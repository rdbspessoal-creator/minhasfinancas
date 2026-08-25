import {
  formatBRL, isoToBrDate, monthKeyOf, monthLabel, monthLabelShort,
  currentMonthKey, addMonths, todayIso, uid, escapeRegExp,
} from './util.js';
import { CATEGORIES, categoryName, categoryGroup } from './categories.js';
import * as store from './store.js';
import { renderCategoryChart, renderEvolutionChart } from './charts.js';
import { importPdfFile } from './import.js';

let selectedMonth = null; // definido em init()

// ---------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------

function init() {
  const months = store.getMonthKeys();
  selectedMonth = months.length ? months[months.length - 1] : currentMonthKey();

  populateCategorySelects();
  wireHeader();
  wireManualModal();
  wireImportModal();
  wireCategoriesModal();
  wireBackupModal();
  wireModalDismiss();
  wireTableToggles();

  store.subscribe(() => render());
  render();
}

function populateCategorySelects() {
  const ruleSel = document.getElementById('ruleCategoria');
  ruleSel.innerHTML = CATEGORIES.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');

  const filterSel = document.getElementById('filterCategoria');
  filterSel.innerHTML = '<option value="">Todas as categorias</option>' +
    CATEGORIES.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');

  refreshManualCategoriaOptions();
}

function refreshManualCategoriaOptions() {
  const tipo = document.getElementById('manualTipo').value;
  const grupo = tipo; // valores do select já são 'despesa' | 'receita' | 'poupanca'
  const sel = document.getElementById('manualCategoria');
  const opts = CATEGORIES.filter(c => c.grupo === grupo);
  sel.innerHTML = opts.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
}

// ---------------------------------------------------------------------
// Header / navegação de mês
// ---------------------------------------------------------------------

function wireHeader() {
  document.getElementById('btnPrevMonth').addEventListener('click', () => {
    selectedMonth = addMonths(selectedMonth, -1);
    render();
  });
  document.getElementById('btnNextMonth').addEventListener('click', () => {
    selectedMonth = addMonths(selectedMonth, 1);
    render();
  });
  document.getElementById('monthSelect').addEventListener('change', (e) => {
    selectedMonth = e.target.value;
    render();
  });

  document.getElementById('btnManual').addEventListener('click', () => openManualModal());
  document.getElementById('btnManualEmpty').addEventListener('click', () => openManualModal());
  document.getElementById('btnImport').addEventListener('click', () => openImportModal());
  document.getElementById('btnImportEmpty').addEventListener('click', () => openImportModal());
  document.getElementById('btnCategories').addEventListener('click', () => openModal('modalCategories'));
  document.getElementById('btnBackup').addEventListener('click', () => openModal('modalBackup'));

  document.getElementById('filterSearch').addEventListener('input', () => renderTable());
  document.getElementById('filterCategoria').addEventListener('change', () => renderTable());
  document.getElementById('filterOrigem').addEventListener('change', () => renderTable());
}

function populateMonthSelect() {
  const sel = document.getElementById('monthSelect');
  const dataMonths = store.getMonthKeys();
  const all = new Set([...dataMonths, selectedMonth]);
  const sorted = Array.from(all).sort();
  sel.innerHTML = sorted.map(m => `<option value="${m}">${monthLabel(m)}</option>`).join('');
  sel.value = selectedMonth;
}

// ---------------------------------------------------------------------
// Render principal
// ---------------------------------------------------------------------

function render() {
  const hasAny = store.getTransactions().length > 0;
  document.getElementById('emptyState').classList.toggle('hidden', hasAny);
  document.getElementById('dashboardContent').classList.toggle('hidden', !hasAny);
  if (!hasAny) return;

  populateMonthSelect();
  renderKpis();
  renderCharts();
  renderTable();
}

function computeMonthTotals(monthKey) {
  const txs = store.getTransactionsForMonth(monthKey);
  let receitas = 0, despesas = 0, poupanca = 0;
  for (const t of txs) {
    const grupo = categoryGroup(t.categoria);
    if (grupo === 'receita') receitas += t.amount;
    else if (grupo === 'despesa') despesas += Math.abs(t.amount);
    else if (grupo === 'poupanca') poupanca += Math.abs(t.amount);
  }
  return { receitas, despesas, poupanca, saldo: receitas - despesas - poupanca };
}

