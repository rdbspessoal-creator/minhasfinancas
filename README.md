# Assistente Financeiro

Dashboard financeiro pessoal, modular por mês. A interface roda inteiramente no
navegador (sem backend próprio); leitura de PDF e categorização acontecem
localmente. Os lançamentos são salvos em um banco de dados Postgres (Supabase),
o que permite acessar os mesmos dados de qualquer navegador/computador.

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

## Banco de dados

Os dados ficam no projeto Supabase `minhasfinancas-bd`, schema `public`:

| Tabela | Conteúdo |
| --- | --- |
| `categorias` | Categorias do sistema (receita/despesa/poupança/neutro) |
| `transacoes` | Lançamentos manuais e importados |
| `correcoes_categorizacao` | Aprendizado: descrição normalizada → categoria escolhida pelo usuário |
| `regras_categorizacao` | Regras por palavra-chave (`sistema` = padrão do app, `usuario` = criadas na tela de Categorias) |
| `mcc_categorias` | Código MCC de fatura → categoria padrão |
| `tipos_lancamento_categorias` | Tipo de lançamento de extrato → categoria padrão |

O app se conecta usando a chave pública (`publishable key`) em `js/supabase-client.js`.
**Row Level Security está desabilitado nessas tabelas** — qualquer pessoa com a
URL do projeto pode ler/gravar. Isso é aceitável enquanto o app não tem
autenticação de usuário; antes de tratar os dados como sensíveis, habilite RLS
com políticas adequadas (idealmente após adicionar login).

## Como rodar

### Opção recomendada: pasta servida localmente ou publicada como site estático

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
basta apontar para a raiz do projeto, sem nenhum passo de build. É assim que a
versão em produção é servida.

### Build de arquivo único (`assistente-financeiro.html`) — desatualizado

`assistente-financeiro.html` e `scripts/build-standalone.mjs` são de antes da
integração com Supabase e ainda usam `localStorage`. `store.js` hoje depende de
um import externo (`js/supabase-client.js` → CDN do supabase-js) que o script de
build não sabe empacotar corretamente para o arquivo único. Até alguém ajustar
o build para isso, use a versão servida (`index.html`) — ela é a que reflete o
banco de dados atual.

## Estrutura

```
index.html              shell da página e modais
css/styles.css           estilos (com paleta clara/escura)
js/app.js                 controlador principal da interface
js/store.js               estado da UI e persistência (Supabase)
js/supabase-client.js      configuração do cliente Supabase
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

A leitura do PDF e a categorização acontecem localmente no navegador. Os
lançamentos, porém, são enviados e armazenados no banco de dados Supabase (ver
seção "Banco de dados" acima) — não é mais um app 100% offline/local.
