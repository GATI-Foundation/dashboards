/* ==========================================================================
   GATI Japan Country Dashboard — logic
   Processes Japan residence status CSV (Jun-only), renders KPIs, charts,
   and auto-generated insights. Uses CAGR as primary growth metric.
   ========================================================================== */

/* ---- Constants ---- */
const JUNE_YEARS = [2021, 2022, 2023, 2024, 2025];

/* Column indices for June data pairs (0-indexed; col 0 = Residence Status)
   Header: Residence Status, Jun-2021 Total, Jun-2021 India, Dec-2021 Total, Dec-2021 India, ...
   June pairs: (1,2), (5,6), (9,10), (13,14), (17,18)  */
const JUNE_COL_PAIRS = [
  { year: 2021, totalIdx: 1, indianIdx: 2 },
  { year: 2022, totalIdx: 5, indianIdx: 6 },
  { year: 2023, totalIdx: 9, indianIdx: 10 },
  { year: 2024, totalIdx: 13, indianIdx: 14 },
  { year: 2025, totalIdx: 17, indianIdx: 18 }
];

/* Employment residence categories (all 17 as specified) */
const EMPLOYMENT_CATEGORIES = [
  'Professor', 'Artist', 'Religious Activities', 'Journalist/Press',
  'Highly Skilled Professional (Total)',
  'Business Manager', 'Legal/Accounting Services',
  'Medical (Healthcare Worker)', 'Researcher', 'Education',
  'Engineer/Specialist in Humanities/International Services',
  'Intra-company Transferee', 'Caregiver (Nursing Care)',
  'Entertainer', 'Skilled Labor',
  'Specified Skilled Worker (Total)',
  'Technical Intern Training (Total)'
];

/* Healthcare categories */
const HEALTHCARE_CATEGORIES = [
  'Medical (Healthcare Worker)',
  'Caregiver (Nursing Care)'
];

/* Sub-categories to exclude from top-level analysis */
const SUB_CATEGORIES = [
  'Highly Skilled Professional 1a (Academic)',
  'Highly Skilled Professional 1b (Technical)',
  'Highly Skilled Professional 1c (Management)',
  'Highly Skilled Professional 2',
  'Specified Skilled Worker Type 1',
  'Specified Skilled Worker Type 2',
  'Technical Intern Training 1a',
  'Technical Intern Training 1b',
  'Technical Intern Training 2a',
  'Technical Intern Training 2b',
  'Technical Intern Training 3a',
  'Technical Intern Training 3b'
];

/* Short display names for chart labels */
const SHORT_NAMES = {
  'Engineer/Specialist in Humanities/International Services': 'Engineer/Specialist',
  'Highly Skilled Professional (Total)': 'Highly Skilled Prof.',
  'Technical Intern Training (Total)': 'Tech. Intern Training',
  'Specified Skilled Worker (Total)': 'Specified Skilled Worker',
  'Medical (Healthcare Worker)': 'Medical/Healthcare',
  'Caregiver (Nursing Care)': 'Caregiver/Nursing',
  'Spouse of Japanese National': 'Spouse (Japanese)',
  'Spouse of Permanent Resident': 'Spouse (Perm. Resident)',
  'Legal/Accounting Services': 'Legal/Accounting',
  'Religious Activities': 'Religious Activities',
  'Journalist/Press': 'Journalist/Press',
  'Intra-company Transferee': 'Intra-co. Transferee',
  'Cultural Activities': 'Cultural Activities',
  'Designated Activities': 'Designated Activities',
  'Special Permanent Resident': 'Special Perm. Resident'
};

/* Color palette for categories */
const CAT_PALETTE = [
  '#006B76', '#E5A812', '#84D2E2', '#00333A', '#FFCC4E',
  '#8C6A1F', '#839097', '#2E8B94', '#C98A1D', '#4A5A61',
  '#5B9A8B', '#D4763E', '#7B6BA1', '#3D8B7A', '#B85C4F',
  '#6A9BC3', '#C4A35A', '#E07B54', '#5E8C61', '#9B7CB8',
  '#7FA8B5', '#CF8A67', '#8BAA56', '#A6967A', '#6B8FA3',
  '#BE8C73', '#7A9E87'
];

