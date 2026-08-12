const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', '..', 'data', 'minhasfinancas.db');
require('fs').mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS categorias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('receita', 'despesa'))
  );

  CREATE TABLE IF NOT EXISTS transacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    descricao TEXT NOT NULL,
    valor REAL NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('receita', 'despesa')),
    categoria_id INTEGER,
    data TEXT NOT NULL,
    FOREIGN KEY (categoria_id) REFERENCES categorias(id)
  );
`);

const seedCount = db.prepare('SELECT COUNT(*) AS total FROM categorias').get().total;
if (seedCount === 0) {
  const inserirCategoria = db.prepare('INSERT INTO categorias (nome, tipo) VALUES (?, ?)');
  const categoriasPadrao = [
    ['Salário', 'receita'],
    ['Freelance', 'receita'],
    ['Alimentação', 'despesa'],
    ['Moradia', 'despesa'],
    ['Transporte', 'despesa'],
    ['Lazer', 'despesa'],
  ];
  const inserirTodas = db.transaction((categorias) => {
    for (const [nome, tipo] of categorias) inserirCategoria.run(nome, tipo);
  });
  inserirTodas(categoriasPadrao);
}

module.exports = db;
