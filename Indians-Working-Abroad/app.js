/* ==========================================================================
   GATI Indian Global Mobility Dashboard v2 — logic
   Per-chart filters, tab navigation, country names in captions.
   ========================================================================== */

const COUNTRY_COLORS = {
  "Germany": "#006B76", "Japan": "#E5A812", "Italy": "#84D2E2",
  "Spain": "#00333A", "France": "#FFCC4E", "UK": "#8C6A1F",
  "Canada": "#839097", "Poland": "#4A5A61", "South Korea": "#2E8B94",
  "USA": "#C98A1D"
};
const NATION_COLORS = { "Indian": "#E5A812", "Total Foreigners": "#006B76" };

/* ---- Chart registry ---- */
const CHARTS = {
  'pop-stock-trend': { table: 'AllReasons_Stock', type: 'trend', nationality: 'Indian' },
  'pop-share': { table: 'AllReasons_Stock', type: 'share' },
  'pop-flow-A-indian':      { table: 'AllReasons_Flow_A', type: 'trend', nationality: 'Indian' },
  'pop-flow-A-foreign':     { table: 'AllReasons_Flow_A', type: 'trend', nationality: 'Total Foreigners' },
  'pop-flow-B-indian':      { table: 'AllReasons_Flow_B', type: 'trend', nationality: 'Indian' },
  'pop-flow-B-foreign':     { table: 'AllReasons_Flow_B', type: 'trend', nationality: 'Total Foreigners' },
  'emp-stock-trend': { table: 'Employment_Stock', type: 'trend', nationality: 'Indian' },
  'emp-share': { table: 'Employment_Stock', type: 'share' },
  'emp-flow-indian': { table: 'Employment_Flow', type: 'trend', nationality: 'Indian' },
  'emp-flow-foreign': { table: 'Employment_Flow', type: 'trend', nationality: 'Total Foreigners' },
  'health-stock-trend': { table: 'Healthcare_Nurses_Stock', type: 'trend', nationality: 'Indian' },
  'health-stock-foreign': { table: 'Healthcare_Nurses_Stock', type: 'trend', nationality: 'Total Foreigners' },
  'health-share-trend': { table: 'Healthcare_Nurses_Stock', type: 'trend-share' },
  'health-flow-trend': { table: 'Healthcare_Nurses_Flow', type: 'trend', nationality: 'Indian' },
  'health-top-dest': { table: 'Healthcare_Nurses_Stock', type: 'snapshot', nationality: 'Indian' }
};

/* ---- Per-chart filter states ---- */
const cState = {};

/* ---- Utilities ---- */
function uniqueSorted(arr) {
  const s = [...new Set(arr)];
  s.sort((a, b) => (typeof a === 'number' ? a - b : String(a).localeCompare(String(b))));
  return s;
}
function getTableCountries(t) { return uniqueSorted(DATA[t].map(r => r.Country)); }
function getTableYears(t) { return uniqueSorted(DATA[t].map(r => r.Year)); }
function fmtNum(n) { return Math.round(n).toLocaleString('en-US'); }
function fmtPct(n) { return n.toFixed(1) + '%'; }

/* ---- Initialize per-chart filter states ---- */
function initChartStates() {
  Object.keys(CHARTS).forEach(id => {
    const t = CHARTS[id].table;
    const years = getTableYears(t);
    cState[id] = {
      countries: new Set(getTableCountries(t)),
      yearMin: Math.min(...years),
      yearMax: Math.max(...years),
      selectedYear: Math.max(...years)
    };
  });
}

function saveState() {
  const serializableState = {};
  for (const id in cState) {
    serializableState[id] = {
      countries: Array.from(cState[id].countries),
      yearMin: cState[id].yearMin,
      yearMax: cState[id].yearMax,
      selectedYear: cState[id].selectedYear
    };
  }
  localStorage.setItem('gati_cState', JSON.stringify(serializableState));
  const activeTabBtn = document.querySelector('.tab-btn.active');
  if (activeTabBtn) {
    localStorage.setItem('gati_activeTab', activeTabBtn.dataset.tab);
  }
}