/* ---- Global data store ---- */
var JP_DATA = {}; // { categoryName: { total: [5 values], indian: [5 values] } }

/* ---- Utilities ---- */
function fmtNum(n) { return Math.round(n).toLocaleString('en-US'); }
function fmtPct(n) { return n.toFixed(1) + '%'; }
function fmtPctSigned(n) { return (n >= 0 ? '+' : '') + n.toFixed(1) + '%'; }
function shortName(cat) { return SHORT_NAMES[cat] || cat; }

function calcCAGR(startVal, endVal, years) {
  if (!startVal || startVal <= 0 || !endVal || endVal <= 0 || years <= 0) return null;
  return (Math.pow(endVal / startVal, 1 / years) - 1) * 100;
}

function getCatColor(cat, idx) {
  return CAT_PALETTE[idx % CAT_PALETTE.length];
}

/* ---- CSV Processing ---- */
function processJapanCSV(grid) {
  if (grid.length < 2) return;
  for (let ri = 1; ri < grid.length; ri++) {
    const row = grid[ri];
    if (!row || row.length < 2) continue;
    const category = row[0].trim();
    if (!category) continue;

    const totalArr = [];
    const indianArr = [];

    for (const pair of JUNE_COL_PAIRS) {
      const t = parseNumber(row[pair.totalIdx]);
      const ind = parseNumber(row[pair.indianIdx]);
      totalArr.push(t !== null ? t : 0);
      indianArr.push(ind !== null ? ind : 0);
    }

    JP_DATA[category] = { total: totalArr, indian: indianArr };
  }
}

/* ---- Data accessors ---- */
function getMainCategories() {
  return Object.keys(JP_DATA).filter(c => c !== 'Total' && !SUB_CATEGORIES.includes(c));
}

function getLatestIdx() { return JUNE_YEARS.length - 1; }
function getFirstIdx() { return 0; }
function cagrYears() { return JUNE_YEARS.length - 1; } // 4 years from 2021 to 2025

function sumCategories(catList, field, yearIdx) {
  let sum = 0;
  catList.forEach(c => {
    if (JP_DATA[c]) sum += JP_DATA[c][field][yearIdx];
  });
  return sum;
}

function sumCategoriesArray(catList, field) {
  return JUNE_YEARS.map((_, i) => sumCategories(catList, field, i));
}

/* ---- Chart.js helpers ---- */
const chartInstances = {};
function baseFont() { return { family: "'Poppins', sans-serif", size: 12 }; }

function renderOrUpdate(canvasId, config) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  if (chartInstances[canvasId]) chartInstances[canvasId].destroy();
  chartInstances[canvasId] = new Chart(ctx, config);
}

function lineOptions(yCallback) {
  return {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'bottom', labels: { font: baseFont(), usePointStyle: true, boxWidth: 8, padding: 12 } },
      tooltip: { titleFont: baseFont(), bodyFont: baseFont() }
    },
    scales: {
      x: { grid: { color: '#EEF2F3' }, ticks: { font: baseFont() } },
      y: { grid: { color: '#EEF2F3' }, ticks: { font: baseFont(), callback: yCallback || (v => fmtNum(v)) }, beginAtZero: true }
    }
  };
}

function hBarOptions(xCallback) {
  return {
    indexAxis: 'y', responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { titleFont: baseFont(), bodyFont: baseFont() }
    },
    scales: {
      x: { grid: { color: '#EEF2F3' }, ticks: { font: baseFont(), callback: xCallback || (v => fmtNum(v)) }, beginAtZero: true },
      y: { grid: { display: false }, ticks: { font: baseFont() } }
    }
  };
}

/* ======================================================================
   RENDERING
   ====================================================================== */

