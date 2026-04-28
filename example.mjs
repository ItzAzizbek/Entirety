// Entirety — live demo.
//
//   npm install          # installs lodash (devDep) for the demo
//   node example.mjs
//
// Optional: `npm install axios react @mui/material` to unlock those sections.

import Entirety from "./index.js";

const log = (label, value) =>
  console.log(`\x1b[36m${label.padEnd(32)}\x1b[0m`, value);
const section = (title) =>
  console.log(`\n\x1b[1m▸ ${title}\x1b[0m\n${"─".repeat(60)}`);

// ─── 1. Direct chained call ──────────────────────────────────────────
section("1. Direct chained call");
log("Entirety.Lodash.camelCase()", await Entirety.Lodash.camelCase("hello world"));
log("Entirety.Lodash.kebabCase()", await Entirety.Lodash.kebabCase("helloWorld"));
log("Entirety.Lodash.isEqual()", await Entirety.Lodash.isEqual([1, 2], [1, 2]));
log("Entirety.Lodash.sum()", await Entirety.Lodash.sum([1, 2, 3, 4]));

// ─── 2. Await-then-use ───────────────────────────────────────────────
section("2. Await the module, then use synchronously");
const _ = await Entirety.Lodash;
log("typeof _", typeof _);
log("_.capitalize('entirety')", _.capitalize("entirety"));
log("_.range(5)", _.range(5));

// ─── 3. Bonus patterns ───────────────────────────────────────────────
section("3. Bonus patterns");
log(
  "Entirety.Lodash().camelCase()",
  await Entirety.Lodash().camelCase("bonus works")
);
log(
  "Entirety.use('lodash').snakeCase()",
  await Entirety.use("lodash").snakeCase("bonus uses works")
);
log(
  "Entirety('lodash').startCase()",
  await Entirety("lodash").startCase("callable namespace")
);

// ─── 4. Retrieving a reference (no call) ─────────────────────────────
section("4. Retrieving a function reference");
const camelCase = await Entirety.Lodash.camelCase;
log("typeof camelCase", typeof camelCase);
log("camelCase('ref works')", camelCase("ref works"));

// ─── 5. Caching proof ────────────────────────────────────────────────
section("5. Caching (same import resolves to identical module)");
const a = await Entirety.Lodash;
const b = await Entirety.Lodash;
log("a === b", a === b);

// ─── 6. Custom aliases ───────────────────────────────────────────────
section("6. Custom aliases via register / extend");
Entirety.register("Underscore", "lodash");
log("Entirety.aliases", Entirety.aliases);
log(
  "Entirety.Underscore.upperFirst()",
  await Entirety.Underscore.upperFirst("custom alias")
);

// ─── 7. Error messaging ──────────────────────────────────────────────
section("7. Helpful errors");
try {
  Entirety.Foo;
} catch (err) {
  log("Unknown alias →", err.message);
}

try {
  await Entirety.Lodash.definitelyNotARealMethod("x");
} catch (err) {
  log("Bad method →", err.message);
}

// ─── 8. Auto-install on demand ──────────────────────────────────────
section("8. Auto-install on demand");
console.log(
  "   (first run installs a tiny package; set ENTIRETY_NO_INSTALL=1 to disable)\n"
);

// `ms` is ~2KB, zero deps — perfect for a fast auto-install demo.
await tryDemo("Entirety.use('ms')('2 days')  → ms()", async () => {
  return await Entirety.use("ms")("2 days"); // → 172800000
});

// `nanoid` exercises an ESM named export through a fresh install.
await tryDemo("Entirety.use('nanoid').nanoid()", async () => {
  const id = await Entirety.use("nanoid").nanoid();
  return `${id} (len=${id.length})`;
});

// ─── 9. Heavy integrations (same machinery, bigger installs) ─────────
section("9. Heavy integrations (install on first use)");
console.log(
  "   skipped unless ENTIRETY_FULL_DEMO=1  (axios/react/mui are ~60MB together)\n"
);

if (process.env.ENTIRETY_FULL_DEMO === "1") {
  await tryDemo("Entirety.Axios.get('https://api.github.com/zen')", async () => {
    const res = await Entirety.Axios.get("https://api.github.com/zen");
    return res.data;
  });
  await tryDemo("Entirety.React.useState (ref)", async () => {
    return `typeof useState = ${typeof (await Entirety.React.useState)}`;
  });
  await tryDemo("Entirety.MUI.Button (ref)", async () => {
    return `typeof Button = ${typeof (await Entirety.MUI.Button)}`;
  });
} else {
  log("skipped", "set ENTIRETY_FULL_DEMO=1 to run");
}

console.log("\n\x1b[32m✔ demo complete\x1b[0m\n");

async function tryDemo(name, fn) {
  try {
    log(name, await fn());
  } catch (err) {
    log(name, `\x1b[33mskipped — ${err.message.split("\n")[0]}\x1b[0m`);
  }
}
