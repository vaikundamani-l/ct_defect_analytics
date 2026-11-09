/**
 * CT Defect Analytics - Application Logic
 * 100% Client-Side Manufacturing Quality Intelligence
 */
'use strict';

document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="enhancements.css">');
document.querySelector('.filter-panel .section-top span').textContent = 'Date (Excel column 2) · fallback: Xray Date · All rows unique';

const E = CTEngine;
const $ = id => document.getElementById(id);
const fmt = n => (n == null || isNaN(n) ? '0' : Number(n).toLocaleString());
const escapeHTML = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

const palette = ['#3674e8', '#23a79b', '#8b6bd5', '#efae4e', '#e17485', '#6c93b3', '#4cbbca', '#bf8bca', '#708c63', '#c88858'];
const pages = ['Dashboard Overview', 'Machine Analysis', 'SKU & Specification', 'Data Explorer'];
const TABLE_FIELDS = ['Date', 'Shift', ...E.FIELDS.filter(f => f !== 'Date')];
const slicerFields = ['_year', '_month'];

const labels = {
  _year: 'Year',
  _month: 'Month',
  _day: 'Day',
  _period: 'Month / year',
  'Defect Spotting': 'Defect Spotting',
  'Defect Resp': 'Defect Responsibility',
  'TBMMachine ID': 'TBM Machine',
  'Curing Machine ID': 'Curing Machine',
  'Defect Name': 'Defect Name',
  'Defect Group': 'Defect Group',
  'Defect Area': 'Defect Area',
  'Defect Location': 'Defect Location',
  'Curing Tyre Size': 'Tyre Size',
  'TBM GT Code': 'Green Tyre Code'
};

// Saved visible columns from localStorage
let initialVisibleCols = new Set(TABLE_FIELDS);
try {
  const savedCols = JSON.parse(localStorage.getItem('ct_visible_columns') || '[]');
  if (Array.isArray(savedCols) && savedCols.length > 0) {
    initialVisibleCols = new Set(savedCols.filter(c => TABLE_FIELDS.includes(c)));
  }
} catch (e) {}

const state = {
  rows: [],
  filtered: [],
  slicers: {},
  charts: {},
  page: 0,
  query: '',
  dedupe: true,
  tablePage: 1,
  pageSize: 25,
  sort: null,
  ascending: true,
  types: {},
  tops: { group: 10, defectDrill: 10, spotting: 10, curing: 10, size: 10, gtCode: 10 },
  instances: new Map(),
  loaded: false,
  visibleColumns: initialVisibleCols,
  cumulativeInstance: null,
  velocityInstance: null,
  activeDetailRecord: null
};
window.state = state;

const configs = {
  monthDrill: { title: '1. Month-wise defect count', field: '_month', type: 'bar', chronological: true, drill: true },
  dayDrill: { title: '2. Day-wise defect count (SPC Run Chart)', field: '_day', type: 'line', chronological: true, drill: true },
  defectDrill: { title: '3. Defect-wise count', field: 'Defect Name', type: 'pareto', top: true, drill: true, pareto: true },
  spotting: { title: 'Defect Spotting (0°-360°)', field: 'Defect Spotting', type: 'polarArea', top: true },
  group: { title: 'Defect groups', field: 'Defect Group', type: 'bar', top: true, pareto: true },
  area: { title: 'Defect area distribution', field: 'Defect Area', type: 'doughnut' },
  resp: { title: 'Defect responsibility', field: 'Defect Resp', type: 'horizontal' },
  location: { title: 'Defect locations', field: 'Defect Location', type: 'horizontal' },
  trend: { title: 'Monthly defect trend', field: '_period', type: 'line', chronological: true },
  year: { title: 'Year-wise defects', field: '_year', type: 'bar', chronological: true },
  month: { title: 'Month-wise distribution', field: '_month', type: 'bar', chronological: true },
  tbm: { title: 'TBM machine-wise count', field: 'TBMMachine ID', type: 'bar' },
  curing: { title: 'Curing machine code-wise count', field: 'Curing Machine ID', type: 'horizontal', top: true },
  tbmDef: { title: 'Defect name by TBM machine', field: 'TBMMachine ID', split: 'Defect Name', type: 'bar' },
  curingDef: { title: 'Defect name by curing machine', field: 'Curing Machine ID', split: 'Defect Name', type: 'bar' },
  machineGroup: { title: 'Machine-wise defect groups', field: 'TBMMachine ID', split: 'Defect Group', type: 'bar' },
  size: { title: 'Tyre Size defect distribution', field: 'Curing Tyre Size', type: 'pareto', top: true, pareto: true },
  gtCode: { title: 'Green Tyre GT Code breakdown', field: 'TBM GT Code', type: 'bar', top: true, pareto: true },
  sizeGroup: { title: 'Tyre Size × Defect Group', field: 'Curing Tyre Size', split: 'Defect Group', type: 'bar' },
  sizeDef: { title: 'Top defects by Tyre Size', field: 'Curing Tyre Size', split: 'Defect Name', type: 'bar' }
};

const pageCharts = [
  ['monthDrill', 'dayDrill', 'defectDrill', 'spotting', 'resp', 'tbm', 'curing', 'group', 'area', 'location'],
  ['tbm', 'curing', 'tbmDef', 'curingDef', 'machineGroup'],
  ['size', 'gtCode', 'sizeGroup', 'sizeDef'],
  []
];

function display(f, v) {
  return f === '_month' ? E.MONTHS[Number(v) - 1] : f === '_day' ? `Day ${v}` : f === 'Defect Spotting' && v ? `${v}°` : v;
}

function status(content, isHtml = false) {
  const el = $('status');
  if (!el) return;
  if (!content) { el.innerHTML = ''; return; }
  if (isHtml) el.innerHTML = content;
  else el.textContent = content;
}

function destroyCharts() {
  state.instances.forEach(c => c.destroy());
  state.instances.clear();
  if (state.cumulativeInstance) {
    state.cumulativeInstance.destroy();
    state.cumulativeInstance = null;
  }
  if (state.velocityInstance) {
    state.velocityInstance.destroy();
    state.velocityInstance = null;
  }
}

// Sidebar Navigation
$('nav').innerHTML = pages.map((p, i) =>
  `<button data-page="${i}" aria-label="${p}" ${i === 0 ? 'aria-current="page"' : ''} class="${i === 0 ? 'active' : ''}"><span class="nav-icon">${['▦', '⚙', '🛞', '▥'][i]}</span><span class="nav-text">${p}</span></button>`
).join('');

$('nav').onclick = e => {
  const b = e.target.closest('[data-page]');
  if (b) {
    state.page = +b.dataset.page;
    document.querySelectorAll('[data-page]').forEach(x => {
      x.classList.toggle('active', x === b);
      if (x === b) x.setAttribute('aria-current', 'page');
      else x.removeAttribute('aria-current');
    });
    $('pageTitle').textContent = pages[state.page];
    destroyCharts();
    mountCharts();
    render();
  }
};

$('collapse').onclick = () => {
  const collapsed = document.body.classList.toggle('collapsed');
  $('collapse').setAttribute('aria-expanded', String(!collapsed));
  setTimeout(() => state.instances.forEach(c => c.resize()), 50);
};

