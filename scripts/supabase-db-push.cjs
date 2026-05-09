/**
 * db push com token: variável SUPABASE_ACCESS_TOKEN, secrets/supabase-access-token ou .env
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');

function parseEnvFile(content) {
  const out = {};
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function resolveAccessToken() {
  const fromEnv = process.env.SUPABASE_ACCESS_TOKEN;
  if (fromEnv && String(fromEnv).trim()) return String(fromEnv).trim();

  // cli-access-token: ficheiro alternativo quando "supabase-access-token" e uma pasta bloqueada no Windows
  const secretCandidates = [
    path.join(root, 'secrets', 'cli-access-token'),
    path.join(root, 'secrets', 'supabase-access-token'),
    path.join(root, 'secrets', 'supabase-access-token.txt'),
  ];
  for (const secretsFile of secretCandidates) {
    if (!fs.existsSync(secretsFile)) continue;
    const st = fs.statSync(secretsFile);
    if (st.isFile()) {
      const t = fs.readFileSync(secretsFile, 'utf8').trim();
      if (t) return t;
    }
    // Pasta por engano: secrets/supabase-access-token/arquivo
    if (st.isDirectory()) {
      const names = fs.readdirSync(secretsFile);
      const files = names.filter((n) =>
        fs.statSync(path.join(secretsFile, n)).isFile()
      );
      if (files.length >= 1) {
        const t = fs
          .readFileSync(path.join(secretsFile, files[0]), 'utf8')
          .trim();
        if (t) return t;
      }
    }
  }

  const envPath = path.join(root, '.env');
  if (fs.existsSync(envPath)) {
    const dot = parseEnvFile(fs.readFileSync(envPath, 'utf8'));
    if (dot.SUPABASE_ACCESS_TOKEN && String(dot.SUPABASE_ACCESS_TOKEN).trim()) {
      return String(dot.SUPABASE_ACCESS_TOKEN).trim();
    }
  }

  return null;
}

const token = resolveAccessToken();
if (!token) {
  console.error(
    'supabase-db-push: defina o token em SUPABASE_ACCESS_TOKEN, em secrets/supabase-access-token ou em .env (SUPABASE_ACCESS_TOKEN).'
  );
  process.exit(1);
}

const ensure = spawnSync(process.execPath, [path.join(__dirname, 'ensure-supabase-project-ref.cjs')], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, SUPABASE_ACCESS_TOKEN: token },
});
if (ensure.status !== 0) process.exit(ensure.status ?? 1);

const push = spawnSync('pnpm', ['dlx', 'supabase', 'db', 'push', '--linked'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, SUPABASE_ACCESS_TOKEN: token },
});

process.exit(push.status ?? 1);
