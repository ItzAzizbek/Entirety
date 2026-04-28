# entirety

> One package to rule them all — lazy-load (and auto-install) any npm module through a single namespace.

```js
import Entirety from "entirety";

await Entirety.Lodash.camelCase("hello world"); // → "helloWorld"
await Entirety.Axios.get("https://api.example.com"); // → AxiosResponse
const Button = await Entirety.MUI.Button;           // → React component
const useState = await Entirety.React.useState;     // → function
```

No `import { X } from "y"` lines. No bundler glue. Packages load **only** the first time a name is actually used, and are cached thereafter.

---

## Install

```bash
npm install entirety
```

That's it. Entirety ships with **zero runtime dependencies** — every other library is fetched on demand.

### Auto-install (default, v0.3+)

The first time you touch a package that isn't in `node_modules`, Entirety runs your project's package manager for you and retries the import:

```js
// lodash not installed yet:
await Entirety.Lodash.camelCase("hello world");
// [entirety] installing lodash via npm…
// → "helloWorld"
```

- Detects `npm` / `pnpm` / `yarn` / `bun` from `npm_config_user_agent` and lockfiles.
- Finds the nearest `package.json` walking up from `process.cwd()`.
- Installs into that project, so deps self-document as you use them.

### Opt-out & overrides

```bash
ENTIRETY_NO_INSTALL=1  node app.js       # strict mode, error on missing
ENTIRETY_PM=pnpm       node app.js       # force package manager
ENTIRETY_CWD=/srv/app  node app.js       # force install directory
ENTIRETY_SILENT=1      node app.js       # no install output
```

Or from code:

```js
Entirety.configure({ autoInstall: false });
Entirety.configure({ packageManager: "pnpm", silent: true });
console.log(Entirety.config); // { autoInstall, packageManager, installCwd, silent }
```

---

## Quick start

```js
import Entirety from "entirety";

// 1. Direct chained call (the common case)
await Entirety.Lodash.camelCase("hello world");

// 2. Resolve the module, then use it synchronously
const _ = await Entirety.Lodash;
_.isEqual([1, 2], [1, 2]);

// 3. Retrieve a reference without calling it
const useState = await Entirety.React.useState;

// 4. Call the module itself (packages that export a function)
await Entirety.Axios({ url: "/api/user", method: "GET" });

// 5. Reach packages that aren't aliased
await Entirety.use("dayjs");   // equivalent to Entirety.Dayjs after register
await Entirety("dayjs");       // same, shorter
```

---

## API

### `Entirety.<Alias>`

Returns a chainable, awaitable, callable handle for the aliased package. Awaiting it loads the module and resolves to a smart wrapper that prefers `default` and overlays named exports.

### `Entirety.use(nameOrAlias)` / `Entirety(nameOrAlias)`

Reach a package by raw specifier. If the string matches an alias, the alias is used; otherwise the specifier is passed straight to `import()`.

```js
await Entirety.use("dayjs").unix(1700000000).toISOString?.();
await Entirety("nanoid").nanoid();
```

### `Entirety.register(alias, pkg)` / `Entirety.register({ Alias: "pkg", … })`

Add or replace aliases at runtime. `Entirety.extend` is an alias of `register`.

```js
Entirety.register("Day", "dayjs");
Entirety.register({ Zod: "zod", Nano: "nanoid" });
```

### `Entirety.aliases`

Snapshot of the current alias map.

### `Entirety.clearCache()`

Drop every cached `import()` Promise. Mostly useful in tests.

### `Entirety.configure(options)` / `Entirety.config`

Change runtime behaviour. Options (all optional):

| Key              | Type      | Default                   | Effect                                   |
| ---------------- | --------- | ------------------------- | ---------------------------------------- |
| `autoInstall`    | `boolean` | `true`                    | Install missing packages on first access |
| `packageManager` | `string`  | auto-detect               | `"npm" \| "pnpm" \| "yarn" \| "bun"`     |
| `installCwd`     | `string`  | nearest `package.json` up | Where to install                         |
| `silent`         | `boolean` | `false`                   | Suppress installer output                |

`Entirety.config` returns a snapshot of the current settings.

---

## Default aliases

| Namespace | Package         |
| --------- | --------------- |
| `Lodash`  | `lodash`        |
| `Axios`   | `axios`         |
| `React`   | `react`         |
| `MUI`     | `@mui/material` |

Extend with `Entirety.register`.

---

## Run the demo

```bash
git clone <this repo> && cd entirety
npm install           # installs lodash for the demo
node example.mjs
```

Optional, to light up more sections:

```bash
npm install axios react @mui/material
node example.mjs
```

---

## Limitations of the MVP

- **Async everywhere.** ESM `import()` is asynchronous, so top-level access must be `await`ed. Sync use is possible *after* one initial await (`const _ = await Entirety.Lodash; _.foo()`).
- **No autocomplete.** Runtime dispatch is invisible to TypeScript and editor tooling. Planned in v2 via generated `.d.ts`.
- **Node-only.** Bundlers will statically see zero imports and won't include anything. A browser/tree-shaking story is on the roadmap.
- **Alias-level granularity.** Once a package is touched, the whole module graph loads — there is no per-export code splitting at runtime. Build-time transforms (v2) will fix this.
- **Side-effect ordering.** Packages whose import side-effects you rely on will execute at *first access*, not at `import "entirety"`. Usually what you want, occasionally not.
- **First-use install latency.** The first access to a missing package blocks on `npm install` (seconds). Cached thereafter. Pre-install the common ones if this matters, or ship with a warm `node_modules`.
- **Network required for first use.** Offline CI that touches a missing package will fail; pin deps ahead of time or use `ENTIRETY_NO_INSTALL=1`.

---

## Roadmap to v2

- **TypeScript autocomplete.** `npx entirety generate-dts` (or `npm run generate-dts`) generates `entirety-env.d.ts` from the alias map + each package's declarations so `Entirety.Lodash.` shows real suggestions.
- **Build-time transforms** via `entirety/plugin` (Vite/Rollup) for production tree-shaking, preserving DX in dev.
- **Tree shaking.** Per-export splitting that hands bundlers exactly the references used.
- **Browser support.** A drop-in `#loader` subpath export for bundlers makes Entirety work without a Node resolver natively in the browser.
- **Alias bundles.** Curated bundles like `ReactKit`, `DataScience` available in `entirety/bundles`.
- **~~Auto-install.~~** Shipped in v0.3.

---

## License

MIT
