// Regenerates the Laravel seeder payload from the frontend's seed constants.
//
// apps/web/lib/dashboard.ts stays the single source of truth for the demo
// dataset; this transpiles it, reads the SEED_* exports, and writes them to
// apps/api/database/seeders/data/seed.json. Run with `npm run seed:sync`.

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const ts = require("typescript");
const source = readFileSync(join(root, "apps/web/lib/dashboard.ts"), "utf8");

const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
});

// Eval via a throwaway CommonJS file so the exports can be required directly.
const scratch = join(tmpdir(), `scm-seed-${process.pid}.cjs`);
writeFileSync(scratch, outputText);

let seed;
try {
  const mod = require(scratch);
  seed = {
    users: mod.SEED_USERS,
    categories: mod.SEED_CATEGORIES,
    skus: mod.SEED_SKUS,
  };
} finally {
  rmSync(scratch, { force: true });
}

for (const [key, value] of Object.entries(seed)) {
  if (!value) throw new Error(`lib/dashboard.ts is missing the SEED export for "${key}"`);
}

const target = join(root, "apps/api/database/seeders/data/seed.json");
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, `${JSON.stringify(seed, null, 2)}\n`);

const batches = seed.skus.reduce((total, sku) => total + sku.batches.length, 0);
console.log(
  `Wrote ${target}\n  users=${seed.users.length} categories=${Object.keys(seed.categories).length} skus=${seed.skus.length} batches=${batches}`
);
