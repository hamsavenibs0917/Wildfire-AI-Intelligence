/* ==========================================================================
   Forest Safety & Telemetry Management - Main Client Logic (Root Level)
   ========================================================================== */

let activeForests = [];
let activeTourists = [];
let activeIncidents = [];
let map = null;
let markersLayer = null;
let polygonLayer = null;
let activeForest = null;
let currentReportStep = 1;
let currentTelemetryMode = 'live';
let generatedReportContent = '';

document.addEventListener('DOMContentLoaded', () => {
  initMap();
  loadForestsData();
  loadTouristsDatabase();
  loadIncidentsDatabase();
  calculateRiskScore();
  loadSavedChatHistory();
});

/* -------------------------------------------------------------------------- */
/*  Navigation Tabs                                                           */
/* -------------------------------------------------------------------------- */
function switchNavTab(tabId, btnEl) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));

  const targetPane = document.getElementById(tabId);
  if (targetPane) targetPane.classList.add('active');

  if (!btnEl) {
    const btns = document.querySelectorAll('.nav-btn');
    if (tabId === 'tab-map') btnEl = btns[0];
    else if (tabId === 'tab-tourist') btnEl = btns[1];
    else if (tabId === 'tab-forests') btnEl = btns[2];
    else if (tabId === 'tab-risk') btnEl = btns[3];
    else if (tabId === 'tab-assistant') btnEl = btns[4];
  }

  if (btnEl) btnEl.classList.add('active');

  if (tabId === 'tab-map' && map) {
    setTimeout(() => map.invalidateSize(), 200);
  }
}

/* -------------------------------------------------------------------------- */
/*  Leaflet Map Initialization                                                */
/* -------------------------------------------------------------------------- */
function initMap() {
  const mapEl = document.getElementById('leaflet-map');
  if (!mapEl) return;

  map = L.map('leaflet-map').setView([20.5937, 78.9629], 5);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 18
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
}

/* -------------------------------------------------------------------------- */
/*  Fetch Forest Reserves Data & Telemetry                                    */
/* -------------------------------------------------------------------------- */
async function loadForestsData() {
  try {
    const res = await fetch(`/api/forests?mode=${currentTelemetryMode}`);
    const data = await res.json();
    
    if (data.status === 'success' && data.forests) {
      activeForests = data.forests;
      
      populateSpecificForestDatalist(activeForests);
      populateSelectDropdowns(activeForests);
      renderMapMarkers(activeForests);
      renderReserveDrawerList(activeForests);
      renderForestCardsGrid(activeForests);

      if (activeForests.length > 0) {
        selectForestSheet(activeForests[0], false);
      }
    }
  } catch (err) {
    console.error('Error fetching forest reserves:', err);
  }
}

/* Toggle Telemetry Mode */
function toggleTelemetryMode(mode) {
  currentTelemetryMode = mode;
  const lblTemp = document.getElementById('lbl-mode-temp');
  const lblHum = document.getElementById('lbl-mode-humidity');

  if (lblTemp) lblTemp.textContent = mode === 'live' ? 'Live Temp' : 'Historical Temp';
  if (lblHum) lblHum.textContent = mode === 'live' ? 'Live Humidity' : 'Historical Humidity';

  loadForestsData();
}

function refreshTelemetryData() {
  loadForestsData();
  alert(`✅ Refreshed telemetry data in ${currentTelemetryMode.toUpperCase()} mode!`);
}

/* Specific Forest Search Datalist Autocomplete */
function populateSpecificForestDatalist(forests) {
  const datalist = document.getElementById('specific-forest-datalist');
  if (!datalist) return;

  datalist.innerHTML = forests.map(f => `
    <option value="${f.region}">${f.state} (${f.dominant_risk} Risk)</option>
  `).join('');
}

