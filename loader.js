// Module loading, caching, path navigation, and auto-install.
//
// The cache stores the Promise returned by `import()` — not the resolved
// module — so concurrent accesses de-duplicate naturally and the load
// (plus any on-demand install) happens exactly once per package.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { aliases } from "./aliases.js";

const cache = new Map();

// ─── Auto-install configuration ──────────────────────────────────────────
//
// Everything is opt-out. `ENTIRETY_NO_INSTALL=1` disables, any other env
// var is a soft hint. `Entirety.configure({...})` takes precedence.

const config = {
  autoInstall: process.env.ENTIRETY_NO_INSTALL !== "1",
  packageManager: process.env.ENTIRETY_PM || null, // auto-detect if null
  installCwd: process.env.ENTIRETY_CWD || null,    // auto-detect if null
  silent: process.env.ENTIRETY_SILENT === "1",
};

/** Override any of { autoInstall, packageManager, installCwd, silent }. */
export function configure(opts) {
  if (!opts || typeof opts !== "object") {
    throw new TypeError("Entirety.configure expects an options object.");
  }
  Object.assign(config, opts);
  return { ...config };
}

/** Read the current effective configuration. */
export function getConfig() {
  return { ...config };
}

// ─── Package manager detection ───────────────────────────────────────────