function defaultDateFocus() {
  const years = [...new Set(state.rows.map(r => r._year).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const currentYear = String(new Date().getFullYear());
  const year = years.includes(currentYear) ? currentYear : years.at(-1);
  if (year) state.slicers._year = new Set([year]);
}

function reset() {
  state.slicers = {};
  state.charts = {};
  state.query = '';
  $('search').value = '';
  state.tablePage = 1;
  state.dedupe = true;
  if (state.loaded) defaultDateFocus();
  renderSlicers();
  render();
}

$('reset').onclick = reset;
$('clearCharts').onclick = () => { state.charts = {}; render(); };
if ($('printReport')) $('printReport').onclick = () => window.print();

// Theme Toggle
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  const btn = $('themeToggle');
  if (btn) btn.textContent = t === 'dark' ? '☀️ Light' : '🌙 Dark';
  localStorage.setItem('ct_theme', t);
  renderCharts();
  renderTireDiagram();
  renderHeatmap();
  renderCumulativeChart();
  renderVelocityChart();
  renderSankey();
}

if ($('themeToggle')) {
  $('themeToggle').onclick = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
}
const savedTheme = localStorage.getItem('ct_theme') || 'light';
if (savedTheme === 'dark') {
  document.documentElement.dataset.theme = 'dark';
  const btn = $('themeToggle');
  if (btn) btn.textContent = '☀️ Light';
}

// Daily Target Badge
function updateTargetBadge() {
  const targetInput = $('targetDefects');
  if (!targetInput) return;
  const target = +targetInput.value || 50;
  const datedRows = state.filtered.filter(row => row._analysisDate);
  const days = new Set(datedRows.map(row => row._analysisDate));
  const avg = days.size ? +(datedRows.length / days.size).toFixed(1) : 0;
  document.querySelector('.target-control').hidden = !days.size;
  const badge = $('targetBadge');
  if (badge) {
    const diff = +(avg - target).toFixed(1);
    if (diff <= 0) {
      badge.className = 'target-badge within';
      badge.textContent = `✓ Avg ${avg}/day (≤ ${target})`;
    } else {
      badge.className = 'target-badge alert';
      badge.textContent = `⚠️ Avg ${avg}/day (+${diff} over target)`;
    }
  }
}

if ($('targetDefects')) {
  $('targetDefects').value = localStorage.getItem('ct_daily_target') || 50;
  $('targetDefects').oninput = e => {
    localStorage.setItem('ct_daily_target', e.target.value);
    updateTargetBadge();
  };
}

// Slicers
function available(f) {
  if (f === '_month') return E.months(state.rows, state.slicers._year);
  return [...new Set(state.rows.map(r => r[f]).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function renderSlicers() {
  $('slicers').innerHTML = slicerFields.map(f => {
    const vals = available(f);
    const set = state.slicers[f] || new Set();
    if (f === '_year' || f === '_month') {
      const contextSlicers = { ...state.slicers };
      if (f === '_month') delete contextSlicers._month;
      if (f === '_year') delete contextSlicers._year;
      const dateRows = E.filter(state.rows, contextSlicers, {}, '', state.dedupe);
      const counts = new Map(E.group(dateRows, f));
      const cls = f === '_year' ? 'year-slicer' : 'month-slicer';
      return `<section class="tile-slicer ${cls}" data-field="${f}">
        <div class="tile-title">
          <span>${labels[f] || f}</span>
          <button data-op="clear">Clear</button>
        </div>
        <div class="tile-options">
          ${vals.map(v => `<button class="tile-option ${set.has(v) ? 'selected' : ''}" data-value="${escapeHTML(v)}" aria-pressed="${set.has(v)}">
            <span>${escapeHTML(display(f, v))}</span>
            <strong>${fmt(counts.get(v) || 0)}</strong>
          </button>`).join('') || '<p class="muted">No available values</p>'}
        </div>
      </section>`;
    }
    return '';
  }).join('');
}

$('slicers').onclick = e => {
  const tile = e.target.closest('.tile-option');
  if (tile) {
    const f = tile.closest('[data-field]').dataset.field;
    const s = state.slicers[f] || new Set();
    const multi = e.ctrlKey || e.shiftKey || e.metaKey;
    if (s.has(tile.dataset.value)) s.delete(tile.dataset.value);
    else {
      if (!multi) s.clear();
      s.add(tile.dataset.value);
    }
    state.slicers[f] = s;
    const scrollLeft = tile.closest('.tile-options').scrollLeft;
    changeSlicer(f);
    const replacement = [...$('slicers').querySelectorAll('.tile-option')].find(button =>
      button.dataset.value === tile.dataset.value && button.closest('[data-field]').dataset.field === f
    );
    if (replacement) {
      replacement.closest('.tile-options').scrollLeft = scrollLeft;
      replacement.focus({ preventScroll: true });
    }
    return;
  }
  const op = e.target.dataset.op;
  if (!op) return;
  const container = e.target.closest('[data-field]');
  const f = container.dataset.field;
  state.slicers[f] = op === 'all' ? new Set(available(f)) : new Set();
  changeSlicer(f);
  $('slicers').querySelector(`[data-field="${f}"] [data-op="${op}"]`)?.focus({ preventScroll: true });
};

function changeSlicer(f) {
  if (f === '_year') {
    const allowed = E.months(state.rows, state.slicers._year);
    state.slicers._month = new Set([...(state.slicers._month || [])].filter(m => allowed.includes(m)));
    state.charts._month = new Set();
    state.charts._day = new Set();
  }
  if (f === '_month') state.charts._day = new Set();
  state.tablePage = 1;
  renderSlicers();
  render();
}

function selectChart(field, value, multi) {
  const old = state.charts[field] || new Set();
  if (old.has(value)) old.delete(value);
  else {
    if (!multi) old.clear();
    old.add(value);
  }
  state.charts[field] = old;
  if (field === '_month') state.charts._day = new Set();
  state.tablePage = 1;
  render();
}

function chips() {
  let html = '';
  for (const kind of ['slicers', 'charts']) {
    for (const [f, s] of Object.entries(state[kind])) {
      if (s.size) {
        html += `<button class="chip" data-kind="${kind}" data-field="${f}">${kind === 'charts' ? 'Chart · ' : ''}${escapeHTML(labels[f] || f)}: ${escapeHTML([...s].map(v => display(f, v)).join(', '))} ×</button>`;
      }
    }
  }
  if (state.query) html += '<button class="chip" data-query="1">Search: ' + escapeHTML(state.query) + ' ×</button>';
  $('chips').innerHTML = html;
}

$('chips').onclick = e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.query) {
    state.query = '';
    $('search').value = '';
  } else {
    state[b.dataset.kind][b.dataset.field] = new Set();
  }
  changeSlicer(b.dataset.field);
};

// Mount Chart Cards
function mountCharts() {
  const ids = pageCharts[state.page];
  $('charts').innerHTML = ids.map(id => {
    const c = configs[id];
    const isWide = id === 'monthDrill';
    const types = id === 'spotting' ? ['polarArea', 'horizontal', 'bar', 'pie', 'doughnut'] :
      c.pareto ? ['pareto', 'horizontal', 'bar', 'line', ...(c.split ? [] : ['doughnut', 'pie'])] :
      ['bar', 'horizontal', 'line', ...(c.split ? [] : ['doughnut', 'pie'])];
    const subText = c.field === 'Defect Spotting' ? 'Defect Spotting · Angular degree distribution · Record count' :
      (c.split ? c.field + ' × ' + c.split : c.field === '_period' ? 'Actual periods from Date / Xray Date' : (labels[c.field] || c.field) + ' · Record count');
    return `<article class="card chart-card ${c.drill ? 'drill-card' : ''} ${isWide ? 'wide' : ''}" id="card-${id}">
      <div class="chart-head">
        <div>
          <h3>${c.title}</h3>
          <p>${escapeHTML(subText)}</p>
        </div>
        <div class="chart-tools">
          ${c.top ? `<select data-top="${id}" aria-label="${c.title} ranking size">
            ${[5, 10, 15, 20, 25, 'All'].map(n => `<option ${String(state.tops[id] || 10) === String(n) ? 'selected' : ''}>${n === 'All' ? 'All' : 'Top ' + n}</option>`).join('')}
          </select>` : ''}
          <select data-type="${id}" aria-label="Chart type for ${c.title}">
            ${types.map(t => `<option value="${t}" ${(state.types[id] || c.type) === t ? 'selected' : ''}>${{ bar: 'Bar', horizontal: 'Horizontal bar', pareto: 'Pareto (80/20)', polarArea: 'Polar Clock (0°-360°)', line: 'Line', doughnut: 'Doughnut', pie: 'Pie' }[t]}</option>`).join('')}
          </select>
          <button data-clear="${id}" title="Clear this chart selection">↺</button>
          <button data-full="${id}" title="Fullscreen chart">⛶</button>
          <button data-png="${id}" title="Download chart PNG">↓ PNG</button>
        </div>
      </div>
      <div class="chart-scroll">
        <div class="canvas-wrap">
          <canvas id="canvas-${id}" role="img" aria-label="${c.title}"></canvas>
        </div>
      </div>
      <div class="chart-foot" id="foot-${id}"></div>
    </article>`;
  }).join('');
}

$('charts').onchange = e => {
  if (e.target.dataset.type) {
    const id = e.target.dataset.type;
    state.types[id] = e.target.value;
    state.instances.get(id)?.destroy();
    state.instances.delete(id);
  }
  if (e.target.dataset.top) {
    state.tops[e.target.dataset.top] = e.target.value.replace('Top ', '');
  }
  renderCharts();
};

$('charts').onclick = async e => {
  const b = e.target.closest('button');
  if (!b) return;
  try {
    if (b.dataset.clear) {
      const c = configs[b.dataset.clear];
      delete state.charts[c.field];
      if (c.split) delete state.charts[c.split];
      render();
    }
    if (b.dataset.full) {
      const card = $('card-' + b.dataset.full);
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (card.requestFullscreen) await card.requestFullscreen();
      else status('Fullscreen is not supported in this browser.');
    }
    if (b.dataset.png) {
      const chart = state.instances.get(b.dataset.png);
      if (chart) download(chart.toBase64Image(), 'CT-' + b.dataset.png + '.png');
    }
  } catch (err) {
    status(err.message);
  }
};

// Chart Plugins
const valueLabels = {
  id: 'values',
  afterDatasetsDraw(chart) {
    const type = chart.config.type;
    const isBar = type === 'bar';
    const isLine = type === 'line';
    const isRound = ['pie', 'doughnut'].includes(type);
    const isPareto = chart.data.datasets.length === 2 && chart.data.datasets[1]?.yAxisID === 'y1';
    if (!isBar && !isLine && !isRound && !isPareto) return;
    const ctx = chart.ctx;
    ctx.save();
    const isDark = document.documentElement.dataset.theme === 'dark';

    if (isPareto) {
      const metaBar = chart.getDatasetMeta(0);
      const metaLine = chart.getDatasetMeta(1);
      ctx.font = 'bold 10px Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      if (metaBar?.data) {
        metaBar.data.forEach((bar, i) => {
          const val = chart.data.datasets[0].data[i];
          if (val != null && bar) {
            const txt = fmt(val);
            ctx.strokeStyle = isDark ? '#111827' : '#ffffff';
            ctx.lineWidth = 3;
            ctx.strokeText(txt, bar.x, bar.y - 4);
            ctx.fillStyle = isDark ? '#93c5fd' : '#2c4c77';
            ctx.fillText(txt, bar.x, bar.y - 4);
          }
        });
      }
      if (metaLine?.data) {
        metaLine.data.forEach((pt, i) => {
          const val = chart.data.datasets[1].data[i];
          if (val != null && pt && !pt.skip) {
            const txt = val + '%';
            ctx.strokeStyle = isDark ? '#111827' : '#ffffff';
            ctx.lineWidth = 3;
            ctx.strokeText(txt, pt.x, pt.y - 7);
            ctx.fillStyle = '#e17485';
            ctx.fillText(txt, pt.x, pt.y - 7);
          }
        });
      }
      const y1Scale = chart.scales?.y1;
      if (y1Scale && chart.chartArea) {
        const y80 = y1Scale.getPixelForValue(80);
        const left = chart.chartArea.left, right = chart.chartArea.right;
        ctx.strokeStyle = '#e17485';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(left, y80);
        ctx.lineTo(right, y80);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = 'bold 10px Segoe UI, sans-serif';
        ctx.fillStyle = '#e17485';
        ctx.fillText('80% Threshold', right - 75, y80 - 4);
      }
      ctx.restore();
      return;
    }

    const isHorizontal = chart.options.indexAxis === 'y';
    if (chart.data.datasets.length > 1 && isBar) {
      if (chart.options.scales?.x?.stacked || chart.options.scales?.y?.stacked) {
        const numItems = chart.data.labels.length;
        if (numItems <= 35) {
          ctx.font = 'bold 10px Segoe UI, sans-serif';
          ctx.textAlign = isHorizontal ? 'left' : 'center';
          ctx.textBaseline = isHorizontal ? 'middle' : 'bottom';
          for (let i = 0; i < numItems; i++) {
            let total = 0;
            chart.data.datasets.forEach(ds => { total += Number(ds.data[i]) || 0; });
            if (!total) continue;
            let topElem = null;
            for (let d = chart.data.datasets.length - 1; d >= 0; d--) {
              const meta = chart.getDatasetMeta(d);
              if (!meta.hidden && meta.data[i]) { topElem = meta.data[i]; break; }
            }
            if (topElem && typeof topElem.x === 'number' && typeof topElem.y === 'number') {
              const txt = fmt(total);
              if (isHorizontal) {
                ctx.fillStyle = isDark ? '#93c5fd' : '#2c4c77';
                ctx.fillText(txt, topElem.x + 6, topElem.y);
              } else {
                ctx.strokeStyle = isDark ? '#111827' : '#ffffff';
                ctx.lineWidth = 3;
                ctx.strokeText(txt, topElem.x, topElem.y - 4);
                ctx.fillStyle = isDark ? '#93c5fd' : '#2c4c77';
                ctx.fillText(txt, topElem.x, topElem.y - 4);
              }
            }
          }
        }
      }
      ctx.restore();
      return;
    }

    if (isLine) {
      const ds = chart.data.datasets[0];
      const dataVals = ds?.data || [];
      const meta = chart.getDatasetMeta(0);
      if (!meta || !meta.data || !meta.data.length) { ctx.restore(); return; }
      ctx.font = 'bold 10px Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      meta.data.forEach((pt, i) => {
        const val = dataVals[i];
        if (val != null && !isNaN(val) && pt && typeof pt.x === 'number' && typeof pt.y === 'number' && !pt.skip) {
          const txt = fmt(val);
          ctx.strokeStyle = isDark ? '#111827' : '#ffffff';
          ctx.lineWidth = 3;
          ctx.strokeText(txt, pt.x, pt.y - 7);
          ctx.fillStyle = isDark ? '#93c5fd' : '#1c3d73';
          ctx.fillText(txt, pt.x, pt.y - 7);
        }
      });
      ctx.restore();
      return;
    }

    if (chart.data.datasets.length !== 1) { ctx.restore(); return; }
    const ds = chart.data.datasets[0];
    const dataVals = ds?.data || [];
    const meta = chart.getDatasetMeta(0);
    if (!meta || !meta.data || !meta.data.length) { ctx.restore(); return; }

    if (isBar) {
      if (!isHorizontal && chart.data.labels.length > 35) { ctx.restore(); return; }
      ctx.font = isHorizontal ? '11px Segoe UI, sans-serif' : 'bold 10px Segoe UI, sans-serif';
      meta.data.forEach((bar, i) => {
        const val = dataVals[i];
        if (val == null || isNaN(val) || !bar) return;
        const txt = fmt(val);
        if (isHorizontal) {
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = isDark ? '#cbd5e1' : '#334e68';
          ctx.fillText(txt, bar.x + 6, bar.y);
        } else {
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.strokeStyle = isDark ? '#111827' : '#ffffff';
          ctx.lineWidth = 3;
          ctx.strokeText(txt, bar.x, bar.y - 4);
          ctx.fillStyle = isDark ? '#93c5fd' : '#2c4c77';
          ctx.fillText(txt, bar.x, bar.y - 4);
        }
      });
    } else if (isRound) {
      const total = dataVals.reduce((a, b) => a + Number(b || 0), 0);
      if (!total) { ctx.restore(); return; }
      meta.data.forEach((element, i) => {
        const val = Number(dataVals[i] || 0);
        if (!val) return;
        const pct = val / total;
        if (pct < 0.035) return;
        const angle = (element.startAngle + element.endAngle) / 2;
        const innerR = element.innerRadius || 0, outerR = element.outerRadius;
        const r = innerR + (outerR - innerR) * (innerR > 0 ? 0.55 : 0.65);
        const x = element.x + r * Math.cos(angle);
        const y = element.y + r * Math.sin(angle);
        const rawLabel = String(chart.data.labels[i] || '');
        const countStr = fmt(val);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.55)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 1;
        if (pct >= 0.065) {
          ctx.font = 'bold 11px Segoe UI, sans-serif';
          ctx.fillText(rawLabel, x, y - 7);
          ctx.font = '10px Segoe UI, sans-serif';
          ctx.fillText(countStr, x, y + 7);
        } else {
          ctx.font = 'bold 10px Segoe UI, sans-serif';
          ctx.fillText(`${rawLabel} (${countStr})`, x, y);
        }
      });
    }
    ctx.restore();
  }
};