/* ---- Executive KPI Cards ---- */
function renderExecKPIs() {
  const li = getLatestIdx();
  const fi = getFirstIdx();
  const years = cagrYears();
  const latestYear = 'Jun ' + JUNE_YEARS[li];

  // All Residents (Total row)
  if (JP_DATA['Total']) {
    const d = JP_DATA['Total'];
    document.getElementById('exec-all-period').textContent = latestYear;
    document.getElementById('exec-all-indian').textContent = fmtNum(d.indian[li]);
    document.getElementById('exec-all-foreign').textContent = fmtNum(d.total[li]);
    document.getElementById('exec-all-share').textContent = d.total[li] > 0 ? fmtPct(d.indian[li] / d.total[li] * 100) : '—';
    const cagr = calcCAGR(d.indian[fi], d.indian[li], years);
    const cagrEl = document.getElementById('exec-all-cagr');
    if (cagr !== null) {
      cagrEl.textContent = "India's CAGR " + fmtPctSigned(cagr);
      cagrEl.className = 'exec-cagr' + (cagr < 0 ? ' negative' : '');
    }
  }

  // Employment
  const empIndian = sumCategoriesArray(EMPLOYMENT_CATEGORIES, 'indian');
  const empTotal = sumCategoriesArray(EMPLOYMENT_CATEGORIES, 'total');
  document.getElementById('exec-emp-period').textContent = latestYear;
  document.getElementById('exec-emp-indian').textContent = fmtNum(empIndian[li]);
  document.getElementById('exec-emp-foreign').textContent = fmtNum(empTotal[li]);
  document.getElementById('exec-emp-share').textContent = empTotal[li] > 0 ? fmtPct(empIndian[li] / empTotal[li] * 100) : '—';
  const empCagr = calcCAGR(empIndian[fi], empIndian[li], years);
  const empCagrEl = document.getElementById('exec-emp-cagr');
  if (empCagr !== null) {
    empCagrEl.textContent = "India's CAGR " + fmtPctSigned(empCagr);
    empCagrEl.className = 'exec-cagr' + (empCagr < 0 ? ' negative' : '');
  }

  // Healthcare & Care Workers
  const hcIndian = sumCategoriesArray(HEALTHCARE_CATEGORIES, 'indian');
  const hcTotal = sumCategoriesArray(HEALTHCARE_CATEGORIES, 'total');
  document.getElementById('exec-health-period').textContent = latestYear;
  document.getElementById('exec-health-indian').textContent = fmtNum(hcIndian[li]);
  document.getElementById('exec-health-foreign').textContent = fmtNum(hcTotal[li]);
  document.getElementById('exec-health-share').textContent = hcTotal[li] > 0 ? fmtPct(hcIndian[li] / hcTotal[li] * 100) : '—';

}

