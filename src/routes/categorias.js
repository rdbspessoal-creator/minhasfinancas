const express = require('express');
const db = require('../db/database');

const router = express.Router();

router.get('/', (req, res) => {
  const categorias = db.prepare('SELECT * FROM categorias ORDER BY nome').all();
  res.json(categorias);
});

router.post('/', (req, res) => {
  const { nome, tipo } = req.body;
  if (!nome || !['receita', 'despesa'].includes(tipo)) {
    return res.status(400).json({ erro: 'Informe nome e tipo (receita ou despesa) válidos.' });
  }
  const info = db.prepare('INSERT INTO categorias (nome, tipo) VALUES (?, ?)').run(nome, tipo);
  res.status(201).json({ id: info.lastInsertRowid, nome, tipo });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM categorias WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

module.exports = router;
