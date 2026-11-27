// Writes the security rule (Content Security Policy) into index.html: scripts only from this site plus the page's own
// inline scripts (the import map), by fingerprint; nothing may be loaded from or sent to anywhere else.
// bump-version.sh runs it after stamping the version (the import map changes, so its fingerprint does too).
import fs from 'node:fs';
import crypto from 'node:crypto';
const file = new URL('../index.html', import.meta.url);
let html = fs.readFileSync(file, 'utf8');
const hashes = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => `'sha256-${crypto.createHash('sha256').update(m[1].replace(/\r\n?/g, '\n'), 'utf8').digest('base64')}'`);
const policy = ["default-src 'self'", `script-src 'self' ${hashes.join(' ')}`, "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:", "connect-src 'self' data: blob:", "worker-src 'self' blob:", "object-src 'none'", "base-uri 'self'", "form-action 'self'"].join('; ');
const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}">`;
html = /<meta http-equiv="Content-Security-Policy"[^>]*>/.test(html) ? html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, meta) : html.replace(/(<meta charset="[^"]*"\s*\/?>)/i,`$1\n  ${meta}`);
fs.writeFileSync(file, html);
console.log('security rule written');
