/* ==========================================================================
   GATI Germany Country Dashboard — logic
   Processes JSON API data (7 worksheets), renders KPIs, charts (18+),
   and auto-generated insights. Uses Chart.js 4.x.
   ========================================================================== */

/* ---- Global data store ---- */
var DE = {
  masterAnnual: [],    // Master_Annual rows
  masterMonthly: [],   // Master_Monthly rows
  eurostat: [],        // employment_Eurostat rows
  labour: [],          // germany_foreignLabour status rows
  healthcare: [],      // Healthcare rows
  nursingRank: [],     // top_10_nursing rows
  dictionary: []       // Data_Dictionary rows
};

/* ---- Color palette ---- */
const PALETTE = {
  teal: '#006B76', tealDark: '#00333A', tealLight: '#84D2E2',
  gold: '#E5A812', goldLight: '#FFCC4E', goldDark: '#8C6A1F',
  gray: '#839097', green: '#2E7D32', red: '#C62828',
  blue: '#2979FF', orange: '#E07B54', purple: '#7B6BA1',
  series: ['#006B76','#E5A812','#84D2E2','#00333A','#FFCC4E','#8C6A1F',
           '#839097','#2E8B94','#C98A1D','#4A5A61','#5B9A8B','#D4763E']
};

/* ---- Utilities ---- */
function fmtNum(n) {
  if (n === null || n === undefined) return '—';
  return Math.round(n).toLocaleString('en-US');
}
function fmtPct(n) {
  if (n === null || n === undefined) return '—';
  return n.toFixed(2) + '%';
}
function fmtPctSigned(n) {
  if (n === null || n === undefined) return '—';
  return (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
}
function calcCAGR(startVal, endVal, years) {
  if (!startVal || startVal <= 0 || !endVal || endVal <= 0 || years <= 0) return null;
  return (Math.pow(endVal / startVal, 1 / years) - 1) * 100;
}
function parseVal(v) {
  if (v === null || v === undefined || v === '' || v === 'N/A') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

/* ---- Extract year-keyed data from a row ---- */
function extractYearData(row) {
  const data = {};
  for (const key of Object.keys(row)) {
    const y = parseInt(key, 10);
    if (!isNaN(y) && y >= 1990 && y <= 2030) {
      const val = parseVal(row[key]);
      if (val !== null) data[y] = val;
    }
  }
  return data;
}

/* ---- Extract monthly data from a row ---- */
function extractMonthlyData(row) {
  const data = [];
  for (const key of Object.keys(row)) {
    // Skip metadata fields
    if (['Category','Metric Name','Unit','Source','Country','Citizenship_Filter','Data Type'].includes(key)) continue;
    const val = parseVal(row[key]);
    if (val === null) continue;
    // Parse the JS date string
    const d = new Date(key);
    if (!isNaN(d.getTime())) {
      const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      data.push({ date: d, label, value: val });
    }
  }
  data.sort((a, b) => a.date - b.date);
  return data;
}

/* ---- Find a row by matching field values ---- */
function findRow(arr, matchObj) {
  return arr.find(r => {
    for (const [k, v] of Object.entries(matchObj)) {
      if (!r[k] || !r[k].toLowerCase().includes(v.toLowerCase())) return false;
    }
    return true;
  });
}

function findRows(arr, matchObj) {
  return arr.filter(r => {
    for (const [k, v] of Object.entries(matchObj)) {
      if (!r[k] || !r[k].toLowerCase().includes(v.toLowerCase())) return false;
    }
    return true;
  });
}

/* ================================================================
   DATA PROCESSING
   ================================================================ */
function processGermanyData(json) {
  DE.dictionary = (json.Data_Dictionary || []).filter(r => r['Metric Name'] && r['Metric Name'].trim());
  DE.masterAnnual = json.Master_Annual || [];
  DE.masterMonthly = json.Master_Monthly || [];
  DE.eurostat = json.employment_Eurostat || [];
  DE.labour = json['germany_foreignLabour status'] || json.germany_foreignLabour_status || [];
  DE.healthcare = json.Healthcare || [];
  DE.nursingRank = json.top_10_nursing || [];
}

/* ================================================================
   CHART.JS HELPERS
   ================================================================ */
const chartInstances = {};
function baseFont() { return { family: "'Poppins', sans-serif", size: 12 }; }

function renderOrUpdate(canvasId, config) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  if (chartInstances[canvasId]) chartInstances[canvasId].destroy();
  chartInstances[canvasId] = new Chart(ctx, config);
}

function lineOpts(yCallback) {
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

function barOpts(yCallback) {
  return {
    responsive: true, maintainAspectRatio: false,
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

function hBarOpts(xCallback) {
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

function setNote(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/* ================================================================
   EXECUTIVE KPIs
   ================================================================ */
function renderExecKPIs() {
  // --- Population KPI ---
  const indianStockRow = findRow(DE.masterAnnual, { 'Metric Name': 'Total Indian Citizens Registered' });
  const foreignStockRow = findRow(DE.masterAnnual, { 'Metric Name': 'Total Foreign Citizens Registered' });
  const shareRow = findRow(DE.masterAnnual, { 'Metric Name': 'Indian Citizens as %' });

  if (indianStockRow) {
    const iData = extractYearData(indianStockRow);
    const years = Object.keys(iData).map(Number).sort();
    const latest = years[years.length - 1];
    const first = years[0];
    document.getElementById('exec-pop-period').textContent = '31 Dec ' + latest;
    document.getElementById('exec-pop-indian').textContent = fmtNum(iData[latest]);
    const cagr = calcCAGR(iData[first], iData[latest], latest - first);
    const cagrEl = document.getElementById('exec-pop-cagr');
    if (cagr !== null) {
      cagrEl.textContent = 'CAGR ' + fmtPctSigned(cagr);
      if (cagr < 0) cagrEl.classList.add('negative');
    }
    document.getElementById('exec-pop-cagr-period').textContent = '(' + first + '–' + latest + ')';
  }
  if (foreignStockRow) {
    const fData = extractYearData(foreignStockRow);
    const years = Object.keys(fData).map(Number).sort();
    document.getElementById('exec-pop-foreign').textContent = fmtNum(fData[years[years.length - 1]]);
  }
  if (shareRow) {
    const sData = extractYearData(shareRow);
    const years = Object.keys(sData).map(Number).sort();
    document.getElementById('exec-pop-share').textContent = fmtPct(sData[years[years.length - 1]] * 100);
  }

  // --- Employment KPI ---
  const indianEmpRow = findRow(DE.labour, { 'Sub Category': 'Indian', 'Metric Name': 'Total Employees' });
  const foreignEmpRow = findRow(DE.labour, { 'Sub Category': 'All Foreign', 'Metric Name': 'Total Employees' });

  if (indianEmpRow) {
    const iData = extractYearData(indianEmpRow);
    const years = Object.keys(iData).map(Number).sort();
    const latest = years[years.length - 1];
    const first = years[0];
    document.getElementById('exec-emp-period').textContent = '30 Jun ' + latest;
    document.getElementById('exec-emp-indian').textContent = fmtNum(iData[latest]);
    const cagr = calcCAGR(iData[first], iData[latest], latest - first);
    const cagrEl = document.getElementById('exec-emp-cagr');
    if (cagr !== null) {
      cagrEl.textContent = 'CAGR ' + fmtPctSigned(cagr);
      if (cagr < 0) cagrEl.classList.add('negative');
    }
    document.getElementById('exec-emp-cagr-period').textContent = '(' + first + '–' + latest + ')';

    if (foreignEmpRow) {
      const fData = extractYearData(foreignEmpRow);
      const fYears = Object.keys(fData).map(Number).sort();
      const fLatest = fYears[fYears.length - 1];
      document.getElementById('exec-emp-foreign').textContent = fmtNum(fData[fLatest]);
      const share = (iData[latest] / fData[fLatest]) * 100;
      document.getElementById('exec-emp-share').textContent = fmtPct(share);
    }
  }

  // --- Healthcare KPI ---
  const physStockRow = findRow(DE.healthcare, { 'Health Profession': 'Physicians', 'Metric': 'Stock' });
  const physTotalRow = findRow(DE.healthcare, { 'Health Profession': 'Physicians', 'Metric': 'Total Active' });
  const nurseInflowRow = findRow(DE.healthcare, { 'Health Profession': 'Nurses', 'Metric': 'Annual Inflow', 'Country': 'India' });

  if (physStockRow) {
    const pData = extractYearData(physStockRow);
    const years = Object.keys(pData).map(Number).sort();
    const latest = years[years.length - 1];
    const first = years[0];
    document.getElementById('exec-health-period').textContent = latest;
    document.getElementById('exec-health-indian').textContent = fmtNum(pData[latest]);
    const cagr = calcCAGR(pData[first], pData[latest], latest - first);
    const cagrEl = document.getElementById('exec-health-cagr');
    if (cagr !== null) {
      cagrEl.textContent = 'CAGR ' + fmtPctSigned(cagr);
      if (cagr < 0) cagrEl.classList.add('negative');
    }
    document.getElementById('exec-health-cagr-period').textContent = '(' + first + '–' + latest + ')';
  }
  if (physTotalRow) {
    const tData = extractYearData(physTotalRow);
    const years = Object.keys(tData).map(Number).sort();
    document.getElementById('exec-health-total').textContent = fmtNum(tData[years[years.length - 1]]);
  }
  if (nurseInflowRow) {
    const nData = extractYearData(nurseInflowRow);
    const years = Object.keys(nData).map(Number).sort();
    document.getElementById('exec-health-nurse').textContent = fmtNum(nData[years[years.length - 1]]);
  }
}

/* ================================================================
   TAB 1: POPULATION CHARTS
   ================================================================ */
function renderPopulationCharts() {
  // 1. Indian Stock Trend
  const indianStockRow = findRow(DE.masterAnnual, { 'Metric Name': 'Total Indian Citizens Registered' });
  if (indianStockRow) {
    const data = extractYearData(indianStockRow);
    const years = Object.keys(data).map(Number).sort();
    setNote('note-de-indian-stock', 'Indian citizens registered in Germany (all purposes) as of 31 Dec each year. Source: Destatis (AZR)');
    renderOrUpdate('chart-de-indian-stock', {
      type: 'line',
      data: {
        labels: years.map(String),
        datasets: [{
          label: 'Indian Citizens',
          data: years.map(y => data[y]),
          borderColor: PALETTE.teal, backgroundColor: PALETTE.teal + '20',
          fill: true, tension: 0.3, pointRadius: 4, pointHoverRadius: 6, borderWidth: 2.5
        }]
      },
      options: lineOpts()
    });
  }

  // 2. Total Foreign Stock Trend
  const foreignStockRow = findRow(DE.masterAnnual, { 'Metric Name': 'Total Foreign Citizens Registered' });
  if (foreignStockRow) {
    const data = extractYearData(foreignStockRow);
    const years = Object.keys(data).map(Number).sort();
    setNote('note-de-foreign-stock', 'All non-German citizens legally registered as of 31 Dec each year. Source: Destatis (AZR)');
    renderOrUpdate('chart-de-foreign-stock', {
      type: 'line',
      data: {
        labels: years.map(String),
        datasets: [{
          label: 'Total Foreign Citizens',
          data: years.map(y => data[y]),
          borderColor: PALETTE.goldDark, backgroundColor: PALETTE.gold + '20',
          fill: true, tension: 0.3, pointRadius: 4, pointHoverRadius: 6, borderWidth: 2.5
        }]
      },
      options: lineOpts()
    });
  }

  // 3. India's Share Trend
  const shareRow = findRow(DE.masterAnnual, { 'Metric Name': 'Indian Citizens as %' });
  if (shareRow) {
    const data = extractYearData(shareRow);
    const years = Object.keys(data).map(Number).sort();
    setNote('note-de-share-stock', 'Indian citizens as percentage of total foreign population. Source: Calculated from Destatis (AZR)');
    renderOrUpdate('chart-de-share-stock', {
      type: 'line',
      data: {
        labels: years.map(String),
        datasets: [{
          label: "India's Share %",
          data: years.map(y => +(data[y] * 100).toFixed(3)),
          borderColor: PALETTE.green, backgroundColor: PALETTE.green + '18',
          fill: true, tension: 0.3, pointRadius: 4, pointHoverRadius: 6, borderWidth: 2.5
        }]
      },
      options: lineOpts(v => v.toFixed(1) + '%')
    });
  }

  // 4. Eurostat Employment Permits Stock — Indian Citizens
  const euroIndianStock = findRow(DE.eurostat, { 'Description': 'Indian Citizens with Valid Employment' });
  const euroAllStock = findRow(DE.eurostat, { 'Description': 'All Non-EU Citizens with Valid Employment' });
  if (euroIndianStock) {
    const iData = extractYearData(euroIndianStock);
    const years = Object.keys(iData).map(Number).sort();
    setNote('note-de-euro-permits-indian', 'Valid employment residence permits held by Indian citizens as of 31 Dec each year. Source: Eurostat (MIGR_RESVALID)');
    renderOrUpdate('chart-de-euro-permits-indian', {
      type: 'bar',
      data: {
        labels: years.map(String),
        datasets: [
          { label: 'Indian Citizens', data: years.map(y => iData[y] || 0), backgroundColor: PALETTE.teal, borderRadius: 4 }
        ]
      },
      options: barOpts()
    });
  }

  // 4b. Eurostat Employment Permits Stock — All Non-EU Citizens
  if (euroAllStock) {
    const aData = extractYearData(euroAllStock);
    const years = Object.keys(aData).map(Number).sort();
    setNote('note-de-euro-permits-noneu', 'Valid employment residence permits held by all non-EU citizens as of 31 Dec each year. Source: Eurostat (MIGR_RESVALID)');
    renderOrUpdate('chart-de-euro-permits-noneu', {
      type: 'bar',
      data: {
        labels: years.map(String),
        datasets: [
          { label: 'All Non-EU Citizens', data: years.map(y => aData[y] || 0), backgroundColor: PALETTE.gold, borderRadius: 4 }
        ]
      },
      options: barOpts()
    });
  }
}

/* ================================================================
   TAB 2: MIGRATION FLOW CHARTS
   ================================================================ */
function renderMigrationCharts() {
  // 1. Indian Annual Flows
  const indArr = findRow(DE.masterAnnual, { 'Metric Name': 'Indian Citizens Arrivals' });
  const indDep = findRow(DE.masterAnnual, { 'Metric Name': 'Indian Citizens Departures' });
  const indNet = findRow(DE.masterAnnual, { 'Metric Name': 'Net Migration', 'Sub Category': 'Indian' });

  if (indArr && indDep && indNet) {
    const aData = extractYearData(indArr);
    const dData = extractYearData(indDep);
    const nData = extractYearData(indNet);
    const years = Object.keys(aData).map(Number).sort();
    setNote('note-de-indian-flows', 'Annual cross-border movements of Indian citizens. Source: Destatis (Migration Flows)');
    renderOrUpdate('chart-de-indian-flows', {
      type: 'bar',
      data: {
        labels: years.map(String),
        datasets: [
          { label: 'Arrivals', data: years.map(y => aData[y] || 0), backgroundColor: PALETTE.teal, borderRadius: 4 },
          { label: 'Departures', data: years.map(y => dData[y] || 0), backgroundColor: PALETTE.gold, borderRadius: 4 },
          { label: 'Net Migration', data: years.map(y => nData[y] || 0), type: 'line', borderColor: PALETTE.green, backgroundColor: 'transparent', borderWidth: 2.5, pointRadius: 4, tension: 0.3 }
        ]
      },
      options: barOpts()
    });
  }

  // 2. Total Foreign Annual Flows
  const forArr = findRow(DE.masterAnnual, { 'Metric Name': 'Total Foreign Citizens Arrivals' });
  const forDep = findRow(DE.masterAnnual, { 'Metric Name': 'Total Foreign Citizens Departures' });
  const forNet = findRow(DE.masterAnnual, { 'Metric Name': 'Net Migration', 'Sub Category': 'Total Foreign' });

  if (forArr && forDep && forNet) {
    const aData = extractYearData(forArr);
    const dData = extractYearData(forDep);
    const nData = extractYearData(forNet);
    const years = Object.keys(aData).map(Number).sort();
    setNote('note-de-foreign-flows', 'Annual cross-border movements of all non-German citizens. Source: Destatis (Migration Flows)');
    renderOrUpdate('chart-de-foreign-flows', {
      type: 'bar',
      data: {
        labels: years.map(String),
        datasets: [
          { label: 'Arrivals', data: years.map(y => aData[y] || 0), backgroundColor: PALETTE.tealDark, borderRadius: 4 },
          { label: 'Departures', data: years.map(y => dData[y] || 0), backgroundColor: PALETTE.goldDark, borderRadius: 4 },
          { label: 'Net Migration', data: years.map(y => nData[y] || 0), type: 'line', borderColor: PALETTE.green, backgroundColor: 'transparent', borderWidth: 2.5, pointRadius: 4, tension: 0.3 }
        ]
      },
      options: barOpts()
    });
  }

  // 3. Indian Monthly Migration
  const mIndArr = findRow(DE.masterMonthly, { 'Metric Name': 'Indian Citizens', 'Unit': 'Arrivals' });
  const mIndDep = findRow(DE.masterMonthly, { 'Metric Name': 'Indian Citizens', 'Unit': 'Departures' });
  const mIndNet = findRow(DE.masterMonthly, { 'Metric Name': 'Indian Citizens', 'Unit': 'Net' });

  if (mIndArr && mIndDep && mIndNet) {
    const aM = extractMonthlyData(mIndArr);
    const dM = extractMonthlyData(mIndDep);
    const nM = extractMonthlyData(mIndNet);
    const labels = aM.map(d => d.label);
    setNote('note-de-monthly-indian', 'Monthly arrivals, departures & net migration of Indian citizens. Source: Destatis (Migration Flows)');
    renderOrUpdate('chart-de-monthly-indian', {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Arrivals', data: aM.map(d => d.value), borderColor: PALETTE.teal, borderWidth: 2.5, tension: 0.3, pointRadius: 3 },
          { label: 'Departures', data: dM.map(d => d.value), borderColor: PALETTE.gold, borderWidth: 2.5, tension: 0.3, pointRadius: 3 },
          { label: 'Net', data: nM.map(d => d.value), borderColor: PALETTE.green, borderWidth: 2, borderDash: [5, 3], tension: 0.3, pointRadius: 3 }
        ]
      },
      options: lineOpts()
    });
  }

  // 4. Monthly Net Comparison — Indian vs Total Foreign
  const mForNet = findRow(DE.masterMonthly, { 'Metric Name': 'Total Foreign', 'Unit': 'Net' });
  if (mIndNet && mForNet) {
    const iM = extractMonthlyData(mIndNet);
    const fM = extractMonthlyData(mForNet);
    const labels = iM.map(d => d.label);
    setNote('note-de-monthly-compare', 'Indian vs total foreign net migration by month. Source: Destatis (Migration Flows)');
    renderOrUpdate('chart-de-monthly-compare', {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Indian Net', data: iM.map(d => d.value), borderColor: PALETTE.teal, borderWidth: 2.5, tension: 0.3, pointRadius: 4, yAxisID: 'y' },
          { label: 'Total Foreign Net', data: fM.map(d => d.value), borderColor: PALETTE.goldDark, borderWidth: 2.5, tension: 0.3, pointRadius: 4, yAxisID: 'y1' }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { font: baseFont(), usePointStyle: true, boxWidth: 8, padding: 12 } },
          tooltip: { titleFont: baseFont(), bodyFont: baseFont() }
        },
        scales: {
          x: { grid: { color: '#EEF2F3' }, ticks: { font: baseFont() } },
          y: { type: 'linear', position: 'left', grid: { color: '#EEF2F3' }, ticks: { font: baseFont(), callback: v => fmtNum(v) }, title: { display: true, text: 'Indian Net', font: baseFont(), color: PALETTE.teal } },
          y1: { type: 'linear', position: 'right', grid: { drawOnChartArea: false }, ticks: { font: baseFont(), callback: v => fmtNum(v) }, title: { display: true, text: 'Foreign Net', font: baseFont(), color: PALETTE.goldDark } }
        }
      }
    });
  }
}

/* ================================================================
   TAB 3: EMPLOYMENT CHARTS
   ================================================================ */
function renderEmploymentCharts() {
  // 1. Indian Employees Trend
  const indTotal = findRow(DE.labour, { 'Sub Category': 'Indian', 'Metric Name': 'Total Employees' });
  const indSocSec = findRow(DE.labour, { 'Sub Category': 'Indian', 'Metric Name': 'Employees Subject to Social Security' });
  if (indTotal && indSocSec) {
    const tData = extractYearData(indTotal);
    const sData = extractYearData(indSocSec);
    const years = Object.keys(tData).map(Number).sort();
    setNote('note-de-indian-emp', 'Indian citizens employed in Germany as of June 30 each year. Source: Federal Employment Agency (BA)');
    renderOrUpdate('chart-de-indian-emp', {
      type: 'line',
      data: {
        labels: years.map(String),
        datasets: [
          { label: 'Total Employees', data: years.map(y => tData[y]), borderColor: PALETTE.teal, borderWidth: 2.5, tension: 0.3, pointRadius: 4, fill: false },
          { label: 'Social Security Contributors', data: years.map(y => sData[y] || 0), borderColor: PALETTE.gold, borderWidth: 2.5, tension: 0.3, pointRadius: 4, fill: false }
        ]
      },
      options: lineOpts()
    });
  }

  // 2. All Foreign Employees Trend
  const forTotal = findRow(DE.labour, { 'Sub Category': 'All Foreign', 'Metric Name': 'Total Employees' });
  const forSocSec = findRow(DE.labour, { 'Sub Category': 'All Foreign', 'Metric Name': 'Employees Subject to Social Security' });
  if (forTotal && forSocSec) {
    const tData = extractYearData(forTotal);
    const sData = extractYearData(forSocSec);
    const years = Object.keys(tData).map(Number).sort();
    setNote('note-de-foreign-emp', 'All foreign national employees in Germany as of June 30 each year. Source: Federal Employment Agency (BA)');
    renderOrUpdate('chart-de-foreign-emp', {
      type: 'line',
      data: {
        labels: years.map(String),
        datasets: [
          { label: 'Total Employees', data: years.map(y => tData[y]), borderColor: PALETTE.tealDark, borderWidth: 2.5, tension: 0.3, pointRadius: 4, fill: false },
          { label: 'Social Security Contributors', data: years.map(y => sData[y] || 0), borderColor: PALETTE.goldDark, borderWidth: 2.5, tension: 0.3, pointRadius: 4, fill: false }
        ]
      },
      options: lineOpts()
    });
  }

  // 3. India's Share of Foreign Workforce
  if (indTotal && forTotal) {
    const iData = extractYearData(indTotal);
    const fData = extractYearData(forTotal);
    const years = Object.keys(iData).map(Number).sort();
    const shareData = years.map(y => (fData[y] && fData[y] > 0) ? (iData[y] / fData[y]) * 100 : 0);
    setNote('note-de-emp-share', "Indian employees as % of all foreign employees. Source: Calculated from BA data");
    renderOrUpdate('chart-de-emp-share', {
      type: 'line',
      data: {
        labels: years.map(String),
        datasets: [{
          label: "India's Share %",
          data: shareData,
          borderColor: PALETTE.teal, backgroundColor: PALETTE.teal + '18',
          fill: true, tension: 0.3, pointRadius: 4, pointHoverRadius: 6, borderWidth: 2.5
        }]
      },
      options: lineOpts(v => v.toFixed(1) + '%')
    });
  }

  // 4. Indian Labour Market Breakdown
  const breakdownMetrics = [
    { key: 'Total Employees', color: PALETTE.teal },
    { key: 'Employees Subject to Social Security', color: PALETTE.tealLight },
    { key: 'Exclusively Marginally Employed', color: PALETTE.gold },
    { key: 'Unemployed', color: PALETTE.red },
    { key: 'Job Seekers', color: PALETTE.orange },
    { key: 'Underemployed', color: PALETTE.gray }
  ];
  const breakdownSets = [];
  let bdYears = [];
  for (const bm of breakdownMetrics) {
    const row = findRow(DE.labour, { 'Sub Category': 'Indian', 'Metric Name': bm.key });
    if (row) {
      const data = extractYearData(row);
      const yrs = Object.keys(data).map(Number).sort();
      if (yrs.length > bdYears.length) bdYears = yrs;
      breakdownSets.push({
        label: bm.key,
        data: yrs.map(y => data[y]),
        borderColor: bm.color,
        backgroundColor: bm.color + '30',
        borderWidth: 2, tension: 0.3, pointRadius: 3, fill: false
      });
    }
  }
  if (breakdownSets.length) {
    setNote('note-de-indian-breakdown', 'Employment and labour market status of Indian citizens as of June 30. Source: Federal Employment Agency (BA)');
    renderOrUpdate('chart-de-indian-breakdown', {
      type: 'line',
      data: { labels: bdYears.map(String), datasets: breakdownSets },
      options: lineOpts()
    });
  }

  // 5. Eurostat First-Time Employment Permits (Flow)
  const euroIndFlow = findRow(DE.eurostat, { 'Description': 'Indian Citizens Receiving First-Time' });
  const euroAllFlow = findRow(DE.eurostat, { 'Description': 'All Non-EU Citizens Receiving First-Time' });
  if (euroIndFlow && euroAllFlow) {
    const iData = extractYearData(euroIndFlow);
    const aData = extractYearData(euroAllFlow);
    const years = Object.keys(iData).map(Number).sort();
    setNote('note-de-euro-permits-flow', 'New employment permits issued per year. Source: Eurostat (MIGR_RESFIRST)');
    renderOrUpdate('chart-de-euro-permits-flow', {
      type: 'bar',
      data: {
        labels: years.map(String),
        datasets: [
          { label: 'Indian Citizens', data: years.map(y => iData[y] || 0), backgroundColor: PALETTE.teal, borderRadius: 4 },
          { label: 'All Non-EU (÷10)', data: years.map(y => (aData[y] || 0) / 10), backgroundColor: PALETTE.gold + '80', borderRadius: 4 }
        ]
      },
      options: barOpts()
    });
  }
}

/* ================================================================
   TAB 4: HEALTHCARE CHARTS
   ================================================================ */
function renderHealthcareCharts() {
  // --- Healthcare KPI cards ---
  const physStockRow = findRow(DE.healthcare, { 'Health Profession': 'Physicians', 'Metric': 'Stock' });
  const physTotalRow = findRow(DE.healthcare, { 'Health Profession': 'Physicians', 'Metric': 'Total Active' });
  const physInflowRow = findRow(DE.healthcare, { 'Health Profession': 'Physicians', 'Metric': 'Annual Inflow', 'Country': 'India' });
  const nurseInflowRow = findRow(DE.healthcare, { 'Health Profession': 'Nurses', 'Metric': 'Annual Inflow', 'Country': 'India' });
  const nurseTotalRow = findRow(DE.healthcare, { 'Health Profession': 'Nurses', 'Metric': 'Total Active' });

  if (physStockRow) {
    const d = extractYearData(physStockRow);
    const yrs = Object.keys(d).map(Number).sort();
    const latest = yrs[yrs.length - 1];
    document.getElementById('hk-phys-year').textContent = latest;
    document.getElementById('hk-phys-stock').textContent = fmtNum(d[latest]);
  }
  if (physTotalRow) {
    const d = extractYearData(physTotalRow);
    const yrs = Object.keys(d).map(Number).sort();
    document.getElementById('hk-phys-total').textContent = fmtNum(d[yrs[yrs.length - 1]]);
  }
  if (physInflowRow) {
    const d = extractYearData(physInflowRow);
    const yrs = Object.keys(d).map(Number).sort();
    document.getElementById('hk-phys-inflow').textContent = fmtNum(d[yrs[yrs.length - 1]]);
  }
  if (nurseInflowRow) {
    const d = extractYearData(nurseInflowRow);
    const yrs = Object.keys(d).map(Number).sort();
    const latest = yrs[yrs.length - 1];
    document.getElementById('hk-nurse-year').textContent = latest;
    document.getElementById('hk-nurse-inflow').textContent = fmtNum(d[latest]);
  }
  if (nurseTotalRow) {
    const d = extractYearData(nurseTotalRow);
    const yrs = Object.keys(d).map(Number).sort();
    document.getElementById('hk-nurse-total').textContent = fmtNum(d[yrs[yrs.length - 1]]);
  }
  // India's nursing rank
  const indiaRankIdx = DE.nursingRank.findIndex(r => r.Nationality && r.Nationality.toLowerCase() === 'india');
  document.getElementById('hk-nurse-rank').textContent = indiaRankIdx >= 0 ? '#' + (indiaRankIdx + 1) + ' of foreign' : '—';

  // --- Charts ---

  // 1. Indian Physicians Stock Trend
  if (physStockRow) {
    const data = extractYearData(physStockRow);
    const years = Object.keys(data).map(Number).sort();
    setNote('note-de-phys-stock', 'Indian-trained physicians actively working in Germany. Source: OECD Data Explorer');
    renderOrUpdate('chart-de-phys-stock', {
      type: 'line',
      data: {
        labels: years.map(String),
        datasets: [{
          label: 'Indian Physicians (Stock)',
          data: years.map(y => data[y]),
          borderColor: PALETTE.teal, backgroundColor: PALETTE.teal + '20',
          fill: true, tension: 0.3, pointRadius: 4, borderWidth: 2.5
        }]
      },
      options: lineOpts()
    });
  }

  // 2. Indian Nurse Inflow Trend
  if (nurseInflowRow) {
    const data = extractYearData(nurseInflowRow);
    const years = Object.keys(data).map(Number).sort();
    setNote('note-de-nurse-inflow', 'Indian-trained nurses entering Germany per year. Source: OECD Data Explorer');
    renderOrUpdate('chart-de-nurse-inflow', {
      type: 'bar',
      data: {
        labels: years.map(String),
        datasets: [{
          label: 'Indian Nurse Inflow',
          data: years.map(y => data[y]),
          backgroundColor: PALETTE.teal, borderRadius: 4
        }]
      },
      options: barOpts()
    });
  }

  // 3. Indian Physician Inflow Trend
  if (physInflowRow) {
    const data = extractYearData(physInflowRow);
    const years = Object.keys(data).map(Number).sort();
    setNote('note-de-phys-inflow', 'Indian-trained physicians entering Germany per year. Source: OECD Data Explorer');
    renderOrUpdate('chart-de-phys-inflow', {
      type: 'bar',
      data: {
        labels: years.map(String),
        datasets: [{
          label: 'Indian Physician Inflow',
          data: years.map(y => data[y]),
          backgroundColor: PALETTE.gold, borderRadius: 4
        }]
      },
      options: barOpts()
    });
  }

  // 4. Top 10 Nationalities in Hospital Nursing
  if (DE.nursingRank.length) {
    const labels = DE.nursingRank.map(r => r.Nationality);
    const values = DE.nursingRank.map(r => parseVal(r['2023 (June 30)']) || 0);
    const colors = DE.nursingRank.map(r =>
      r.Nationality && r.Nationality.toLowerCase() === 'india' ? PALETTE.gold : PALETTE.teal
    );
    setNote('note-de-nursing-rank', 'Foreign nationalities in hospital nursing, June 30 2023. Source: Federal Employment Agency (BA)');
    renderOrUpdate('chart-de-nursing-rank', {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Nurses (2023)',
          data: values,
          backgroundColor: colors,
          borderRadius: 4
        }]
      },
      options: hBarOpts()
    });
  }

  // 5. Total Active Nurses
  if (nurseTotalRow) {
    const data = extractYearData(nurseTotalRow);
    const years = Object.keys(data).map(Number).sort();
    setNote('note-de-nurses-total', 'Total nursing workforce in Germany (all nationalities). Source: OECD Data Explorer');
    renderOrUpdate('chart-de-nurses-total', {
      type: 'line',
      data: {
        labels: years.map(String),
        datasets: [{
          label: 'Total Active Nurses',
          data: years.map(y => data[y]),
          borderColor: PALETTE.teal, backgroundColor: PALETTE.teal + '20',
          fill: true, tension: 0.3, pointRadius: 4, borderWidth: 2.5
        }]
      },
      options: lineOpts()
    });
  }

  // 6. Total Active Physicians
  if (physTotalRow) {
    const data = extractYearData(physTotalRow);
    const years = Object.keys(data).map(Number).sort();
    setNote('note-de-phys-total', 'Total physician workforce in Germany (all nationalities). Source: OECD Data Explorer');
    renderOrUpdate('chart-de-phys-total', {
      type: 'line',
      data: {
        labels: years.map(String),
        datasets: [{
          label: 'Total Active Physicians',
          data: years.map(y => data[y]),
          borderColor: PALETTE.gold, backgroundColor: PALETTE.gold + '20',
          fill: true, tension: 0.3, pointRadius: 4, borderWidth: 2.5
        }]
      },
      options: lineOpts()
    });
  }
}

