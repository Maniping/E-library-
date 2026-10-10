import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'dist');

if (existsSync(output)) rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

for (const file of ['index.html', 'api-config.js', 'src']) {
  cpSync(resolve(root, file), resolve(output, file), { recursive: true });
}

writeFileSync(
  resolve(output, 'api-config.js'),
  "window.UV_API_BASE = 'https://elibtoledo-backend.onrender.com';\nwindow.UV_DEMO_LOGIN_ENABLED = false;\n"
);

const publicDirectory = resolve(root, 'public');
if (existsSync(publicDirectory)) {
  for (const file of readdirSync(publicDirectory)) {
    cpSync(resolve(publicDirectory, file), resolve(output, file), { recursive: true });
  }
}
