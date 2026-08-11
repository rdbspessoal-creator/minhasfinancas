// Gera assistente-financeiro.html: uma versão do app em um único arquivo,
// com CSS, Chart.js, pdf.js (+worker) e todo o código embutidos em base64.
// Funciona só de dar duplo-clique (file://), sem precisar de servidor.
//
// Uso: node scripts/build-standalone.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const readBin = (p) => fs.readFileSync(path.join(ROOT, p));

// --- strip import/export syntax from my own ES modules, in dependency order ---
function stripModuleSyntax(src) {
  return src
    // imports podem ter chaves em várias linhas (ex.: import {\n a,\n b,\n} from '...';)
    .replace(/^import\s+[\s\S]*?from\s+['"][^'"]*['"];?\s*$/gm, '')
    .replace(/^export\s+(async\s+function|function|const|class)/gm, '$1')
    .replace(/^export\s*\{[^}]*\};?\s*$/gm, '');
}

const files = [
  'js/util.js',
  'js/categories.js',
  'js/categorize.js',
  'js/store.js',
  'js/charts.js',
  'js/pdf-extract.js',
  'js/parsers/parse-extrato.js',
  'js/parsers/parse-fatura.js',
  'js/import.js',
  'js/app.js',
];

let appBundle = files.map(f => `// ---- ${f} ----\n` + stripModuleSyntax(read(f))).join('\n\n');

// pdf-extract.js used `import * as pdfjsLib from '../vendor/pdfjs/pdf.min.mjs'` (already stripped above)
// and set GlobalWorkerOptions from a relative URL. Replace that with the blob-based setup
// that the bootstrap section prepares into a shared `pdfjsLib` + `PDFJS_WORKER_BLOB_URL`.
appBundle = appBundle.replace(
  /pdfjsLib\.GlobalWorkerOptions\.workerSrc =\s*\n?\s*new URL\([^)]*\)\.href;/,
  'pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_BLOB_URL;'
);

// store.js exposes everything as top-level functions/consts after stripping `export`;
// app.js calls them via `store.xxx(...)`. Rebuild that namespace object.
const storeExports = [
  'getState', 'getTransactions', 'getMonthKeys', 'getTransactionsForMonth',
  'addTransaction', 'addTransactions', 'updateTransaction', 'deleteTransaction',
  'deleteTransactions', 'classifyPreview', 'addCustomRule', 'removeCustomRule',
  'categoryLabel', 'exportBackup', 'importBackup', 'clearAllData', 'findDuplicate',
  'subscribe',
];
appBundle = appBundle.replace(
  '// ---- js/charts.js ----',
  `const store = { ${storeExports.join(', ')} };\n\n// ---- js/charts.js ----`
);

const css = read('css/styles.css');
const chartJs = readBin('vendor/chartjs/chart.umd.min.js').toString('base64');
const pdfjsLib = readBin('vendor/pdfjs/pdf.min.mjs').toString('base64');
const pdfjsWorker = readBin('vendor/pdfjs/pdf.worker.min.mjs').toString('base64');

// --- body: reuse index.html's body markup verbatim ---
const indexHtml = read('index.html');
const bodyMatch = /<body>([\s\S]*)<\/body>/.exec(indexHtml);
let body = bodyMatch[1];
// remove the two script tags at the end (chart.js src + app.js module) — replaced by the bootstrap below
body = body.replace(/<script src="vendor\/chartjs\/chart\.umd\.min\.js"><\/script>\s*/, '');
body = body.replace(/<script type="module" src="js\/app\.js"><\/script>\s*/, '');

// greedy: a tag do favicon é uma URI de dados com "<svg ...>" embutido, ou
// seja, contém um ">" no MEIO do atributo href — precisamos do ÚLTIMO ">" da
// linha (fim real da tag), não do primeiro.
const iconMatch = /<link rel="icon".*>/.exec(indexHtml);

const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Assistente Financeiro</title>
${iconMatch[0]}
<style>
${css}
</style>
</head>
<body>
${body}
<script type="text/plain" id="b64-chartjs">${chartJs}</script>
<script type="text/plain" id="b64-pdfjs">${pdfjsLib}</script>
<script type="text/plain" id="b64-pdfjs-worker">${pdfjsWorker}</script>

<script type="module">
function b64ToText(id) {
  const b64 = document.getElementById(id).textContent;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

// Chart.js (UMD) precisa rodar como <script> clássico para expor window.Chart
const chartSrc = b64ToText('b64-chartjs');
const chartBlobUrl = URL.createObjectURL(new Blob([chartSrc], { type: 'text/javascript' }));
await new Promise((resolve, reject) => {
  const s = document.createElement('script');
  s.src = chartBlobUrl;
  s.onload = resolve;
  s.onerror = reject;
  document.head.appendChild(s);
});

// pdf.js como módulo ES, carregado a partir de um Blob (sem nenhum arquivo externo)
const pdfjsModuleSrc = b64ToText('b64-pdfjs');
const pdfjsBlobUrl = URL.createObjectURL(new Blob([pdfjsModuleSrc], { type: 'text/javascript' }));
const pdfjsLib = await import(/* webpackIgnore: true */ pdfjsBlobUrl);

const pdfjsWorkerSrc = b64ToText('b64-pdfjs-worker');
const PDFJS_WORKER_BLOB_URL = URL.createObjectURL(new Blob([pdfjsWorkerSrc], { type: 'text/javascript' }));

${appBundle}
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(ROOT, 'assistente-financeiro.html'), html);
console.log('Gerado assistente-financeiro.html —', (html.length / 1024 / 1024).toFixed(2), 'MB');
