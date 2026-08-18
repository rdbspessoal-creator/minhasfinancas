import { parseNumberBR, brDateToIso } from '../util.js';

// Tipos de lançamento conhecidos em extratos bancários (ordenados dos mais
// específicos para os mais genéricos, para casar o texto certo primeiro).
const TIPOS = [
  'PIX ENVIADO', 'PIX RECEBIDO', 'DEB AUTOMATICO', 'DEBITO AUTOMATICO',
  'COMPRA DEBITO', 'CREDITO TED', 'CREDITO DOC', 'PAGTO FATURA',
  'PAGAMENTO FATURA', 'SALDO ANTERIOR', 'TED ENVIADA', 'DOC ENVIADO',
  'TRANSFERENCIA', 'SAQUE', 'TARIFA', 'RENDIMENTO',
];

const CURRENCY_RE = /-?\d{1,3}(?:\.\d{3})*,\d{2}/g;
const DATE_START_RE = /^(\d{2}\/\d{2}\/\d{4})\s+(.*)$/;

function findTipo(text) {
  // O texto do histórico às vezes repete a própria palavra do tipo (ex:
  // "COMPRA DEBITO SUPERMERCADO DIA COMPRA DEBITO ..."). A ocorrência que
  // representa a coluna "Tipo de lançamento" é sempre a mais à direita, logo
  // pegamos a ÚLTIMA ocorrência de cada candidato e, entre os candidatos que
  // batem, ficamos com o de maior índice (mais próximo do fim da linha).
  let best = null;
  let bestIndex = -1;
  for (const tipo of TIPOS) {
    const re = new RegExp(`\\b${tipo}\\b`, 'gi');
    let m;
    let lastIndex = -1;
    while ((m = re.exec(text)) !== null) {
      lastIndex = m.index;
      if (m.index === re.lastIndex) re.lastIndex++; // evita loop infinito em match vazio
    }
    if (lastIndex > bestIndex) {
      best = tipo;
      bestIndex = lastIndex;
    }
  }
  return best ? { tipo: best, index: bestIndex } : null;
}

/**
 * Recebe as linhas reconstruídas do PDF (ver pdf-extract.js) e devolve as
 * transações identificadas no extrato bancário.
 */
export function parseExtrato(lines) {
  const results = [];

  for (const rawLine of lines) {
    const dm = DATE_START_RE.exec(rawLine);
    if (!dm) continue;

    const [, dateBr, rest] = dm;
    const iso = brDateToIso(dateBr);
    if (!iso) continue;

    const found = findTipo(rest);
    if (!found) continue;
    const { tipo, index } = found;

    if (tipo === 'SALDO ANTERIOR') continue; // não é um lançamento

    const historico = rest.slice(0, index).trim();
    const afterTipo = rest.slice(index + tipo.length).trim();

    const numbers = afterTipo.match(CURRENCY_RE) || [];
    if (numbers.length === 0) continue;

    let valorStr, saldoStr, docPart;
    if (numbers.length >= 2) {
      saldoStr = numbers[numbers.length - 1];
      valorStr = numbers[numbers.length - 2];
      const cut = afterTipo.lastIndexOf(valorStr);
      docPart = afterTipo.slice(0, cut).trim();
    } else {
      valorStr = numbers[0];
      saldoStr = null;
      const cut = afterTipo.lastIndexOf(valorStr);
      docPart = afterTipo.slice(0, cut).trim();
    }

    const amount = parseNumberBR(valorStr);
    if (amount == null) continue;

    results.push({
      date: iso,
      description: historico || tipo,
      amount,
      source: 'conta',
      tipoLancamento: tipo,
      documento: docPart && docPart !== '-' ? docPart : null,
      saldoApos: saldoStr ? parseNumberBR(saldoStr) : null,
    });
  }

  return results;
}
