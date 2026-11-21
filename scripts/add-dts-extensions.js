/**
 * The package is `"type": "module"`, so under `moduleResolution: node16/nodenext`
 * TypeScript requires explicit file extensions on relative imports in its
 * `.d.ts` files. `tsc` keeps the extensionless specifiers from the sources, so
 * this rewrites them after the declarations are emitted:
 *
 *   './Modal/Modal'   -> './Modal/Modal.js'
 *   './themes/tokens' -> './themes/tokens/index.js'
 *
 * `.js` specifiers resolve to the sibling `.d.ts` under every module
 * resolution mode, so `bundler` and `node` keep working.
 */
const path = require('path');
const fs = require('fs');

const typesDir = path.resolve(process.argv[2] || './dist/types');

const specifierPattern =
  /(\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)(['"])(\.{1,2}\/[^'"]*)\2/g;

function withExtension(file, specifier) {
  if (/\.(c|m)?js$/.test(specifier)) return specifier;

  const target = path.resolve(path.dirname(file), specifier);
  if (fs.existsSync(`${target}.d.ts`)) return `${specifier}.js`;
  if (fs.existsSync(path.join(target, 'index.d.ts'))) {
    return `${specifier.replace(/\/$/, '')}/index.js`;
  }
  // Assets such as './imgs/foo.png' are typed by wildcard module declarations
  if (/\.[a-z0-9]+$/i.test(specifier)) return specifier;

  throw new Error(`Cannot resolve '${specifier}' imported from ${file}`);
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(entryPath);
    return entry.name.endsWith('.d.ts') ? [entryPath] : [];
  });
}

let count = 0;
for (const file of walk(typesDir)) {
  const source = fs.readFileSync(file, 'utf8');
  const output = source.replace(
    specifierPattern,
    (match, prefix, quote, specifier) => {
      const rewritten = withExtension(file, specifier);
      if (rewritten === specifier) return match;
      count += 1;
      return `${prefix}${quote}${rewritten}${quote}`;
    },
  );
  if (output !== source) fs.writeFileSync(file, output, 'utf8');
}

console.log(`Added extensions to ${count} relative imports in ${typesDir}`);