const whiteBackground = {
  id: 'whiteBackground',
  beforeDraw(chart) {
    const ctx = chart.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = document.documentElement.dataset.theme === 'dark' ? '#111827' : '#fff';
    ctx.fillRect(0, 0, chart.width, chart.height);
    ctx.restore();
  }
};

// Render Primary Charts
function renderCharts() {
  if (!state.loaded || typeof Chart === 'undefined') return;
  for (const id of pageCharts[state.page]) {
    const c = configs[id];
    const type = state.types[id] || c.type;
    const round = ['pie', 'doughnut', 'polarArea'].includes(type);
    const isPolar = type === 'polarArea';
    const isPareto = type === 'pareto';
    const horizontal = type === 'horizontal';
    const chartFilters = { ...state.charts, [c.field]: new Set() };
    let chartRows = E.filter(state.rows, state.slicers, chartFilters, state.query, state.dedupe);
    const hasYear = (state.slicers._year?.size || state.charts._year?.size);
    const hasMonth = (state.slicers._month?.size || state.charts._month?.size);
    if (id === 'monthDrill' && !hasYear) chartRows = [];
    if (id === 'dayDrill' && !hasMonth) chartRows = [];
    let pairs = E.group(chartRows, c.field);
    if (c.chronological) pairs.sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
    const totalCategories = pairs.length;
    const top = state.tops[id] || 10;
    if (c.top && top !== 'All') pairs = pairs.slice(0, +top);
    const keys = pairs.map(p => p[0]);
    const selected = state.charts[c.field] || new Set();
    let series = [];
    let datasets;
    let spcStats = null;

    if (id === 'dayDrill' && hasMonth && keys.length > 1) {
      spcStats = E.spc(chartRows);
      if (spcStats) {
        const vals = keys.map(k => spcStats.dayMap.get(k) || 0);
        const dayColors = keys.map(k => {
          const v = spcStats.dayMap.get(k) || 0;
          if (v > spcStats.ucl) return '#ef4444';
          if (v > spcStats.uwl) return '#f59e0b';
          return '#3674e8';
        });
        const dayRadii = keys.map(k => {
          const v = spcStats.dayMap.get(k) || 0;
          return v > spcStats.ucl ? 6 : v > spcStats.uwl ? 5 : 3.5;
        });
        datasets = [
          {
            type: 'line',
            label: 'Defect records',
            data: vals,
            borderColor: '#3674e8',
            backgroundColor: '#3674e8',
            pointBackgroundColor: dayColors,
            pointBorderColor: keys.map(k => (spcStats.dayMap.get(k) || 0) > spcStats.ucl ? '#ffffff' : '#3674e8'),
            pointBorderWidth: keys.map(k => (spcStats.dayMap.get(k) || 0) > spcStats.ucl ? 2 : 1),
            pointRadius: dayRadii,
            tension: 0.2,
            fill: false
          },
          {
            type: 'line',
            label: `UCL (3σ: ${spcStats.ucl})`,
            data: keys.map(() => spcStats.ucl),
            borderColor: '#e17485',
            borderDash: [5, 5],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false
          },
          {
            type: 'line',
            label: `Mean (x̄: ${spcStats.mean})`,
            data: keys.map(() => spcStats.mean),
            borderColor: '#8ba3c7',
            borderDash: [3, 3],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false
          }
        ];
        if (spcStats.lcl > 0) {
          datasets.push({
            type: 'line',
            label: `LCL (3σ: ${spcStats.lcl})`,
            data: keys.map(() => spcStats.lcl),
            borderColor: '#10b981',
            borderDash: [5, 5],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false
          });
        }
      }
    } else if (isPareto) {
      const totalSum = pairs.reduce((sum, p) => sum + p[1], 0);
      let running = 0;
      const cumPct = pairs.map(p => {
        running += p[1];
        return totalSum ? +(running / totalSum * 100).toFixed(1) : 0;
      });
      datasets = [
        {
          type: 'bar',
          label: 'Defect records',
          data: pairs.map(p => p[1]),
          yAxisID: 'y',
          backgroundColor: palette[0] + 'cc',
          borderColor: palette[0],
          borderWidth: 1,
          borderRadius: 4
        },
        {
          type: 'line',
          label: 'Cumulative % (80/20)',
          data: cumPct,
          yAxisID: 'y1',
          borderColor: '#e17485',
          backgroundColor: '#e17485',
          tension: 0.25,
          pointRadius: 4,
          pointBackgroundColor: '#e17485',
          fill: false
        }
      ];
    } else if (isPolar) {
      datasets = [{
        label: 'Defect records',
        data: pairs.map(p => p[1]),
        backgroundColor: keys.map((_, i) => palette[i % palette.length] + 'dd')
      }];
    } else if (c.split) {
      series = E.group(chartRows, c.split).map(p => p[0]);
      const counts = new Map();
      chartRows.forEach(r => {
        if (r[c.field] && r[c.split]) {
          const k = JSON.stringify([r[c.field], r[c.split]]);
          counts.set(k, (counts.get(k) || 0) + 1);
        }
      });
      datasets = series.map((s, i) => ({
        label: s,
        data: keys.map(k => counts.get(JSON.stringify([k, s])) || 0),
        backgroundColor: palette[i % palette.length] + 'cc',
        borderColor: palette[i % palette.length],
        borderWidth: 1,
        tension: 0.25,
        pointRadius: 3
      }));
    } else {
      datasets = [{
        label: 'Defect records',
        data: pairs.map(p => p[1]),
        backgroundColor: keys.map((k, i) => selected.has(k) ? '#153f98' : round ? palette[i % palette.length] + 'dd' : '#4a80e4cc'),
        borderColor: type === 'line' ? '#3674e8' : keys.map(k => selected.has(k) ? '#102c67' : '#ffffff'),
        borderWidth: round ? 2 : 1,
        borderRadius: round ? 0 : 4,
        tension: 0.25,
        pointRadius: 4,
        fill: false
      }];
    }

    const isDark = document.documentElement.dataset.theme === 'dark';
    const gridColor = isDark ? '#1e293b' : '#edf1f6';
    const wrap = $('canvas-' + id).parentElement;
    wrap.style.height = (round ? 360 : (horizontal ? Math.max(300, keys.length * 29) : 300)) + 'px';

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      indexAxis: horizontal ? 'y' : 'x',
      layout: { padding: { right: horizontal ? 48 : isPareto ? 20 : 15, top: 24, left: 10, bottom: 10 } },
      interaction: { mode: 'nearest', intersect: true },
      plugins: {
        legend: {
          display: round || isPareto || Boolean(c.split) || (id === 'dayDrill' && Boolean(spcStats)),
          position: 'bottom',
          labels: {
            boxWidth: 9,
            font: { size: 10 },
            generateLabels(chart) {
              if (isPareto || !round || (id === 'dayDrill' && spcStats)) return Chart.defaults.plugins.legend.labels.generateLabels(chart);
              const data = chart.data;
              if (data.labels.length && data.datasets.length) {
                const ds = data.datasets[0];
                const total = ds.data.reduce((a, b) => a + Number(b || 0), 0);
                return data.labels.map((l, i) => {
                  const val = Number(ds.data[i] || 0);
                  const pct = total ? (val / total * 100).toFixed(1) + '%' : '';
                  return {
                    text: `${l}: ${fmt(val)} (${pct})`,
                    fillStyle: ds.backgroundColor?.[i] || palette[i % palette.length],
                    strokeStyle: ds.borderColor?.[i] || '#ffffff',
                    lineWidth: ds.borderWidth || 1,
                    hidden: isNaN(ds.data[i]) || chart.getDatasetMeta(0).data[i]?.hidden,
                    index: i
                  };
                });
              }
              return [];
            }
          }
        },
        tooltip: {
          callbacks: {
            title: items => round && c.field === 'Defect Spotting' ? `${items[0]?.label} Spotting Angle` : items[0]?.label || '',
            label: ctx => {
              if (isPareto) return `${ctx.dataset.label}: ${ctx.datasetIndex === 1 ? ctx.raw + '%' : fmt(Number(ctx.raw)) + ' records'}`;
              if (round && ctx.dataset.data) {
                const total = ctx.dataset.data.reduce((a, b) => a + Number(b || 0), 0);
                const val = Number(ctx.raw || 0);
                const pct = total ? (val / total * 100).toFixed(1) + '%' : '';
                return `Defect records: ${fmt(val)} (${pct})`;
              }
              return `${ctx.dataset.label}: ${fmt(Number(ctx.raw))} records`;
            }
          }
        }
      },
      onClick: (event, elements) => {
        if (!elements.length) return;
        const el = elements[0];
        const multi = Boolean(event.native?.ctrlKey || event.native?.shiftKey || event.native?.metaKey);
        if (c.split && event.native?.altKey) selectChart(c.split, series[el.datasetIndex], multi);
        else selectChart(c.field, keys[el.index], multi);
      }
    };

    if (isPareto) {
      options.scales = {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: { beginAtZero: true, position: 'left', grid: { color: gridColor }, ticks: { font: { size: 10 }, precision: 0 }, title: { display: true, text: 'Defect Count', font: { size: 10 } } },
        y1: { beginAtZero: true, max: 100, position: 'right', grid: { drawOnChartArea: false }, ticks: { font: { size: 10 }, callback: v => v + '%' }, title: { display: true, text: 'Cumulative %', font: { size: 10 } } }
      };
    } else if (isPolar) {
      options.scales = { r: { beginAtZero: true, ticks: { backdropColor: 'transparent', font: { size: 9 }, precision: 0 }, grid: { color: gridColor } } };
    } else if (!round) {
      options.scales = {
        x: { stacked: Boolean(c.split) && type !== 'line', grid: { display: horizontal, color: gridColor }, ticks: { font: { size: 10 }, precision: 0 }, grace: horizontal ? '10%' : 0 },
        y: { stacked: Boolean(c.split) && type !== 'line', beginAtZero: true, grid: { display: !horizontal, color: gridColor }, ticks: { font: { size: 10 }, precision: 0 }, grace: !horizontal ? '12%' : 0 }
      };
    }

    const chartType = isPareto ? 'bar' : isPolar ? 'polarArea' : horizontal ? 'bar' : type;
    let chart = state.instances.get(id);
    if (!chart) {
      chart = new Chart($('canvas-' + id), {
        type: chartType,
        data: { labels: keys.map(k => display(c.field, k)), datasets },
        options,
        plugins: [valueLabels, whiteBackground]
      });
      state.instances.set(id, chart);
    } else {
      chart.data = { labels: keys.map(k => display(c.field, k)), datasets };
      chart.options = options;
      chart.update('none');
    }

    if (id === 'defectDrill') {
      const sub = $('card-defectDrill')?.querySelector('.chart-head p');
      if (sub) {
        const selMonths = [...(state.slicers._month || []), ...(state.charts._month || [])];
        sub.textContent = hasMonth ? `Defect Name · ${selMonths.map(m => display('_month', m)).join(', ')} · Record count` : 'Defect Name · Total across all months · Record count';
      }
    }
    if (id === 'dayDrill') {
      const card = $('card-dayDrill');
      if (card) {
        let badge = card.querySelector('.spc-badge');
        if (!badge) {
          badge = document.createElement('span');
          card.querySelector('.chart-head > div')?.append(badge);
        }
        if (spcStats && hasMonth) {
          if (spcStats.anomalies.length) {
            badge.className = 'spc-badge spc-alert';
            badge.textContent = `⚠️ ${spcStats.anomalies.length} Spikes (>3σ)`;
          } else {
            badge.className = 'spc-badge spc-ok';
            badge.textContent = '✓ 3σ Stable';
          }
          badge.hidden = false;
        } else {
          badge.hidden = true;
        }
      }
    }

    const omitted = chartRows.filter(r => !r[c.field] || (c.split && !r[c.split])).length;
    const instruction = id === 'monthDrill' && !hasYear ? 'Select a Year tile above to display month-wise defect counts.' :
      id === 'dayDrill' && !hasMonth ? 'Click a month bar above or select a Month tile to display day-wise analysis.' :
      'No matching records with values for this chart.';
    const drillNote = id === 'defectDrill' ? (hasMonth ? ' · Filtered by selected month' : ' · Total across all months') : '';
    const spcNote = spcStats ? (spcStats.anomalies.length ? ` · ⚠️ ${spcStats.anomalies.length} Out-of-Control Spikes detected (> UCL ${spcStats.ucl} defects/day)` : ' · Process count stable within 3σ control limits') : '';
    $('foot-' + id).textContent = keys.length ?
      `${c.top ? 'Showing ' + keys.length + ' of ' + totalCategories + ' categories · ' : ''}${fmt(omitted)} records with missing chart fields excluded · Click to filter; Ctrl/Shift to multi-select${c.split ? '; Alt-click selects series' : ''}${drillNote}${spcNote}.` :
      instruction;
  }
}

