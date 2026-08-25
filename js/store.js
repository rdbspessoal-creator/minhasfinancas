import { uid, monthKeyOf, normalizeDesc } from './util.js';
import { categorize } from './categorize.js';
import { CATEGORY_BY_ID } from './categories.js';
import { supabase } from './supabase-client.js';

function defaultState() {
  return {
    version: 1,
    transactions: [],   // { id, date, description, amount, source, tipoLancamento, documento, mcc, cidade, categoria, origem, cartaoFinal, notes }
    overrides: {},       // normalizedDescription -> categoriaId (aprendizado)
    customRules: [],      // [{ id, pattern, categoria }]
    ready: false,
  };
}

let state = defaultState();
const listeners = new Set();

function emit() {
  listeners.forEach(fn => fn(state));
}

function commit() {
  emit();
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getState() {
  return state;
}

export function getTransactions() {
  return state.transactions;
}

export function getMonthKeys() {
  const set = new Set(state.transactions.map(t => monthKeyOf(t.date)));
  return Array.from(set).sort();
}

export function getTransactionsForMonth(monthKey) {
  return state.transactions.filter(t => monthKeyOf(t.date) === monthKey);
}

function classify(txPartial) {
  return categorize(txPartial, { overrides: state.overrides, extraRules: state.customRules });
}

// --- Mapeamento entre o objeto de transação usado na UI e a linha da
// tabela `transacoes` no banco -----------------------------------------

function rowToTx(row) {
  return {
    id: row.id,
    date: row.data,
    description: row.descricao,
    amount: Number(row.valor),
    source: row.origem_lancamento,
    tipoLancamento: row.tipo_lancamento,
    documento: row.documento,
    mcc: row.mcc,
    cidade: row.cidade,
    cartaoFinal: row.cartao_final,
    categoria: row.categoria_id,
    origem: row.origem_registro,
    notes: row.observacoes || '',
  };
}

function txToRow(tx) {
  return {
    id: tx.id,
    data: tx.date,
    descricao: tx.description,
    valor: tx.amount,
    origem_lancamento: tx.source || 'conta',
    tipo_lancamento: tx.tipoLancamento || null,
    documento: tx.documento || null,
    mcc: tx.mcc || null,
    cidade: tx.cidade || null,
    cartao_final: tx.cartaoFinal || null,
    categoria_id: tx.categoria || null,
    origem_registro: tx.origem || 'manual',
    observacoes: tx.notes || '',
  };
}

function logDbError(action, error) {
  if (error) console.error(`Falha ao ${action} no banco de dados.`, error);
}

// --- Carga inicial -------------------------------------------------------

// Busca transações, correções aprendidas e regras do usuário no Supabase.
// Precisa ser aguardada (await store.init()) antes do primeiro render.
export async function init() {
  const [txRes, ovrRes, ruleRes] = await Promise.all([
    supabase.from('transacoes').select('*').order('data', { ascending: true }),
    supabase.from('correcoes_categorizacao').select('*'),
    supabase.from('regras_categorizacao').select('*').eq('origem', 'usuario').order('criado_em', { ascending: true }),
  ]);

  logDbError('carregar transações', txRes.error);
  logDbError('carregar correções de categorização', ovrRes.error);
  logDbError('carregar regras de categorização', ruleRes.error);

  state.transactions = (txRes.data || []).map(rowToTx);
  state.overrides = Object.fromEntries((ovrRes.data || []).map(r => [r.descricao_normalizada, r.categoria_id]));
  state.customRules = (ruleRes.data || []).map(r => ({ id: r.id, pattern: r.padrao, categoria: r.categoria_id }));
  state.ready = true;
  commit();
}

// --- Transações ------------------------------------------------------

export function addTransaction(tx) {
  const categoria = tx.categoria || classify(tx);
  const full = {
    id: tx.id || uid(),
    date: tx.date,
    description: tx.description,
    amount: Number(tx.amount),
    source: tx.source || 'conta',
    tipoLancamento: tx.tipoLancamento || null,
    documento: tx.documento || null,
    mcc: tx.mcc || null,
    cidade: tx.cidade || null,
    cartaoFinal: tx.cartaoFinal || null,
    categoria,
    origem: tx.origem || 'manual',
    notes: tx.notes || '',
  };
  state.transactions.push(full);
  commit();
  supabase.from('transacoes').insert(txToRow(full)).then(({ error }) => logDbError('salvar lançamento', error));
  return full;
}

export function addTransactions(list) {
  const added = list.map(tx => {
    const categoria = tx.categoria || classify(tx);
    return {
      id: tx.id || uid(),
      date: tx.date,
      description: tx.description,
      amount: Number(tx.amount),
      source: tx.source || 'conta',
      tipoLancamento: tx.tipoLancamento || null,
      documento: tx.documento || null,
      mcc: tx.mcc || null,
      cidade: tx.cidade || null,
      cartaoFinal: tx.cartaoFinal || null,
      categoria,
      origem: tx.origem || 'import',
      notes: tx.notes || '',
    };
  });
  state.transactions.push(...added);
  commit();
  if (added.length) {
    supabase.from('transacoes').insert(added.map(txToRow)).then(({ error }) => logDbError('salvar lançamentos importados', error));
  }
  return added;
}

export function updateTransaction(id, patch) {
  const idx = state.transactions.findIndex(t => t.id === id);
  if (idx === -1) return null;
  const prev = state.transactions[idx];
  const next = { ...prev, ...patch };
  state.transactions[idx] = next;

  // Se o usuário mudou a categoria manualmente, memoriza a correção pela
  // descrição normalizada, para que a próxima importação já venha certa.
  let overrideKey = null;
  if (patch.categoria && patch.categoria !== prev.categoria) {
    overrideKey = normalizeDesc(next.description);
    state.overrides[overrideKey] = patch.categoria;
  }
  commit();

  supabase.from('transacoes').update(txToRow(next)).eq('id', id)
    .then(({ error }) => logDbError('atualizar lançamento', error));

  if (overrideKey) {
    supabase.from('correcoes_categorizacao')
      .upsert({ descricao_normalizada: overrideKey, categoria_id: patch.categoria, atualizado_em: new Date().toISOString() })
      .then(({ error }) => logDbError('salvar correção de categorização', error));
  }
  return next;
}

export function deleteTransaction(id) {
  state.transactions = state.transactions.filter(t => t.id !== id);
  commit();
  supabase.from('transacoes').delete().eq('id', id).then(({ error }) => logDbError('excluir lançamento', error));
}

export function deleteTransactions(ids) {
  const set = new Set(ids);
  state.transactions = state.transactions.filter(t => !set.has(t.id));
  commit();
  if (ids.length) {
    supabase.from('transacoes').delete().in('id', ids).then(({ error }) => logDbError('excluir lançamentos', error));
  }
}

export function classifyPreview(txPartial) {
  return classify(txPartial);
}

// --- Regras personalizadas --------------------------------------------

export function addCustomRule(pattern, categoria) {
  const id = crypto.randomUUID();
  state.customRules.unshift({ id, pattern, categoria });
  commit();
  supabase.from('regras_categorizacao')
    .insert({ id, padrao: pattern, categoria_id: categoria, origem: 'usuario' })
    .then(({ error }) => logDbError('salvar regra de categorização', error));
}

export function removeCustomRule(index) {
  const [removed] = state.customRules.splice(index, 1);
  commit();
  if (removed) {
    supabase.from('regras_categorizacao').delete().eq('id', removed.id)
      .then(({ error }) => logDbError('remover regra de categorização', error));
  }
}

export function categoryLabel(id) {
  return CATEGORY_BY_ID[id]?.nome || id;
}

// --- Backup / restauração --------------------------------------------

export function exportBackup() {
  return JSON.stringify(state, null, 2);
}

export async function importBackup(json, { merge = false } = {}) {
  const incoming = JSON.parse(json);
  if (!incoming || !Array.isArray(incoming.transactions)) {
    throw new Error('Arquivo de backup inválido.');
  }

  if (merge) {
    const existingIds = new Set(state.transactions.map(t => t.id));
    const newTx = incoming.transactions.filter(t => !existingIds.has(t.id));
    state.transactions.push(...newTx);
    state.overrides = { ...state.overrides, ...(incoming.overrides || {}) };
    const incomingRules = (incoming.customRules || []).map(r => ({ id: r.id || crypto.randomUUID(), pattern: r.pattern, categoria: r.categoria }));
    state.customRules = [...incomingRules, ...state.customRules];
    commit();

    if (newTx.length) {
      await supabase.from('transacoes').insert(newTx.map(txToRow)).then(({ error }) => logDbError('importar lançamentos do backup', error));
    }
    const overrideRows = Object.entries(incoming.overrides || {}).map(([descricao_normalizada, categoria_id]) => ({
      descricao_normalizada, categoria_id, atualizado_em: new Date().toISOString(),
    }));
    if (overrideRows.length) {
      await supabase.from('correcoes_categorizacao').upsert(overrideRows).then(({ error }) => logDbError('importar correções do backup', error));
    }
    if (incomingRules.length) {
      await supabase.from('regras_categorizacao')
        .insert(incomingRules.map(r => ({ id: r.id, padrao: r.pattern, categoria_id: r.categoria, origem: 'usuario' })))
        .then(({ error }) => logDbError('importar regras do backup', error));
    }
  } else {
    const cleared = defaultState();
    cleared.transactions = incoming.transactions;
    cleared.overrides = incoming.overrides || {};
    cleared.customRules = (incoming.customRules || []).map(r => ({ id: r.id || crypto.randomUUID(), pattern: r.pattern, categoria: r.categoria }));
    cleared.ready = true;
    state = cleared;
    commit();

    await supabase.from('transacoes').delete().neq('id', '').then(({ error }) => logDbError('limpar transações antes do restore', error));
    await supabase.from('correcoes_categorizacao').delete().neq('descricao_normalizada', '').then(({ error }) => logDbError('limpar correções antes do restore', error));
    await supabase.from('regras_categorizacao').delete().eq('origem', 'usuario').then(({ error }) => logDbError('limpar regras antes do restore', error));

    if (state.transactions.length) {
      await supabase.from('transacoes').insert(state.transactions.map(txToRow)).then(({ error }) => logDbError('restaurar lançamentos do backup', error));
    }
    const overrideRows = Object.entries(state.overrides).map(([descricao_normalizada, categoria_id]) => ({
      descricao_normalizada, categoria_id, atualizado_em: new Date().toISOString(),
    }));
    if (overrideRows.length) {
      await supabase.from('correcoes_categorizacao').insert(overrideRows).then(({ error }) => logDbError('restaurar correções do backup', error));
    }
    if (state.customRules.length) {
      await supabase.from('regras_categorizacao')
        .insert(state.customRules.map(r => ({ id: r.id, padrao: r.pattern, categoria_id: r.categoria, origem: 'usuario' })))
        .then(({ error }) => logDbError('restaurar regras do backup', error));
    }
  }
}

export async function clearAllData() {
  state = defaultState();
  state.ready = true;
  commit();
  await supabase.from('transacoes').delete().neq('id', '').then(({ error }) => logDbError('apagar transações', error));
  await supabase.from('correcoes_categorizacao').delete().neq('descricao_normalizada', '').then(({ error }) => logDbError('apagar correções', error));
  await supabase.from('regras_categorizacao').delete().eq('origem', 'usuario').then(({ error }) => logDbError('apagar regras do usuário', error));
}

// Detecta duplicatas exatas (mesma data, descrição e valor) — útil antes de
// confirmar uma importação, para não lançar o mesmo item duas vezes.
export function findDuplicate(tx) {
  return state.transactions.find(t =>
    t.date === tx.date &&
    t.amount === Number(tx.amount) &&
    normalizeDesc(t.description) === normalizeDesc(tx.description)
  );
}