/* ---- Overview Charts ---- */
function renderOverviewCharts() {
  if (!JP_DATA['Total']) return;
  const d = JP_DATA['Total'];
  const labels = JUNE_YEARS.map(y => 'Jun ' + y);

  // 1. Indian Population Trend
  renderOrUpdate('chart-jp-indian-trend', {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Indian Population',
        data: d.indian,
        borderColor: '#E5A812', backgroundColor: 'rgba(229,168,18,0.1)',
        tension: 0.3, fill: true, borderWidth: 2.5, pointRadius: 4, pointHoverRadius: 6
      }]
    },
    options: {
      ...lineOptions(),
      plugins: {
        ...lineOptions().plugins,
        tooltip: {
          ...lineOptions().plugins.tooltip,
          callbacks: { label: ctx => ' Indian: ' + fmtNum(ctx.parsed.y) }
        }
      }
    }
  });
  document.getElementById('note-jp-indian-trend').textContent =
    'Jun ' + JUNE_YEARS[0] + '–' + JUNE_YEARS[JUNE_YEARS.length - 1] + ' · ' + fmtNum(d.indian[0]) + ' → ' + fmtNum(d.indian[d.indian.length - 1]) + '. Source: Immigration Services Agency (ISA), Japan. Statistics on Foreign Residents in Japan.';

  // 2. Total Foreign Population Trend
  renderOrUpdate('chart-jp-foreign-trend', {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Total Foreign Population',
        data: d.total,
        borderColor: '#006B76', backgroundColor: 'rgba(0,107,118,0.1)',
        tension: 0.3, fill: true, borderWidth: 2.5, pointRadius: 4, pointHoverRadius: 6
      }]
    },
    options: {
      ...lineOptions(),
      plugins: {
        ...lineOptions().plugins,
        tooltip: {
          ...lineOptions().plugins.tooltip,
          callbacks: { label: ctx => ' Total Foreign: ' + fmtNum(ctx.parsed.y) }
        }
      }
    }
  });
  document.getElementById('note-jp-foreign-trend').textContent =
    'Jun ' + JUNE_YEARS[0] + '–' + JUNE_YEARS[JUNE_YEARS.length - 1] + ' · ' + fmtNum(d.total[0]) + ' → ' + fmtNum(d.total[d.total.length - 1]) + '. Source: Immigration Services Agency (ISA), Japan. Statistics on Foreign Residents in Japan.';

  // 3. India's Share Trend
  const shareData = JUNE_YEARS.map((_, i) => d.total[i] > 0 ? (d.indian[i] / d.total[i] * 100) : 0);
  renderOrUpdate('chart-jp-share-trend', {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: "India's Share (%)",
        data: shareData,
        borderColor: '#2E8B94', backgroundColor: 'rgba(46,139,148,0.1)',
        tension: 0.3, fill: true, borderWidth: 2.5, pointRadius: 4, pointHoverRadius: 6
      }]
    },
    options: lineOptions(v => v.toFixed(2) + '%')
  });
  document.getElementById('note-jp-share-trend').textContent =
    fmtPct(shareData[0]) + ' → ' + fmtPct(shareData[shareData.length - 1]) + '. Source: Calculated from Immigration Services Agency (ISA), Japan data.';

  // 4. Top Residence Categories by Indian Count
  const li = getLatestIdx();
  const cats = getMainCategories()
    .filter(c => JP_DATA[c].indian[li] > 0)
    .map(c => ({ name: c, value: JP_DATA[c].indian[li] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 15);

  renderOrUpdate('chart-jp-top-categories', {
    type: 'bar',
    data: {
      labels: cats.map(c => shortName(c.name)),
      datasets: [{
        label: 'Indian Count',
        data: cats.map(c => c.value),
        backgroundColor: cats.map((_, i) => CAT_PALETTE[i % CAT_PALETTE.length])
      }]
    },
    options: {
      ...hBarOptions(),
      plugins: {
        ...hBarOptions().plugins,
        tooltip: {
          titleFont: baseFont(), bodyFont: baseFont(),
          callbacks: { label: ctx => ' ' + fmtNum(ctx.parsed.x) }
        }
      }
    }
  });
  document.getElementById('note-jp-top-categories').textContent =
    'Jun ' + JUNE_YEARS[li] + ' · Top ' + cats.length + ' categories by Indian count. Source: Immigration Services Agency (ISA), Japan. Statistics on Foreign Residents in Japan.';
}

/* ---- Workforce Charts ---- */
function renderWorkforceCharts() {
  const li = getLatestIdx();
  const fi = getFirstIdx();
  const years = cagrYears();

  // 1. Distribution — Doughnut (employment categories only)
  const empCats = EMPLOYMENT_CATEGORIES
    .filter(c => JP_DATA[c] && JP_DATA[c].indian[li] > 0)
    .map(c => ({ name: c, value: JP_DATA[c].indian[li] }))
    .sort((a, b) => b.value - a.value);

  const topCats = empCats.slice(0, 8);
  const otherVal = empCats.slice(8).reduce((s, c) => s + c.value, 0);
  const doughnutLabels = topCats.map(c => shortName(c.name));
  const doughnutData = topCats.map(c => c.value);
  if (otherVal > 0) { doughnutLabels.push('Other'); doughnutData.push(otherVal); }

  renderOrUpdate('chart-jp-distribution', {
    type: 'doughnut',
    data: {
      labels: doughnutLabels,
      datasets: [{
        data: doughnutData,
        backgroundColor: doughnutLabels.map((_, i) => CAT_PALETTE[i % CAT_PALETTE.length]),
        borderWidth: 2, borderColor: '#fff'
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { font: baseFont(), padding: 10, usePointStyle: true, boxWidth: 8 } },
        tooltip: {
          titleFont: baseFont(), bodyFont: baseFont(),
          callbacks: {
            label: ctx => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              return ' ' + ctx.label + ': ' + fmtNum(ctx.parsed) + ' (' + fmtPct(ctx.parsed / total * 100) + ')';
            }
          }
        }
      }
    }
  });
  document.getElementById('note-jp-distribution').textContent =
    'Jun ' + JUNE_YEARS[li] + ' · Employment categories — Indian workers. Source: Calculated from Immigration Services Agency (ISA), Japan data.';

  // 2. Fastest Growing Employment Categories (CAGR)
  const cagrData = EMPLOYMENT_CATEGORIES
    .filter(c => JP_DATA[c] && JP_DATA[c].indian[fi] >= 10 && JP_DATA[c].indian[li] > 0)
    .map(c => {
      const cagr = calcCAGR(JP_DATA[c].indian[fi], JP_DATA[c].indian[li], years);
      return { name: c, cagr: cagr || 0 };
    })
    .filter(c => c.cagr !== 0)
    .sort((a, b) => b.cagr - a.cagr)
    .slice(0, 12);

  renderOrUpdate('chart-jp-cagr-rank', {
    type: 'bar',
    data: {
      labels: cagrData.map(c => shortName(c.name)),
      datasets: [{
        label: "India's CAGR (%)",
        data: cagrData.map(c => c.cagr),
        backgroundColor: cagrData.map(c => c.cagr >= 0 ? '#2E8B94' : '#C0392B')
      }]
    },
    options: {
      ...hBarOptions(v => v.toFixed(1) + '%'),
      plugins: {
        ...hBarOptions().plugins,
        tooltip: {
          titleFont: baseFont(), bodyFont: baseFont(),
          callbacks: { label: ctx => " India's CAGR: " + fmtPctSigned(ctx.parsed.x) }
        }
      }
    }
  });
  document.getElementById('note-jp-cagr-rank').textContent =
    'Jun ' + JUNE_YEARS[fi] + '–' + JUNE_YEARS[li] + ' · Indian workers, employment categories. Source: Calculated from Immigration Services Agency (ISA), Japan data.';

  // 3. India's Share across Employment Categories
  const shareCats = EMPLOYMENT_CATEGORIES
    .filter(c => JP_DATA[c] && JP_DATA[c].total[li] > 0 && JP_DATA[c].indian[li] > 0)
    .map(c => ({
      name: c,
      share: JP_DATA[c].indian[li] / JP_DATA[c].total[li] * 100
    }))
    .sort((a, b) => b.share - a.share);

  renderOrUpdate('chart-jp-share-cats', {
    type: 'bar',
    data: {
      labels: shareCats.map(c => shortName(c.name)),
      datasets: [{
        label: "India's Share (%)",
        data: shareCats.map(c => c.share),
        backgroundColor: shareCats.map((_, i) => CAT_PALETTE[i % CAT_PALETTE.length])
      }]
    },
    options: {
      ...hBarOptions(v => v.toFixed(1) + '%'),
      plugins: {
        ...hBarOptions().plugins,
        tooltip: {
          titleFont: baseFont(), bodyFont: baseFont(),
          callbacks: { label: ctx => " India's Share: " + fmtPct(ctx.parsed.x) }
        }
      }
    }
  });
  document.getElementById('note-jp-share-cats').textContent =
    'Jun ' + JUNE_YEARS[li] + ' · Indian / Total Foreign per category. Source: Calculated from Immigration Services Agency (ISA), Japan data.';

  // 4. Employment Category Trends (top 5 by latest count)
  const topEmpTrend = EMPLOYMENT_CATEGORIES
    .filter(c => JP_DATA[c])
    .map(c => ({ name: c, latest: JP_DATA[c].indian[li] }))
    .sort((a, b) => b.latest - a.latest)
    .slice(0, 5);

  const labels = JUNE_YEARS.map(y => 'Jun ' + y);
  renderOrUpdate('chart-jp-emp-trend', {
    type: 'line',
    data: {
      labels,
      datasets: topEmpTrend.map((c, i) => ({
        label: shortName(c.name),
        data: JP_DATA[c.name].indian,
        borderColor: CAT_PALETTE[i],
        backgroundColor: CAT_PALETTE[i],
        tension: 0.3, borderWidth: 2, pointRadius: 3, pointHoverRadius: 5
      }))
    },
    options: {
      ...lineOptions(),
      plugins: {
        ...lineOptions().plugins,
        tooltip: {
          titleFont: baseFont(), bodyFont: baseFont(),
          callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + fmtNum(ctx.parsed.y) }
        }
      }
    }
  });
  document.getElementById('note-jp-emp-trend').textContent =
    'Jun ' + JUNE_YEARS[0] + '–' + JUNE_YEARS[li] + ' · Based on top 5 count as of Jun ' + JUNE_YEARS[li] + '. Source: Immigration Services Agency (ISA), Japan. Statistics on Foreign Residents in Japan.';
}