// Main Render Function
function render() {
  state.filtered = E.filter(state.rows, state.slicers, state.charts, state.query, state.dedupe);
  chips();

  // KPIs with Trend Badges (Feature #1)
  const values = E.kpis(state.filtered);
  const names = ['Total Defect Records', 'Unique Defect Barcodes', 'Total Defect Names', 'Total Defect Groups', 'Total Defect Areas', 'Total Responsible Categories'];
  const trends = state.loaded ? E.trendBadges(state.rows, state.slicers) : null;

  $('kpis').innerHTML = names.map((n, i) => {
    let trendHtml = '';
    if (trends && state.loaded) {
      let changeVal = null;
      if (i === 0) changeVal = trends.totalChange;
      else if (i === 1) changeVal = trends.barcodeChange;
      else if (i === 2) changeVal = trends.defectNameChange;

      if (changeVal !== null && !isNaN(changeVal)) {
        const isUp = changeVal > 0;
        const isDown = changeVal < 0;
        const cls = isUp ? 'up' : isDown ? 'down' : 'flat';
        const arrow = isUp ? '↑' : isDown ? '↓' : '→';
        trendHtml = `<div class="kpi-trend ${cls}">${arrow} ${Math.abs(changeVal)}% vs prev period</div>`;
      }
    }
    return `<div class="card kpi" style="--accent:${palette[i]}">
      <div class="kpi-label">${n}</div>
      <div class="kpi-value">${state.loaded ? fmt(values[i]) : '—'}</div>
      <div class="kpi-note">${i === 0 ? 'All unique matching records' : 'Distinct non-empty values'}</div>
      ${trendHtml}
    </div>`;
  }).join('');

  $('filteredCount').textContent = state.loaded ? `${fmt(state.filtered.length)} of ${fmt(state.rows.length)} unique records` : 'Awaiting workbook';
  $('welcome').hidden = state.loaded;
  $('kpis').hidden = !state.loaded;
  document.querySelector('.filter-panel').hidden = !state.loaded;
  for (const id of ['reset', 'savedFilters', 'printReport']) $(id).disabled = !state.loaded;
  $('charts').hidden = !state.loaded;
  $('explorer').hidden = !state.loaded;

  // Page 0 Visibility (Dashboard Overview)
  const isP0 = state.loaded && state.page === 0;
  if ($('advancedVisuals')) $('advancedVisuals').hidden = !isP0;
  if ($('weeklySummarySection')) $('weeklySummarySection').hidden = !isP0;
  if ($('machineIntelSection')) $('machineIntelSection').hidden = !isP0;
  if ($('paretoProgressSection')) $('paretoProgressSection').hidden = !isP0;
  if ($('cumulativeSection')) $('cumulativeSection').hidden = !isP0;
  if ($('velocitySection')) $('velocitySection').hidden = !isP0;
  if ($('scorecardSection')) $('scorecardSection').hidden = !isP0;

  // Page 1 Visibility (Machine Analysis)
  const isP1 = state.loaded && state.page === 1;
  if ($('heatmapSection')) $('heatmapSection').hidden = !isP1;
  if ($('sankeySection')) $('sankeySection').hidden = !isP1;

  updateTargetBadge();

  if (isP0) {
    renderRootCause();
    renderTireDiagram();
    renderWeeklySummary();
    renderRepeatOffenders();
    renderMachineHealth();
    renderParetoProgress();
    renderQualityScorecard();
    renderCumulativeChart();
    renderVelocityChart();
  }

  if (isP1) {
    renderHeatmap();
    renderSankey();
  }

  // Summary Text & YoY
  const comp = E.comparison(state.rows, state.slicers, state.charts, state.query, state.dedupe);
  let summary = '';
  if (state.loaded && state.page === 0) {
    const lead = E.group(state.filtered, 'Defect Resp')[0];
    const topTbm = E.group(state.filtered, 'TBMMachine ID')[0];
    const topCuring = E.group(state.filtered, 'Curing Machine ID')[0];
    const topLoc = E.group(state.filtered, 'Defect Location')[0];
    const parts = [];
    if (lead) parts.push(`Highest responsibility: <strong>${escapeHTML(lead[0])}</strong> · ${fmt(lead[1])} records (${(lead[1] / state.filtered.length * 100).toFixed(1)}% of matching records)`);
    if (topTbm) parts.push(`Leading TBM machine: <strong>${escapeHTML(topTbm[0])}</strong> (${fmt(topTbm[1])} records)`);
    if (topCuring) parts.push(`Leading Curing machine: <strong>${escapeHTML(topCuring[0])}</strong> (${fmt(topCuring[1])} records)`);
    if (topLoc) parts.push(`Top location: <strong>${escapeHTML(topLoc[0])}</strong> (${fmt(topLoc[1])} records)`);
    const yoyText = comp ? `Year-over-year, matched available months: <strong>${comp.percent >= 0 ? '+' : ''}${comp.percent.toFixed(1)}%</strong> · ${fmt(comp.cur)} in ${comp.year} versus ${fmt(comp.prior)} in ${comp.prev}, across ${comp.months} shared months.` : '';
    summary = (yoyText ? yoyText + '<br>' : '') + (parts.length ? parts.join(' · ') : 'No non-empty categories in this selection.');
  }
  $('summary').innerHTML = summary ? '<div class="insight">' + summary + '</div>' : '';

  renderCharts();
  renderTable();
}

// Root Cause Intelligence Assistant
function renderRootCause(explicitDefect) {
  if (!state.loaded) return;
  const select = $('rootCauseSelect');
  const topDefects = E.group(state.filtered, 'Defect Name');
  if (!topDefects.length) {
    $('rootCauseBody').innerHTML = '<p class="muted">No defect records in current selection.</p>';
    return;
  }
  const currentSelDefect = [...(state.charts['Defect Name'] || [])][0];
  const target = explicitDefect || currentSelDefect || select.value || topDefects[0][0];
  select.innerHTML = topDefects.slice(0, 25).map(d => `<option value="${escapeHTML(d[0])}" ${d[0] === target ? 'selected' : ''}>${escapeHTML(d[0])} (${fmt(d[1])})</option>`).join('');
  select.onchange = e => renderRootCause(e.target.value);
  const rc = E.rootCause(state.filtered, target);
  if (!rc) return;

  let html = `<div class="rc-header-badge">🎯 Analyzing Defect: <strong>${escapeHTML(rc.defectName)}</strong> · ${fmt(rc.defectCount)} records (${rc.defectShare}% of current selection)</div><div class="rc-grid">`;
  if (rc.topCuring) html += `<div class="rc-tile" data-field="Curing Machine ID" data-val="${escapeHTML(rc.topCuring.id)}"><div class="rc-tile-lbl">Top Curing Machine</div><div class="rc-tile-val">${escapeHTML(rc.topCuring.id)}</div><div class="rc-tile-sub">${fmt(rc.topCuring.count)} records (${rc.topCuring.pct}%)</div></div>`;
  if (rc.topTbm) html += `<div class="rc-tile" data-field="TBMMachine ID" data-val="${escapeHTML(rc.topTbm.id)}"><div class="rc-tile-lbl">Top TBM Machine</div><div class="rc-tile-val">${escapeHTML(rc.topTbm.id)}</div><div class="rc-tile-sub">${fmt(rc.topTbm.count)} records (${rc.topTbm.pct}%)</div></div>`;
  if (rc.topSize) html += `<div class="rc-tile" data-field="Curing Tyre Size" data-val="${escapeHTML(rc.topSize.size)}"><div class="rc-tile-lbl">Most Affected Tyre Size</div><div class="rc-tile-val">${escapeHTML(rc.topSize.size)}</div><div class="rc-tile-sub">${fmt(rc.topSize.count)} records (${rc.topSize.pct}%)</div></div>`;
  if (rc.topArea) html += `<div class="rc-tile" data-field="Defect Area" data-val="${escapeHTML(rc.topArea.name)}"><div class="rc-tile-lbl">Primary Physical Zone</div><div class="rc-tile-val">${escapeHTML(rc.topArea.name)}</div><div class="rc-tile-sub">${rc.topLoc ? escapeHTML(rc.topLoc.name) + ': ' : ''}${fmt(rc.topArea.count)} (${rc.topArea.pct}%)</div></div>`;
  if (rc.topSpot) html += `<div class="rc-tile" data-field="Defect Spotting" data-val="${escapeHTML(rc.topSpot.angle)}"><div class="rc-tile-lbl">Circumference Hotspot</div><div class="rc-tile-val">${escapeHTML(rc.topSpot.angle)}°</div><div class="rc-tile-sub">${fmt(rc.topSpot.count)} records (${rc.topSpot.pct}%)</div></div>`;
  html += '</div>';

  const takeawayParts = [];
  if (rc.topCuring && rc.topCuring.pct >= 25) takeawayParts.push(`Heavily concentrated on Curing Machine <strong>${escapeHTML(rc.topCuring.id)}</strong> (${rc.topCuring.pct}%)`);
  if (rc.topSize && rc.topSize.pct >= 30) takeawayParts.push(`Predominant on Tyre Size <strong>${escapeHTML(rc.topSize.size)}</strong>`);
  if (rc.topArea) takeawayParts.push(`Primary physical zone is <strong>${escapeHTML(rc.topArea.name)}</strong>${rc.topSpot ? ` around ${rc.topSpot.angle}°` : ''}`);
  html += `<div class="rc-takeaway">💡 <strong>Diagnostic Takeaway:</strong> ${takeawayParts.length ? takeawayParts.join(' · ') + '.' : 'Balanced distribution across machines and physical zones with no single outlier.'} <small>(Click any tile above to isolate that factor)</small></div>`;
  $('rootCauseBody').innerHTML = html;
}

