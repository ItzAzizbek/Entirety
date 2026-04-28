// The LazyModule proxy — a chainable, awaitable, callable placeholder
// for a module that has not been imported yet.
//
// A single Proxy covers three shapes at once:
//   • Object-like:  Entirety.Lodash.camelCase
//   • Thenable:     await Entirety.Lodash
//   • Callable:     Entirety.Axios(config)  |  Entirety.Lodash.camelCase('hi')
//
// The target is a function so the `apply` trap is reachable; the function
// itself is never executed.

import { loadPackage, navigate, unwrapModule } from "#loader";

const INTERNAL = Symbol("entirety.internal");

/** Resolve the value addressed by (pkg, path). */
function resolveLazy(pkgName, path) {
  return loadPackage(pkgName).then((mod) =>
    path.length === 0 ? unwrapModule(mod) : navigate(mod, path)
  );
}

/** Build a human-readable label for errors and inspection. */
function label(pkgName, path) {
  return path.length === 0 ? pkgName : `${pkgName}.${path.join(".")}`;
}

export function createLazy(pkgName, path = []) {
  // The target must be a function for `apply` to fire. It is never invoked.
  const target = function entiretyLazyTarget() {};

  return new Proxy(target, {
    get(_, prop) {
      // Own internal handle, used by tests and debugging.
      if (prop === INTERNAL) return { pkgName, path };

      // --- Promise interface: make the proxy awaitable ---------------------
      // `then` must be handled BEFORE recursion, otherwise `await` would
      // extend the path with 'then' and hang.
      if (prop === "then") {
        const p = resolveLazy(pkgName, path);
        return p.then.bind(p);
      }
      if (prop === "catch") {
        const p = resolveLazy(pkgName, path);
        return p.catch.bind(p);
      }
      if (prop === "finally") {
        const p = resolveLazy(pkgName, path);
        return p.finally.bind(p);
      }

      // --- Symbols & inspection -------------------------------------------
      // Never feed engine-internal symbol lookups (toPrimitive, iterator,
      // util.inspect.custom, ...) into the module — that would force a load
      // just because something tried to stringify the proxy.
      if (typeof prop === "symbol") {
        if (prop === Symbol.toStringTag) return `Lazy(${label(pkgName, path)})`;
        return undefined;
      }

      // --- Recursive proxying ---------------------------------------------
      return createLazy(pkgName, [...path, prop]);
    },

    apply(_, thisArg, args) {
      // Priming call: `Entirety.Lodash()` with no args stays chainable so
      // the bonus pattern `Entirety.Lodash().camelCase('hi')` works.
      if (path.length === 0 && args.length === 0) {
        return createLazy(pkgName, []);
      }

      return loadPackage(pkgName).then((mod) => {
        // Case 1: calling the module itself (e.g. axios(config)).
        if (path.length === 0) {
          const callable =
            typeof mod === "function"
              ? mod
              : typeof mod?.default === "function"
              ? mod.default
              : null;
          if (!callable) {
            throw new TypeError(
              `Entirety: '${pkgName}' is not callable. ` +
                `Access a named export instead, e.g. Entirety.${pkgName}.method(...).`
            );
          }
          return callable.apply(undefined, args);
        }

        // Case 2: calling a leaf function at `mod.a.b.c`.
        const parent = navigate(mod, path.slice(0, -1));
        const key = path[path.length - 1];

        let fn, ctx;
        if (parent != null && parent[key] !== undefined) {
          fn = parent[key];
          ctx = parent;
        } else if (
          parent != null &&
          typeof parent === "object" &&
          parent.default != null &&
          parent.default[key] !== undefined
        ) {
          fn = parent.default[key];
          ctx = parent.default;
        }

        if (typeof fn !== "function") {
          throw new TypeError(
            `Entirety: '${label(pkgName, path)}' is not a function` +
              (fn === undefined ? " (property not found)." : ".")
          );
        }
        return fn.apply(ctx, args);
      });
    },

    has(_, prop) {
      // Pretend every key is present — the real check happens on await.
      return prop !== INTERNAL && typeof prop !== "symbol";
    },
  });
}

export { INTERNAL };
