import MagicString from "magic-string";
import { aliases as defaultAliases } from "./aliases.js";

/**
 * Vite / Rollup plugin for Entirety build-time transforms and tree-shaking.
 * Converts dynamic `await Entirety.Alias.method()` calls into static ES imports.
 */
export default function entiretyPlugin(options = {}) {
  const aliases = { ...defaultAliases, ...(options.aliases || {}) };

  return {
    name: "vite-plugin-entirety",
    enforce: "pre",
    transform(code, id) {
      // Fast path: skip files without Entirety
      if (!code.includes("Entirety")) return null;

      const s = new MagicString(code);
      let modified = false;

      // Map of package -> Set of named exports to import
      const namedImports = new Map();
      // Map of package -> auto-generated namespace identifier
      const namespaceImports = new Map();

      function addNamedImport(pkg, name) {
        if (!namedImports.has(pkg)) namedImports.set(pkg, new Set());
        namedImports.get(pkg).add(name);
      }

      function getNamespaceImport(pkg) {
        if (!namespaceImports.has(pkg)) {
          const id = `__entirety_${pkg.replace(/[^a-zA-Z0-9]/g, "_")}`;
          namespaceImports.set(pkg, id);
        }
        return namespaceImports.get(pkg);
      }

      // 1. Transform: await Entirety.Alias.method
      const methodRegex = /await\s+Entirety\.([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)/g;
      for (const match of code.matchAll(methodRegex)) {
        const [fullMatch, alias, method] = match;
        const pkg = aliases[alias] || alias;
        if (!namedImports.has(pkg)) namedImports.set(pkg, new Set());
        namedImports.get(pkg).add(method);
        modified = true;
        s.overwrite(match.index, match.index + fullMatch.length, method);
      }

      // 2. Transform: await Entirety.use('pkg').method
      const useMethodRegex = /await\s+Entirety(?:\.use)?\(['"]([^'"]+)['"]\)\.([A-Za-z0-9_]+)/g;
      for (const match of code.matchAll(useMethodRegex)) {
        const [fullMatch, pkg, method] = match;
        if (!namedImports.has(pkg)) namedImports.set(pkg, new Set());
        namedImports.get(pkg).add(method);
        modified = true;
        s.overwrite(match.index, match.index + fullMatch.length, method);
      }

      // 3. Transform: await Entirety.Alias (namespace fetch)
      // Matches: await Entirety.Lodash  but NOT  await Entirety.Lodash.method  AND NOT  await Entirety.Lodash(
      const namespaceRegex = /await\s+Entirety\.([A-Za-z0-9_]+)(?!\(|\.)/g;
      for (const match of code.matchAll(namespaceRegex)) {
        const [fullMatch, alias] = match;
        const pkg = aliases[alias] || alias;
        const id = getNamespaceImport(pkg);
        modified = true;
        s.overwrite(match.index, match.index + fullMatch.length, id);
      }

      // 4. Transform: await Entirety.use('pkg') (namespace fetch)
      const useNamespaceRegex = /await\s+Entirety(?:\.use)?\(['"]([^'"]+)['"]\)(?!\.)/g;
      for (const match of code.matchAll(useNamespaceRegex)) {
        const [fullMatch, pkg] = match;
        const id = getNamespaceImport(pkg);
        modified = true;
        s.overwrite(match.index, match.index + fullMatch.length, id);
      }

      // 5. Transform: import Entirety from "entirety"
      // If we completely removed all Entirety usages, we could remove the import,
      // but keeping it is harmless as tree-shaking will drop it if unused.

      if (!modified) return null;

      // Prepend the static imports
      let importsText = "";

      for (const [pkg, names] of namedImports.entries()) {
        const sorted = Array.from(names).sort();
        importsText += `import { ${sorted.join(", ")} } from "${pkg}";\n`;
      }

      for (const [pkg, id] of namespaceImports.entries()) {
        // We use import * as ... because it handles both CJS and ESM gracefully in most bundlers
        importsText += `import * as ${id} from "${pkg}";\n`;
      }

      s.prepend(importsText);

      return {
        code: s.toString(),
        map: s.generateMap({ source: id, includeContent: true }),
      };
    },
  };
}
