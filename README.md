# Minhas Finanças

Aplicação web simples para controle de finanças pessoais: registro de receitas e despesas, categorias e resumo de saldo.

## Stack

- Node.js + Express (API REST)
- SQLite (via `better-sqlite3`) para persistência
- Frontend em HTML/CSS/JavaScript puro

## Como rodar

```bash
npm install
npm start
```

A aplicação sobe em `http://localhost:3000`.

Para desenvolvimento com recarregamento automático:

```bash
npm run dev
```

## Funcionalidades

- Cadastro de transações (receita ou despesa) com descrição, valor, categoria e data
- Listagem de transações ordenada por data
- Exclusão de transações
- Resumo com total de receitas, despesas e saldo
- Categorias pré-cadastradas (Salário, Freelance, Alimentação, Moradia, Transporte, Lazer)

## API

| Método | Rota                    | Descrição                          |
| ------ | ------------------------ | ----------------------------------- |
| GET    | `/api/categorias`        | Lista categorias                    |
| POST   | `/api/categorias`        | Cria categoria                      |
| DELETE | `/api/categorias/:id`    | Remove categoria                    |
| GET    | `/api/transacoes`        | Lista transações                    |
| POST   | `/api/transacoes`        | Cria transação                      |
| DELETE | `/api/transacoes/:id`    | Remove transação                    |
| GET    | `/api/transacoes/resumo` | Retorna totais de receitas/despesas |