/* ---- Healthcare Charts ---- */
function renderHealthcareCharts() {
  const li = getLatestIdx();
  const fi = getFirstIdx();
  const years = cagrYears();
  const labels = JUNE_YEARS.map(y => 'Jun ' + y);

  // Healthcare KPI Cards
  HEALTHCARE_CATEGORIES.forEach(cat => {
    if (!JP_DATA[cat]) return;
    const d = JP_DATA[cat];
    const prefix = cat.includes('Medical') ? 'hk-med' : 'hk-care';
    document.getElementById(prefix + '-indian').textContent = fmtNum(d.indian[li]);
    document.getElementById(prefix + '-foreign').textContent = fmtNum(d.total[li]);
    document.getElementById(prefix + '-share').textContent = d.total[li] > 0 ? fmtPct(d.indian[li] / d.total[li] * 100) : '—';

  });

  // Healthcare Indian Trend
  const medD = JP_DATA['Medical (Healthcare Worker)'];
  const careD = JP_DATA['Caregiver (Nursing Care)'];
  const datasets = [];
  if (medD) {
    datasets.push({
      label: 'Medical/Healthcare',
      data: medD.indian,
      borderColor: '#E07B54', backgroundColor: '#E07B54',
      tension: 0.3, borderWidth: 2.5, pointRadius: 4, pointHoverRadius: 6
    });
  }
  if (careD) {
    datasets.push({
      label: 'Caregiver/Nursing',
      data: careD.indian,
      borderColor: '#7B6BA1', backgroundColor: '#7B6BA1',
      tension: 0.3, borderWidth: 2.5, pointRadius: 4, pointHoverRadius: 6
    });
  }
  renderOrUpdate('chart-jp-health-indian', {
    type: 'line',
    data: { labels, datasets },
    options: {
      ...lineOptions(),
      plugins: {
        ...lineOptions().plugins,
        tooltip: {
          titleFont: baseFont(), bodyFont: baseFont(),
          callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + fmtNum(ctx.parsed.y) }
        }
      }
    }
  });
  document.getElementById('note-jp-health-indian').textContent =
    'Jun ' + JUNE_YEARS[0] + '–' + JUNE_YEARS[li] + ' · Indian healthcare & care workers. Source: Immigration Services Agency (ISA), Japan. Statistics on Foreign Residents in Japan.';

  // Healthcare Total Foreign Trend
  const fDatasets = [];
  if (medD) {
    fDatasets.push({
      label: 'Medical/Healthcare',
      data: medD.total,
      borderColor: '#006B76', backgroundColor: '#006B76',
      tension: 0.3, borderWidth: 2.5, pointRadius: 4, pointHoverRadius: 6
    });
  }
  if (careD) {
    fDatasets.push({
      label: 'Caregiver/Nursing',
      data: careD.total,
      borderColor: '#2E8B94', backgroundColor: '#2E8B94',
      tension: 0.3, borderWidth: 2.5, pointRadius: 4, pointHoverRadius: 6
    });
  }
  renderOrUpdate('chart-jp-health-foreign', {
    type: 'line',
    data: { labels, datasets: fDatasets },
    options: {
      ...lineOptions(),
      plugins: {
        ...lineOptions().plugins,
        tooltip: {
          titleFont: baseFont(), bodyFont: baseFont(),
          callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + fmtNum(ctx.parsed.y) }
        }
      }
    }
  });
  document.getElementById('note-jp-health-foreign').textContent =
    'Jun ' + JUNE_YEARS[0] + '–' + JUNE_YEARS[li] + ' · Total foreign healthcare & care workers. Source: Immigration Services Agency (ISA), Japan. Statistics on Foreign Residents in Japan.';
}