if ($('rootCauseBody')) {
  $('rootCauseBody').onclick = e => {
    const t = e.target.closest('.rc-tile');
    if (t) {
      const f = t.dataset.field, v = t.dataset.val;
      state.charts[f] = new Set([v]);
      render();
    }
  };
}

// Tire Anatomical Cross-Section Map
function renderTireDiagram() {
  if (!state.loaded) return;
  const stats = E.getTireZoneStats(state.filtered);
  const colorForPct = pct => {
    if (pct >= 35) return '#ef4444';
    if (pct >= 20) return '#f59e0b';
    if (pct >= 10) return '#3b82f6';
    return '#64748b';
  };
  const activeArea = [...(state.charts['Defect Area'] || [])][0];
  const isDark = document.documentElement.dataset.theme === 'dark';
  const rimStroke = isDark ? '#334155' : '#cbd5e1';
  const svg = `<svg viewBox="0 0 460 280" class="tire-svg" style="width:100%;max-width:320px;height:auto;" role="img" aria-label="Tire Cross Section">
    <path d="M 80,240 L 140,240 L 150,250 L 310,250 L 320,240 L 380,240" fill="none" stroke="${rimStroke}" stroke-width="4" stroke-dasharray="6,4"/>
    <text x="230" y="268" text-anchor="middle" fill="${isDark ? '#64748b' : '#94a3b8'}" font-size="10" font-weight="600">WHEEL RIM SEAT</text>
    <path id="svg-zone-Crown" data-zone="Crown" class="tire-zone ${activeArea === 'Crown' ? 'selected' : ''}" d="M 160,35 Q 230,22 300,35 L 305,58 Q 230,46 155,58 Z" fill="${colorForPct(stats.Crown.pct)}" />
    <text x="230" y="47" text-anchor="middle" fill="#fff" font-size="11" font-weight="bold" pointer-events="none">TREAD / CROWN</text>
    <path id="svg-zone-Shoulder-L" data-zone="Shoulder" class="tire-zone ${activeArea === 'Shoulder' ? 'selected' : ''}" d="M 160,35 Q 125,48 105,75 L 125,92 Q 138,68 155,58 Z" fill="${colorForPct(stats.Shoulder.pct)}" />
    <path id="svg-zone-Shoulder-R" data-zone="Shoulder" class="tire-zone ${activeArea === 'Shoulder' ? 'selected' : ''}" d="M 300,35 Q 335,48 355,75 L 335,92 Q 322,68 305,58 Z" fill="${colorForPct(stats.Shoulder.pct)}" />
    <path id="svg-zone-Sidewall-L" data-zone="Sidewall" class="tire-zone ${activeArea === 'Sidewall' ? 'selected' : ''}" d="M 105,75 Q 85,130 100,195 L 120,190 Q 105,135 125,92 Z" fill="${colorForPct(stats.Sidewall.pct)}" />
    <path id="svg-zone-Sidewall-R" data-zone="Sidewall" class="tire-zone ${activeArea === 'Sidewall' ? 'selected' : ''}" d="M 355,75 Q 375,130 360,195 L 340,190 Q 355,135 335,92 Z" fill="${colorForPct(stats.Sidewall.pct)}" />
    <path id="svg-zone-Bead-L" data-zone="Bead" class="tire-zone ${activeArea === 'Bead' ? 'selected' : ''}" d="M 100,195 Q 110,238 135,238 L 138,215 Q 120,215 120,190 Z" fill="${colorForPct(stats.Bead.pct)}" />
    <path id="svg-zone-Bead-R" data-zone="Bead" class="tire-zone ${activeArea === 'Bead' ? 'selected' : ''}" d="M 360,195 Q 350,238 325,238 L 322,215 Q 340,215 340,190 Z" fill="${colorForPct(stats.Bead.pct)}" />
    <path id="svg-zone-Innerliner" data-zone="Innerliner" class="tire-zone ${activeArea === 'Innerliner' ? 'selected' : ''}" d="M 138,215 Q 125,135 175,75 Q 230,62 285,75 Q 335,135 322,215 L 314,213 Q 325,140 280,82 Q 230,70 180,82 Q 135,140 146,213 Z" fill="${colorForPct(stats.Innerliner.pct)}" />
  </svg>`;

  const zones = [
    { name: 'Crown', label: 'Crown / Tread', desc: 'Tire road contact patch' },
    { name: 'Shoulder', label: 'Shoulder', desc: 'Upper tread transition zone' },
    { name: 'Sidewall', label: 'Sidewall', desc: 'Vertical flexible flanks' },
    { name: 'Bead', label: 'Bead Area', desc: 'Wheel rim anchor contact' },
    { name: 'Innerliner', label: 'Innerliner', desc: 'Interior pneumatic lining' }
  ];

  let legendHtml = '<div class="tire-legend">';
  zones.forEach(z => {
    const s = stats[z.name] || { count: 0, pct: 0 };
    const isAct = activeArea === z.name;
    legendHtml += `<div class="tire-legend-item ${isAct ? 'active' : ''}" data-zone="${z.name}">
      <div>
        <span class="legend-dot" style="background:${colorForPct(s.pct)}"></span>
        <strong>${z.label}</strong> <small style="color:${isDark ? '#94a3b8' : '#64748b'}">(${z.desc})</small>
      </div>
      <div><strong>${fmt(s.count)}</strong> <span style="color:#2563eb;font-weight:600;">${s.pct}%</span></div>
    </div>`;
  });
  legendHtml += '</div>';
  $('tireDiagramBody').innerHTML = `<div class="tire-wrap">${svg}${legendHtml}</div>`;
}

if ($('tireDiagramBody')) {
  $('tireDiagramBody').onclick = e => {
    const el = e.target.closest('[data-zone]');
    if (el) {
      const zone = el.dataset.zone;
      const matched = [...new Set(state.rows.map(r => r['Defect Area']).filter(Boolean))].find(a => a.toLowerCase().includes(zone.toLowerCase())) || zone;
      const cur = state.charts['Defect Area'];
      if (cur?.has(matched)) delete state.charts['Defect Area'];
      else state.charts['Defect Area'] = new Set([matched]);
      render();
    }
  };
}

// Machine × Defect Heatmap Matrix
function renderHeatmap() {
  if (!state.loaded || state.page !== 1) return;
  const machineField = $('heatmapMachineType')?.value || 'TBMMachine ID';
  const data = E.heatmap(state.filtered, machineField, 'Defect Name', 10, 8);
  const isDark = document.documentElement.dataset.theme === 'dark';
  if (!data.machines.length || !data.defects.length) {
    $('heatmapTableWrap').innerHTML = '<p class="muted">No defect records matching current filter.</p>';
    return;
  }
  let html = `<table class="heatmap-table"><thead><tr><th>${escapeHTML(labels[machineField] || machineField)} \\ Defect</th>`;
  data.defects.forEach(d => {
    html += `<th title="${escapeHTML(d)}">${escapeHTML(d.length > 16 ? d.slice(0, 14) + '…' : d)}</th>`;
  });
  html += '<th>Machine Total</th></tr></thead><tbody>';
  data.machines.forEach(m => {
    let rowTotal = 0;
    html += `<tr><th>${escapeHTML(m)}</th>`;
    data.defects.forEach(d => {
      const val = data.matrix[m]?.[d] || 0;
      rowTotal += val;
      const intensity = data.maxVal ? (val / data.maxVal) : 0;
      const bg = val === 0 ? (isDark ? '#131c2e' : '#f8fafc') : `rgba(37, 99, 235, ${Math.max(0.18, intensity)})`;
      const textColor = intensity > 0.5 ? '#ffffff' : (isDark ? '#f1f5f9' : '#1e293b');
      html += `<td class="heatmap-cell" data-machine="${escapeHTML(m)}" data-defect="${escapeHTML(d)}" style="background:${bg};color:${textColor};" title="${escapeHTML(m)} · ${escapeHTML(d)}: ${fmt(val)} records">${val ? fmt(val) : '—'}</td>`;
    });
    html += `<td style="font-weight:700;">${fmt(rowTotal)}</td></tr>`;
  });
  html += '</tbody></table>';
  $('heatmapTableWrap').innerHTML = html;
}

if ($('heatmapTableWrap')) {
  $('heatmapTableWrap').onclick = e => {
    const cell = e.target.closest('.heatmap-cell');
    if (cell) {
      const m = cell.dataset.machine, d = cell.dataset.defect;
      const mf = $('heatmapMachineType')?.value || 'TBMMachine ID';
      state.charts[mf] = new Set([m]);
      state.charts['Defect Name'] = new Set([d]);
      render();
    }
  };
}

if ($('heatmapMachineType')) $('heatmapMachineType').onchange = () => renderHeatmap();

// Quality Period Summary (Feature #18)
function renderWeeklySummary() {
  if (!state.loaded || state.page !== 0) return;
  const sumData = E.weeklySummary(state.filtered, state.slicers);
  if (!sumData) return;
  let html = `<p style="margin-bottom:12px;font-size:13px;color:var(--muted);">${escapeHTML(sumData.summary)}</p><div class="summary-highlights">`;
  sumData.highlights.forEach(h => {
    html += `<div class="summary-item"><span class="summary-icon">${h.icon}</span><span>${escapeHTML(h.text)}</span></div>`;
  });
  html += '</div>';
  $('weeklySummaryBody').innerHTML = html;
}

// Repeat Offender Machine Detection (Feature #2)
function renderRepeatOffenders() {
  if (!state.loaded || state.page !== 0) return;
  const offenders = E.repeatOffenders(state.filtered, 'TBMMachine ID', 6);
  if (!offenders || !offenders.length) {
    $('repeatOffenderBody').innerHTML = '<p class="muted">No repeat offender machine concentrations detected above average.</p>';
    return;
  }
  let html = `<table class="offender-table"><thead><tr><th>Machine</th><th>Defect Name</th><th>Count</th><th>Avg/Machine</th><th>Concentration</th><th>Risk Level</th></tr></thead><tbody>`;
  offenders.forEach(o => {
    const risk = o.ratio >= 2.5 ? 'critical' : o.ratio >= 1.7 ? 'warning' : 'watch';
    const riskLabel = o.ratio >= 2.5 ? 'CRITICAL' : o.ratio >= 1.7 ? 'WARNING' : 'WATCH';
    html += `<tr style="cursor:pointer;" data-machine="${escapeHTML(o.machine)}" data-defect="${escapeHTML(o.defect)}" title="Click to isolate ${escapeHTML(o.machine)} and ${escapeHTML(o.defect)}">
      <td><strong>${escapeHTML(o.machine)}</strong></td>
      <td>${escapeHTML(o.defect)}</td>
      <td><strong>${fmt(o.count)}</strong></td>
      <td>${fmt(o.avgForDefect)}</td>
      <td><span style="font-weight:700;color:${o.ratio >= 2.5 ? '#ef4444' : '#f59e0b'};">${o.ratio}x</span></td>
      <td><span class="offender-badge ${risk}">${riskLabel}</span></td>
    </tr>`;
  });
  html += '</tbody></table>';
  $('repeatOffenderBody').innerHTML = html;
}

