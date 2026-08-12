const express = require('express');
const db = require('../db/database');

const router = express.Router();

router.get('/', (req, res) => {
  const transacoes = db
    .prepare(
      `SELECT t.*, c.nome AS categoria_nome
       FROM transacoes t
       LEFT JOIN categorias c ON c.id = t.categoria_id
       ORDER BY t.data DESC, t.id DESC`
    )
    .all();
  res.json(transacoes);
});

router.post('/', (req, res) => {
  const { descricao, valor, tipo, categoria_id, data } = req.body;
  if (!descricao || typeof valor !== 'number' || !['receita', 'despesa'].includes(tipo) || !data) {
    return res.status(400).json({ erro: 'Informe descrição, valor, tipo e data válidos.' });
  }
  const info = db
    .prepare('INSERT INTO transacoes (descricao, valor, tipo, categoria_id, data) VALUES (?, ?, ?, ?, ?)')
    .run(descricao, valor, tipo, categoria_id || null, data);
  res.status(201).json({ id: info.lastInsertRowid, descricao, valor, tipo, categoria_id, data });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM transacoes WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

router.get('/resumo', (req, res) => {
  const receitas = db
    .prepare("SELECT COALESCE(SUM(valor), 0) AS total FROM transacoes WHERE tipo = 'receita'")
    .get().total;
  const despesas = db
    .prepare("SELECT COALESCE(SUM(valor), 0) AS total FROM transacoes WHERE tipo = 'despesa'")
    .get().total;
  res.json({ receitas, despesas, saldo: receitas - despesas });
});

module.exports = router;