function deltaHtml(current, previous, invert = false) {
  if (previous === 0 || previous == null) return '<div class="delta">sem dado do mês anterior</div>';
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const up = pct >= 0;
  const good = invert ? !up : up;
  const arrow = up ? '▲' : '▼';
  const cls = good ? 'up' : 'down';
  return `<div class="delta ${cls}">${arrow} ${Math.abs(pct).toFixed(0)}% vs mês anterior</div>`;
}

function renderKpis() {
  const cur = computeMonthTotals(selectedMonth);
  const prev = computeMonthTotals(addMonths(selectedMonth, -1));
  const row = document.getElementById('kpiRow');

  const saldoClass = cur.saldo >= 0 ? 'saldo-positivo' : 'saldo-negativo';

  row.innerHTML = `
    <div class="stat-tile">
      <div class="label">Receitas</div>
      <div class="value">${formatBRL(cur.receitas)}</div>
      ${deltaHtml(cur.receitas, prev.receitas, false)}
    </div>
    <div class="stat-tile">
      <div class="label">Despesas</div>
      <div class="value">${formatBRL(cur.despesas)}</div>
      ${deltaHtml(cur.despesas, prev.despesas, true)}
    </div>
    <div class="stat-tile">
      <div class="label">Investido / guardado</div>
      <div class="value">${formatBRL(cur.poupanca)}</div>
      ${deltaHtml(cur.poupanca, prev.poupanca, false)}
    </div>
    <div class="stat-tile stat-tile--total ${saldoClass}">
      <div class="label">Saldo do mês</div>
      <div class="value">${formatBRL(cur.saldo)}</div>
      ${deltaHtml(cur.saldo, prev.saldo, false)}
    </div>
  `;
}

function renderCharts() {
  // gráfico de despesas por categoria (mês selecionado)
  const txs = store.getTransactionsForMonth(selectedMonth);
  const porCategoria = {};
  for (const t of txs) {
    if (categoryGroup(t.categoria) !== 'despesa') continue;
    porCategoria[t.categoria] = (porCategoria[t.categoria] || 0) + Math.abs(t.amount);
  }
  renderCategoryChart(document.getElementById('categoryChart'), porCategoria);

  const catRows = Object.entries(porCategoria).sort((a, b) => b[1] - a[1]);
  document.getElementById('categoryTableView').innerHTML = catRows.length
    ? `<table><thead><tr><th>Categoria</th><th>Valor</th></tr></thead><tbody>${
        catRows.map(([id, v]) => `<tr><td>${categoryName(id)}</td><td>${formatBRL(v)}</td></tr>`).join('')
      }</tbody></table>`
    : '<p>Sem despesas neste mês.</p>';

  // evolução mensal (todos os meses com dados)
  const months = store.getMonthKeys().sort();
  const labels = months.map(monthLabelShort);
  const receitasArr = [];
  const despesasArr = [];
  for (const m of months) {
    const t = computeMonthTotals(m);
    receitasArr.push(t.receitas);
    despesasArr.push(t.despesas);
  }
  renderEvolutionChart(document.getElementById('evolutionChart'), labels, receitasArr, despesasArr);

  document.getElementById('evolutionTableView').innerHTML = months.length
    ? `<table><thead><tr><th>Mês</th><th>Receitas</th><th>Despesas</th></tr></thead><tbody>${
        months.map((m, i) => `<tr><td>${monthLabel(m)}</td><td>${formatBRL(receitasArr[i])}</td><td>${formatBRL(despesasArr[i])}</td></tr>`).join('')
      }</tbody></table>`
    : '';
}