if ($('repeatOffenderBody')) {
  $('repeatOffenderBody').onclick = e => {
    const tr = e.target.closest('tr[data-machine]');
    if (tr) {
      state.charts['TBMMachine ID'] = new Set([tr.dataset.machine]);
      state.charts['Defect Name'] = new Set([tr.dataset.defect]);
      render();
    }
  };
}

// Machine Health Score (Feature #9)
function renderMachineHealth() {
  if (!state.loaded || state.page !== 0) return;
  const machineField = $('healthMachineType')?.value || 'TBMMachine ID';
  const healthList = E.machineHealth(state.filtered, machineField, 8);
  if (!healthList || !healthList.length) {
    $('machineHealthBody').innerHTML = '<p class="muted">No machine data available.</p>';
    return;
  }
  let html = '<div class="health-grid">';
  healthList.forEach(m => {
    const trendIcon = m.trend === 'improving' ? '📈 Improving' : m.trend === 'worsening' ? '📉 Worsening' : '➡️ Stable';
    html += `<div class="health-card" style="cursor:pointer;" data-field="${escapeHTML(machineField)}" data-machine="${escapeHTML(m.machine)}" title="Click to filter by ${escapeHTML(m.machine)}">
      <div class="health-label">${escapeHTML(m.machine)}</div>
      <div class="health-score">${m.score}<small style="font-size:12px;font-weight:400;">/100</small></div>
      <div><span class="health-grade ${m.grade}">Grade ${m.grade}</span></div>
      <div class="health-detail">${fmt(m.totalDefects)} defects · ${m.uniqueDefects} types</div>
      <div class="health-detail" style="font-weight:600;margin-top:2px;">${trendIcon}</div>
    </div>`;
  });
  html += '</div>';
  $('machineHealthBody').innerHTML = html;
}

if ($('healthMachineType')) $('healthMachineType').onchange = () => renderMachineHealth();

if ($('machineHealthBody')) {
  $('machineHealthBody').onclick = e => {
    const card = e.target.closest('.health-card');
    if (card) {
      const f = card.dataset.field, m = card.dataset.machine;
      state.charts[f] = new Set([m]);
      render();
    }
  };
}

// Pareto Progress Tracking (Feature #10)
function renderParetoProgress() {
  if (!state.loaded || state.page !== 0) return;
  const prog = E.paretoProgress(state.rows, state.slicers);
  if (!prog || !prog.length) {
    $('paretoProgressBody').innerHTML = '<p class="muted">Select a specific month or year with an immediately preceding period to track Pareto progress.</p>';
    return;
  }
  let html = `<table class="pareto-progress"><thead><tr><th>Top Defect (Prior Period)</th><th>Prior Count</th><th>Current Count</th><th>Change %</th><th>Status</th></tr></thead><tbody>`;
  prog.forEach(p => {
    const arrow = p.improved ? '↓' : '↑';
    const cls = p.improved ? 'improved' : 'worsened';
    const statusText = p.improved ? '✓ Improved' : '⚠️ Worsened';
    html += `<tr style="cursor:pointer;" data-defect="${escapeHTML(p.defect)}" title="Click to filter by ${escapeHTML(p.defect)}">
      <td><strong>${escapeHTML(p.defect)}</strong></td>
      <td>${fmt(p.prevCount)}</td>
      <td><strong>${fmt(p.curCount)}</strong></td>
      <td><span class="progress-arrow ${cls}">${arrow} ${Math.abs(p.change)}%</span></td>
      <td><span class="progress-arrow ${cls}">${statusText}</span></td>
    </tr>`;
  });
  html += '</tbody></table>';
  $('paretoProgressBody').innerHTML = html;
}

if ($('paretoProgressBody')) {
  $('paretoProgressBody').onclick = e => {
    const tr = e.target.closest('tr[data-defect]');
    if (tr) {
      state.charts['Defect Name'] = new Set([tr.dataset.defect]);
      render();
    }
  };
}

// Factory Quality Scorecard (Feature #15)
function renderQualityScorecard() {
  if (!state.loaded || state.page !== 0) return;
  const sc = E.qualityScorecard(state.filtered);
  if (!sc) return;
  const gradeColor = sc.score >= 80 ? '#10b981' : sc.score >= 60 ? '#3b82f6' : sc.score >= 40 ? '#f59e0b' : '#ef4444';
  const html = `<div class="scorecard-wrap">
    <div class="scorecard-main">
      <div class="scorecard-value" style="color:${gradeColor};">${sc.score}</div>
      <div class="scorecard-grade" style="color:${gradeColor};">Grade ${sc.grade}</div>
      <p style="font-size:11px;color:var(--muted);margin-top:4px;">Factory Quality Index</p>
    </div>
    <div class="scorecard-factors">
      <div class="factor-row">
        <span class="factor-label">Machine Spread:</span>
        <div class="factor-bar"><div class="factor-fill" style="width:${sc.factors.machineSpread}%;background:#3b82f6;"></div></div>
        <span class="factor-value">${sc.factors.machineSpread}%</span>
      </div>
      <div class="factor-row">
        <span class="factor-label">Defect Focus:</span>
        <div class="factor-bar"><div class="factor-fill" style="width:${sc.factors.defectFocus}%;background:#10b981;"></div></div>
        <span class="factor-value">${sc.factors.defectFocus}%</span>
      </div>
      <div class="factor-row">
        <span class="factor-label">Process Stability:</span>
        <div class="factor-bar"><div class="factor-fill" style="width:${sc.factors.processStability}%;background:#8b5cf6;"></div></div>
        <span class="factor-value">${sc.factors.processStability}%</span>
      </div>
      <p style="font-size:12px;margin:6px 0 0;color:var(--muted);">${escapeHTML(sc.summary)}</p>
    </div>
  </div>`;
  $('scorecardBody').innerHTML = html;
}

// Cumulative Defect Tracker (Feature #13)
function renderCumulativeChart() {
  if (!state.loaded || state.page !== 0 || typeof Chart === 'undefined') return;
  const canvas = $('canvas-cumulative');
  if (!canvas) return;

  const pairs = E.group(state.filtered, '_day').sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
  if (!pairs.length) {
    if (state.cumulativeInstance) { state.cumulativeInstance.destroy(); state.cumulativeInstance = null; }
    return;
  }

  const days = pairs.map(p => 'Day ' + p[0]);
  let running = 0;
  const cumulativeActual = pairs.map(p => { running += p[1]; return running; });

  const targetInput = $('cumulativeTarget');
  const targetVal = +(targetInput?.value || 500);
  const targetSlope = days.length > 0 ? targetVal / days.length : targetVal;
  const targetLine = days.map((_, i) => Math.round((i + 1) * targetSlope));

  const isDark = document.documentElement.dataset.theme === 'dark';
  const gridColor = isDark ? '#1e293b' : '#edf1f6';

  const data = {
    labels: days,
    datasets: [
      {
        type: 'line',
        label: 'Cumulative Defects (Actual)',
        data: cumulativeActual,
        borderColor: '#3674e8',
        backgroundColor: '#3674e822',
        fill: true,
        tension: 0.2,
        pointRadius: 3
      },
      {
        type: 'line',
        label: `Cumulative Target (${targetVal})`,
        data: targetLine,
        borderColor: '#ef4444',
        borderDash: [6, 4],
        pointRadius: 0,
        fill: false
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    scales: {
      x: { grid: { color: gridColor }, ticks: { font: { size: 10 } } },
      y: { beginAtZero: true, grid: { color: gridColor }, ticks: { font: { size: 10 } } }
    },
    plugins: {
      legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } }
    }
  };

  if (!state.cumulativeInstance) {
    state.cumulativeInstance = new Chart(canvas, { type: 'line', data, options, plugins: [whiteBackground] });
  } else {
    state.cumulativeInstance.data = data;
    state.cumulativeInstance.options = options;
    state.cumulativeInstance.update('none');
  }
}

if ($('cumulativeTarget')) {
  $('cumulativeTarget').oninput = e => {
    localStorage.setItem('ct_cumulative_target', e.target.value);
    renderCumulativeChart();
  };
}

// Defect Velocity & Acceleration Chart (Feature #14)
function renderVelocityChart() {
  if (!state.loaded || state.page !== 0 || typeof Chart === 'undefined') return;
  const canvas = $('canvas-velocity');
  if (!canvas) return;

  const velData = E.defectVelocity(state.filtered);
  if (!velData.length || velData.length < 2) {
    if (state.velocityInstance) { state.velocityInstance.destroy(); state.velocityInstance = null; }
    return;
  }

  const periods = velData.map(v => v.period);
  const velocities = velData.map(v => v.velocity);
  const accelerations = velData.map(v => v.acceleration);

  const isDark = document.documentElement.dataset.theme === 'dark';
  const gridColor = isDark ? '#1e293b' : '#edf1f6';

  const data = {
    labels: periods,
    datasets: [
      {
        type: 'bar',
        label: 'Velocity (Period-over-Period Change)',
        data: velocities,
        backgroundColor: velocities.map(v => v > 0 ? '#ef4444cc' : '#10b981cc'),
        borderRadius: 4
      },
      {
        type: 'line',
        label: 'Acceleration (Rate of Velocity Change)',
        data: accelerations,
        borderColor: '#8b5cf6',
        backgroundColor: '#8b5cf6',
        tension: 0.2,
        pointRadius: 4,
        fill: false
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    scales: {
      x: { grid: { color: gridColor }, ticks: { font: { size: 10 } } },
      y: { grid: { color: gridColor }, ticks: { font: { size: 10 } } }
    },
    plugins: {
      legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } }
    }
  };

  if (!state.velocityInstance) {
    state.velocityInstance = new Chart(canvas, { type: 'bar', data, options, plugins: [whiteBackground] });
  } else {
    state.velocityInstance.data = data;
    state.velocityInstance.options = options;
    state.velocityInstance.update('none');
  }
}

