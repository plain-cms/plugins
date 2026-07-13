// Validate the plugins registry. Run: node tools/validate.mjs
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';

let errors = 0;
const fail = (m) => { console.error('✗ ' + m); errors++; };

const registry = JSON.parse(readFileSync('registry.json', 'utf8'));
if (!Array.isArray(registry)) fail('registry.json must be a JSON array');
const ids = new Set();
for (const e of registry) {
  for (const k of ['id', 'title', 'description']) if (!e[k]) fail(`registry entry missing "${k}": ${JSON.stringify(e)}`);
  if (e.runsAt && !['client', 'build', 'both'].includes(e.runsAt)) fail(`registry entry ${e.id}: runsAt must be client|build|both`);
  if (ids.has(e.id)) fail(`duplicate registry id: ${e.id}`);
  ids.add(e.id);
  const dir = e.path || e.id;
  if (!e.repo && !existsSync(`${dir}/plugin.json`)) fail(`registry entry ${e.id}: ${dir}/plugin.json not found`);
}

for (const name of readdirSync('.')) {
  if (name === 'plugin-template' || !statSync(name).isDirectory() || !existsSync(`${name}/plugin.json`)) continue;
  let m;
  try { m = JSON.parse(readFileSync(`${name}/plugin.json`, 'utf8')); }
  catch (err) { fail(`${name}/plugin.json is not valid JSON: ${err.message}`); continue; }
  for (const k of ['name', 'version', 'description']) if (!m[k]) fail(`${name}/plugin.json missing "${k}"`);
  if (m.name !== name) fail(`${name}/plugin.json name "${m.name}" must match folder "${name}"`);
  for (const [kind, file] of Object.entries(m.client || {})) if (!existsSync(`${name}/${file}`)) fail(`${name}: client.${kind} "${file}" declared but missing`);
  if (!ids.has(name)) fail(`plugin "${name}" has no registry.json entry`);
}

if (errors) { console.error(`\n${errors} problem(s).`); process.exit(1); }
console.log(`✓ registry.json + ${ids.size} plugin(s) valid.`);
