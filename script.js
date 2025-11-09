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

function sortByProcessOrder(data) {
  const order = ["No Asignado", "Tendido", "Enfarde", "Analizado", "Envio", "Almacén", "Tendido/Rechazado"];
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

async function performUpdate() {
  console.log("🔄 Actualizando datos...");
  try {
    await Promise.all([updateCamionesData(), updateGeneralData(), updateFechaData()]);
    updateTimestamp(camionesUpdateElement);
    updateTimestamp(generalUpdateElement);
    console.log("✅ Actualización completada", new Date().toLocaleTimeString());
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

async function loadCSV(url, container) {
  try {
    const timestamp = new Date().getTime();
    const response = await fetch(`${url}&t=${timestamp}`);
    if (!response.ok) throw new Error(`Error HTTP ${response.status}`);
    const text = await response.text();
    const data = parseCSV(text);
    if (!data.length && container)
      container.innerHTML = '<div class="error">No hay datos disponibles.</div>';
    return data;
  } catch (err) {
    console.error("❌ Error cargando CSV:", err);
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

    // Buscar la fecha en la tabla de fechas, compatible con más patios
    const patioInfo = fechaData.find(f => (f.PatioRec || "").trim().toLowerCase() === patio.trim().toLowerCase());
    let fechaTexto = "";

    if (patioInfo && patioInfo.UltimaFechaRecibida) {
      const fecha = new Date(patioInfo.UltimaFechaRecibida);
      if (!isNaN(fecha.getTime())) {
        const hoy = new Date();
        const diffDias = Math.floor((hoy - fecha) / (1000 * 60 * 60 * 24));
        const color = diffDias > 3 ? "style='color:#d32f2f;font-weight:bold;animation:blink 1.5s infinite;'" : "";
        const alerta = diffDias > 3 ? "⚠️" : "";
        const fechaFormateada = fecha.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
        fechaTexto = `— 🕓 Fecha más antigua sin asignar: <span ${color}>${fechaFormateada}</span> ${alerta}`;
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

  setupScrollEffects();
}

function setupScrollEffects() {
  document.querySelectorAll(".cards-container").forEach(container => {
    if (window.innerWidth <= 768) {
      container.addEventListener("scroll", () => {
        const cards = container.querySelectorAll(".card");
        const center = container.getBoundingClientRect().left + container.offsetWidth / 2;
        cards.forEach(card => {
          const rect = card.getBoundingClientRect();
          const mid = rect.left + rect.width / 2;
          card.classList.toggle("snap-center", Math.abs(mid - center) < rect.width / 2);
        });
      });
    }
  });
}

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

async function initializeApp() {
  await performUpdate();
  scheduleNextUpdate();
  console.log("✅ Dashboard inicializado");
}

initializeApp();
window.addEventListener("resize", setupScrollEffects);
window.addEventListener("beforeunload", () => clearInterval(updateInterval));


