import { extractLines } from './pdf-extract.js';
import { parseExtrato } from './parsers/parse-extrato.js';
import { parseFatura } from './parsers/parse-fatura.js';
import { classifyPreview, findDuplicate } from './store.js';

function detectDocType(lines) {
  const text = lines.join(' ').toUpperCase();
  const faturaScore =
    (text.includes('FATURA DE CART') ? 2 : 0) +
    (text.includes('MCC') ? 1 : 0) +
    (text.includes('RAMO DE ATIVIDADE') ? 2 : 0) +
    (text.includes('LIMITE DISPON') ? 1 : 0);
  const extratoScore =
    (text.includes('EXTRATO DE CONTA') ? 2 : 0) +
    (text.includes('HIST') && text.includes('ÓRICO') ? 0 : 0) +
    (text.includes('SALDO ANTERIOR') ? 1 : 0) +
    (text.includes('TIPO DE LAN') ? 2 : 0);

  if (faturaScore > extratoScore) return 'fatura';
  if (extratoScore > faturaScore) return 'extrato';
  return faturaScore === extratoScore && faturaScore > 0 ? 'ambiguo' : 'desconhecido';
}

/**
 * Lê um arquivo PDF, detecta se é extrato bancário ou fatura de cartão,
 * extrai as transações e devolve um preview (com categoria sugerida e
 * marcação de possível duplicata) para o usuário revisar antes de importar.
 */
export async function importPdfFile(file) {
  const lines = await extractLines(file);
  const docType = detectDocType(lines);

  let items = [];
  if (docType === 'fatura') {
    items = parseFatura(lines);
  } else if (docType === 'extrato') {
    items = parseExtrato(lines);
  } else if (docType === 'ambiguo') {
    // tenta os dois e fica com quem achou mais linhas
    const a = parseExtrato(lines);
    const b = parseFatura(lines);
    items = b.length > a.length ? b : a;
  }

  const preview = items.map(item => {
    const categoria = classifyPreview(item);
    const duplicate = findDuplicate(item);
    return {
      ...item,
      categoria,
      origem: 'import',
      possivelDuplicata: !!duplicate,
      selecionado: !duplicate,
    };
  });

  return {
    fileName: file.name,
    docType,
    lineCount: lines.length,
    items: preview,
  };
}