/* ================================================================
   TAB 5: KEY INSIGHTS
   ================================================================ */
function renderInsights() {
  const grid = document.getElementById('insight-grid');
  if (!grid) return;
  const insights = [];

  // Population growth
  const indianStockRow = findRow(DE.masterAnnual, { 'Metric Name': 'Total Indian Citizens Registered' });
  if (indianStockRow) {
    const d = extractYearData(indianStockRow);
    const yrs = Object.keys(d).map(Number).sort();
    const first = yrs[0], last = yrs[yrs.length - 1];
    const cagr = calcCAGR(d[first], d[last], last - first);
    if (cagr !== null) {
      insights.push({
        title: 'Rapid Population Growth',
        body: `Indian citizens in Germany grew from <b>${fmtNum(d[first])}</b> (${first}) to <b>${fmtNum(d[last])}</b> (${last}), a CAGR of <b>${fmtPctSigned(cagr)}</b>. Germany is among the fastest-growing destinations for Indian talent in Europe.`,
        type: 'highlight'
      });
    }
  }

  // Share growth
  const shareRow = findRow(DE.masterAnnual, { 'Metric Name': 'Indian Citizens as %' });
  if (shareRow) {
    const d = extractYearData(shareRow);
    const yrs = Object.keys(d).map(Number).sort();
    const first = yrs[0], last = yrs[yrs.length - 1];
    insights.push({
      title: 'Growing Share of Foreign Population',
      body: `India's share of Germany's total foreign population nearly doubled from <b>${(d[first]*100).toFixed(2)}%</b> (${first}) to <b>${(d[last]*100).toFixed(2)}%</b> (${last}).`,
      type: 'teal'
    });
  }

  // Employment growth
  const indEmpRow = findRow(DE.labour, { 'Sub Category': 'Indian', 'Metric Name': 'Total Employees' });
  if (indEmpRow) {
    const d = extractYearData(indEmpRow);
    const yrs = Object.keys(d).map(Number).sort();
    const first = yrs[0], last = yrs[yrs.length - 1];
    const cagr = calcCAGR(d[first], d[last], last - first);
    if (cagr !== null) {
      insights.push({
        title: 'Employment Surge',
        body: `Indian workers in Germany went from <b>${fmtNum(d[first])}</b> (${first}) to <b>${fmtNum(d[last])}</b> (${last}) — a <b>${fmtPctSigned(cagr)}</b> CAGR. The majority are social security contributors (formal employment).`,
        type: 'gold'
      });
    }
  }

  // Net migration
  const indNetRow = findRow(DE.masterAnnual, { 'Metric Name': 'Net Migration', 'Sub Category': 'Indian' });
  if (indNetRow) {
    const d = extractYearData(indNetRow);
    const yrs = Object.keys(d).map(Number).sort();
    const last = yrs[yrs.length - 1];
    const peak = Math.max(...Object.values(d));
    const peakYear = yrs.find(y => d[y] === peak);
    insights.push({
      title: 'Consistent Positive Net Migration',
      body: `Net Indian migration to Germany has been strongly positive every year since 2020, peaking at <b>${fmtNum(peak)}</b> in ${peakYear}. In ${last}, net migration was <b>${fmtNum(d[last])}</b>.`,
      type: 'teal'
    });
  }

  // Nurse inflow surge
  const nurseInflowRow = findRow(DE.healthcare, { 'Health Profession': 'Nurses', 'Metric': 'Annual Inflow', 'Country': 'India' });
  if (nurseInflowRow) {
    const d = extractYearData(nurseInflowRow);
    const yrs = Object.keys(d).map(Number).sort();
    const first = yrs[0], last = yrs[yrs.length - 1];
    insights.push({
      title: 'Nurse Recruitment Surge',
      body: `Indian nurse inflow into Germany skyrocketed from <b>${fmtNum(d[first])}</b> (${first}) to <b>${fmtNum(d[last])}</b> (${last}) — a <b>${Math.round(d[last]/d[first])}x</b> increase. Germany is actively recruiting Indian nurses to address chronic shortages.`,
      type: 'highlight'
    });
  }

  // Hospital nursing rank
  const indiaRankIdx = DE.nursingRank.findIndex(r => r.Nationality && r.Nationality.toLowerCase() === 'india');
  if (indiaRankIdx >= 0) {
    const indiaCount = parseVal(DE.nursingRank[indiaRankIdx]['2023 (June 30)']);
    const topCount = parseVal(DE.nursingRank[0]['2023 (June 30)']);
    insights.push({
      title: 'India Ranks #' + (indiaRankIdx + 1) + ' in Hospital Nursing',
      body: `With <b>${fmtNum(indiaCount)}</b> nurses in hospital nursing (June 2023), India ranks <b>#${indiaRankIdx + 1}</b> among foreign nationalities. ${DE.nursingRank[0].Nationality} leads with <b>${fmtNum(topCount)}</b>.`,
      type: 'gold'
    });
  }

  // Physician stock growth
  const physRow = findRow(DE.healthcare, { 'Health Profession': 'Physicians', 'Metric': 'Stock' });
  if (physRow) {
    const d = extractYearData(physRow);
    const yrs = Object.keys(d).map(Number).sort();
    const first = yrs[0], last = yrs[yrs.length - 1];
    const cagr = calcCAGR(d[first], d[last], last - first);
    if (cagr !== null) {
      insights.push({
        title: 'Physician Presence Growth',
        body: `Indian-trained physicians active in Germany grew from <b>${fmtNum(d[first])}</b> (${first}) to <b>${fmtNum(d[last])}</b> (${last}), a CAGR of <b>${fmtPctSigned(cagr)}</b> over ${last - first} years.`,
        type: 'teal'
      });
    }
  }

  // Low welfare dependency
  const welfareRow = findRow(DE.labour, { 'Sub Category': 'Indian', 'Metric Name': 'Those Entitled to Standard Benefits' });
  if (welfareRow && indEmpRow) {
    const wData = extractYearData(welfareRow);
    const eData = extractYearData(indEmpRow);
    const yrs = Object.keys(wData).map(Number).sort();
    const last = yrs[yrs.length - 1];
    if (eData[last] && wData[last]) {
      const ratio = (wData[last] / eData[last]) * 100;
      insights.push({
        title: 'Low Welfare Dependency',
        body: `Only <b>${fmtPct(ratio)}</b> of Indian citizens in Germany receive standard welfare benefits relative to their total employment count (${last}). This is among the lowest ratios for any foreign nationality group, indicating strong workforce integration.`,
        type: 'highlight'
      });
    }
  }

  // Render
  grid.innerHTML = insights.map(ins => {
    const cls = ins.type === 'gold' ? ' gold' : ins.type === 'highlight' ? ' highlight' : '';
    return `<div class="insight-card${cls}">
      <div class="insight-title">${ins.title}</div>
      <div class="insight-body">${ins.body}</div>
    </div>`;
  }).join('');
}

/* ================================================================
   INIT & TAB NAVIGATION
   ================================================================ */
function initGermanyDashboard() {
  renderExecKPIs();
  renderPopulationCharts();
  renderMigrationCharts();
  renderEmploymentCharts();
  renderHealthcareCharts();
  renderInsights();

  // Tab navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = document.getElementById('tab-' + btn.dataset.tab);
      if (panel) panel.classList.add('active');
      // Re-render charts in visible tab (Chart.js needs visible canvas)
      requestAnimationFrame(() => {
        Object.values(chartInstances).forEach(c => { try { c.resize(); } catch(e) {} });
      });
    };
  });
}
