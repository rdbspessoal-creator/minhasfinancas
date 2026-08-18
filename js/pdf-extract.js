import * as pdfjsLib from '../vendor/pdfjs/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;

// Lê um PDF e devolve um array de linhas de texto (uma por linha visual do
// documento), reconstruídas a partir da posição (x, y) de cada fragmento de
// texto. Isso reaproxima uma extração "linha a linha" mesmo quando o PDF
// quebra palavras/números em vários fragmentos internos.
export async function extractLines(file) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const lines = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();

    const items = content.items
      .map(it => ({ str: it.str, x: it.transform[4], y: it.transform[5] }))
      .filter(it => it.str.trim().length > 0);

    const Y_TOL = 3;
    const rows = [];
    for (const it of items) {
      let row = rows.find(r => Math.abs(r.y - it.y) <= Y_TOL);
      if (!row) {
        row = { y: it.y, items: [] };
        rows.push(row);
      }
      row.items.push(it);
    }

    rows.sort((a, b) => b.y - a.y);
    for (const row of rows) {
      row.items.sort((a, b) => a.x - b.x);
      const text = row.items.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim();
      if (text) lines.push(text);
    }
  }

  return lines;
}

export async function extractFullText(file) {
  const lines = await extractLines(file);
  return lines.join('\n');
}
