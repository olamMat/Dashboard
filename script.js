// === CONFIGURACIÓN GENERAL ===
const basculaJsonUrl   = "https://raw.githubusercontent.com/olamMat/TemperaturasRepo/refs/heads/main/JSONBascula.json";
const sheetUrlGeneral  = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTmkOu3MtRM8A5lWnbZiSsmml38oQfDH7lymtUq2Mxao2EIgGkkAso9O6JnI0Ys1g/pub?output=csv";
const sheetUrlFechas   = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTkjuaFRpult81iqXUoM_0s0aO_Hx2NXI-Vt3b7NjydPhDjWpNt1xl_SuHxZ_8y7Q/pub?output=csv";

const generalContainer = document.getElementById("general-cards");
const camionesContainer = document.getElementById("camiones-cards");
const camionesUpdateElement = document.getElementById("camiones-update");
const generalUpdateElement = document.getElementById("general-update");

let generalData = [];
let fechaData = [];
let basculaRawRows = [];
let basculaFilteredRows = [];
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
  // Bascula ahora viene de JSON (no CSV). Patio se mantiene igual.
  basculaRawRows = await loadBasculaJSON(basculaJsonUrl, camionesContainer);
  setupBasculaDateUIOnce();
  applyBasculaFiltersAndRender();
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

// === BÁSCULA (JSON) ===
function parseDotNetDate(dotNetStr) {
  // Formato: "/Date(1766642400000)/"
  if (!dotNetStr) return null;
  const m = String(dotNetStr).match(/Date\((\d+)\)/);
  if (!m) return null;
  const ms = Number(m[1]);
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  return isNaN(d.getTime()) ? null : d;
}