function findProjectRoot(startDir) {
  let dir = resolve(startDir || process.cwd());
  while (true) {
    if (existsSync(join(dir, "package.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function detectPackageManager(root) {
  if (config.packageManager) return config.packageManager;
  // Respect npm_config_user_agent first (set by whichever pm invoked Node).
  const ua = process.env.npm_config_user_agent || "";
  if (ua.startsWith("pnpm")) return "pnpm";
  if (ua.startsWith("yarn")) return "yarn";
  if (ua.startsWith("bun")) return "bun";
  if (ua.startsWith("npm")) return "npm";
  // Fall back to lockfile sniffing.
  if (existsSync(join(root, "bun.lockb"))) return "bun";
  if (existsSync(join(root, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(root, "yarn.lock"))) return "yarn";
  return "npm";
}

function installInvocation(pm, pkg) {
  switch (pm) {
    case "yarn": return ["yarn", ["add", pkg]];
    case "pnpm": return ["pnpm", ["add", pkg]];
    case "bun":  return ["bun",  ["add", pkg]];
    default:     return ["npm",  ["install", pkg, "--no-fund", "--no-audit"]];
  }
}

function installPackage(pkgName) {
  const root = config.installCwd || findProjectRoot();
  if (!root) {
    throw new Error(
      `Entirety: cannot auto-install '${pkgName}' — no package.json found ` +
        `in '${process.cwd()}' or any parent. Run 'npm init -y' first, or ` +
        `set ENTIRETY_NO_INSTALL=1 to require manual installs.`
    );
  }
  const pm = detectPackageManager(root);
  const [cmd, args] = installInvocation(pm, pkgName);

  if (!config.silent) {
    process.stderr.write(
      `\x1b[36m[entirety] installing ${pkgName} via ${pm}…\x1b[0m\n`
    );
  }

  return new Promise((resolveP, rejectP) => {
    const child = spawn(cmd, args, {
      cwd: root,
      stdio: config.silent ? "ignore" : "inherit",
      shell: process.platform === "win32",
    });
    child.on("error", (err) => {
      rejectP(
        new Error(
          `Entirety: failed to spawn '${cmd}'. Is ${pm} installed and on PATH? (${err.message})`
        )
      );
    });
    child.on("exit", (code) => {
      if (code === 0) resolveP();
      else
        rejectP(
          new Error(
            `Entirety: ${pm} exited with code ${code} while installing '${pkgName}'.`
          )
        );
    });
  });
}

/** Register a single alias, or merge a record of aliases. */
export function registerAlias(nameOrMap, pkg) {
  if (nameOrMap && typeof nameOrMap === "object") {
    for (const [k, v] of Object.entries(nameOrMap)) {
      if (typeof v !== "string") {
        throw new TypeError(
          `Entirety.register: alias '${k}' must map to a string, got ${typeof v}.`
        );
      }
      aliases[k] = v;
    }
    return;
  }
  if (typeof nameOrMap !== "string" || typeof pkg !== "string") {
    throw new TypeError(
      "Entirety.register(name, pkg) expects two strings, or a single object."
    );
  }
  aliases[nameOrMap] = pkg;
}

/** Return the raw npm specifier for an alias, or undefined. */
export function resolveAlias(name) {
  return aliases[name];
}

/**
 * Load a package by specifier. Returns the same Promise on repeat calls.
 *
 * On ERR_MODULE_NOT_FOUND we shell out to the project's package manager,
 * install the package, and retry `import()` once. Set `autoInstall:false`
 * (or ENTIRETY_NO_INSTALL=1) to restore strict behaviour.
 */
export function loadPackage(pkgName) {
  const cached = cache.get(pkgName);
  if (cached) return cached;

  const promise = (async () => {
    try {
      return await import(pkgName);
    } catch (err) {
      const code = err && err.code;
      const missing =
        code === "ERR_MODULE_NOT_FOUND" || code === "MODULE_NOT_FOUND";
      if (!missing) throw err;

      if (!config.autoInstall) {
        const hint = new Error(
          `Entirety: package '${pkgName}' is not installed.\n` +
            `  Install it with:  npm install ${pkgName}\n` +
            `  Or enable auto-install (remove ENTIRETY_NO_INSTALL from the env).`
        );
        hint.code = code;
        hint.cause = err;
        throw hint;
      }

      await installPackage(pkgName);
      return await import(pkgName);
    }
  })().catch((err) => {
    // Allow a future call to retry (e.g. after the user fixes permissions).
    cache.delete(pkgName);
    throw err;
  });

  cache.set(pkgName, promise);
  return promise;
}

/**
 * Walk a property path on a module, falling back to `.default` at each
 * level when the direct lookup is undefined. Handles the common CJS/ESM
 * interop case where named exports live on either the namespace or
 * on `module.default`.
 */
export function navigate(mod, path) {
  let cur = mod;
  for (const key of path) {
    if (cur == null) return undefined;
    const direct = cur[key];
    if (direct !== undefined) {
      cur = direct;
    } else if (
      typeof cur === "object" &&
      cur.default != null &&
      cur.default[key] !== undefined
    ) {
      cur = cur.default[key];
    } else {
      return undefined;
    }
  }
  return cur;
}

/**
 * Unwrap a module namespace for `await Entirety.X`.
 *
 * The native ESM namespace exposes named exports plus a `default` key,
 * but for CJS interop the named exports are often missing — yet users
 * still expect `(await Entirety.Lodash).camelCase(...)` to work.
 *
 * We return a Proxy view that:
 *   • uses `mod.default` as its base (so the result is callable when the
 *     default is a function — axios, lodash `_`, …),
 *   • overlays the namespace's own named exports on top so ESM-style
 *     packages keep their public surface,
 *   • degrades to the raw namespace when there is no default.
 */
const unwrapCache = new WeakMap();

export function unwrapModule(mod) {
  if (mod == null || typeof mod !== "object") return mod;

  const cached = unwrapCache.get(mod);
  if (cached !== undefined) return cached;

  let result = mod;
  if ("default" in mod) {
    const def = mod.default;
    if (def == null) {
      result = mod;
    } else if (typeof def !== "object" && typeof def !== "function") {
      result = def;
    } else {
      result = new Proxy(def, {
        get(target, prop, receiver) {
          if (prop !== "default" && prop in mod) {
            const named = mod[prop];
            if (named !== undefined) return named;
          }
          return Reflect.get(target, prop, receiver);
        },
        has(target, prop) {
          return prop in mod || Reflect.has(target, prop);
        },
      });
    }
  }
  unwrapCache.set(mod, result);
  return result;
}

/** Drop every cached import. Primarily useful in tests. */
export function clearCache() {
  cache.clear();
}