function loadState() {
  const savedStateStr = localStorage.getItem('gati_cState');
  if (savedStateStr) {
    try {
      const savedState = JSON.parse(savedStateStr);
      for (const id in savedState) {
        if (cState[id]) {
          cState[id].countries = new Set(savedState[id].countries);
          cState[id].yearMin = savedState[id].yearMin;
          cState[id].yearMax = savedState[id].yearMax;
          cState[id].selectedYear = savedState[id].selectedYear;
        }
      }
    } catch (e) { console.error('Failed to parse saved cState', e); }
  }
}

/* ---- Chart-specific accessors ---- */
function chartCountries(id) {
  return getTableCountries(CHARTS[id].table).filter(c => cState[id].countries.has(c));
}
function chartYears(id) {
  return getTableYears(CHARTS[id].table).filter(y => y >= cState[id].yearMin && y <= cState[id].yearMax);
}
function chartEffectiveYear(id) {
  const years = chartYears(id);
  if (years.length === 0) return null;
  if (CHARTS[id].type !== 'trend') {
    const sel = cState[id].selectedYear;
    if (years.includes(sel)) return sel;
  }
  return Math.max(...years);
}

/* ---- Data helpers ---- */
function sumForYear(t, year, nationality, countryList) {
  return DATA[t]
    .filter(r => r.Year === year && r.Nationality === nationality && countryList.includes(r.Country))
    .reduce((s, r) => s + r.Value, 0);
}
function shareRowsForYear(t, year, countryList) {
  const rows = [];
  countryList.forEach(c => {
    const ind = DATA[t].find(r => r.Year === year && r.Country === c && r.Nationality === 'Indian');
    const tot = DATA[t].find(r => r.Year === year && r.Country === c && r.Nationality === 'Total Foreigners');
    if (ind && tot && tot.Value > 0) {
      rows.push({ country: c, share: (ind.Value / tot.Value) * 100, indianValue: ind.Value, totalValue: tot.Value });
    }
  });
  rows.sort((a, b) => b.share - a.share);
  return rows;
}
function avgShare(t, year, countryList) {
  const rows = shareRowsForYear(t, year, countryList);
  if (rows.length === 0) return null;
  return rows.reduce((s, r) => s + r.share, 0) / rows.length;
}

/* ---- KPI rendering (fixed year 2024 for stock KPIs with country names) ---- */
function renderFixedYearKPI(elId, table, nationality, fixedYear) {
  const el = document.getElementById(elId);
  if (!el) return;
  const allC = getTableCountries(table);
  const valEl = el.querySelector('.kpi-value');
  const capEl = el.querySelector('.kpi-caption');
  const countriesWithData = allC.filter(c =>
    DATA[table].some(r => r.Year === fixedYear && r.Country === c && r.Nationality === nationality)
  );
  if (countriesWithData.length === 0) {
    valEl.textContent = '—'; capEl.textContent = 'No data available'; return;
  }
  valEl.textContent = fmtNum(sumForYear(table, fixedYear, nationality, countriesWithData));
  capEl.textContent = fixedYear + ' · ' + countriesWithData.join(', ');
}

function renderFixedYearShareKPI(elId, table, fixedYear) {
  const el = document.getElementById(elId);
  if (!el) return;
  const allC = getTableCountries(table);
  const valEl = el.querySelector('.kpi-value');
  const capEl = el.querySelector('.kpi-caption');
  const rows = shareRowsForYear(table, fixedYear, allC);
  const avg = rows.length ? rows.reduce((s, r) => s + r.share, 0) / rows.length : null;
  if (avg === null) { valEl.textContent = '—'; capEl.textContent = 'No matching data'; return; }
  valEl.textContent = fmtPct(avg);
  capEl.textContent = fixedYear + ' · avg across ' + rows.map(r => r.country).join(', ');
}

/* Legacy KPI helpers kept for Healthcare tab which still uses latest year */
function renderKPI(elId, table, nationality) {
  const el = document.getElementById(elId);
  if (!el) return;
  const allC = getTableCountries(table);
  const years = getTableYears(table);
  const year = years.length ? Math.max(...years) : null;
  const valEl = el.querySelector('.kpi-value');
  const capEl = el.querySelector('.kpi-caption');
  if (!year || allC.length === 0) {
    valEl.textContent = '—'; capEl.textContent = 'No data available'; return;
  }
  const countriesWithData = allC.filter(c =>
    DATA[table].some(r => r.Year === year && r.Country === c && r.Nationality === nationality)
  );
  if (countriesWithData.length === 0) {
    valEl.textContent = '—'; capEl.textContent = 'No data available'; return;
  }
  valEl.textContent = fmtNum(sumForYear(table, year, nationality, countriesWithData));
  capEl.textContent = year + ' · ' + countriesWithData.join(', ');
}

