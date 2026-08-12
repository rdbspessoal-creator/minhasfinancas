const formatoMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const form = document.getElementById('formTransacao');
const selectCategoria = document.getElementById('categoria');
const selectTipo = document.getElementById('tipo');
const corpoTabela = document.getElementById('corpoTabela');

async function carregarCategorias() {
  const resposta = await fetch('/api/categorias');
  const categorias = await resposta.json();
  atualizarOpcoesCategoria(categorias);
  selectTipo.addEventListener('change', () => atualizarOpcoesCategoria(categorias));
}

function atualizarOpcoesCategoria(categorias) {
  const tipoSelecionado = selectTipo.value;
  selectCategoria.innerHTML = categorias
    .filter((c) => c.tipo === tipoSelecionado)
    .map((c) => `<option value="${c.id}">${c.nome}</option>`)
    .join('');
}

async function carregarResumo() {
  const resposta = await fetch('/api/transacoes/resumo');
  const resumo = await resposta.json();
  document.getElementById('totalReceitas').textContent = formatoMoeda.format(resumo.receitas);
  document.getElementById('totalDespesas').textContent = formatoMoeda.format(resumo.despesas);
  document.getElementById('totalSaldo').textContent = formatoMoeda.format(resumo.saldo);
}

async function carregarTransacoes() {
  const resposta = await fetch('/api/transacoes');
  const transacoes = await resposta.json();
  corpoTabela.innerHTML = transacoes
    .map(
      (t) => `
      <tr>
        <td>${new Date(t.data + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
        <td>${t.descricao}</td>
        <td>${t.categoria_nome || '-'}</td>
        <td>${t.tipo === 'receita' ? 'Receita' : 'Despesa'}</td>
        <td class="valor-${t.tipo}">${formatoMoeda.format(t.valor)}</td>
        <td><button class="excluir" data-id="${t.id}">Excluir</button></td>
      </tr>`
    )
    .join('');

  corpoTabela.querySelectorAll('.excluir').forEach((botao) => {
    botao.addEventListener('click', async () => {
      await fetch(`/api/transacoes/${botao.dataset.id}`, { method: 'DELETE' });
      await atualizarTudo();
    });
  });
}

async function atualizarTudo() {
  await Promise.all([carregarResumo(), carregarTransacoes()]);
}

form.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const dados = {
    descricao: document.getElementById('descricao').value,
    valor: parseFloat(document.getElementById('valor').value),
    tipo: selectTipo.value,
    categoria_id: selectCategoria.value ? Number(selectCategoria.value) : null,
    data: document.getElementById('data').value,
  };

  const resposta = await fetch('/api/transacoes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  });

  if (resposta.ok) {
    form.reset();
    document.getElementById('data').value = new Date().toISOString().slice(0, 10);
    await atualizarTudo();
  } else {
    const erro = await resposta.json();
    alert(erro.erro || 'Erro ao salvar transação.');
  }
});

document.getElementById('data').value = new Date().toISOString().slice(0, 10);
carregarCategorias().then(atualizarTudo);