// Defect → Machine Flow (Sankey / Flow Diagram) (Feature #19)
function renderSankey() {
  if (!state.loaded || state.page !== 1) return;
  const container = $('sankeyBody');
  if (!container) return;

  const machineField = $('sankeyMachineType')?.value || 'TBMMachine ID';
  const data = E.groupByMulti(state.filtered, 'Defect Name', machineField);
  if (!data.links.length) {
    container.innerHTML = '<p class="muted">No defect flow data matching current selection.</p>';
    return;
  }

  // Pick top 8 defects and top 8 machines
  const topDefects = E.group(state.filtered, 'Defect Name').slice(0, 8).map(p => p[0]);
  const topMachines = E.group(state.filtered, machineField).slice(0, 8).map(p => p[0]);
  const filteredLinks = data.links.filter(l => {
    const d = l.source.replace('Defect Name:', '');
    const m = l.target.replace(machineField + ':', '');
    return topDefects.includes(d) && topMachines.includes(m);
  });

  if (!filteredLinks.length) {
    container.innerHTML = '<p class="muted">No flow data for top categories.</p>';
    return;
  }

  const isDark = document.documentElement.dataset.theme === 'dark';
  const width = Math.max(600, container.clientWidth || 700);
  const height = 360;
  const leftX = 140, rightX = width - 140;

  const dSpacing = height / (topDefects.length + 1);
  const mSpacing = height / (topMachines.length + 1);

  const dPositions = new Map(topDefects.map((d, i) => [d, (i + 1) * dSpacing]));
  const mPositions = new Map(topMachines.map((m, i) => [m, (i + 1) * mSpacing]));

  let paths = '';
  filteredLinks.forEach((link, idx) => {
    const d = link.source.replace('Defect Name:', '');
    const m = link.target.replace(machineField + ':', '');
    const y1 = dPositions.get(d) || 0;
    const y2 = mPositions.get(m) || 0;
    const strokeWidth = Math.max(2, Math.min(18, link.value / 4));
    const color = palette[idx % palette.length];
    const cX1 = leftX + (rightX - leftX) * 0.45;
    const cX2 = leftX + (rightX - leftX) * 0.55;

    paths += `<path class="sankey-link" d="M ${leftX} ${y1} C ${cX1} ${y1}, ${cX2} ${y2}, ${rightX} ${y2}"
      stroke="${color}" stroke-width="${strokeWidth}" stroke-opacity="0.45" fill="none"
      data-defect="${escapeHTML(d)}" data-machine="${escapeHTML(m)}"
      style="cursor:pointer;">
      <title>${escapeHTML(d)} → ${escapeHTML(m)}: ${fmt(link.value)} records</title>
    </path>`;
  });

  let nodesHtml = '';
  topDefects.forEach(d => {
    const y = dPositions.get(d);
    nodesHtml += `<g class="sankey-node" data-field="Defect Name" data-val="${escapeHTML(d)}" style="cursor:pointer;">
      <rect x="${leftX - 8}" y="${y - 12}" width="16" height="24" rx="4" fill="#3b82f6" />
      <text x="${leftX - 14}" y="${y + 4}" text-anchor="end" font-size="11" font-weight="600" fill="${isDark ? '#e2e8f0' : '#1e293b'}">${escapeHTML(d.length > 20 ? d.slice(0, 18) + '…' : d)}</text>
    </g>`;
  });

  topMachines.forEach(m => {
    const y = mPositions.get(m);
    nodesHtml += `<g class="sankey-node" data-field="${escapeHTML(machineField)}" data-val="${escapeHTML(m)}" style="cursor:pointer;">
      <rect x="${rightX - 8}" y="${y - 12}" width="16" height="24" rx="4" fill="#10b981" />
      <text x="${rightX + 14}" y="${y + 4}" text-anchor="start" font-size="11" font-weight="600" fill="${isDark ? '#e2e8f0' : '#1e293b'}">${escapeHTML(m)}</text>
    </g>`;
  });

  container.innerHTML = `<svg viewBox="0 0 ${width} ${height}" style="width:100%;height:auto;display:block;">
    <text x="${leftX - 14}" y="20" text-anchor="end" font-size="11" font-weight="700" fill="${isDark ? '#94a3b8' : '#64748b'}">DEFECT NAME</text>
    <text x="${rightX + 14}" y="20" text-anchor="start" font-size="11" font-weight="700" fill="${isDark ? '#94a3b8' : '#64748b'}">${labels[machineField] || machineField}</text>
    ${paths}
    ${nodesHtml}
  </svg>`;
}

if ($('sankeyMachineType')) $('sankeyMachineType').onchange = () => renderSankey();

if ($('sankeyBody')) {
  $('sankeyBody').onclick = e => {
    const link = e.target.closest('.sankey-link');
    if (link) {
      const mf = $('sankeyMachineType')?.value || 'TBMMachine ID';
      state.charts['Defect Name'] = new Set([link.dataset.defect]);
      state.charts[mf] = new Set([link.dataset.machine]);
      render();
      return;
    }
    const node = e.target.closest('.sankey-node');
    if (node) {
      state.charts[node.dataset.field] = new Set([node.dataset.val]);
      render();
    }
  };
}

// Table & Sorting
function sortedRows() {
  const r = state.filtered.slice();
  if (state.sort) {
    r.sort((a, b) => (a[state.sort] || '').localeCompare(b[state.sort] || '', undefined, { numeric: true }) * (state.ascending ? 1 : -1));
  }
  return r;
}

function getVisibleColumns() {
  return TABLE_FIELDS.filter(f => state.visibleColumns.has(f));
}

// Render Table with Recurrence Badges and Row Severity Highlighting (Features #3, #6, #12)
function renderTable() {
  if (!state.loaded) return;
  const r = sortedRows();
  const pagesCount = Math.max(1, Math.ceil(r.length / state.pageSize));
  state.tablePage = Math.min(state.tablePage, pagesCount);
  const cols = getVisibleColumns();

  // Recurrence map (Feature #3)
  const recData = E.recurrence(state.filtered);
  const recMap = new Map();
  recData.recurring.forEach(item => {
    recMap.set(item.barcode + '\u0000' + item.defect, item.count);
  });

  // Top defects for severity classification (Feature #12)
  const top3Defects = new Set(E.group(state.filtered, 'Defect Name').slice(0, 3).map(p => p[0]));

  $('thead').innerHTML = '<tr>' + cols.map(f => `<th><button data-sort="${f}">${f} ${state.sort === f ? (state.ascending ? '↑' : '↓') : '↕'}</button></th>`).join('') + '</tr>';

  $('tbody').innerHTML = r.slice((state.tablePage - 1) * state.pageSize, state.tablePage * state.pageSize).map(row => {
    const isTopDefect = top3Defects.has(row['Defect Name']);
    const isRec = recMap.has(row.Barcode + '\u0000' + row['Defect Name']);
    const severityCls = isTopDefect ? 'severity-high' : isRec ? 'severity-medium' : '';

    const cells = cols.map(f => {
      let val = escapeHTML(row[f] || '—');
      if (f === 'Barcode' && isRec) {
        const cnt = recMap.get(row.Barcode + '\u0000' + row['Defect Name']);
        val += ` <span class="recurrence-badge" title="Recurring barcode defect">🔁 ${cnt}x</span>`;
      }
      return '<td>' + val + '</td>';
    }).join('');

    return `<tr tabindex="0" data-row="${row._id}" class="${severityCls}">${cells}</tr>`;
  }).join('') || `<tr><td colspan="${cols.length}">No matching records.</td></tr>`;

  $('tableCount').textContent = `${fmt(r.length)} matching records · showing ${cols.length} of ${TABLE_FIELDS.length} columns · click a row for details`;
  $('pageInfo').textContent = `Page ${state.tablePage} of ${pagesCount}`;
  $('prev').disabled = state.tablePage <= 1;
  $('next').disabled = state.tablePage >= pagesCount;
}

$('thead').onclick = e => {
  const b = e.target.closest('[data-sort]');
  if (b) {
    state.ascending = state.sort === b.dataset.sort ? !state.ascending : true;
    state.sort = b.dataset.sort;
    renderTable();
    $('thead').querySelector(`[data-sort="${state.sort}"]`)?.focus({ preventScroll: true });
  }
};

$('tbody').onclick = e => {
  const tr = e.target.closest('[data-row]');
  if (tr) {
    const r = state.rows.find(row => row._id === +tr.dataset.row);
    if (!r) return;
    state.activeDetailRecord = r;
    $('detailFields').innerHTML = TABLE_FIELDS.map(f => `<dt>${f}</dt><dd>${escapeHTML(r[f] || 'Not provided')}</dd>`).join('');
    $('detail').showModal();
  }
};

$('tbody').onkeydown = e => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    e.target.click();
  }
};

$('closeDetail').onclick = () => $('detail').close();
$('prev').onclick = () => { state.tablePage--; renderTable(); };
$('next').onclick = () => { state.tablePage++; renderTable(); };
$('pageSize').onchange = e => { state.pageSize = +e.target.value; state.tablePage = 1; renderTable(); };

let searchTimer;
$('search').oninput = e => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.query = e.target.value;
    state.tablePage = 1;
    render();
  }, 180);
};

// Data Exports
function download(url, name) {
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
}

$('csv').onclick = () => {
  const cols = getVisibleColumns();
  const url = URL.createObjectURL(new Blob([E.csv(sortedRows(), cols)], { type: 'text/csv;charset=utf-8' }));
  download(url, 'CT-filtered-defects.csv');
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

$('excel').onclick = () => {
  if (typeof XLSX === 'undefined') {
    status('SheetJS could not load. Check your internet connection and reload.');
    return;
  }
  const cols = getVisibleColumns();
  const ws = XLSX.utils.aoa_to_sheet([cols, ...sortedRows().map(r => cols.map(f => r[f]))]);
  ws['!cols'] = cols.map(() => ({ wch: 22 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DefectReport');
  XLSX.writeFile(wb, 'CT-filtered-defects.xlsx');
};

// Column Visibility Dialog (Feature #6)
if ($('colToggle')) {
  $('colToggle').onclick = () => {
    const list = $('colCheckboxes');
    list.innerHTML = TABLE_FIELDS.map(f => `
      <label>
        <input type="checkbox" value="${escapeHTML(f)}" ${state.visibleColumns.has(f) ? 'checked' : ''}>
        <span>${escapeHTML(f)}</span>
      </label>
    `).join('');
    $('colDialog').showModal();
  };
}

if ($('closeColDialog')) $('closeColDialog').onclick = () => $('colDialog').close();

if ($('colCheckboxes')) {
  $('colCheckboxes').onchange = e => {
    const val = e.target.value;
    if (e.target.checked) state.visibleColumns.add(val);
    else if (state.visibleColumns.size > 1) state.visibleColumns.delete(val);
    else e.target.checked = true; // Keep at least one column
    localStorage.setItem('ct_visible_columns', JSON.stringify([...state.visibleColumns]));
    renderTable();
  };
}

// Saved Filter Presets (Feature #4)
function renderPresetsList() {
  const listEl = $('presetsList');
  if (!listEl) return;
  const presets = JSON.parse(localStorage.getItem('ct_filter_presets') || '[]');
  if (!presets.length) {
    listEl.innerHTML = '<p class="muted">No saved filter presets yet. Set your filters and click "Save Current" above.</p>';
    return;
  }
  listEl.innerHTML = presets.map((p, idx) => `
    <div class="preset-item" data-idx="${idx}">
      <div>
        <strong>${escapeHTML(p.name)}</strong>
        <div class="preset-meta">${p.date} · ${escapeHTML(p.desc || 'Custom filter')}</div>
      </div>
      <div class="preset-actions">
        <button class="primary" data-op="apply" data-idx="${idx}">Apply</button>
        <button data-op="delete" data-idx="${idx}" style="color:#ef4444;">✕</button>
      </div>
    </div>
  `).join('');
}

if ($('savedFilters')) {
  $('savedFilters').onclick = () => {
    renderPresetsList();
    $('presetsDialog').showModal();
  };
}

if ($('closePresets')) $('closePresets').onclick = () => $('presetsDialog').close();

if ($('savePreset')) {
  $('savePreset').onclick = () => {
    const nameInput = $('presetName');
    const name = nameInput.value.trim() || `Preset ${new Date().toLocaleDateString()}`;
    const presets = JSON.parse(localStorage.getItem('ct_filter_presets') || '[]');

    const activeFilterDesc = [];
    Object.entries(state.slicers).forEach(([k, s]) => { if (s.size) activeFilterDesc.push(`${labels[k] || k}: ${[...s].join(',')}`); });
    Object.entries(state.charts).forEach(([k, s]) => { if (s.size) activeFilterDesc.push(`${labels[k] || k}: ${[...s].join(',')}`); });

    presets.push({
      name,
      date: new Date().toLocaleDateString(),
      desc: activeFilterDesc.join(' | ') || 'All filters',
      slicers: Object.fromEntries(Object.entries(state.slicers).map(([k, s]) => [k, [...s]])),
      charts: Object.fromEntries(Object.entries(state.charts).map(([k, s]) => [k, [...s]])),
      query: state.query
    });
    localStorage.setItem('ct_filter_presets', JSON.stringify(presets));
    nameInput.value = '';
    renderPresetsList();
  };
}

if ($('presetsList')) {
  $('presetsList').onclick = e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const idx = +btn.dataset.idx;
    const presets = JSON.parse(localStorage.getItem('ct_filter_presets') || '[]');
    const p = presets[idx];
    if (!p) return;

    if (btn.dataset.op === 'apply') {
      state.slicers = Object.fromEntries(Object.entries(p.slicers || {}).map(([k, arr]) => [k, new Set(arr)]));
      state.charts = Object.fromEntries(Object.entries(p.charts || {}).map(([k, arr]) => [k, new Set(arr)]));
      state.query = p.query || '';
      $('search').value = state.query;
      $('presetsDialog').close();
      renderSlicers();
      render();
    } else if (btn.dataset.op === 'delete') {
      presets.splice(idx, 1);
      localStorage.setItem('ct_filter_presets', JSON.stringify(presets));
      renderPresetsList();
    }
  };
}

// Data Annotations (Feature #17)
function renderAnnotationsList(barcode) {
  const container = $('annotationsList');
  if (!container) return;
  const notes = JSON.parse(localStorage.getItem('ct_annotations') || '{}');
  const recordNotes = notes[barcode] || [];
  if (!recordNotes.length) {
    container.innerHTML = '<p class="muted" style="margin-top:10px;">No notes recorded for this barcode yet.</p>';
    return;
  }
  container.innerHTML = recordNotes.map((note, i) => `
    <div class="annotation-item">
      <div class="ann-meta">${note.date}</div>
      <div>${escapeHTML(note.text)}</div>
    </div>
  `).join('');
}

if ($('closeAnnotation')) $('closeAnnotation').onclick = () => $('annotationDialog').close();

if ($('saveAnnotation')) {
  $('saveAnnotation').onclick = () => {
    const barcode = state.activeDetailRecord?.Barcode;
    if (!barcode) return;
    const txt = $('annotationText').value.trim();
    if (!txt) return;
    const notes = JSON.parse(localStorage.getItem('ct_annotations') || '{}');
    if (!notes[barcode]) notes[barcode] = [];
    notes[barcode].push({ text: txt, date: new Date().toLocaleString() });
    localStorage.setItem('ct_annotations', JSON.stringify(notes));
    $('annotationText').value = '';
    renderAnnotationsList(barcode);
  };
}

// IndexedDB Cache
const DB_NAME = 'CTDefectDB', STORE_NAME = 'cache', DB_VER = 1;
function openDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) return reject(new Error('IndexedDB not supported'));
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveCache(buffer, filename) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ buffer: buffer.slice(0), filename, savedAt: Date.now() }, 'workbook');
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('Cache save skipped:', e);
  }
}

