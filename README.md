# Assistente Financeiro

Dashboard financeiro pessoal, modular por mês, 100% client-side: roda inteiramente
no navegador, sem backend e sem enviar dados para nenhum servidor. Tudo fica salvo
no `localStorage` do navegador.

## Funcionalidades

- **Lançamento manual** de receitas, despesas e investimentos.
- **Importação de PDF**: extrato bancário e fatura de cartão de crédito. O texto é
  extraído e interpretado no próprio navegador (biblioteca `pdf.js`), com uma tela
  de revisão antes de confirmar a importação.
- **Categorização automática**, usando o tipo de lançamento do extrato e o MCC
  (código do ramo de atividade) da fatura, com regras de palavra-chave como
  reforço. Corrigir a categoria de um lançamento na tabela ensina o sistema a
  classificar aquele mesmo estabelecimento assim da próxima vez.
- **Evita contagem duplicada**: o pagamento da fatura do cartão (que aparece no
  extrato) é tratado como neutro, já que as compras já entram detalhadas pela
  própria fatura.
- **Dashboard**: receitas, despesas, investido no mês, saldo, despesas por
  categoria e evolução mês a mês.
- **Backup**: exportar/importar todos os dados em um arquivo `.json`.

## Como rodar

### Opção mais simples: um único arquivo HTML

`assistente-financeiro.html`, na raiz do projeto, é uma versão autocontida —
CSS, Chart.js, pdf.js e todo o código do app embutidos em um único arquivo.
Basta dar duplo-clique nele para abrir no navegador; não precisa de servidor,
internet ou instalar nada. É o arquivo recomendado para uso do dia a dia.

Ele é gerado a partir do código-fonte em `js/`, `css/` e `index.html` pelo
script `scripts/build-standalone.mjs` (rode `node scripts/build-standalone.mjs`
após alterar o código-fonte, para atualizá-lo).

### Opção para desenvolvimento: pasta servida localmente

O restante do projeto (`index.html` + `js/` + `css/`) usa módulos ES
(`<script type="module">`), que a maioria dos navegadores bloqueia ao abrir o
arquivo diretamente (`file://`). Por isso, para editar e testar o código-fonte,
sirva a pasta com um servidor local simples:

```bash
# opção 1: Python (já vem instalado na maioria dos sistemas)
python3 -m http.server 8080

# opção 2: Node
npx serve .
```

Depois acesse `http://localhost:8080` no navegador.

Também é possível publicar como site estático (GitHub Pages, Netlify, Vercel, etc.) —
basta apontar para a raiz do projeto, sem nenhum passo de build.

## Estrutura

```
index.html              shell da página e modais
css/styles.css           estilos (com paleta clara/escura)
js/app.js                 controlador principal da interface
js/store.js               persistência (localStorage) e estado
js/categories.js          lista de categorias do sistema
js/categorize.js          motor de categorização automática
js/import.js               orquestra a leitura de um PDF até o preview
js/pdf-extract.js          extração de texto/linhas do PDF (pdf.js)
js/parsers/parse-extrato.js  parser de extrato bancário
js/parsers/parse-fatura.js   parser de fatura de cartão
js/charts.js               gráficos (Chart.js)
js/util.js                  formatação de datas/moeda, helpers
vendor/                    pdf.js e Chart.js vendorizados (funciona offline)
```

## Sobre a importação de PDF

Os parsers foram calibrados a partir de um extrato e uma fatura reais fornecidos
como referência. Eles reconhecem linhas de lançamento pela data no início da
linha e por palavras-chave de tipo (extrato) ou pelo código MCC de 4 dígitos
(fatura). Formatos de outros bancos/cartões devem funcionar de forma similar,
mas a tela de revisão antes de importar existe justamente para conferir e
corrigir qualquer linha antes de gravar.

## Privacidade

Nenhum dado sai do seu navegador: a leitura do PDF, a categorização e o
armazenamento acontecem localmente. Não há chamadas de rede para nenhum serviço
externo.
