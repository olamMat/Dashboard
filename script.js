// === CONFIGURACIÓN GENERAL ===
const sheetUrlCamiones = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRPW7ORSBCNqyu9AVjwWvCl_abfuud3m1COUTdEAUE4Rvoetf0E8m9jK9WX_OKzaA/pub?output=csv";
const sheetUrlGeneral  = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTmkOu3MtRM8A5lWnbZiSsmml38oQfDH7lymtUq2Mxao2EIgGkkAso9O6JnI0Ys1g/pub?output=csv";
const sheetUrlFechas   = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTkjuaFRpult81iqXUoM_0s0aO_Hx2NXI-Vt3b7NjydPhDjWpNt1xl_SuHxZ_8y7Q/pub?output=csv";

const generalContainer = document.getElementById("general-cards");
const camionesContainer = document.getElementById("camiones-cards");
const camionesUpdateElement = document.getElementById("camiones-update");
const generalUpdateElement = document.getElementById("general-update");

let generalData = [];
let fechaData = [];
let updateInterval;

// === CONFIGURACIÓN DE ALERTA ===
const ALERT_DAYS = 3; // 🔴 Será rojo si tiene 3 días o más

// === FUNCIÓN DE PARSEO DE FECHA ===
function parseFechaTexto(fechaStrRaw) {
  if (!fechaStrRaw) return null;
  try {
    const clean = fechaStrRaw.trim().replace(/\s+/g, " ");
    const [fechaPart, horaPart = "00:00"] = clean.split(" ");
    const [dStr, mesStr, yStr] = fechaPart.split("/");

    const d = parseInt(dStr, 10);
    let y = parseInt(yStr, 10);
    if (isNaN(d) || isNaN(y)) return null;
    if (y < 100) y += 2000;

    // Normalizamos el texto del mes a minúsculas sin acentos
    const mesNorm = mesStr
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .substring(0, 3)
      .toLowerCase();

    const meses = {
      ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
      jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11,
      jan: 0, feb: 1, mar: 2, apr: 3, may_: 4, jun: 5,
      jul_: 6, aug: 7, sep_: 8, oct_: 9, nov_: 10, dec: 11
    };

    const m = meses[mesNorm];
    if (m === undefined) return null;

    const [hhStr, mmStr = "0"] = horaPart.split(":");
    const hh = parseInt(hhStr, 10) || 0;
    const mm = parseInt(mmStr, 10) || 0;

    const date = new Date(y, m, d, hh, mm, 0, 0);
    if (isNaN(date.getTime())) return null;

    return date;
  } catch (err) {
    console.warn("❌ Error parseando fecha:", fechaStrRaw, err);
    return null;
  }
}

// === DIFERENCIA DE DÍAS ===
function diffDiasCalendario(fechaActual, fechaComparar) {
  const a = new Date(fechaActual);
  const b = new Date(fechaComparar);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.floor((a - b) / (1000 * 60 * 60 * 24));
}

// === UTILIDADES ===
function sortByProcessOrder(data) {
  const order = ["No Asignado", "Tendido", "Enfarde", "Sin Catacion", "Analizado", "Envio", "Almacén", "Tendido/Rechazado"];
  return data.sort((a, b) => order.indexOf(a.Proceso) - order.indexOf(b.Proceso));
}

