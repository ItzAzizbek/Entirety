// Entirety — one package, every library.
//
// The default export is a Proxy that routes property access to lazily
// imported npm packages via the alias map in `aliases.js`.

import { aliases } from "./aliases.js";
import { createLazy } from "./lazy.js";
import { registerAlias, clearCache, configure, getConfig } from "#loader";

const RESERVED = new Set([
  "use",
  "register",
  "extend",
  "aliases",
  "clearCache",
  "configure",
  "config",
]);

function buildLazyFromNameOrPkg(nameOrPkg) {
  if (typeof nameOrPkg !== "string" || nameOrPkg.length === 0) {
    throw new TypeError(
      "Entirety.use / Entirety(): expected a non-empty package name or alias."
    );
  }
  // If it matches a known alias, resolve through it; otherwise treat it as
  // a raw npm specifier so users can reach packages they haven't aliased.
  const pkg = Object.prototype.hasOwnProperty.call(aliases, nameOrPkg)
    ? aliases[nameOrPkg]
    : nameOrPkg;
  return createLazy(pkg, []);
}

function createRoot() {
  // Function target — lets users call `Entirety('lodash')` as a shortcut
  // for `Entirety.use('lodash')`.
  const target = function Entirety() {};

  return new Proxy(target, {
    apply(_, __, args) {
      return buildLazyFromNameOrPkg(args[0]);
    },

    get(_, prop) {
      // Symbols never reach the alias map — keeps inspection side-effect free.
      if (typeof prop === "symbol") {
        if (prop === Symbol.toStringTag) return "Entirety";
        return undefined;
      }

      // Entirety itself is NOT a Promise. Returning undefined here ensures
      // `await Entirety` does not hang on `.then` lookup.
      if (prop === "then" || prop === "catch" || prop === "finally") {
        return undefined;
      }

      // --- Public API ------------------------------------------------------
      if (prop === "use") return buildLazyFromNameOrPkg;

      if (prop === "register" || prop === "extend") {
        return (nameOrMap, pkg) => registerAlias(nameOrMap, pkg);
      }

      if (prop === "aliases") {
        // Return a snapshot so callers can't mutate the internal map.
        return { ...aliases };
      }

      if (prop === "clearCache") return clearCache;

      if (prop === "configure") return configure;

      if (prop === "config") return getConfig();

      // --- Alias dispatch --------------------------------------------------
      if (!Object.prototype.hasOwnProperty.call(aliases, prop)) {
        const known = Object.keys(aliases).join(", ") || "(none)";
        throw new Error(
          `Entirety package alias '${String(prop)}' is not configured. ` +
            `Known aliases: ${known}. ` +
            `Use Entirety.register('${String(prop)}', 'npm-package') ` +
            `or Entirety.use('npm-package') to reach it directly.`
        );
      }
      return createLazy(aliases[prop], []);
    },

    has(_, prop) {
      if (typeof prop === "symbol") return false;
      return (
        Object.prototype.hasOwnProperty.call(aliases, prop) || RESERVED.has(prop)
      );
    },

    ownKeys() {
      return Object.keys(aliases);
    },

    getOwnPropertyDescriptor(_, prop) {
      if (typeof prop === "symbol") return undefined;
      if (Object.prototype.hasOwnProperty.call(aliases, prop)) {
        return {
          enumerable: true,
          configurable: true,
          writable: false,
          value: createLazy(aliases[prop], []),
        };
      }
      return undefined;
    },
  });
}

const Entirety = createRoot();

export default Entirety;
export { registerAlias, aliases };