function populateSelectDropdowns(forests) {
  const states = Array.from(new Set(forests.map(f => f.state))).sort();
  
  // State filter dropdown
  const mapStateSel = document.getElementById('map-state-filter');
  if (mapStateSel) {
    mapStateSel.innerHTML = `<option value="ALL">All Reserve States</option>` + states.map(s => `
      <option value="${s}">${s}</option>
    `).join('');
  }

  // Directory state pills
  const pillsContainer = document.getElementById('state-pills-container');
  if (pillsContainer) {
    pillsContainer.innerHTML = `<button class="state-pill active" onclick="filterForestsByState('ALL', this)">All States</button>` + states.map(s => `
      <button class="state-pill" onclick="filterForestsByState('${s}', this)">${s}</button>
    `).join('');
  }

  // Risk calculator forest select
  const calcSel = document.getElementById('calc-forest-select');
  const formSel = document.getElementById('form-forest-select');
  const repSel = document.getElementById('report-forest-select');

  const optionsHTML = forests.map(f => `
    <option value="${f.region}">${f.region} (${f.state})</option>
  `).join('');

  if (calcSel) calcSel.innerHTML = optionsHTML;
  if (formSel) formSel.innerHTML = optionsHTML;
  if (repSel) repSel.innerHTML = optionsHTML;
}

/* Render Map Markers */
function renderMapMarkers(forests) {
  if (!map || !markersLayer) return;
  markersLayer.clearLayers();

  const riskColors = {
    'Low': '#059669',
    'Medium': '#d97706',
    'High': '#ea580c',
    'Extreme': '#dc2626'
  };

  forests.forEach(f => {
    if (!f.latitude || !f.longitude) return;

    // Strict India geographical boundary filter (prevents markers outside India landmass)
    if (f.latitude < 8.2 || f.latitude > 34.5 || f.longitude < 68.5 || f.longitude > 94.5) return;

    const color = riskColors[f.dominant_risk] || '#2563eb';
    const marker = L.circleMarker([f.latitude, f.longitude], {
      radius: f.dominant_risk === 'Extreme' ? 10 : 8,
      fillColor: color,
      color: '#ffffff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.85
    });

    marker.bindPopup(`
      <div style="font-family: var(--font-sans); padding: 4px;">
        <strong style="font-size: 14px; color: ${color};">${f.region}</strong><br>
        <span style="font-size: 12px; color: #475569;">📍 ${f.state}</span><br>
        <span style="font-size: 12px; color: #475569;">🌡️ Temp: <strong>${f.avg_temp}°C</strong> | 💧 Humidity: <strong>${f.avg_humidity}%</strong></span><br>
        <span style="font-size: 12px; font-weight:700; color: ${color};">Status: ${f.dominant_risk.toUpperCase()} RISK</span><br>
        <button onclick="selectForestByName('${f.region}', true)" style="margin-top: 6px; padding: 4px 8px; font-size: 11px; background: ${color}; color: white; border: none; border-radius: 4px; cursor: pointer;">View Profile Sheet</button>
      </div>
    `);

    marker.on('click', () => {
      selectForestSheet(f, true);
    });

    markersLayer.addLayer(marker);
  });
}

/* Render Side Drawer Reserve List */
function renderReserveDrawerList(forests) {
  const container = document.getElementById('map-reserve-list');
  if (!container) return;

  container.innerHTML = forests.map(f => `
    <div class="reserve-item-row" onclick="selectForestByName('${f.region}', true)">
      <div class="reserve-item-info">
        <strong>${f.region}</strong>
        <span>📍 ${f.state} (${f.avg_temp}°C)</span>
      </div>
      <span class="sheet-badge ${f.dominant_risk.toLowerCase()}">${f.dominant_risk}</span>
    </div>
  `).join('');

  document.getElementById('drawer-forest-count').textContent = 'Monitored Reserve Telemetry';
}

/* Filter Map Forests */
function filterMapForests() {
  const query = document.getElementById('map-search-input').value.toLowerCase().trim();
  const stateFilter = document.getElementById('map-state-filter').value;
  const riskFilter = document.getElementById('map-risk-filter').value;

  const filtered = activeForests.filter(f => {
    const matchesSearch = f.region.toLowerCase().includes(query) || f.state.toLowerCase().includes(query);
    const matchesState = stateFilter === 'ALL' || f.state === stateFilter;
    const matchesRisk = riskFilter === 'ALL' || f.dominant_risk === riskFilter;
    return matchesSearch && matchesState && matchesRisk;
  });

  renderMapMarkers(filtered);
  renderReserveDrawerList(filtered);
}

/* Specific Forest Search Input Handler */
function onSpecificForestSearchInput() {
  const inputVal = document.getElementById('map-search-input').value.trim();
  filterMapForests();

  if (!inputVal) return;

  const matched = activeForests.find(f => f.region.toLowerCase() === inputVal.toLowerCase() || f.region.toLowerCase().includes(inputVal.toLowerCase()));
  if (matched) {
    selectForestSheet(matched, true);
  }
}

