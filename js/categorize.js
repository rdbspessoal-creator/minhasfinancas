import { normalizeDesc } from './util.js';

// MCC (Merchant Category Code) -> categoria.
// O MCC é o jeito mais confiável de categorizar compras de cartão: é
// padronizado pela bandeira, diferente do nome do estabelecimento.
export const MCC_MAP = {
  '5811': 'alimentacao', '5812': 'alimentacao', '5813': 'alimentacao',
  '5814': 'alimentacao', '5411': 'alimentacao', '5462': 'alimentacao',
  '5499': 'alimentacao', '5441': 'alimentacao',

  '5541': 'transporte', '5542': 'transporte', '4121': 'transporte',
  '4111': 'transporte', '7523': 'transporte', '4112': 'transporte',

  '4899': 'assinaturas', '5735': 'assinaturas', '5815': 'assinaturas',
  '4816': 'assinaturas',

  '5912': 'saude', '8011': 'saude', '8021': 'saude', '8099': 'saude',
  '7298': 'saude', '8062': 'saude',

  '5999': 'compras', '5311': 'compras', '5691': 'compras', '5651': 'compras',
  '5732': 'compras', '5722': 'compras', '5655': 'compras', '5661': 'compras',
  '5399': 'compras', '5300': 'alimentacao',

  '5942': 'lazer', '7832': 'lazer', '7841': 'lazer', '7922': 'lazer',
  '7997': 'lazer', '7993': 'lazer',

  '8211': 'educacao', '8220': 'educacao', '8241': 'educacao',

  '4900': 'utilidades', '4814': 'utilidades',
};

// Tipo de lançamento do extrato bancário -> categoria padrão.
export const TIPO_LANCAMENTO_MAP = {
  'PIX RECEBIDO': 'outros_recebimentos',
  'CREDITO TED': 'salario',
  'CREDITO DOC': 'salario',
  'RENDIMENTO': 'rendimentos',
  'PAGTO FATURA': 'pagamento_fatura',
  'PAGAMENTO FATURA': 'pagamento_fatura',
  'SAQUE': 'saque',
  'TARIFA': 'tarifas',
  'DEB AUTOMATICO': 'outros_despesa',
  'DEBITO AUTOMATICO': 'outros_despesa',
  'COMPRA DEBITO': 'compras',
  'PIX ENVIADO': 'outros_despesa',
  'TRANSFERENCIA': 'transferencia',
  'TED ENVIADA': 'transferencia',
  'DOC ENVIADO': 'transferencia',
};

