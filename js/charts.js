import { formatBRL } from './util.js';
import { categoryName } from './categories.js';

// Paleta categórica validada (ver skill de dataviz) — ordem fixa, nunca ciclada.
export const PALETTE = {
  blue: { light: '#2a78d6', dark: '#3987e5' },
  orange: { light: '#eb6834', dark: '#d95926' },
};

function isDark() {
  const explicit = document.documentElement.getAttribute('data-theme');
  if (explicit === 'dark') return true;
  if (explicit === 'light') return false;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function chartTextColors() {
  const dark = isDark();
  return {
    text: dark ? '#c3c2b7' : '#52514e',
    grid: dark ? '#2c2c2a' : '#e1e0d9',
    axis: dark ? '#383835' : '#c3c2b7',
  };
}

let categoryChart = null;
let evolutionChart = null;

const MAX_CATEGORY_BARS = 7;

export function renderCategoryChart(canvas, despesasPorCategoria) {
  const entries = Object.entries(despesasPorCategoria)
    .map(([id, valor]) => ({ id, nome: categoryName(id), valor }))
    .sort((a, b) => b.valor - a.valor);

  let top = entries.slice(0, MAX_CATEGORY_BARS);
  const rest = entries.slice(MAX_CATEGORY_BARS);
  if (rest.length) {
    const outros = rest.reduce((s, e) => s + e.valor, 0);
    top.push({ id: 'outros', nome: `Outros (${rest.length})`, valor: outros });
  }

  const { text, grid } = chartTextColors();
  const hue = isDark() ? PALETTE.blue.dark : PALETTE.blue.light;

  if (categoryChart) categoryChart.destroy();
  categoryChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: top.map(e => e.nome),
      datasets: [{
        data: top.map(e => e.valor),
        backgroundColor: hue,
        borderRadius: 4,
        barThickness: 20,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => formatBRL(ctx.parsed.x),
          },
        },
      },
      scales: {
        x: {
          ticks: { color: text, callback: (v) => formatBRL(v) },
          grid: { color: grid },
        },
        y: {
          ticks: { color: text },
          grid: { display: false },
        },
      },
    },
  });
}

export function renderEvolutionChart(canvas, months, receitas, despesas) {
  const { text, grid } = chartTextColors();
  const blue = isDark() ? PALETTE.blue.dark : PALETTE.blue.light;
  const orange = isDark() ? PALETTE.orange.dark : PALETTE.orange.light;

  if (evolutionChart) evolutionChart.destroy();
  evolutionChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        { label: 'Receitas', data: receitas, backgroundColor: blue, borderRadius: 4, barThickness: 20 },
        { label: 'Despesas', data: despesas, backgroundColor: orange, borderRadius: 4, barThickness: 20 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: text }, position: 'top', align: 'end' },
        tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatBRL(ctx.parsed.y)}` } },
      },
      scales: {
        x: { ticks: { color: text }, grid: { display: false } },
        y: { ticks: { color: text, callback: (v) => formatBRL(v) }, grid: { color: grid } },
      },
    },
  });
}
