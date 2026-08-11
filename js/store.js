import { uid, monthKeyOf, normalizeDesc } from './util.js';
import { categorize } from './categorize.js';
import { CATEGORY_BY_ID } from './categories.js';

const STORAGE_KEY = 'financas.v1';

function defaultState() {
  return {
    version: 1,
    transactions: [],   // { id, date, description, amount, source, tipoLancamento, documento, mcc, cidade, categoria, origem, cartaoFinal, notes }
    overrides: {},       // normalizedDescription -> categoriaId (aprendizado)
    customRules: [],      // [{ pattern, categoria }]
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed };
  } catch (e) {
    console.error('Falha ao carregar dados salvos, iniciando vazio.', e);
    return defaultState();
  }
}

let state = load();
const listeners = new Set();

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function emit() {
  listeners.forEach(fn => fn(state));
}

function commit() {
  persist();
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
  if (patch.categoria && patch.categoria !== prev.categoria) {
    state.overrides[normalizeDesc(next.description)] = patch.categoria;
  }
  commit();
  return next;
}

export function deleteTransaction(id) {
  state.transactions = state.transactions.filter(t => t.id !== id);
  commit();
}

export function deleteTransactions(ids) {
  const set = new Set(ids);
  state.transactions = state.transactions.filter(t => !set.has(t.id));
  commit();
}

export function classifyPreview(txPartial) {
  return classify(txPartial);
}

export function addCustomRule(pattern, categoria) {
  state.customRules.unshift({ pattern, categoria });
  commit();
}

export function removeCustomRule(index) {
  state.customRules.splice(index, 1);
  commit();
}

export function categoryLabel(id) {
  return CATEGORY_BY_ID[id]?.nome || id;
}

// --- Backup / restauração --------------------------------------------

export function exportBackup() {
  return JSON.stringify(state, null, 2);
}

export function importBackup(json, { merge = false } = {}) {
  const incoming = JSON.parse(json);
  if (!incoming || !Array.isArray(incoming.transactions)) {
    throw new Error('Arquivo de backup inválido.');
  }
  if (merge) {
    const existingIds = new Set(state.transactions.map(t => t.id));
    const newTx = incoming.transactions.filter(t => !existingIds.has(t.id));
    state.transactions.push(...newTx);
    state.overrides = { ...state.overrides, ...(incoming.overrides || {}) };
    state.customRules = [...(incoming.customRules || []), ...state.customRules];
  } else {
    state = { ...defaultState(), ...incoming };
  }
  commit();
}

export function clearAllData() {
  state = defaultState();
  commit();
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