function renderShareKPI(elId, table) {
  const el = document.getElementById(elId);
  if (!el) return;
  const allC = getTableCountries(table);
  const years = getTableYears(table);
  const year = years.length ? Math.max(...years) : null;
  const valEl = el.querySelector('.kpi-value');
  const capEl = el.querySelector('.kpi-caption');
  if (!year) { valEl.textContent = '—'; capEl.textContent = 'No data available'; return; }
  const rows = shareRowsForYear(table, year, allC);
  const avg = rows.length ? rows.reduce((s, r) => s + r.share, 0) / rows.length : null;
  if (avg === null) { valEl.textContent = '—'; capEl.textContent = 'No matching data'; return; }
  valEl.textContent = fmtPct(avg);
  capEl.textContent = year + ' · avg across ' + rows.map(r => r.country).join(', ');
}

/* ---- Chart options ---- */
const chartInstances = {};
function baseFont() { return { family: "'Poppins', sans-serif", size: 12 }; }
function renderOrUpdate(canvasId, config) {
  const ctx = document.getElementById(canvasId);
  if (chartInstances[canvasId]) chartInstances[canvasId].destroy();
  chartInstances[canvasId] = new Chart(ctx, config);
}
function emptyChartConfig() {
  return {
    type: 'bar', data: { labels: [], datasets: [] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
  };
}

function lineOptions() {
  return {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'bottom', labels: { font: baseFont(), usePointStyle: true, boxWidth: 8, padding: 12 } },
      tooltip: { titleFont: baseFont(), bodyFont: baseFont(), callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + fmtNum(ctx.parsed.y) } }
    },
    scales: {
      x: { grid: { color: '#EEF2F3' }, ticks: { font: baseFont() } },
      y: { grid: { color: '#EEF2F3' }, ticks: { font: baseFont(), callback: v => fmtNum(v) }, beginAtZero: true }
    }
  };
}
function barOptions() {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { titleFont: baseFont(), bodyFont: baseFont(), callbacks: { label: ctx => ' ' + fmtNum(ctx.parsed.y) } }
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: baseFont() } },
      y: { grid: { color: '#EEF2F3' }, ticks: { font: baseFont(), callback: v => fmtNum(v) }, beginAtZero: true }
    }
  };
}
function stackedBarOptions() {
  return {
    indexAxis: 'y', responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { font: baseFont(), usePointStyle: true, boxWidth: 8, padding: 12 } },
      tooltip: { titleFont: baseFont(), bodyFont: baseFont(), callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + ctx.parsed.x.toFixed(1) + '%' } }
    },
    scales: {
      x: { stacked: true, min: 0, max: 100, grid: { color: '#EEF2F3' }, ticks: { font: baseFont(), callback: v => v + '%' } },
      y: { stacked: true, grid: { display: false }, ticks: { font: baseFont() } }
    }
  };
}

/* ---- Chart renderers (per-chart filter aware) ---- */
function renderTrendChart(chartId) {
  const cfg = CHARTS[chartId];
  const years = chartYears(chartId);
  const active = chartCountries(chartId);
  const noteEl = document.getElementById('note-' + chartId);
  const canvasId = 'chart-' + chartId;

  if (years.length === 0 || active.length === 0) {
    noteEl.textContent = 'No data available for the current filters.';
    renderOrUpdate(canvasId, emptyChartConfig()); return;
  }
  const datasets = active.map(c => {
    const data = years.map(y => {
      const rec = DATA[cfg.table].find(r => r.Year === y && r.Country === c && r.Nationality === cfg.nationality);
      return rec ? rec.Value : null;
    });
    return {
      label: c, data, borderColor: COUNTRY_COLORS[c], backgroundColor: COUNTRY_COLORS[c],
      tension: 0.3, spanGaps: true, borderWidth: 2.5, pointRadius: 3, pointHoverRadius: 5
    };
  });
  renderOrUpdate(canvasId, { type: 'line', data: { labels: years, datasets }, options: lineOptions() });
  noteEl.textContent = years[0] + '–' + years[years.length - 1] + ' · ' + active.join(', ');
}

