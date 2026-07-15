import assert from 'node:assert/strict';
import fs from 'node:fs';

const browserFiles = ['terminal/live.html', 'terminal/live.js', 'terminal/live.css'];
for (const path of browserFiles) {
  const text = fs.readFileSync(path, 'utf8');
  assert.equal(/HL_API_SECRET_KEY|api_secret_key|PASTE_API_WALLET_PRIVATE_KEY/.test(text), false, `${path} must not contain secret names or placeholders`);
}

const server = fs.readFileSync('live/server.py', 'utf8');
const config = fs.readFileSync('live/config.py', 'utf8');
assert.match(server, /ThreadingHTTPServer\(\(config\.host, config\.port\)/);
assert.match(server, /no-store/);
assert.match(config, /host="127\.0\.0\.1"/);
assert.match(config, /Unsafe permissions/);

const setup = fs.readFileSync('scripts/setup-galka-live.sh', 'utf8');
assert.match(setup, /chmod 600/);
assert.match(setup, /HL_ACCOUNT_ADDRESS/);
assert.match(setup, /HL_API_SECRET_KEY/);

const gitignore = fs.readFileSync('.gitignore', 'utf8');
assert.match(gitignore, /\*\.env/);
assert.match(gitignore, /\.venv-live/);

console.log('Live secret isolation contract passed');