// Regras por palavra-chave na descrição, aplicadas em ordem (a primeira que
// bater vence). Cobrem tanto lançamentos de extrato quanto de fatura.
// Editáveis/expansíveis pelo usuário na tela de Categorias.
export const DEFAULT_KEYWORD_RULES = [
  { pattern: 'ALUGUEL', categoria: 'moradia' },
  { pattern: 'CONDOMINIO', categoria: 'moradia' },
  { pattern: 'IMOB', categoria: 'moradia' },

  { pattern: 'VIVO|CLARO|TIM |OI FIBRA|INTERNET|FIBRA|TELEFONIA', categoria: 'utilidades' },
  { pattern: 'ENEL|ENERGIA|LUZ|SABESP|COMGAS|GAS NATURAL|AGUA E ESGOTO|CPFL|CEMIG', categoria: 'utilidades' },

  { pattern: 'SMARTFIT|SMART FIT|ACADEMIA|\\bGYM\\b', categoria: 'saude' },
  { pattern: 'UNIMED|AMIL|HAPVIDA|SULAMERICA|BRADESCO SAUDE|PLANO DE SAUDE', categoria: 'saude' },
  { pattern: 'DROGASIL|FARMACIA|DROGARIA|PAGUE MENOS|PACHECO', categoria: 'saude' },

  { pattern: 'PORTO SEGURO|SEGURO AUTO|SEGURO RESIDENC|SEG AUTO', categoria: 'seguros' },

  { pattern: 'SUPERMERCADO|MERCADO |HORTIFRUTI|ATACAD[AÃ]O|SACOLAO|HIPER ', categoria: 'alimentacao' },
  { pattern: 'IFOOD|RAPPI|RESTAURANTE|LANCHONETE|PADARIA|OUTBACK|MC ?DONALD|BURGER KING|PIZZ', categoria: 'alimentacao' },

  { pattern: 'POSTO |COMBUSTIVEL|IPIRANGA|SHELL|\\bBR\\b MANIA|ULTRAGAZ', categoria: 'transporte' },
  { pattern: '\\bUBER\\b|\\b99\\b|\\bTAXI\\b|99POP|CABIFY', categoria: 'transporte' },

  { pattern: 'PET SHOP|\\bPET\\b|VETERIN', categoria: 'pets' },

  { pattern: 'CULTURA INGLESA|ESCOLA|FACULDADE|UNIVERSIDADE|CURSO |MENSALIDADE ESCOLAR', categoria: 'educacao' },
  { pattern: 'LIVRARIA', categoria: 'lazer' },

  { pattern: 'DIARISTA|FAXINEIRA|FAXINA', categoria: 'servicos_domesticos' },
  { pattern: 'PRESENTE', categoria: 'presentes' },

  { pattern: 'INVESTIMENTO|RESERVA|\\bCDB\\b|TESOURO DIRETO|POUPANCA|CORRETORA', categoria: 'investimentos' },

  { pattern: 'NETFLIX|SPOTIFY|ICLOUD|AMAZON PRIME|DISNEY\\+?|HBO|YOUTUBE PREMIUM|DEEZER', categoria: 'assinaturas' },

  { pattern: 'CINEMARK|\\bCINEMA\\b|CINEPOLIS', categoria: 'lazer' },
  { pattern: 'DECATHLON|ARTIGOS ESPORTIVOS', categoria: 'compras' },
  { pattern: 'MAGAZINE LUIZA|MAGALU|AMAZON |MERCADO LIVRE|\\bLOJA\\b|SHOPEE|ALIEXPRESS', categoria: 'compras' },

  { pattern: 'SALARIO', categoria: 'salario' },
];

function compileRules(rules) {
  const compiled = [];
  for (const r of rules) {
    try {
      compiled.push({ ...r, regex: new RegExp(r.pattern, 'i') });
    } catch (e) {
      // regra inválida (ex.: caractere especial não escapado) — ignora em vez de derrubar a categorização
    }
  }
  return compiled;
}

// Tipos de lançamento cujo significado já é inequívoco (o próprio banco diz
// o que é). Palavra-chave na descrição NÃO deve sobrescrever esses casos —
// por exemplo, um RENDIMENTO de CDB não pode virar "investimentos" só porque
// a palavra "CDB" aparece na descrição do rendimento recebido.
const UNAMBIGUOUS_TIPOS = new Set([
  'RENDIMENTO', 'CREDITO TED', 'CREDITO DOC', 'PAGTO FATURA',
  'PAGAMENTO FATURA', 'SAQUE', 'TARIFA', 'PIX RECEBIDO',
]);

/**
 * Classifica uma transação. Prioridade:
 *  1) correção manual salva para essa descrição exata (aprendizado)
 *  2) tipo de lançamento inequívoco (extrato bancário)
 *  3) regra de palavra-chave na descrição
 *  4) MCC (fatura de cartão)
 *  5) tipo de lançamento ambíguo, pelo valor padrão
 *  6) fallback por sinal do valor
 */
export function categorize(tx, { overrides = {}, extraRules = [] } = {}) {
  const key = normalizeDesc(tx.description);
  if (overrides[key]) return overrides[key];

  if (tx.tipoLancamento && UNAMBIGUOUS_TIPOS.has(tx.tipoLancamento)) {
    return TIPO_LANCAMENTO_MAP[tx.tipoLancamento];
  }

  const allRules = compileRules([...extraRules, ...DEFAULT_KEYWORD_RULES]);
  for (const rule of allRules) {
    if (rule.regex.test(tx.description)) return rule.categoria;
  }

  if (tx.mcc && MCC_MAP[tx.mcc]) return MCC_MAP[tx.mcc];

  if (tx.tipoLancamento && TIPO_LANCAMENTO_MAP[tx.tipoLancamento]) {
    return TIPO_LANCAMENTO_MAP[tx.tipoLancamento];
  }

  return tx.amount >= 0 ? 'outros_recebimentos' : 'outros_despesa';
}