function renderShareChart(chartId) {
  const cfg = CHARTS[chartId];
  const year = chartEffectiveYear(chartId);
  const active = chartCountries(chartId);
  const noteEl = document.getElementById('note-' + chartId);
  const canvasId = 'chart-' + chartId;

  if (year === null) {
    noteEl.textContent = 'No data available for the current filters.';
    renderOrUpdate(canvasId, emptyChartConfig()); return;
  }
  const rows = shareRowsForYear(cfg.table, year, active);
  if (rows.length === 0) {
    noteEl.textContent = 'No overlapping Indian / Total-Foreigner data for the current filters.';
    renderOrUpdate(canvasId, emptyChartConfig()); return;
  }
  renderOrUpdate(canvasId, {
    type: 'bar',
    data: {
      labels: rows.map(r => r.country),
      datasets: [
        { label: 'Indian', data: rows.map(r => r.share), backgroundColor: NATION_COLORS.Indian, stack: 's' },
        { label: 'Rest of foreign nationals', data: rows.map(r => 100 - r.share), backgroundColor: NATION_COLORS['Total Foreigners'], stack: 's' }
      ]
    },
    options: stackedBarOptions()
  });
  noteEl.textContent = year + ' · ' + rows.map(r => r.country).join(', ');
}

function renderSnapshotChart(chartId) {
  const cfg = CHARTS[chartId];
  const year = chartEffectiveYear(chartId);
  const active = chartCountries(chartId);
  const noteEl = document.getElementById('note-' + chartId);
  const canvasId = 'chart-' + chartId;

  if (year === null || active.length === 0) {
    noteEl.textContent = 'No data available for the current filters.';
    renderOrUpdate(canvasId, emptyChartConfig()); return;
  }
  const rows = active
    .map(c => {
      const rec = DATA[cfg.table].find(r => r.Year === year && r.Country === c && r.Nationality === cfg.nationality);
      return { country: c, value: rec ? rec.Value : 0 };
    })
    .filter(r => r.value > 0)
    .sort((a, b) => b.value - a.value);

  if (rows.length === 0) {
    noteEl.textContent = 'No data available for the current filters.';
    renderOrUpdate(canvasId, emptyChartConfig()); return;
  }
  renderOrUpdate(canvasId, {
    type: 'bar',
    data: {
      labels: rows.map(r => r.country), datasets: [{
        label: cfg.nationality, data: rows.map(r => r.value),
        backgroundColor: rows.map(r => COUNTRY_COLORS[r.country])
      }]
    },
    options: barOptions()
  });
  noteEl.textContent = year + ' · ' + rows.map(r => r.country).join(', ');
}

/* ---- Trend-share chart: India's share (%) per country over time ---- */
function renderTrendShareChart(chartId) {
  const cfg = CHARTS[chartId];
  const years = chartYears(chartId);
  const active = chartCountries(chartId);
  const noteEl = document.getElementById('note-' + chartId);
  const canvasId = 'chart-' + chartId;

  if (years.length === 0 || active.length === 0) {
    noteEl.textContent = 'No data available for the current filters.';
    renderOrUpdate(canvasId, emptyChartConfig()); return;
  }

  /* For each country, compute Indian / Total Foreigners share per year */
  const countriesWithData = active.filter(c =>
    years.some(y => {
      const ind = DATA[cfg.table].find(r => r.Year === y && r.Country === c && r.Nationality === 'Indian');
      const tot = DATA[cfg.table].find(r => r.Year === y && r.Country === c && r.Nationality === 'Total Foreigners');
      return ind && tot && tot.Value > 0;
    })
  );

  if (countriesWithData.length === 0) {
    noteEl.textContent = 'No overlapping Indian / Total-Foreigner data for the current filters.';
    renderOrUpdate(canvasId, emptyChartConfig()); return;
  }

  const datasets = countriesWithData.map(c => {
    const data = years.map(y => {
      const ind = DATA[cfg.table].find(r => r.Year === y && r.Country === c && r.Nationality === 'Indian');
      const tot = DATA[cfg.table].find(r => r.Year === y && r.Country === c && r.Nationality === 'Total Foreigners');
      if (ind && tot && tot.Value > 0) return (ind.Value / tot.Value) * 100;
      return null;
    });
    return {
      label: c, data, borderColor: COUNTRY_COLORS[c], backgroundColor: COUNTRY_COLORS[c],
      tension: 0.3, spanGaps: true, borderWidth: 2.5, pointRadius: 3, pointHoverRadius: 5
    };
  });

  renderOrUpdate(canvasId, {
    type: 'line',
    data: { labels: years, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { font: baseFont(), usePointStyle: true, boxWidth: 8, padding: 12 } },
        tooltip: { titleFont: baseFont(), bodyFont: baseFont(), callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + (ctx.parsed.y !== null ? ctx.parsed.y.toFixed(1) + '%' : '—') } }
      },
      scales: {
        x: { grid: { color: '#EEF2F3' }, ticks: { font: baseFont() } },
        y: { grid: { color: '#EEF2F3' }, ticks: { font: baseFont(), callback: v => v.toFixed(1) + '%' }, beginAtZero: true }
      }
    }
  });
  noteEl.textContent = years[0] + '–' + years[years.length - 1] + " · India's share = Indian nurses ÷ total foreign nurses × 100, per country. " + countriesWithData.join(', ');
}

