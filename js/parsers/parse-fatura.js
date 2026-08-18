import { parseNumberBR, brDateToIso } from '../util.js';

const FATURA_DATE_START_RE = /^(\d{2}\/\d{2}\/\d{4})\s+(.*)$/;
const TRAILING_VALUE_RE = /(-?\d{1,3}(?:\.\d{3})*,\d{2})\s*$/;
const STANDALONE_4DIGIT_RE = /\b\d{4}\b/g;
const CITY_TAIL_RE = /^(.*?)\s+([A-ZÇÃÕÁÉÍÓÚÂÊÔ][A-ZÇÃÕÁÉÍÓÚÂÊÔ \-]{2,})$/;
const CARD_FINAL_RE = /Cart[ãa]o final:?\s*(\d{3,4})/i;

function findLast4DigitToken(text) {
  let last = null;
  let m;
  STANDALONE_4DIGIT_RE.lastIndex = 0;
  while ((m = STANDALONE_4DIGIT_RE.exec(text)) !== null) {
    last = { value: m[0], index: m.index };
  }
  return last;
}

/**
 * Recebe as linhas reconstruídas do PDF e devolve as compras/lançamentos
 * identificados na fatura de cartão de crédito.
 */
export function parseFatura(lines) {
  const results = [];

  let cartaoFinal = null;
  for (const line of lines) {
    const m = CARD_FINAL_RE.exec(line);
    if (m) { cartaoFinal = m[1]; break; }
  }

  for (const rawLine of lines) {
    const dm = FATURA_DATE_START_RE.exec(rawLine);
    if (!dm) continue;
    const [, dateBr, rest] = dm;
    const iso = brDateToIso(dateBr);
    if (!iso) continue;

    const valueMatch = TRAILING_VALUE_RE.exec(rest);
    if (!valueMatch) continue;
    const valorStr = valueMatch[1];
    const withoutValor = rest.slice(0, valueMatch.index).trim();

    const mccToken = findLast4DigitToken(withoutValor);
    if (!mccToken) continue; // sem MCC identificável, não é linha de compra

    const estabelecimento = withoutValor.slice(0, mccToken.index).trim();
    const afterMcc = withoutValor.slice(mccToken.index + mccToken.value.length).trim();
    if (!estabelecimento) continue;

    const cityMatch = CITY_TAIL_RE.exec(afterMcc);
    const ramo = cityMatch ? cityMatch[1].trim() : afterMcc;
    const cidade = cityMatch ? cityMatch[2].trim() : null;

    const rawAmount = parseNumberBR(valorStr);
    if (rawAmount == null) continue;

    results.push({
      date: iso,
      description: estabelecimento,
      amount: -rawAmount, // compra = saída de dinheiro
      source: 'cartao',
      mcc: mccToken.value,
      ramoAtividade: ramo || null,
      cidade,
      cartaoFinal,
    });
  }

  return results;
}