async function loadCache() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get('workbook');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    return null;
  }
}

async function ensureSheetJS() {
  if (typeof XLSX !== 'undefined') return true;
  status('Loading Excel reader (SheetJS)…');
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 100));
    if (typeof XLSX !== 'undefined') return true;
  }
  return false;
}

// Parse Raw Rows from Excel Buffer
function parseRowsFromBuffer(buffer) {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false, cellText: true });
  let targetSheet = wb.Sheets.DefectReport;
  if (!targetSheet) {
    const normKey = Object.keys(wb.Sheets).find(k => k.toLowerCase().replace(/[\s_-]/g, '') === 'defectreport');
    if (normKey) targetSheet = wb.Sheets[normKey];
    else if (wb.SheetNames.length === 1) targetSheet = wb.Sheets[wb.SheetNames[0]];
  }
  const ws = targetSheet;
  if (!ws) throw new Error('The workbook must contain a sheet named DefectReport (or your single data sheet).');

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  let header = -1, positions;
  const required = E.FIELDS.filter(f => f !== 'Date');
  for (let r = range.s.r; r <= Math.min(range.e.r, range.s.r + 50); r++) {
    const found = new Map();
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell) found.set(E.text(cell.v), c);
    }
    if (required.every(f => found.has(f)) && (found.has('Date') || found.has('Xray Date'))) {
      header = r;
      positions = found;
      break;
    }
  }
  if (header < 0) throw new Error('Could not find all required columns plus Date or Xray Date in the first 51 rows.');

  const raw = [];
  let blankRows = 0;
  for (let r = header + 1; r <= range.e.r; r++) {
    const row = {};
    E.FIELDS.forEach(f => {
      const column = positions.get(f);
      const cell = column == null ? null : ws[XLSX.utils.encode_cell({ r, c: column })];
      row[f] = cell?.t === 'e' ? '' : (cell?.v ?? '');
      if (cell && f === 'Barcode' && cell.t === 'n' && cell.w && /^0\d+$/.test(cell.w)) {
        row[f] = cell.w;
      }
    });
    for (const f of ['Date', 'Xray Date']) {
      const column = positions.get(f);
      const cell = column == null ? null : ws[XLSX.utils.encode_cell({ r, c: column })];
      if (column != null) row[f] = cell?.t === 'e' ? '' : (cell?.v ?? '');
    }
    if (E.FIELDS.every(f => E.text(row[f]) === '')) {
      blankRows++;
      continue;
    }
    raw.push(row);
  }
  return { raw, blankRows, date1904: Boolean(wb.Workbook?.WBProps?.date1904) };
}

// Ingest Single Excel File
async function upload(file, opts = {}) {
  if (!file) return;
  const ready = await ensureSheetJS();
  if (!ready) {
    status('Excel reader (SheetJS) could not load. Connect to the internet and reload.');
    return;
  }
  status('Reading workbook locally…');
  document.querySelectorAll('input[type=file]').forEach(x => { x.disabled = true; });
  await new Promise(r => setTimeout(r, 30));

  try {
    const buffer = await file.arrayBuffer();
    const { raw, blankRows, date1904 } = parseRowsFromBuffer(buffer);
    const parsed = E.normalize(raw, date1904);

    state.rows = parsed.rows;
    state.loaded = true;
    state.dedupe = true;
    state.sort = null;
    destroyCharts();

    $('source').textContent = `${file.name} · ${fmt(state.rows.length)} unique records · Refreshed ${new Date().toLocaleString()}`;
    $('quality').innerHTML = `<details><summary>Data quality · Every row is unique · ${fmt(parsed.duplicates)} duplicate rows excluded · ${fmt(parsed.missingDates)} missing analysis dates · ${fmt(parsed.invalidDates)} unrecognized analysis dates</summary><p>Every row in this project is guaranteed unique. Exact duplicate rows across the 16 retained fields are excluded automatically upon import (keeping the first occurrence). Date filtering uses the Excel Date column; when Date is blank or invalid, Xray Date is used as fallback (${fmt(parsed.fallbackDates)} fallback rows). Invalid or missing dates remain in unfiltered totals, but cannot match a date selection. Empty categories are excluded from their charts and distinct counts. ${fmt(blankRows)} rows empty across all ${E.FIELDS.length} displayed fields were skipped. DD/MM/YYYY is interpreted day-first.</p><div class="quality-badge"><span class="live-dot"></span> <strong>Enforced: Every row is unique</strong> (${fmt(state.rows.length)} unique records active)</div></details>`;

    mountCharts();
    reset();

    if (opts.saveCache !== false) await saveCache(buffer, file.name);
    if (opts.fromCache) {
      status('Loaded workbook from offline browser cache. Everything runs 100% locally.');
      setTimeout(() => {
        if ($('status').textContent.includes('offline browser cache')) status('');
      }, 4000);
    } else {
      status(typeof Chart === 'undefined' ? 'Data loaded, but Chart.js could not load. Connect to the internet and reload for charts.' : '');
    }
  } catch (err) {
    status('Import failed: ' + err.message);
  } finally {
    document.querySelectorAll('input[type=file]').forEach(x => {
      x.disabled = false;
      x.value = '';
    });
  }
}

// Multi-File Merge (Feature #5)
async function mergeUploadFiles(files) {
  if (!files || !files.length) return;
  const ready = await ensureSheetJS();
  if (!ready) {
    status('Excel reader (SheetJS) could not load. Connect to the internet and reload.');
    return;
  }
  status(`Merging ${files.length} Excel files locally…`);
  document.querySelectorAll('input[type=file]').forEach(x => { x.disabled = true; });
  await new Promise(r => setTimeout(r, 30));

  try {
    let allRaw = [];
    let is1904 = false;
    for (let i = 0; i < files.length; i++) {
      status(`Reading file ${i + 1} of ${files.length} (${files[i].name})…`);
      const buffer = await files[i].arrayBuffer();
      const { raw, date1904 } = parseRowsFromBuffer(buffer);
      allRaw = allRaw.concat(raw);
      if (date1904) is1904 = true;
    }

    status('Enforcing uniqueness across all merged records…');
    const parsed = E.normalize(allRaw, is1904);
    state.rows = parsed.rows;
    state.loaded = true;
    state.dedupe = true;
    state.sort = null;
    destroyCharts();

    const fileNames = files.map(f => f.name).join(', ');
    $('source').textContent = `Merged ${files.length} files (${fileNames}) · ${fmt(state.rows.length)} unique records · Refreshed ${new Date().toLocaleString()}`;
    $('quality').innerHTML = `<details><summary>Data quality · Merged ${files.length} files · ${fmt(parsed.duplicates)} duplicate rows excluded across files</summary><p>All ${files.length} files merged seamlessly. Exact duplicates across the combined dataset have been eliminated automatically.</p><div class="quality-badge"><span class="live-dot"></span> <strong>Enforced: Every row is unique</strong> (${fmt(state.rows.length)} unique records active)</div></details>`;

    mountCharts();
    reset();
    status(`Successfully merged ${files.length} workbooks (${fmt(state.rows.length)} unique records).`);
    setTimeout(() => { if ($('status').textContent.includes('Successfully merged')) status(''); }, 4000);
  } catch (err) {
    status('Merge failed: ' + err.message);
  } finally {
    document.querySelectorAll('input[type=file]').forEach(x => {
      x.disabled = false;
      x.value = '';
    });
  }
}

$('upload').onchange = e => upload(e.target.files[0], { saveCache: true });
if ($('mergeUpload')) $('mergeUpload').onchange = e => mergeUploadFiles(Array.from(e.target.files));
for (const [buttonId, inputId] of [['chooseUpload', 'upload'], ['chooseWelcome', 'upload'], ['chooseMerge', 'mergeUpload']]) {
  $(buttonId).onclick = () => {
    if (!$(inputId).disabled) $(inputId).click();
  };
}

// Keyboard Shortcuts & Accessibility
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('dialog[open]').forEach(d => d.close());
  }
  if (state.loaded && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
    if (e.key === 'ArrowLeft' && state.tablePage > 1) {
      state.tablePage--;
      renderTable();
    } else if (e.key === 'ArrowRight') {
      const maxPages = Math.ceil(state.filtered.length / state.pageSize);
      if (state.tablePage < maxPages) {
        state.tablePage++;
        renderTable();
      }
    }
  }
});

renderSlicers();
mountCharts();
render();

// Startup Data Initialization
async function initData() {
  const candidates = ['CT Defects-1.xlsx', 'CT_Defects-1.xlsx', 'CT-Defects-1.xlsx'];
  if (location.protocol === 'http:' || location.protocol === 'https:') {
    status('Fetching CT Defects-1.xlsx from current location…');
    for (const name of candidates) {
      try {
        const url = new URL(name, window.location.href).href;
        const res = await fetch(url, { cache: 'no-cache' });
        if (res.ok) {
          const blob = await res.blob();
          await upload(new File([blob], name), { saveCache: true });
          return;
        }
      } catch (err) {}
    }
  }
  const cached = await loadCache();
  if (cached && cached.buffer) {
    try {
      await upload(new File([cached.buffer], cached.filename || 'CT Defects-1.xlsx'), { fromCache: true, saveCache: false });
      return;
    } catch (err) {
      console.warn('Cache restore error:', err);
    }
  }
  if (!state.loaded && !$('upload').disabled) status('');
}

initData();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