function renderChart(chartId) {
  const type = CHARTS[chartId].type;
  if (type === 'trend') renderTrendChart(chartId);
  else if (type === 'share') renderShareChart(chartId);
  else if (type === 'snapshot') renderSnapshotChart(chartId);
  else if (type === 'trend-share') renderTrendShareChart(chartId);
}

/* ---- Build per-chart filter UI ---- */
function buildChartFilters() {
  Object.keys(CHARTS).forEach(id => {
    const cfg = CHARTS[id];
    const el = document.getElementById('filters-' + id);
    if (!el) return;
    el.innerHTML = '';

    const allCountries = getTableCountries(cfg.table);
    const allYears = getTableYears(cfg.table);
    const st = cState[id];

    /* Country pills */
    allCountries.forEach(c => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chart-pill' + (st.countries.has(c) ? ' active' : '');
      btn.textContent = c;
      btn.onclick = () => {
        if (st.countries.has(c)) st.countries.delete(c); else st.countries.add(c);
        btn.classList.toggle('active');
        renderChart(id);
        saveState();
      };
      el.appendChild(btn);
    });

    /* Year controls */
    if (allYears.length > 1) {
      if (cfg.type.includes('trend')) {
        /* Year range: from – to */
        const lbl = document.createElement('span');
        lbl.className = 'filter-year-label';
        lbl.textContent = 'Years:';
        el.appendChild(lbl);

        const from = document.createElement('select');
        from.className = 'chart-year-sel';
        allYears.forEach(y => { const o = document.createElement('option'); o.value = y; o.textContent = y; from.appendChild(o); });
        from.value = st.yearMin;

        const sep = document.createElement('span');
        sep.className = 'filter-sep';
        sep.textContent = '–';

        const to = document.createElement('select');
        to.className = 'chart-year-sel';
        allYears.forEach(y => { const o = document.createElement('option'); o.value = y; o.textContent = y; to.appendChild(o); });
        to.value = st.yearMax;

        from.onchange = () => {
          st.yearMin = parseInt(from.value);
          if (st.yearMin > st.yearMax) { st.yearMax = st.yearMin; to.value = st.yearMax; }
          renderChart(id);
          saveState();
        };
        to.onchange = () => {
          st.yearMax = parseInt(to.value);
          if (st.yearMax < st.yearMin) { st.yearMin = st.yearMax; from.value = st.yearMin; }
          renderChart(id);
          saveState();
        };

        el.appendChild(from);
        el.appendChild(sep);
        el.appendChild(to);
      } else {
        /* Single year selector for snapshot / share */
        const lbl = document.createElement('span');
        lbl.className = 'filter-year-label';
        lbl.textContent = 'Year:';
        el.appendChild(lbl);

        const sel = document.createElement('select');
        sel.className = 'chart-year-sel';
        allYears.forEach(y => { const o = document.createElement('option'); o.value = y; o.textContent = y; sel.appendChild(o); });
        sel.value = st.selectedYear;
        sel.onchange = () => {
          st.selectedYear = parseInt(sel.value);
          renderChart(id);
          saveState();
        };
        el.appendChild(sel);
      }
    }
  });
}