function toISODateLocal(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isRobustaRow(row) {
  const cliente = (row?.["CLIENTE O AGENCIA"] || "").trim().toLowerCase();
  const ubicacion = (row?.["Ubicacion"] || "").toString().trim().toLowerCase();

  // Robusta si cumple cualquiera:
  // 1) Cliente = Nueva Guinea o El Rama
  // 2) Ubicacion = Patio Waswali
  return (
    cliente === "nueva guinea" ||
    cliente === "el rama" ||
    ubicacion === "patio waswali"
  );
}


async function loadBasculaJSON(url, container) {
  try {
    const resp = await fetch(`${url}?t=${Date.now()}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    const rows = Array.isArray(json?.rows) ? json.rows : [];
    if (!rows.length && container) {
      container.innerHTML = '<div class="error">No hay datos de báscula disponibles.</div>';
    }
    return rows;
  } catch (err) {
    console.error("❌ Error cargando JSON de báscula:", err);
    if (container) container.innerHTML = `<div class="error">Error cargando báscula: ${err.message}</div>`;
    return [];
  }
}

function applyBasculaFiltersAndRender() {
  const fromEl = document.getElementById("bascula-date-from");
  const toEl   = document.getElementById("bascula-date-to");

  const from = fromEl?.value ? new Date(fromEl.value + "T00:00:00") : null;
  const to   = toEl?.value   ? new Date(toEl.value   + "T23:59:59") : null;

  basculaFilteredRows = (basculaRawRows || []).filter(r => {
    const d = parseDotNetDate(r["Fecha"]);
    if (!d) return false;
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });

  renderBasculaFromRows(basculaFilteredRows);
}

function setupBasculaDateUIOnce() {
  const fromEl = document.getElementById("bascula-date-from");
  const toEl   = document.getElementById("bascula-date-to");
  const clearEl= document.getElementById("bascula-clear");

  if (!fromEl || !toEl) return;

  // Inicializa min/max y valor sugerido (solo una vez)
  if (!fromEl.dataset.init && basculaRawRows?.length) {
    const dates = basculaRawRows
      .map(r => parseDotNetDate(r["Fecha"]))
      .filter(Boolean)
      .sort((a,b) => a-b);

    if (dates.length) {
      const minISO = toISODateLocal(dates[0]);
      const maxISO = toISODateLocal(dates[dates.length - 1]);

      fromEl.min = minISO; fromEl.max = maxISO;
      toEl.min   = minISO; toEl.max   = maxISO;

      // Por defecto: "Hasta" = último día disponible
      if (!toEl.value) toEl.value = maxISO;
    }
    fromEl.dataset.init = "1";
  }

  if (!fromEl.dataset.bound) {
    fromEl.addEventListener("change", applyBasculaFiltersAndRender);
    fromEl.dataset.bound = "1";
  }
  if (!toEl.dataset.bound) {
    toEl.addEventListener("change", applyBasculaFiltersAndRender);
    toEl.dataset.bound = "1";
  }
  if (clearEl && !clearEl.dataset.bound) {
    clearEl.addEventListener("click", () => {
      fromEl.value = "";
      toEl.value = "";
      applyBasculaFiltersAndRender();
    });
    clearEl.dataset.bound = "1";
  }
}

function renderBasculaFromRows(rows) {
  camionesContainer.innerHTML = "";
  if (!rows || !rows.length) {
    camionesContainer.innerHTML = '<div class="error">No hay datos disponibles para el rango seleccionado.</div>';
    return;
  }

  // Totales (Camiones = número de registros)
  function acum(items) {
    let cam = 0, sac = 0, qq = 0;
    items.forEach(r => {
      cam += 1;
      sac += Number(r["SACOS"] || 0);
      qq  += Number(r["QQS NETOS"] || 0);
    });
    const kg = qq * 46;
    return { cam, sac, qq, kg };
  }

  const totalGeneral = acum(rows);

  // Barra Total General
  const barra = document.createElement("div");
  barra.classList.add("general-info-bar");
  barra.innerHTML = `
    <div class="general-info-title">📦 Total General</div>
    <div class="general-info-data">
      <div class="general-pill">Camiones: ${totalGeneral.cam}</div>
      <div class="general-pill">Kilos: ${totalGeneral.kg.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
      <div class="general-pill">QQs: ${totalGeneral.qq.toLocaleString(undefined, {maximumFractionDigits: 2})}</div>
      <div class="general-pill">Sacos: ${totalGeneral.sac.toLocaleString()}</div>
    </div>
  `;
  camionesContainer.appendChild(barra);

  // Clasificación Robusta/Arabigo
  const arabigo = [];
  const robusta = [];

  rows.forEach(r => {
  if (isRobustaRow(r)) robusta.push(r);
  else arabigo.push(r);
});


  // Agrupar Arabigo por Ubicacion
  const arabigoByUb = {};
  arabigo.forEach(r => {
    const ub = (r["Ubicacion"] || "Sin Ubicación").toString().trim() || "Sin Ubicación";
    if (!arabigoByUb[ub]) arabigoByUb[ub] = [];
    arabigoByUb[ub].push(r);
  });

  function agruparPorStatus(items) {
    const m = {};
    items.forEach(r => {
      const st = (r["Status"] || "Sin Status").toString().trim() || "Sin Status";
      if (!m[st]) m[st] = [];
      m[st].push(r);
    });
    return m;
  }

  function crearSeccionLikePatio(titulo, items, color) {
    const section = document.createElement("div");
    section.classList.add("patio-section");
    section.innerHTML = `<div class="patio-title" style="color:${color}">${titulo}</div>`;

    const cards = document.createElement("div");
    cards.classList.add("cards-container");

    const grouped = agruparPorStatus(items);
    Object.keys(grouped).forEach(st => {
      const sum = acum(grouped[st]);
      const card = document.createElement("div");
      card.classList.add("card");
      card.innerHTML = `
        <div class="proceso-label">${st}</div>
        <p><span>Camiones:</span> ${sum.cam}</p>
        <p><span>Kilos:</span> ${sum.kg.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
        <p><span>QQs:</span> ${sum.qq.toLocaleString(undefined, {maximumFractionDigits: 2})}</p>
        <p><span>Sacos:</span> ${sum.sac.toLocaleString()}</p>
      `;
      cards.appendChild(card);
    });

    section.appendChild(cards);
    camionesContainer.appendChild(section);
  }

  // Arabigo (por Ubicación)
Object.keys(arabigoByUb)
  .sort((a, b) => {
    const A = (a || "").toLowerCase();
    const B = (b || "").toLowerCase();
    const sin = "sin ubicación";

    if (A === sin && B !== sin) return -1;
    if (B === sin && A !== sin) return 1;
    return a.localeCompare(b, "es");
  })
  .forEach(ub => {
    crearSeccionLikePatio(`Arabigo — ${ub}`, arabigoByUb[ub], "#005ace");
  });

  // Robusta (una sola sección)
  if (robusta.length) {
    crearSeccionLikePatio("Robusta", robusta, "#1f8f2e");
  }
}

// Mantengo esta función por compatibilidad, pero ahora la data llega por JSON
function renderCamionesData(data) {
  renderBasculaFromRows(data);
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

const hamburger = document.getElementById("hamburger");
const menuPanel = document.getElementById("menu-panel");

hamburger.addEventListener("click", () => {
  const visible = menuPanel.style.display === "block";
  menuPanel.style.display = visible ? "none" : "block";
});

// Cerrar menú si se hace clic afuera
document.addEventListener("click", (e) => {
  if (!document.getElementById("menu-container").contains(e.target)) {
    menuPanel.style.display = "none";
  }
});
// MENÚ HAMBURGUESA
const burger = document.getElementById("hamburger");
const panel  = document.getElementById("menu-panel");
const mask   = document.getElementById("menu-mask");

burger.addEventListener("click", () => {
    burger.classList.toggle("open");
    if (burger.classList.contains("open")) {
        panel.style.display = "block";
    } else {
        panel.style.display = "none";
        mask.classList.remove("show");
    }
});
mask.addEventListener("click", () => {
    burger.classList.remove("open");
    panel.style.display = "none";
});

initializeApp();