/* Select Active Forest Profile Sheet & Pan Map to Preferred Location */
function selectForestSheet(forest, flyToMap = true) {
  if (!forest) return;
  activeForest = forest;

  document.getElementById('sheet-forest-name').textContent = forest.region;
  document.getElementById('sheet-forest-state').textContent = `📍 ${forest.state}, India`;
  document.getElementById('sheet-temp').textContent = `${forest.avg_temp} °C`;
  document.getElementById('sheet-humidity').textContent = `${forest.avg_humidity} %`;
  document.getElementById('sheet-wind').textContent = `${forest.avg_wind} km/h`;
  document.getElementById('sheet-drought').textContent = `${forest.avg_drought}`;

  const badge = document.getElementById('sheet-risk-badge');
  badge.className = `sheet-badge ${forest.dominant_risk.toLowerCase()}`;
  badge.textContent = `${forest.dominant_risk.toUpperCase()} RISK`;

  if (map && forest.latitude && forest.longitude) {
    if (polygonLayer) map.removeLayer(polygonLayer);

    const lat = forest.latitude;
    const lon = forest.longitude;
    const bounds = [
      [lat - 0.05, lon - 0.05],
      [lat + 0.05, lon - 0.05],
      [lat + 0.05, lon + 0.05],
      [lat - 0.05, lon + 0.05]
    ];

    const colors = {
      'Low': '#059669',
      'Medium': '#d97706',
      'High': '#ea580c',
      'Extreme': '#dc2626'
    };
    const color = colors[forest.dominant_risk] || '#dc2626';

    polygonLayer = L.polygon(bounds, {
      color: color,
      weight: 3.5,
      dashArray: '6, 6',
      fillColor: color,
      fillOpacity: 0.25
    }).addTo(map);

    if (flyToMap) {
      map.flyTo([lat, lon], 10, { animate: true, duration: 1.2 });
    }
  }
}

function selectForestByName(name, flyToMap = true) {
  const f = activeForests.find(item => item.region === name);
  if (f) selectForestSheet(f, flyToMap);
}