function renderTable() {
  const search = document.getElementById('filterSearch').value.trim().toLowerCase();
  const catFilter = document.getElementById('filterCategoria').value;
  const origemFilter = document.getElementById('filterOrigem').value;

  let txs = store.getTransactionsForMonth(selectedMonth);
  if (search) txs = txs.filter(t => t.description.toLowerCase().includes(search));
  if (catFilter) txs = txs.filter(t => t.categoria === catFilter);
  if (origemFilter) txs = txs.filter(t => t.source === origemFilter);
  txs = [...txs].sort((a, b) => a.date.localeCompare(b.date));

  const tbody = document.getElementById('txTableBody');
  if (!txs.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="color:var(--text-muted); padding:16px 8px;">Nenhum lançamento encontrado.</td></tr>';
    return;
  }

  tbody.innerHTML = txs.map(t => {
    const grupo = categoryGroup(t.categoria);
    const amountClass = grupo === 'neutro' ? 'amount-neutral' : (t.amount >= 0 ? 'amount-pos' : 'amount-neg');
    const origemLabel = t.source === 'cartao' ? `Cartão${t.cartaoFinal ? ' •' + t.cartaoFinal : ''}` : 'Conta';
    const neutroBadge = grupo === 'neutro' ? '<span class="badge badge-neutro" title="Não entra nos totais de receita/despesa">neutro</span>' : '';
    return `
      <tr data-id="${t.id}">
        <td>${isoToBrDate(t.date)}</td>
        <td>${escapeHtml(t.description)}</td>
        <td>
          <select class="cat-select" data-id="${t.id}">
            ${CATEGORIES.map(c => `<option value="${c.id}" ${c.id === t.categoria ? 'selected' : ''}>${c.nome}</option>`).join('')}
          </select>
          ${neutroBadge}
        </td>
        <td><span class="badge">${origemLabel}</span></td>
        <td style="text-align:right" class="${amountClass}">${formatBRL(t.amount)}</td>
        <td class="row-actions">
          <button data-edit="${t.id}" title="Editar" aria-label="Editar">✏️</button>
          <button data-del="${t.id}" title="Excluir" aria-label="Excluir">🗑</button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('select.cat-select').forEach(sel => {
    sel.addEventListener('change', (e) => {
      store.updateTransaction(e.target.dataset.id, { categoria: e.target.value });
    });
  });
  tbody.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.edit;
      const tx = store.getTransactions().find(t => t.id === id);
      if (tx) openManualModal(tx);
    });
  });
  tbody.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.del;
      if (confirm('Excluir este lançamento?')) {
        store.deleteTransaction(id);
        showToast('Lançamento excluído.');
      }
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------------------------------------------------------------------
// Modal genérico
// ---------------------------------------------------------------------

function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function wireModalDismiss() {
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
  });
  document.querySelectorAll('.modal-backdrop').forEach(bd => {
    bd.addEventListener('click', (e) => {
      if (e.target === bd) bd.classList.add('hidden');
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop:not(.hidden)').forEach(bd => bd.classList.add('hidden'));
    }
  });
}

function wireTableToggles() {
  document.querySelectorAll('.table-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.target);
      const nowHidden = target.classList.toggle('hidden');
      btn.textContent = nowHidden ? 'Ver como tabela' : 'Ocultar tabela';
    });
  });
}

// ---------------------------------------------------------------------
// Modal: lançamento manual
// ---------------------------------------------------------------------

function openManualModal(existingTx = null) {
  const form = document.getElementById('formManual');
  form.reset();
  document.getElementById('manualId').value = existingTx?.id || '';
  document.getElementById('manualModalTitle').textContent = existingTx ? 'Editar lançamento' : 'Novo lançamento';

  if (existingTx) {
    const grupo = categoryGroup(existingTx.categoria);
    document.getElementById('manualTipo').value = grupo; // 'despesa' | 'receita' | 'poupanca' | 'neutro'
    refreshManualCategoriaOptions();
    document.getElementById('manualCategoria').value = existingTx.categoria;
    document.getElementById('manualData').value = existingTx.date;
    document.getElementById('manualValor').value = Math.abs(existingTx.amount);
    document.getElementById('manualOrigem').value = existingTx.source;
    document.getElementById('manualDescricao').value = existingTx.description;
  } else {
    document.getElementById('manualTipo').value = 'despesa';
    refreshManualCategoriaOptions();
    document.getElementById('manualData').value = selectedMonth ? `${selectedMonth}-01` : todayIso();
    document.getElementById('manualOrigem').value = 'conta';
  }
  openModal('modalManual');
}

function wireManualModal() {
  document.getElementById('manualTipo').addEventListener('change', refreshManualCategoriaOptions);

  document.getElementById('formManual').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('manualId').value || null;
    const tipo = document.getElementById('manualTipo').value;
    const categoria = document.getElementById('manualCategoria').value;
    const date = document.getElementById('manualData').value;
    const valorAbs = parseFloat(document.getElementById('manualValor').value);
    const source = document.getElementById('manualOrigem').value;
    const description = document.getElementById('manualDescricao').value.trim();

    if (!date || !description || !Number.isFinite(valorAbs) || valorAbs < 0) return;

    const amount = tipo === 'receita' ? valorAbs : -valorAbs;

    if (id) {
      store.updateTransaction(id, { date, amount, source, description, categoria });
      showToast('Lançamento atualizado.');
    } else {
      selectedMonth = monthKeyOf(date); // antes de gravar: o subscriber redesenha de forma síncrona
      store.addTransaction({ date, amount, source, description, categoria, origem: 'manual' });
      showToast('Lançamento adicionado.');
    }
    closeModal('modalManual');
  });
}

// ---------------------------------------------------------------------
// Modal: importar PDF
// ---------------------------------------------------------------------

let pendingImportItems = []; // itens do preview, com _localId

function openImportModal() {
  document.getElementById('importStep1').classList.remove('hidden');
  document.getElementById('importStep2').classList.add('hidden');
  document.getElementById('importStatus').textContent = '';
  document.getElementById('fileInput').value = '';
  pendingImportItems = [];
  openModal('modalImport');
}

function wireImportModal() {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) handleFiles(fileInput.files);
  });

  document.getElementById('btnImportBack').addEventListener('click', () => openImportModal());
  document.getElementById('btnImportConfirm').addEventListener('click', confirmImport);
}

async function handleFiles(fileList) {
  const files = Array.from(fileList).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
  if (!files.length) {
    document.getElementById('importStatus').textContent = 'Selecione arquivos PDF.';
    return;
  }
  document.getElementById('importStatus').textContent = `Lendo ${files.length} arquivo(s)…`;

  const allItems = [];
  const warnings = [];
  for (const file of files) {
    try {
      const result = await importPdfFile(file);
      if (result.docType === 'desconhecido' || result.items.length === 0) {
        warnings.push(`${file.name}: não foi possível reconhecer lançamentos (formato não identificado).`);
        continue;
      }
      result.items.forEach(item => allItems.push({ ...item, _localId: uid(), _fileName: file.name, _docType: result.docType }));
    } catch (err) {
      console.error(err);
      warnings.push(`${file.name}: erro ao ler o PDF (${err.message}).`);
    }
  }

  if (warnings.length) document.getElementById('importStatus').textContent = warnings.join(' ');

  if (!allItems.length) return;

  pendingImportItems = allItems;
  showImportPreview();
}

function showImportPreview() {
  document.getElementById('importStep1').classList.add('hidden');
  document.getElementById('importStep2').classList.remove('hidden');

  const nExtrato = pendingImportItems.filter(i => i._docType === 'extrato').length;
  const nFatura = pendingImportItems.filter(i => i._docType === 'fatura').length;
  const nDup = pendingImportItems.filter(i => i.possivelDuplicata).length;
  document.getElementById('importSummary').innerHTML = `
    <span>${pendingImportItems.length} lançamento(s) encontrado(s)</span>
    ${nExtrato ? `<span>${nExtrato} de extrato bancário</span>` : ''}
    ${nFatura ? `<span>${nFatura} de fatura de cartão</span>` : ''}
    ${nDup ? `<span style="color:var(--warning)">${nDup} possível(is) duplicata(s) — desmarcados por padrão</span>` : ''}
  `;

  const body = document.getElementById('importPreviewBody');
  body.innerHTML = pendingImportItems.map(item => `
    <tr data-local-id="${item._localId}" ${item.possivelDuplicata ? 'style="opacity:0.6"' : ''}>
      <td><input type="checkbox" class="import-check" data-local-id="${item._localId}" ${item.selecionado ? 'checked' : ''}></td>
      <td>${isoToBrDate(item.date)}</td>
      <td>${escapeHtml(item.description)}${item.possivelDuplicata ? ' <span class="badge" style="color:var(--warning)">duplicata?</span>' : ''}</td>
      <td>
        <select class="cat-select import-cat" data-local-id="${item._localId}">
          ${CATEGORIES.map(c => `<option value="${c.id}" ${c.id === item.categoria ? 'selected' : ''}>${c.nome}</option>`).join('')}
        </select>
      </td>
      <td><span class="badge">${item.source === 'cartao' ? 'Cartão' : 'Conta'}</span></td>
      <td style="text-align:right" class="${item.amount >= 0 ? 'amount-pos' : 'amount-neg'}">${formatBRL(item.amount)}</td>
    </tr>
  `).join('');

  body.querySelectorAll('.import-cat').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const item = pendingImportItems.find(i => i._localId === e.target.dataset.localId);
      if (item) item.categoria = e.target.value;
    });
  });
}

function confirmImport() {
  const checked = new Set(
    Array.from(document.querySelectorAll('.import-check:checked')).map(c => c.dataset.localId)
  );
  const toImport = pendingImportItems.filter(i => checked.has(i._localId));
  if (!toImport.length) {
    showToast('Nenhum lançamento selecionado.');
    return;
  }
  // define o mês selecionado ANTES de gravar: o subscriber do store redesenha
  // a tela de forma síncrona dentro de addTransactions().
  const mostRecentDate = toImport.map(i => i.date).sort().at(-1);
  if (mostRecentDate) selectedMonth = monthKeyOf(mostRecentDate);

  const added = store.addTransactions(toImport.map(i => ({
    date: i.date,
    description: i.description,
    amount: i.amount,
    source: i.source,
    tipoLancamento: i.tipoLancamento || null,
    documento: i.documento || null,
    mcc: i.mcc || null,
    cidade: i.cidade || null,
    cartaoFinal: i.cartaoFinal || null,
    categoria: i.categoria,
    origem: 'import',
  })));
  closeModal('modalImport');
  showToast(`${added.length} lançamento(s) importado(s).`);
}

// ---------------------------------------------------------------------
// Modal: categorias e regras
// ---------------------------------------------------------------------

function wireCategoriesModal() {
  document.getElementById('formNewRule').addEventListener('submit', (e) => {
    e.preventDefault();
    const keyword = document.getElementById('ruleKeyword').value.trim();
    const categoria = document.getElementById('ruleCategoria').value;
    if (!keyword) return;
    store.addCustomRule(escapeRegExp(keyword), categoria);
    document.getElementById('ruleKeyword').value = '';
    renderRulesList();
    showToast('Regra adicionada.');
  });
}

function renderRulesList() {
  const list = document.getElementById('rulesList');
  const rules = store.getState().customRules;
  if (!rules.length) {
    list.innerHTML = '<li style="color:var(--text-muted)">Nenhuma regra personalizada ainda.</li>';
    return;
  }
  list.innerHTML = rules.map((r, i) => `
    <li>
      <span class="rule-pattern">${escapeHtml(r.pattern)}</span>
      <span class="badge">${categoryName(r.categoria)}</span>
      <button data-rm-rule="${i}" title="Remover" aria-label="Remover" style="background:none;border:none;cursor:pointer;color:var(--text-muted)">✕</button>
    </li>
  `).join('');
  list.querySelectorAll('[data-rm-rule]').forEach(btn => {
    btn.addEventListener('click', () => {
      store.removeCustomRule(Number(btn.dataset.rmRule));
      renderRulesList();
    });
  });
}

// ---------------------------------------------------------------------
// Modal: backup
// ---------------------------------------------------------------------

function wireBackupModal() {
  document.getElementById('btnExportBackup').addEventListener('click', () => {
    const json = store.exportBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financas-backup-${todayIso()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('btnImportBackup').addEventListener('click', () => {
    document.getElementById('backupFileInput').click();
  });
  document.getElementById('backupFileInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const merge = confirm('OK = mesclar com os dados atuais.\nCancelar = substituir todos os dados atuais pelo backup.');
    try {
      await store.importBackup(text, { merge });
      showToast('Backup importado com sucesso.');
      closeModal('modalBackup');
    } catch (err) {
      alert('Não foi possível importar o backup: ' + err.message);
    }
    e.target.value = '';
  });

  document.getElementById('btnClearAll').addEventListener('click', () => {
    if (confirm('Isso vai apagar TODOS os lançamentos salvos no banco de dados. Tem certeza?')) {
      store.clearAllData();
      showToast('Dados apagados.');
      closeModal('modalBackup');
    }
  });
}

// ---------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------

function showToast(message) {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ---------------------------------------------------------------------

async function boot() {
  await store.init();
  init();
  renderRulesList();
}

// Se este módulo só terminar de executar depois que o DOM já tiver disparado
// "DOMContentLoaded" (ex.: quando há `await`s antes deste ponto, como no build
// autocontido em um único arquivo .html), o evento nunca mais dispara — nesse
// caso já é seguro iniciar direto, pois o documento já está pronto.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
