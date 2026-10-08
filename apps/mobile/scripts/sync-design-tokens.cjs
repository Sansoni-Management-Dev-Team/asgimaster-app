/* global __dirname */
const fs = require('node:fs');
const path = require('node:path');

// CSS remains the source of truth. Native code cannot read CSS variables at runtime.
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'design-system/tokens.css'), 'utf8');
const raw = Object.fromEntries(
  [...source.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].map(([, key, value]) => [key, value.trim()]),
);
function resolve(key, parents = []) {
  if (!(key in raw) || parents.includes(key)) throw new Error(`Invalid design token: ${key}`);
  return raw[key].replace(/var\(--([\w-]+)\)/g, (_, next) => resolve(next, [...parents, key]));
}
const tokens = Object.fromEntries(Object.keys(raw).map((key) => [key, resolve(key)]));
const output = `${JSON.stringify(tokens, null, 2)}\n`;
const destination = path.join(root, 'src/theme/tokens.generated.json');
if (process.argv.includes('--check')) {
  if (!fs.existsSync(destination) || fs.readFileSync(destination, 'utf8') !== output) {
    throw new Error('Native tokens are out of date. Run npm run tokens:sync.');
  }
} else {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, output);
}