/* ---- Tab navigation ---- */
const TABS_CHARTS = {
  population: ['pop-stock-trend', 'pop-share', 'pop-flow-A-indian', 'pop-flow-A-foreign', 'pop-flow-B-indian', 'pop-flow-B-foreign'],
  employment: ['emp-stock-trend', 'emp-share', 'emp-flow-indian', 'emp-flow-foreign'],
  healthcare: ['health-stock-trend', 'health-stock-foreign', 'health-share-trend', 'health-flow-trend', 'health-top-dest']
};

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      saveState();
      /* Re-render charts in newly visible tab (Chart.js needs visible canvas for sizing) */
      requestAnimationFrame(() => {
        const charts = TABS_CHARTS[btn.dataset.tab];
        if (charts) charts.forEach(id => renderChart(id));
      });
    };
  });
}

/* ---- Render all KPIs ---- */
function renderKPIs() {
  /* Population — use AllReasons_Stock year 2024 (5 countries) */
  renderFixedYearKPI('kpi-pop-indian', 'AllReasons_Stock', 'Indian', 2024);
  renderFixedYearKPI('kpi-pop-foreign', 'AllReasons_Stock', 'Total Foreigners', 2024);
  renderFixedYearShareKPI('kpi-pop-share', 'AllReasons_Stock', 2024);

  /* Employment — use Employment_Stock year 2024 (9 countries) */
  renderFixedYearKPI('kpi-emp-indian', 'Employment_Stock', 'Indian', 2024);
  renderFixedYearKPI('kpi-emp-foreign', 'Employment_Stock', 'Total Foreigners', 2024);
  renderFixedYearShareKPI('kpi-emp-share', 'Employment_Stock', 2024);

  /* Healthcare — use Healthcare_Nurses_Stock year 2024 */
  renderFixedYearKPI('kpi-health-indian', 'Healthcare_Nurses_Stock', 'Indian', 2024);
  renderFixedYearKPI('kpi-health-foreign', 'Healthcare_Nurses_Stock', 'Total Foreigners', 2024);
  renderFixedYearShareKPI('kpi-health-share', 'Healthcare_Nurses_Stock', 2024);

  /* Healthcare — growth KPI (avg % change across countries with 2020 & latest data) */
  renderHealthGrowthKPI('kpi-health-growth', 'Healthcare_Nurses_Stock');
}

/* ---- Healthcare growth KPI: average % change for Indian nurses across countries ---- */
function renderHealthGrowthKPI(elId, table) {
  const el = document.getElementById(elId);
  if (!el) return;
  const valEl = el.querySelector('.kpi-value');
  const capEl = el.querySelector('.kpi-caption');
  const allC = getTableCountries(table);
  const years = getTableYears(table);
  if (years.length < 2) { valEl.textContent = '—'; capEl.textContent = 'Not enough years'; return; }
  const firstYear = Math.min(...years);
  const lastYear = Math.max(...years);

  const growths = [];
  const countriesUsed = [];
  allC.forEach(c => {
    const first = DATA[table].find(r => r.Year === firstYear && r.Country === c && r.Nationality === 'Indian');
    const last = DATA[table].find(r => r.Year === lastYear && r.Country === c && r.Nationality === 'Indian');
    if (first && last && first.Value > 0) {
      growths.push(((last.Value - first.Value) / first.Value) * 100);
      countriesUsed.push(c);
    }
  });
  if (growths.length === 0) { valEl.textContent = '—'; capEl.textContent = 'No matching data'; return; }
  const avg = growths.reduce((s, v) => s + v, 0) / growths.length;
  valEl.textContent = (avg >= 0 ? '+' : '') + avg.toFixed(0) + '%';
  capEl.textContent = firstYear + '→' + lastYear + ' · avg across ' + countriesUsed.join(', ');
}
/* ---- Master init (called after DATA is populated) ---- */
function initDashboard(){
  initChartStates();
  loadState();
  initTabs();
  buildChartFilters();
  renderKPIs();
  /* Render only the active tab's charts on init */
  const activeTab = localStorage.getItem('gati_activeTab') || 'population';
  const tabBtn = document.querySelector(`.tab-btn[data-tab="${activeTab}"]`);
  if (tabBtn) {
    tabBtn.click();
  } else {
    TABS_CHARTS.population.forEach(id => renderChart(id));
  }
}