function filterForestsByState(stateName, btnEl) {
  document.querySelectorAll('.state-pill').forEach(el => el.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');

  const filtered = stateName === 'ALL' ? activeForests : activeForests.filter(f => f.state === stateName);
  renderForestCardsGrid(filtered);
}

/* -------------------------------------------------------------------------- */
/*  MERGED RISK CALCULATOR & PDF / DOC REPORT GENERATION                       */
/* -------------------------------------------------------------------------- */
function onCalcForestSelectChange() {
  const selVal = document.getElementById('calc-forest-select').value;
  const f = activeForests.find(item => item.region === selVal);

  if (f) {
    document.getElementById('input-temp').value = f.avg_temp;
    document.getElementById('input-humidity').value = f.avg_humidity;
    document.getElementById('input-wind').value = f.avg_wind;
    document.getElementById('input-ndvi').value = f.avg_ndvi;
    
    if (f.vegetation_type && document.getElementById('input-vegetation')) {
      const vegOpt = Array.from(document.getElementById('input-vegetation').options).find(o => o.value.toLowerCase().includes(f.vegetation_type.toLowerCase()) || f.vegetation_type.toLowerCase().includes(o.value.toLowerCase()));
      if (vegOpt) document.getElementById('input-vegetation').value = vegOpt.value;
    }
    calculateRiskScore();
  }
}

async function generateMergedReportFromCalculator() {
  const forestName = document.getElementById('calc-forest-select').value;
  const temp = parseFloat(document.getElementById('input-temp').value);
  const humidity = parseFloat(document.getElementById('input-humidity').value);
  const wind = parseFloat(document.getElementById('input-wind').value);
  const ndvi = parseFloat(document.getElementById('input-ndvi').value);
  const soil = parseFloat(document.getElementById('input-soil').value);
  const human = parseFloat(document.getElementById('input-human').value);
  const vegetation = document.getElementById('input-vegetation').value;
  
  const scoreText = document.getElementById('calc-score-val').textContent;
  const scoreNum = parseInt(scoreText) || 74;
  const riskBadgeText = document.getElementById('calc-risk-badge').textContent.replace(' RISK', '');

  const payload = {
    forest: forestName,
    temp: temp,
    humidity: humidity,
    wind: wind,
    ndvi: ndvi,
    soil: soil,
    human: human,
    vegetation: vegetation,
    score: scoreNum,
    risk_level: riskBadgeText
  };

  try {
    const res = await fetch('/api/generate-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.status === 'success' && data.report_text) {
      generatedReportContent = data.report_text;
      
      const preBox = document.getElementById('report-preview-text');
      const container = document.getElementById('report-preview-container');
      const btnPdf = document.getElementById('btn-download-pdf');
      const btnDoc = document.getElementById('btn-download-doc');

      if (preBox) preBox.textContent = generatedReportContent;
      if (container) {
        container.style.display = 'block';
        container.scrollIntoView({ behavior: 'smooth' });
      }
      if (btnPdf) btnPdf.style.display = 'inline-flex';
      if (btnDoc) btnDoc.style.display = 'inline-flex';
    } else {
      alert('Error generating report.');
    }
  } catch (err) {
    alert('Failed to connect to report generation server.');
  }
}

/* Download as PDF */
function downloadReportAsPDF() {
  if (!generatedReportContent) return alert('No report generated yet.');

  const printWindow = window.open('', '_blank');
  const forestName = document.getElementById('calc-forest-select').value;
  
  printWindow.document.write(`
    <html>
      <head>
        <title>Advisory_Report_${forestName.replace(/[^a-z0-9]/gi, '_')}</title>
        <style>
          body { font-family: sans-serif; padding: 2rem; color: #0f172a; line-height: 1.6; }
          h2 { color: #059669; border-bottom: 2px solid #059669; padding-bottom: 8px; }
          pre { background: #f8fafc; padding: 1.5rem; border: 1px solid #cbd5e1; border-radius: 8px; font-family: monospace; white-space: pre-wrap; }
        </style>
      </head>
      <body>
        <h2>OFFICIAL FOREST SAFETY & MITIGATION ADVISORY REPORT</h2>
        <pre>${generatedReportContent}</pre>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

/* Download as Word DOC */
function downloadReportAsDOC() {
  if (!generatedReportContent) return alert('No report generated yet.');

  const forestName = document.getElementById('calc-forest-select').value.replace(/[^a-z0-9]/gi, '_');
  const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Forest Advisory Report</title></head><body>";
  const footer = "</body></html>";
  const htmlContent = header + "<h2 style='color:#059669;'>OFFICIAL FOREST SAFETY & MITIGATION ADVISORY REPORT</h2><pre style='font-family:Courier New; font-size:11pt;'>" + generatedReportContent + "</pre>" + footer;

  const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${forestName}_advisory_report.doc`;
  a.click();
}

function copyReportToClipboard() {
  if (!generatedReportContent) return;
  navigator.clipboard.writeText(generatedReportContent).then(() => {
    alert('📋 Report content copied to clipboard!');
  });
}

function openMergedReportTabForActiveForest() {
  switchNavTab('tab-risk');
  if (activeForest) {
    const sel = document.getElementById('calc-forest-select');
    if (sel) sel.value = activeForest.region;
    onCalcForestSelectChange();
  }
}

/* -------------------------------------------------------------------------- */
/*  Tourist Database AJAX & Pass QR Code Functions                            */
/* -------------------------------------------------------------------------- */
async function loadTouristsDatabase() {
  try {
    const res = await fetch('/api/tourists');
    const data = await res.json();

    if (data.status === 'success') {
      activeTourists = data.tourists || [];

      document.getElementById('db-total-members').textContent = data.total_members.toLocaleString();
      document.getElementById('db-active-passes').textContent = data.active_passes.toLocaleString();
      
      const uniqueForests = new Set(activeTourists.filter(t => t.status === 'ACTIVE').map(t => t.forest));
      document.getElementById('db-active-forests').textContent = uniqueForests.size;
      document.getElementById('db-checked-out').textContent = (data.total_passes - data.active_passes).toLocaleString();
      document.getElementById('nav-member-badge').textContent = data.total_members;

      renderTouristTable();
    }
  } catch (err) {
    console.error('Error fetching tourist database:', err);
  }
}

function renderTouristTable() {
  const tbody = document.getElementById('tourist-table-body');
  if (!tbody) return;

  const query = document.getElementById('tourist-search-input').value.toLowerCase().trim();
  const statusFilter = document.getElementById('tourist-status-filter').value;

  const filtered = activeTourists.filter(t => {
    const searchMatch = (t.pass_id || '').toLowerCase().includes(query) ||
                        (t.name || '').toLowerCase().includes(query) ||
                        (t.phone || '').toLowerCase().includes(query) ||
                        (t.forest || '').toLowerCase().includes(query);
    const statusMatch = statusFilter === 'ALL' || t.status === statusFilter;
    return searchMatch && statusMatch;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 2rem;">No tourist records found in database.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(t => `
    <tr>
      <td><strong>${t.pass_id}</strong></td>
      <td>${t.name}</td>
      <td>${t.phone}</td>
      <td>🌲 ${t.forest}</td>
      <td><strong style="color: var(--primary); font-size: 0.95rem;">${t.members_count || 1} Member(s)</strong></td>
      <td>${t.duration || '4 Hours'}</td>
      <td><span class="badge badge-${(t.status || 'active').toLowerCase()}">${t.status}</span></td>
      <td>
        <button class="btn btn-outline" style="padding: 3px 8px; font-size: 0.75rem;" onclick="openPassQRModal('${t.pass_id}', '${t.name}', '${t.forest}', '${t.members_count || 1}', '${t.status}')">
          🔍 View QR Pass
        </button>
      </td>
      <td>
        <div style="display: flex; gap: 0.35rem;">
          ${t.status === 'ACTIVE' ? `<button class="btn btn-outline" style="padding: 2px 6px; font-size: 0.75rem;" onclick="checkoutTouristPass(${t.id})">Check Out</button>` : ''}
          <button class="btn btn-danger" style="padding: 2px 6px; font-size: 0.75rem;" onclick="deleteTouristPass(${t.id})">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

/* Open Scannable QR Code Modal */
function openPassQRModal(pass_id, name, forest, members_count, status) {
  document.getElementById('qr-pass-id').textContent = pass_id;
  document.getElementById('qr-pass-name').innerHTML = `Visitor: <strong>${name}</strong>`;
  document.getElementById('qr-pass-forest').innerHTML = `Forest: <strong>${forest}</strong>`;
  document.getElementById('qr-pass-members').innerHTML = `Group Size: <strong>${members_count} Member(s)</strong>`;
  
  const badge = document.getElementById('qr-pass-status');
  badge.className = `badge badge-${(status || 'active').toLowerCase()}`;
  badge.textContent = `${status} PERMIT`;

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(pass_id + ' | ' + name + ' | ' + forest + ' | Members: ' + members_count)}&size=220x220`;
  document.getElementById('qr-code-img').src = qrUrl;

  document.getElementById('qr-modal').classList.add('active');
}

function closeQRModal() {
  document.getElementById('qr-modal').classList.remove('active');
}

async function handleTouristFormSubmit(e) {
  e.preventDefault();

  const forestVal = document.getElementById('form-forest-select').value.trim();
  const nameVal = document.getElementById('form-name').value.trim();
  const membersCount = parseInt(document.getElementById('form-members').value) || 1;

  const payload = {
    name: nameVal,
    phone: document.getElementById('form-phone').value.trim(),
    email: document.getElementById('form-email').value.trim(),
    forest: forestVal,
    duration: document.getElementById('form-duration').value,
    members_count: membersCount,
    emergency_contact: document.getElementById('form-emergency').value.trim()
  };

  try {
    const res = await fetch('/api/tourists/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.status === 'success') {
      closeTouristRegisterModal();
      document.getElementById('tourist-form').reset();
      loadTouristsDatabase();

      // Open QR Code Modal for newly generated pass
      openPassQRModal(data.pass_id, nameVal, forestVal, membersCount, 'ACTIVE');
    } else {
      alert(`⚠️ Registration Failed: ${data.message}`);
    }
  } catch (err) {
    alert('Error connecting to backend database.');
  }
}

async function checkoutTouristPass(id) {
  if (!confirm('Mark tourist pass as CHECKED OUT?')) return;
  try {
    await fetch(`/api/tourists/checkout/${id}`, { method: 'POST' });
    loadTouristsDatabase();
  } catch (err) {
    console.error(err);
  }
}

async function deleteTouristPass(id) {
  if (!confirm('Permanently delete this pass record from SQLite database?')) return;
  try {
    await fetch(`/api/tourists/${id}`, { method: 'DELETE' });
    loadTouristsDatabase();
  } catch (err) {
    console.error(err);
  }
}

function exportTouristCSV() {
  if (activeTourists.length === 0) return alert('No records to export.');

  let csv = 'ID,Pass_ID,Name,Phone,Email,Forest,Duration,Members_Count,Emergency_Contact,Status,Registered_At\n';
  activeTourists.forEach(t => {
    csv += `${t.id},"${t.pass_id}","${t.name}","${t.phone}","${t.email}","${t.forest}","${t.duration}",${t.members_count},"${t.emergency_contact}","${t.status}","${t.created_at}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'registered_tourists_database_export.csv';
  a.click();
}

/* Modals */
function openTouristRegisterModal() {
  document.getElementById('tourist-modal').classList.add('active');
}

function openTouristRegisterModalFromSheet() {
  if (activeForest) {
    const sel = document.getElementById('form-forest-select');
    if (sel) sel.value = activeForest.region;
  }
  openTouristRegisterModal();
}

function closeTouristRegisterModal() {
  document.getElementById('tourist-modal').classList.remove('active');
}

/* -------------------------------------------------------------------------- */
/*  FETCH & RENDER EMERGENCY INCIDENTS REPORTED DATABASE                      */
/* -------------------------------------------------------------------------- */
async function loadIncidentsDatabase() {
  try {
    const res = await fetch('/api/incidents');
    const data = await res.json();

    if (data.status === 'success') {
      activeIncidents = data.incidents || [];
      document.getElementById('db-total-incidents').textContent = data.total_incidents.toLocaleString();
      renderIncidentsTable();
    }
  } catch (err) {
    console.error('Error fetching incidents database:', err);
  }
}

function renderIncidentsTable() {
  const tbody = document.getElementById('incidents-table-body');
  if (!tbody) return;

  if (activeIncidents.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 2rem;">No emergency incidents reported yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = activeIncidents.map(inc => `
    <tr>
      <td><strong style="color: #dc2626;">${inc.report_id}</strong></td>
      <td>🌲 ${inc.forest}</td>
      <td>📍 ${inc.state}</td>
      <td><strong>${inc.hazard_type}</strong></td>
      <td>${inc.temperature}</td>
      <td>${inc.smoke_level}</td>
      <td><span class="sheet-badge ${inc.severity.toLowerCase()}">${inc.severity}</span></td>
      <td><span class="badge badge-active">${inc.status}</span></td>
      <td>${inc.created_at ? inc.created_at.substring(0, 16) : 'Just Now'}</td>
    </tr>
  `).join('');
}

/* -------------------------------------------------------------------------- */
/*  STEPPER INCIDENT REPORTING FLOW                                           */
/* -------------------------------------------------------------------------- */
function openIncidentReportModal() {
  goToStep(1);
  document.getElementById('incident-modal').classList.add('active');
}

function closeIncidentReportModal() {
  document.getElementById('incident-modal').classList.remove('active');
}

function goToStep(stepNum) {
  currentReportStep = stepNum;

  document.querySelectorAll('.step-pane').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.step-indicator').forEach(el => el.classList.remove('active'));

  document.getElementById(`step-pane-${stepNum}`).classList.add('active');
  
  for (let i = 1; i <= stepNum; i++) {
    const ind = document.getElementById(`step-indicator-${i}`);
    if (ind) ind.classList.add('active');
  }

  const titleEl = document.getElementById('stepper-title-step');
  if (titleEl) {
    if (stepNum === 1) titleEl.textContent = 'Process Step 1 of 2: Select Forest & Hazard';
    else if (stepNum === 2) titleEl.textContent = 'Process Step 2 of 2: Live Observations & Weather';
    else titleEl.textContent = 'Report Dispatched';
  }

  if (stepNum === 2) {
    updateStepForestTelemetry();
  }
}

function updateStepForestTelemetry() {
  const forestName = document.getElementById('report-forest-select').value;
  const f = activeForests.find(item => item.region === forestName);
  
  if (f) {
    document.getElementById('rep-live-temp').textContent = `${f.avg_temp} °C`;
    document.getElementById('rep-live-humidity').textContent = `${f.avg_humidity} %`;
    document.getElementById('rep-live-wind').textContent = `${f.avg_wind} km/h`;
  }
}

async function submitIncidentReportForm() {
  const forest = document.getElementById('report-forest-select').value.trim();
  const f = activeForests.find(item => item.region === forest);

  const selectedHazard = document.querySelector('input[name="hazard_type"]:checked');
  const hazard_type = selectedHazard ? selectedHazard.value : 'Thermal Hotspot';

  const payload = {
    forest: forest,
    state: f ? f.state : 'India',
    hazard_type: hazard_type,
    temperature: f ? `${f.avg_temp}°C` : '34°C',
    humidity: f ? `${f.avg_humidity}%` : '25%',
    wind_speed: f ? `${f.avg_wind}km/h` : '18km/h',
    smoke_level: document.getElementById('report-smoke-level').value,
    severity: document.getElementById('report-severity').value,
    notes: document.getElementById('report-notes').value.trim()
  };

  try {
    const res = await fetch('/api/report-incident', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.status === 'success') {
      document.getElementById('report-confirm-id').textContent = data.report_id;
      goToStep(3);
      loadIncidentsDatabase();
    } else {
      alert(`⚠️ Incident Submission Error: ${data.message}`);
    }
  } catch (err) {
    alert('Error connecting to backend server.');
  }
}

/* -------------------------------------------------------------------------- */
/*  Forest Directory Grid View                                                */
/* -------------------------------------------------------------------------- */
function renderForestCardsGrid(forests) {
  const grid = document.getElementById('forest-grid-container');
  if (!grid) return;

  grid.innerHTML = forests.map(f => `
    <div class="forest-card">
      <div class="forest-card-header">
        <div>
          <div class="forest-card-title">${f.region}</div>
          <div class="forest-card-state">📍 ${f.state}</div>
        </div>
        <span class="sheet-badge ${f.dominant_risk.toLowerCase()}">${f.dominant_risk}</span>
      </div>

      <div class="sheet-metrics-grid" style="margin: 0;">
        <div class="sheet-metric"><span class="lbl">Temp</span><span class="val">${f.avg_temp}°C</span></div>
        <div class="sheet-metric"><span class="lbl">Humidity</span><span class="val">${f.avg_humidity}%</span></div>
        <div class="sheet-metric"><span class="lbl">Wind</span><span class="val">${f.avg_wind} km/h</span></div>
        <div class="sheet-metric"><span class="lbl">Drought</span><span class="val">${f.avg_drought}</span></div>
      </div>

      <button class="btn btn-outline" style="width: 100%; font-size: 0.8rem;" onclick="switchNavTab('tab-map', document.querySelectorAll('.nav-btn')[0]); selectForestByName('${f.region}', true)">
        🗺️ View Map Location
      </button>
    </div>
  `).join('');
}

/* -------------------------------------------------------------------------- */
/*  Forest Safety Assistant Chat & History Persistence                         */
/* -------------------------------------------------------------------------- */
let chatHistoryStore = [];

function loadSavedChatHistory() {
  try {
    const stored = localStorage.getItem('wildfire_chat_history_store');
    if (stored) {
      chatHistoryStore = JSON.parse(stored);
      if (Array.isArray(chatHistoryStore) && chatHistoryStore.length > 0) {
        const box = document.getElementById('chat-messages-box');
        if (!box) return;
        
        box.innerHTML = '';
        chatHistoryStore.forEach(item => {
          msgCount++;
          const div = document.createElement('div');
          div.id = item.id || `msg-${msgCount}`;
          div.className = `chat-msg ${item.sender}`;
          div.innerHTML = (item.text || '').replace(/\n/g, '<br>');
          box.appendChild(div);
        });
        box.scrollTop = box.scrollHeight;
      }
    }
  } catch (err) {
    console.error('Error loading chat history:', err);
  }
}

function saveChatHistoryToStorage() {
  try {
    localStorage.setItem('wildfire_chat_history_store', JSON.stringify(chatHistoryStore));
  } catch (err) {
    console.error('Error saving chat history:', err);
  }
}

function clearChatHistory() {
  if (!confirm('Clear all stored chat history?')) return;
  
  localStorage.removeItem('wildfire_chat_history_store');
  chatHistoryStore = [];
  
  const box = document.getElementById('chat-messages-box');
  if (box) {
    box.innerHTML = `
      <div class="chat-msg bot">
        Hello! I am your <strong>Wildfire AI Intelligence Safety Assistant</strong>.<br>
        Ask me about specific reserve fire risks, weather telemetry, or safety protocols (e.g., <em>"What is the weather telemetry in Bandipur National Park?"</em>).
      </div>
    `;
  }
  alert('🧹 Chat history cleared successfully!');
}

async function submitChatMessage() {
  const input = document.getElementById('chat-input-text');
  const text = input ? input.value.trim() : '';
  if (!text) return;

  appendChatMessage(text, 'user');
  input.value = '';

  const typingId = appendChatMessage('⏳ Processing safety advisory inquiry...', 'bot');

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    });
    const data = await res.json();

    if (data.status === 'success' && data.reply) {
      updateChatMessage(typingId, data.reply);
    } else {
      updateChatMessage(typingId, '⚠️ Standard safety advisory system unreachable. Please try again.');
    }
  } catch (err) {
    updateChatMessage(typingId, '⚠️ Connection error. Please verify network status.');
  }
}

function sendPromptText(msg) {
  const input = document.getElementById('chat-input-text');
  if (input) input.value = msg;
  submitChatMessage();
}

function handleChatEnter(e) {
  if (e.key === 'Enter') submitChatMessage();
}

let msgCount = 0;
function appendChatMessage(text, sender) {
  const box = document.getElementById('chat-messages-box');
  if (!box) return null;

  msgCount++;
  const id = `msg-${msgCount}`;
  const div = document.createElement('div');
  div.id = id;
  div.className = `chat-msg ${sender}`;
  div.innerHTML = text.replace(/\n/g, '<br>');
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;

  chatHistoryStore.push({ id, text, sender });
  saveChatHistoryToStorage();

  return id;
}

function updateChatMessage(id, text) {
  const div = document.getElementById(id);
  if (div) {
    div.innerHTML = text.replace(/\n/g, '<br>');
    const box = document.getElementById('chat-messages-box');
    if (box) box.scrollTop = box.scrollHeight;

    const storedItem = chatHistoryStore.find(item => item.id === id);
    if (storedItem) {
      storedItem.text = text;
    } else {
      chatHistoryStore.push({ id, text, sender: 'bot' });
    }
    saveChatHistoryToStorage();
  }
}

/* -------------------------------------------------------------------------- */
/*  Environmental Risk Calculator                                             */
/* -------------------------------------------------------------------------- */
async function calculateRiskScore() {
  const temp = parseFloat(document.getElementById('input-temp').value);
  const humidity = parseFloat(document.getElementById('input-humidity').value);
  const wind = parseFloat(document.getElementById('input-wind').value);
  const ndvi = parseFloat(document.getElementById('input-ndvi').value);
  const soil = parseFloat(document.getElementById('input-soil').value);
  const human = parseFloat(document.getElementById('input-human').value);
  const vegetation = document.getElementById('input-vegetation').value;

  document.getElementById('lbl-temp').textContent = `${temp} °C`;
  document.getElementById('lbl-humidity').textContent = `${humidity} %`;
  document.getElementById('lbl-wind').textContent = `${wind} km/h`;
  document.getElementById('lbl-ndvi').textContent = `${ndvi}`;
  document.getElementById('lbl-soil').textContent = `${soil} %`;
  document.getElementById('lbl-human').textContent = `${human}`;

  try {
    const res = await fetch('/api/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ temp, humidity, wind, ndvi, soil, human, vegetation })
    });
    const data = await res.json();

    if (data.status === 'success') {
      const score = data.score;
      const riskLevel = data.risk_level;

      document.getElementById('calc-score-val').textContent = `${score}%`;
      
      const badge = document.getElementById('calc-risk-badge');
      badge.className = `risk-badge-large ${riskLevel.toLowerCase()}`;
      badge.textContent = `${riskLevel.toUpperCase()} RISK`;

      const circleColors = { 'Low': '#059669', 'Medium': '#d97706', 'High': '#ea580c', 'Extreme': '#dc2626' };
      document.getElementById('calc-score-circle').style.borderColor = circleColors[riskLevel] || '#ea580c';

      document.getElementById('calc-factor-list').innerHTML = `
        <li>Ambient Temperature (${temp}°C) - ${temp > 32 ? 'High Thermal Stress' : 'Normal Range'}</li>
        <li>Relative Humidity (${humidity}%) - ${humidity < 30 ? 'Critical Low Moisture' : 'Adequate'}</li>
        <li>NDVI Index (${ndvi}) - ${ndvi < 0.3 ? 'Dry Canopy Vegetation' : 'Healthy Vegetation'}</li>
        <li>Canopy Profile - ${vegetation}</li>
        <li>Human Footprint Index (${human}/10)</li>
      `;
    }
  } catch (err) {
    console.error('Error calculating risk:', err);
  }
}
