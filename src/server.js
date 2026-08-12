const path = require('path');
const express = require('express');
const categoriasRouter = require('./routes/categorias');
const transacoesRouter = require('./routes/transacoes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/categorias', categoriasRouter);
app.use('/api/transacoes', transacoesRouter);

app.listen(PORT, () => {
  console.log(`MinhasFinancas rodando em http://localhost:${PORT}`);
});
