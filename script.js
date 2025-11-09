const sheetUrlCamiones = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRPW7ORSBCNqyu9AVjwWvCl_abfuud3m1COUTdEAUE4Rvoetf0E8m9jK9WX_OKzaA/pub?output=csv";
const sheetUrlGeneral = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTmkOu3MtRM8A5lWnbZiSsmml38oQfDH7lymtUq2Mxao2EIgGkkAso9O6JnI0Ys1g/pub?output=csv";

const generalContainer = document.getElementById("general-cards");
const camionesContainer = document.getElementById("camiones-cards");
const camionesUpdateElement = document.getElementById("camiones-update");
const generalUpdateElement = document.getElementById("general-update");

let generalData = [];
let updateInterval;

function sortByProcessOrder(data) {
  const processOrder = ["No Asignado", "Tendido", "Enfarde", "Analizado", "Envio", "Almacen", "Tendido/Rechazado"];
  return data.sort((a, b) => {
    const indexA = processOrder.indexOf(a.Proceso);
    const indexB = processOrder.indexOf(b.Proceso);
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return a.Proceso.localeCompare(b.Proceso);
  });
}

function formatTime(date) {
  return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function updateTimestamp(element) {
  element.textContent = `Última actualización: ${formatTime(new Date())}`;
}

function scheduleNextUpdate() {
  if (updateInterval) clearInterval(updateInterval);
  performUpdate(); // actualización inicial inmediata
  updateInterval = setInterval(performUpdate, 5 * 60 * 1000); // cada 5 minutos
}

async function performUpdate() {
  console.log('🔄 Actualizando datos...');
  try {
    await Promise.all([
      updateCamionesData(),
      updateGeneralData()
    ]);
    updateTimestamp(camionesUpdateElement);
    updateTimestamp(generalUpdateElement);
    console.log('✅ Actualización completada', new Date().toLocaleTimeString());
  } catch (error) {
    console.error('❌ Error en actualización:', error);
  }
}

async function updateCamionesData() {
  const data = await loadCSV(sheetUrlCamiones, camionesContainer);
  renderCamionesData(data);
}

async function updateGeneralData() {
  const data = await loadCSV(sheetUrlGeneral, generalContainer);
  generalData = data;
  renderGeneralData(data);
  setupFilters();
}

async function loadCSV(url, container) {
  try {
    const timestamp = new Date().getTime();
    const response = await fetch(`${url}&t=${timestamp}`);
    if (!response.ok) throw new Error(`Error HTTP ${response.status}`);
    const csvText = await response.text();
    const data = parseCSV(csvText);
    if (!data.length) {
      container.innerHTML = '<div class="error">No hay datos disponibles.</div>';
      return [];
    }
    return data;
  } catch (err) {
    console.error("❌ Error cargando CSV:", err);
    container.innerHTML = `<div class="error">Error cargando datos: ${err.message}</div>`;
    return [];
  }
}

function parseCSV(text) {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",").map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(",").map(v => v.trim());
    const obj = {};
    headers.forEach((header, i) => obj[header] = values[i]);
    return obj;
  });
}

function renderCamionesData(data) {
  camionesContainer.innerHTML = "";
  if (!data || !data.length) {
    camionesContainer.innerHTML = '<div class="error">No hay datos de camiones disponibles.</div>';
    return;
  }
  data.forEach(row => {
    const card = document.createElement("div");
    card.classList.add("card");
    card.innerHTML = `
      <p><span>Status:</span> ${row.Status || 'N/A'}</p>
      <p><span>Camiones:</span> ${row.Camiones || 'N/A'}</p>
      <p><span>Kilos:</span> ${parseFloat(row.Kilos || 0).toLocaleString()}</p>
      <p><span>QQs:</span> ${parseFloat(row.QQs || 0).toLocaleString()}</p>
    `;
    camionesContainer.appendChild(card);
  });
  setupScrollEffects();
}

function renderGeneralData(data) {
  generalContainer.innerHTML = "";
  if (!data.length) {
    generalContainer.innerHTML = '<div class="error">No hay datos generales.</div>';
    return;
  }
  const sorted = sortByProcessOrder(data);
  const grouped = {};
  sorted.forEach(item => {
    const patio = item.PatioRec || item.Patio || "Sin Patio";
    if (!grouped[patio]) grouped[patio] = [];
    grouped[patio].push(item);
  });

  Object.keys(grouped).forEach(patio => {
    const patioSection = document.createElement("div");
    patioSection.classList.add("patio-section");
    patioSection.innerHTML = `<div class="patio-title">📍 ${patio}</div>`;
    const cardsContainer = document.createElement("div");
    cardsContainer.classList.add("cards-container");

    grouped[patio].forEach(item => {
      const card = document.createElement("div");
      card.classList.add("card");
      card.innerHTML = `
        <p id="Proceso"> ${item.Proceso}</p>
        <p><span>Patio:</span> ${patio}</p>
        <p><span>CantSacos:</span> ${item.CantSacos}</p>
        <p><span>Kilos:</span> ${parseFloat(item.Kilos || 0).toLocaleString()}</p>
        <p><span>QQs:</span> ${parseFloat(item.QQs || 0).toLocaleString()}</p>
        <p><span>Lotes:</span> ${parseFloat(item.Lotes || 0).toLocaleString()}</p>
      `;
      cardsContainer.appendChild(card);
    });
    patioSection.appendChild(cardsContainer);
    generalContainer.appendChild(patioSection);
  });
  setupScrollEffects();
}

function setupScrollEffects() {
  const containers = document.querySelectorAll('.cards-container');
  containers.forEach(container => {
    if (window.innerWidth <= 768) {
      container.addEventListener('scroll', () => {
        const cards = container.querySelectorAll('.card');
        const center = container.getBoundingClientRect().left + container.offsetWidth / 2;
        cards.forEach(card => {
          const rect = card.getBoundingClientRect();
          const cardCenter = rect.left + rect.width / 2;
          card.classList.toggle('snap-center', Math.abs(cardCenter - center) < rect.width / 2);
        });
      });
    }
  });
}

function setupFilters() {
  const procesoSelect = document.getElementById("filter-proceso");
  const patioSelect = document.getElementById("filter-patio");
  procesoSelect.innerHTML = '<option value="Todos">Todos</option>';
  patioSelect.innerHTML = '<option value="Todos">Todos</option>';

  const procesos = [...new Set(generalData.map(d => d.Proceso))];
  const patios = [...new Set(generalData.map(d => d.PatioRec || d.Patio))];

  procesos.forEach(p => procesoSelect.innerHTML += `<option value="${p}">${p}</option>`);
  patios.forEach(p => patioSelect.innerHTML += `<option value="${p}">${p}</option>`);

  const applyFilters = () => {
    const fp = procesoSelect.value;
    const ft = patioSelect.value;
    const filtered = generalData.filter(d =>
      (fp === "Todos" || d.Proceso === fp) &&
      (ft === "Todos" || d.PatioRec === ft || d.Patio === ft)
    );
    renderGeneralData(filtered);
  };

  procesoSelect.onchange = applyFilters;
  patioSelect.onchange = applyFilters;
}

async function initializeApp() {
  await performUpdate();
  scheduleNextUpdate();
  console.log('✅ Dashboard inicializado');
}

initializeApp();
window.addEventListener('resize', setupScrollEffects);
window.addEventListener('beforeunload', () => clearInterval(updateInterval));