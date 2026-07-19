/**
 * Loads presentation/.env (gitignored) into process.env so the capture/demo
 * scripts get the demo login without hardcoding credentials in git.
 * Real env vars win over .env values. Create presentation/.env like:
 *   XEFE_EMAIL=demo@xefe.tl
 *   XEFE_PASSWORD=...
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '.env');
try {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
} catch {
  // no .env — fall through to whatever the shell provided
}