function formatTime(date) {
  return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function updateTimestamp(element) {
  element.textContent = `Última actualización: ${formatTime(new Date())}`;
}

function scheduleNextUpdate() {
  if (updateInterval) clearInterval(updateInterval);
  performUpdate();
  updateInterval = setInterval(performUpdate, 5 * 60 * 1000);
}

// === PROCESOS PRINCIPALES ===
async function performUpdate() {
  try {
    await Promise.all([updateCamionesData(), updateGeneralData(), updateFechaData()]);
    updateTimestamp(camionesUpdateElement);
    updateTimestamp(generalUpdateElement);
  } catch (error) {
    console.error("❌ Error en actualización:", error);
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

async function updateFechaData() {
  fechaData = await loadCSV(sheetUrlFechas);
}

// === LECTURA CSV ===
async function loadCSV(url, container) {
  try {
    const response = await fetch(`${url}&t=${Date.now()}`);
    const text = await response.text();
    const data = parseCSV(text);
    if (!data.length && container)
      container.innerHTML = '<div class="error">No hay datos disponibles.</div>';
    return data;
  } catch (err) {
    if (container)
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
    headers.forEach((h, i) => (obj[h] = values[i]));
    return obj;
  });
}

// === RENDERIZADO ===
function renderCamionesData(data) {
  camionesContainer.innerHTML = "";
  if (!data.length) {
    camionesContainer.innerHTML = '<div class="error">No hay datos de camiones disponibles.</div>';
    return;
  }
  data.forEach(r => {
    const card = document.createElement("div");
    card.classList.add("card");
    card.innerHTML = `
      <p><span>Status:</span> ${r.Status || "N/A"}</p>
      <p><span>Camiones:</span> ${r.Camiones || "N/A"}</p>
      <p><span>Kilos:</span> ${parseFloat(r.Kilos || 0).toLocaleString()}</p>
      <p><span>QQs:</span> ${parseFloat(r.QQs || 0).toLocaleString()}</p>
    `;
    camionesContainer.appendChild(card);
  });
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

    const patioInfo = fechaData.find(f =>
      (f.PatioRec || "").trim().toLowerCase() === patio.trim().toLowerCase()
    );

    let fechaTexto = "";
    if (patioInfo && patioInfo.UltimaFechaRecibida) {
      const fecha = parseFechaTexto(patioInfo.UltimaFechaRecibida);
      if (fecha instanceof Date && !isNaN(fecha)) {
        const hoy = new Date();
        const diff = diffDiasCalendario(hoy, fecha);
        const isAlert = diff >= ALERT_DAYS;
        const style = isAlert
          ? "style='color:#d32f2f;font-weight:bold;animation:blink 1.5s infinite;'"
          : "style='color:#2e7d32;font-weight:bold;'";
        const icon = isAlert ? "⚠️" : "✅";
        const fechaFormateada = fecha.toLocaleString("es-ES", {
          day: "2-digit", month: "short", year: "numeric",
          hour: "2-digit", minute: "2-digit"
        }).replace(".", "");
        fechaTexto = `— 🕓 Fecha más antigua sin asignar: <span ${style}>${fechaFormateada}</span> ${icon}`;
      }
    }

    patioSection.innerHTML = `<div class="patio-title">📍 ${patio} ${fechaTexto}</div>`;

    const cardsContainer = document.createElement("div");
    cardsContainer.classList.add("cards-container");

    grouped[patio].forEach(item => {
      const card = document.createElement("div");
      card.classList.add("card");
      card.innerHTML = `
        <div class="proceso-label">${item.Proceso}</div>
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
}

// === FILTROS ===
function setupFilters() {
  const pSelect = document.getElementById("filter-proceso");
  const tSelect = document.getElementById("filter-patio");
  pSelect.innerHTML = '<option value="Todos">Todos</option>';
  tSelect.innerHTML = '<option value="Todos">Todos</option>';

  const procesos = [...new Set(generalData.map(d => d.Proceso))];
  const patios = [...new Set(generalData.map(d => d.PatioRec || d.Patio))];

  procesos.forEach(p => (pSelect.innerHTML += `<option value="${p}">${p}</option>`));
  patios.forEach(p => (tSelect.innerHTML += `<option value="${p}">${p}</option>`));

  const applyFilters = () => {
    const fp = pSelect.value, ft = tSelect.value;
    const filtered = generalData.filter(
      d =>
        (fp === "Todos" || d.Proceso === fp) &&
        (ft === "Todos" || d.PatioRec === ft || d.Patio === ft)
    );
    renderGeneralData(filtered);
  };

  pSelect.onchange = applyFilters;
  tSelect.onchange = applyFilters;
}

// === INICIALIZACIÓN ===
async function initializeApp() {
  await performUpdate();
  scheduleNextUpdate();
  console.log("✅ Dashboard inicializado");
}

initializeApp();


