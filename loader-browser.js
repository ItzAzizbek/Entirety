import { aliases } from "./aliases.js";

const cache = new Map();

const config = {
  autoInstall: false,
  packageManager: null,
  installCwd: null,
  silent: true,
};

export function configure(opts) {
  if (!opts || typeof opts !== "object") {
    throw new TypeError("Entirety.configure expects an options object.");
  }
  Object.assign(config, opts);
  return { ...config };
}

export function getConfig() {
  return { ...config };
}

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

export function resolveAlias(name) {
  return aliases[name];
}

export function loadPackage(pkgName) {
  const cached = cache.get(pkgName);
  if (cached) return cached;

  const promise = (async () => {
    try {
      return await import(pkgName);
    } catch (err) {
      throw new Error(`Entirety: Failed to import '${pkgName}' in browser environment. Please make sure the package is bundled or accessible. Error: ${err.message}`);
    }
  })();

  cache.set(pkgName, promise);
  return promise;
}

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

export function clearCache() {
  cache.clear();
}
