// Categorias padrão do sistema.
// grupo: 'receita' | 'despesa' | 'poupanca' | 'neutro'
//   receita  -> soma no total de receitas do mês
//   despesa  -> soma no total de despesas do mês
//   poupanca -> dinheiro guardado/investido (não é gasto, mas sai do caixa)
//   neutro   -> não entra em nenhum total (ex.: pagamento de fatura, que já
//               está contado como despesa em cada compra do cartão)

export const CATEGORIES = [
  { id: 'salario', nome: 'Salário', grupo: 'receita' },
  { id: 'outros_recebimentos', nome: 'Outros recebimentos', grupo: 'receita' },
  { id: 'rendimentos', nome: 'Rendimentos', grupo: 'receita' },

  { id: 'moradia', nome: 'Moradia', grupo: 'despesa' },
  { id: 'utilidades', nome: 'Contas e utilidades', grupo: 'despesa' },
  { id: 'alimentacao', nome: 'Alimentação', grupo: 'despesa' },
  { id: 'transporte', nome: 'Transporte', grupo: 'despesa' },
  { id: 'saude', nome: 'Saúde e bem-estar', grupo: 'despesa' },
  { id: 'educacao', nome: 'Educação', grupo: 'despesa' },
  { id: 'assinaturas', nome: 'Assinaturas e streaming', grupo: 'despesa' },
  { id: 'lazer', nome: 'Lazer e cultura', grupo: 'despesa' },
  { id: 'compras', nome: 'Compras', grupo: 'despesa' },
  { id: 'servicos_domesticos', nome: 'Serviços domésticos', grupo: 'despesa' },
  { id: 'presentes', nome: 'Presentes', grupo: 'despesa' },
  { id: 'seguros', nome: 'Seguros', grupo: 'despesa' },
  { id: 'pets', nome: 'Pets', grupo: 'despesa' },
  { id: 'tarifas', nome: 'Tarifas bancárias', grupo: 'despesa' },
  { id: 'saque', nome: 'Saque em dinheiro', grupo: 'despesa' },
  { id: 'outros_despesa', nome: 'Outras despesas', grupo: 'despesa' },

  { id: 'investimentos', nome: 'Investimentos / poupança', grupo: 'poupanca' },

  { id: 'pagamento_fatura', nome: 'Pagamento de fatura do cartão', grupo: 'neutro' },
  { id: 'transferencia', nome: 'Transferência interna', grupo: 'neutro' },
];

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

export function categoryName(id) {
  return CATEGORY_BY_ID[id]?.nome || 'Outras despesas';
}

export function categoryGroup(id) {
  return CATEGORY_BY_ID[id]?.grupo || 'despesa';
}

export const GROUP_LABELS = {
  receita: 'Receita',
  despesa: 'Despesa',
  poupanca: 'Poupança/Investimento',
  neutro: 'Neutro (não contabilizado)',
};
