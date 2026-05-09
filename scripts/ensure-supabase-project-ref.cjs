/**
 * Garante supabase/.temp/project-ref para o CLI (db push --linked) sem rodar link interativo.
 * Lê project_id de supabase/config.toml.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const configPath = path.join(root, 'supabase', 'config.toml');
const outDir = path.join(root, 'supabase', '.temp');
const outFile = path.join(outDir, 'project-ref');

const raw = fs.readFileSync(configPath, 'utf8');
const m = raw.match(/project_id\s*=\s*"([^"]+)"/);
if (!m) {
  console.error('ensure-supabase-project-ref: project_id não encontrado em', configPath);
  process.exit(1);
}
const ref = m[1].trim();
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, ref + '\n', 'utf8');
console.log('ensure-supabase-project-ref: escrito', outFile);
