import { build } from 'esbuild';
import { mkdir, readFile, writeFile, copyFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const angularDirectory = path.resolve('.build/angular/browser');
const outputDirectory = path.resolve('dist/siq-small-editor');
const assetsDirectory = path.join(outputDirectory, 'src');
await mkdir(assetsDirectory, { recursive: true });

// Обычная сборка Angular использует ES-модули, которые Chrome блокирует при file://.
// AOT-код и полифиллы объединяются в обычный script без import и сетевых запросов.
await build({
  stdin: {
    contents: "import './polyfills.js'; import './main.js';",
    resolveDir: angularDirectory,
    sourcefile: 'portable-entry.js',
  },
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['chrome120'],
  minify: true,
  legalComments: 'eof',
  outfile: path.join(assetsDirectory, 'app.js'),
});

await copyFile(path.join(angularDirectory, 'styles.css'), path.join(assetsDirectory, 'styles.css'));

let html = await readFile('src/index.html', 'utf8');
html = html.replace('</head>', '  <link rel="stylesheet" href="./src/styles.css">\n  </head>');
html = html.replace('</body>', '  <script defer src="./src/app.js"></script>\n  </body>');
await writeFile(path.join(outputDirectory, 'index.html'), html);

// Сохраняем локальные ресурсы CSS, если зависимости начнут их добавлять.
async function copyTree(source, destination) {
  await mkdir(destination, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) await copyTree(from, to);
    else await copyFile(from, to);
  }
}
const assets = await readdir(angularDirectory, { withFileTypes: true });
for (const entry of assets.filter((entry) => entry.isDirectory())) {
  // src/assets уже имеет нужный путь относительно index.html.
  const destination = entry.name === 'src' ? assetsDirectory : path.join(assetsDirectory, entry.name);
  await copyTree(path.join(angularDirectory, entry.name), destination);
}
await copyFile('.build/angular/3rdpartylicenses.txt', path.join(assetsDirectory, 'licenses.txt'));
console.log(`Готово: ${path.join(outputDirectory, 'index.html')}`);