/* ---- Insights Generation ---- */
function renderInsights() {
  const li = getLatestIdx();
  const fi = getFirstIdx();
  const years = cagrYears();
  const insights = [];

  // 1. Total Indian Population Growth
  if (JP_DATA['Total']) {
    const d = JP_DATA['Total'];
    const growth = d.indian[li] - d.indian[fi];
    const cagr = calcCAGR(d.indian[fi], d.indian[li], years);
    insights.push({
      cls: 'highlight',
      title: 'Indian Population Growth',
      body: `India's population in Japan grew from <b>${fmtNum(d.indian[fi])}</b> (Jun ${JUNE_YEARS[fi]}) to <b>${fmtNum(d.indian[li])}</b> (Jun ${JUNE_YEARS[li]}), an absolute increase of <b>${fmtNum(growth)}</b> with an India CAGR of <b>${cagr !== null ? fmtPct(cagr) : '—'}</b>.`
    });
  }

  // 2. Largest Category
  const mainCats = getMainCategories();
  const largestCat = mainCats
    .filter(c => JP_DATA[c].indian[li] > 0)
    .sort((a, b) => JP_DATA[b].indian[li] - JP_DATA[a].indian[li])[0];
  if (largestCat) {
    insights.push({
      cls: 'gold',
      title: 'Largest Residence Category',
      body: `<b>${shortName(largestCat)}</b> is the largest residence category for Indians in Japan with <b>${fmtNum(JP_DATA[largestCat].indian[li])}</b> persons in Jun ${JUNE_YEARS[li]}, accounting for <b>${fmtPct(JP_DATA[largestCat].indian[li] / JP_DATA['Total'].indian[li] * 100)}</b> of all Indian residents.`
    });
  }

  // 3. Fastest Growing Category (employment)
  const cagrRanked = EMPLOYMENT_CATEGORIES
    .filter(c => JP_DATA[c] && JP_DATA[c].indian[fi] >= 10 && JP_DATA[c].indian[li] > 0)
    .map(c => ({ name: c, cagr: calcCAGR(JP_DATA[c].indian[fi], JP_DATA[c].indian[li], years) }))
    .filter(c => c.cagr !== null)
    .sort((a, b) => b.cagr - a.cagr);

  if (cagrRanked.length > 0) {
    const fastest = cagrRanked[0];
    insights.push({
      cls: 'highlight',
      title: 'Fastest Growing Employment Category',
      body: `<b>${shortName(fastest.name)}</b> is the fastest growing employment category for Indians with an India CAGR of <b>${fmtPct(fastest.cagr)}</b> (Jun ${JUNE_YEARS[fi]}–${JUNE_YEARS[li]}). Indian count grew from <b>${fmtNum(JP_DATA[fastest.name].indian[fi])}</b> to <b>${fmtNum(JP_DATA[fastest.name].indian[li])}</b>.`
    });
  }

  // 4. India's Share of Total Foreign Population
  if (JP_DATA['Total']) {
    const shareStart = JP_DATA['Total'].indian[fi] / JP_DATA['Total'].total[fi] * 100;
    const shareEnd = JP_DATA['Total'].indian[li] / JP_DATA['Total'].total[li] * 100;
    const direction = shareEnd > shareStart ? 'increased' : 'decreased';
    insights.push({
      cls: '',
      title: "India's Share of Foreign Population",
      body: `India's share of Japan's total foreign population <b>${direction}</b> from <b>${fmtPct(shareStart)}</b> (Jun ${JUNE_YEARS[fi]}) to <b>${fmtPct(shareEnd)}</b> (Jun ${JUNE_YEARS[li]}).`
    });
  }

  // 5. Highest Indian Share Category
  const highShareCat = mainCats
    .filter(c => JP_DATA[c].total[li] > 100 && JP_DATA[c].indian[li] > 0) // min threshold
    .map(c => ({ name: c, share: JP_DATA[c].indian[li] / JP_DATA[c].total[li] * 100 }))
    .sort((a, b) => b.share - a.share)[0];
  if (highShareCat) {
    insights.push({
      cls: 'gold',
      title: 'Highest Indian Share',
      body: `<b>${shortName(highShareCat.name)}</b> has the highest Indian share of total foreign nationals at <b>${fmtPct(highShareCat.share)}</b> (Jun ${JUNE_YEARS[li]}), with <b>${fmtNum(JP_DATA[highShareCat.name].indian[li])}</b> Indians out of <b>${fmtNum(JP_DATA[highShareCat.name].total[li])}</b> total foreign nationals.`
    });
  }

  // 6. Employment Dominance
  const empTotal = sumCategories(EMPLOYMENT_CATEGORIES, 'indian', li);
  if (JP_DATA['Total'] && empTotal > 0) {
    const empShare = empTotal / JP_DATA['Total'].indian[li] * 100;
    insights.push({
      cls: '',
      title: 'Employment Composition',
      body: `<b>${fmtNum(empTotal)}</b> Indians (<b>${fmtPct(empShare)}</b> of all Indian residents) hold employment-related residence statuses in Jun ${JUNE_YEARS[li]}. The remaining are in family, education, or other categories.`
    });
  }

  // 7. Healthcare Snapshot
  const hcIndian = sumCategories(HEALTHCARE_CATEGORIES, 'indian', li);
  const hcTotal = sumCategories(HEALTHCARE_CATEGORIES, 'total', li);
  if (hcIndian > 0) {
    insights.push({
      cls: 'highlight',
      title: 'Healthcare Presence',
      body: `<b>${fmtNum(hcIndian)}</b> Indians work in healthcare & care roles (Medical + Caregiver) out of <b>${fmtNum(hcTotal)}</b> total foreign healthcare workers. India's share is <b>${fmtPct(hcIndian / hcTotal * 100)}</b>.`
    });
  }

  // 8. Specified Skilled Worker (notable growth)
  if (JP_DATA['Specified Skilled Worker (Total)']) {
    const ssw = JP_DATA['Specified Skilled Worker (Total)'];
    if (ssw.indian[li] > 0 && ssw.indian[fi] >= 0) {
      const growth = ssw.indian[li] - ssw.indian[fi];
      insights.push({
        cls: 'gold',
        title: 'Specified Skilled Worker Program',
        body: `The Specified Skilled Worker category saw dramatic Indian growth from <b>${fmtNum(ssw.indian[fi])}</b> to <b>${fmtNum(ssw.indian[li])}</b> (Jun ${JUNE_YEARS[fi]}–${JUNE_YEARS[li]}), an increase of <b>${fmtNum(growth)}</b>. Total foreign SSW grew from <b>${fmtNum(ssw.total[fi])}</b> to <b>${fmtNum(ssw.total[li])}</b>.`
      });
    }
  }

  // Render insights
  const grid = document.getElementById('insight-grid');
  grid.innerHTML = insights.map(ins =>
    `<div class="insight-card ${ins.cls}">
       <div class="insight-title">${ins.title}</div>
       <div class="insight-body">${ins.body}</div>
     </div>`
  ).join('');
}

/* ---- Tab Navigation ---- */
const JP_TABS_CHARTS = {
  overview: renderOverviewCharts,
  workforce: renderWorkforceCharts,
  healthcare: renderHealthcareCharts,
  insights: renderInsights
};

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      localStorage.setItem('gati_jp_activeTab', btn.dataset.tab);
      requestAnimationFrame(() => {
        const renderer = JP_TABS_CHARTS[btn.dataset.tab];
        if (renderer) renderer();
      });
    };
  });
}

/* ---- Master Init ---- */
function initJapanDashboard() {
  renderExecKPIs();
  initTabs();

  // Restore saved tab or default to overview
  const savedTab = localStorage.getItem('gati_jp_activeTab') || 'overview';
  const tabBtn = document.querySelector(`.tab-btn[data-tab="${savedTab}"]`);
  if (tabBtn) {
    tabBtn.click();
  } else {
    renderOverviewCharts();
  }
}
