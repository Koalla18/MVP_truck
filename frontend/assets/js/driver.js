// Use relative URL when running through nginx on port 8080
const API_BASE_URL = window.location.port === "8080" ? "/api/v1" : "http://localhost:8000/api/v1";
const SETTINGS_KEY = "routox-settings";

const prefs = { tz: "UTC+3", fuel: "l", temp: "c", alert: "push" };
let lastAlerts = [];
let lastOrders = [];

async function apiRequest(endpoint, token, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const e = new Error(err.detail || `HTTP ${res.status}`);
    e.status = res.status;
    throw e;
  }
  return await res.json();
}

function applyTheme(theme) {
  const isLight = theme === "light";
  document.body.classList.toggle("theme-light", isLight);
  document.documentElement.classList.toggle("theme-light", isLight);
  document.documentElement.style.colorScheme = isLight ? "light" : "dark";
  const input = document.getElementById("themeToggleInput");
  if (input) input.checked = isLight;
  try {
    localStorage.setItem("routox-theme", theme);
  } catch {
    // ignore
  }
}

function loadTheme() {
  try {
    applyTheme(localStorage.getItem("routox-theme") || "dark");
  } catch {
    applyTheme("dark");
  }
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    Object.assign(prefs, saved);
  } catch {
    // ignore
  }
  const tz = document.getElementById("tzSelect");
  const fuel = document.getElementById("fuelUnitSelect");
  const temp = document.getElementById("tempUnitSelect");
  const alert = document.getElementById("alertModeSelect");
  if (tz) tz.value = prefs.tz;
  if (fuel) fuel.value = prefs.fuel;
  if (temp) temp.value = prefs.temp;
  if (alert) alert.value = prefs.alert;
}

function persistSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

function setupHeaderPanels() {
  const themeInput = document.getElementById("themeToggleInput");
  if (themeInput) {
    themeInput.addEventListener("change", (e) => applyTheme(e.target.checked ? "light" : "dark"));
  }

  const notifBtn = document.getElementById("notifBtn");
  const settingsBtn = document.getElementById("settingsBtn");
  const notifPanel = document.getElementById("notifPanel");
  const settingsPanel = document.getElementById("settingsPanel");

  const closePanels = () => {
    notifPanel?.classList.add("hidden");
    settingsPanel?.classList.add("hidden");
  };

  notifBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    closePanels();
    renderNotifPanel();
    notifPanel?.classList.toggle("hidden");
    updateNotifBadge(0);
  });

  settingsBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    closePanels();
    settingsPanel?.classList.toggle("hidden");
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".floating-panel") && !e.target.closest("#notifBtn") && !e.target.closest("#settingsBtn")) {
      closePanels();
    }
  });

  const settingMap = { tzSelect: "tz", fuelUnitSelect: "fuel", tempUnitSelect: "temp", alertModeSelect: "alert" };
  Object.keys(settingMap).forEach((id) => {
    document.getElementById(id)?.addEventListener("change", (e) => {
      prefs[settingMap[id]] = e.target.value;
      persistSettings();
    });
  });
}

function updateNotifBadge(unread) {
  const dot = document.querySelector(".notif-dot");
  const icon = document.getElementById("notifIcon");
  const has = unread > 0;
  dot?.classList.toggle("hidden", !has);
  icon?.classList.toggle("hidden", !has);
}

function renderNotifPanel() {
  const list = document.getElementById("notifList");
  if (!list) return;
  const items = Array.isArray(lastAlerts) ? lastAlerts.slice(0, 20) : [];
  if (!items.length) {
    list.innerHTML = '<div class="text-sm text-slate-400">Нет активных тревог</div>';
    return;
  }
  list.innerHTML = items
    .map((a) => {
      return `<div class="notif-item">
        <div class="notif-icon bg-slate-800 text-amber-300"><i class="fa-solid fa-triangle-exclamation"></i></div>
        <div>
          <div class="text-sm font-semibold">${a.alert_type ? `Тревога: ${a.alert_type}` : "Тревога"}</div>
          <div class="text-xs text-slate-400">${(a.message || "—").replaceAll("<", "&lt;")}</div>
        </div>
      </div>`;
    })
    .join("");
}

function formatPhone(phone) {
  if (!phone) return "—";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11 && cleaned.startsWith("8")) {
    const normalized = `7${cleaned.slice(1)}`;
    return `+7 (${normalized.slice(1, 4)}) ${normalized.slice(4, 7)}-${normalized.slice(7, 9)}-${normalized.slice(9)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith("7")) {
    return `+7 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7, 9)}-${cleaned.slice(9)}`;
  }
  if (cleaned.length === 12 && cleaned.startsWith("375")) {
    return `+375 (${cleaned.slice(3, 5)}) ${cleaned.slice(5, 8)}-${cleaned.slice(8, 10)}-${cleaned.slice(10)}`;
  }
  return phone;
}

function phoneToTel(phone) {
  const cleaned = (phone || "").replace(/\D/g, "");
  if (!cleaned) return "";
  if (cleaned.length === 10) return `+7${cleaned}`;
  if (cleaned.length === 11 && cleaned.startsWith("8")) return `+7${cleaned.slice(1)}`;
  if (cleaned.length === 11 && cleaned.startsWith("7")) return `+${cleaned}`;
  if (cleaned.startsWith("375")) return `+${cleaned}`;
  return `+${cleaned}`;
}

function isValidPhoneLike(phone) {
  const digits = (phone || "").replace(/\D/g, "");
  return digits.length >= 10;
}

async function getMe(token) {
  const res = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("auth/me failed");
  return await res.json();
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function renderStatusPills(containerId, statuses = []) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = "";
  const uniq = statuses.filter(Boolean).slice(0, 4);
  for (const s of uniq) {
    const pill = document.createElement("span");
    pill.className = "px-3 py-1 rounded-full bg-slate-500/10 text-slate-200 border border-slate-500/30";
    pill.textContent = s;
    el.appendChild(pill);
  }
}

function formatTs(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts);
  return d.toLocaleString("ru-RU", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
}

function renderAlerts(alerts, token) {
  const list = document.getElementById("alertsList");
  const empty = document.getElementById("alertsEmpty");
  if (!list || !empty) return;

  list.innerHTML = "";
  const items = Array.isArray(alerts) ? alerts : [];
  lastAlerts = items;
  updateNotifBadge(items.length);
  empty.classList.toggle("hidden", items.length > 0);

  for (const a of items) {
    const row = document.createElement("div");
    row.className = "glass rounded-xl p-3 border border-slate-800 flex items-start justify-between gap-3";

    const left = document.createElement("div");
    left.className = "min-w-0";
    const title = document.createElement("div");
    title.className = "text-sm font-semibold";
    title.textContent = a.alert_type ? `Тревога: ${a.alert_type}` : "Тревога";
    const msg = document.createElement("div");
    msg.className = "text-sm text-slate-300 mt-1";
    msg.textContent = a.message || "—";
    const meta = document.createElement("div");
    meta.className = "text-xs text-slate-500 mt-2";
    meta.textContent = `${formatTs(a.created_at)} · vehicle: ${a.vehicle_id || "—"}`;

    left.appendChild(title);
    left.appendChild(msg);
    left.appendChild(meta);

    const btn = document.createElement("button");
    btn.className = "glass px-3 py-2 rounded-lg border border-slate-700 hover:border-amber-400/60 transition flex items-center gap-2 text-sm whitespace-nowrap";
    btn.innerHTML = '<i class="fa-solid fa-circle-check text-amber-300"></i> Подтвердить';

    btn.addEventListener("click", async () => {
      try {
        btn.disabled = true;
        btn.classList.add("opacity-70");
        await apiRequest(`/alerts/${a.id}/ack`, token, { method: "POST" });
        await refreshAlerts(token);
      } catch (e) {
        btn.disabled = false;
        btn.classList.remove("opacity-70");
        empty.textContent = e?.message || "Ошибка подтверждения";
        empty.classList.remove("hidden");
      }
    });

    row.appendChild(left);
    row.appendChild(btn);
    list.appendChild(row);
  }
}

function renderOrders(orders, token) {
  const list = document.getElementById("ordersList");
  const empty = document.getElementById("ordersEmpty");
  if (!list || !empty) return;

  list.innerHTML = "";
  const items = Array.isArray(orders) ? orders : [];
  lastOrders = items;
  empty.classList.toggle("hidden", items.length > 0);

  for (const o of items) {
    const row = document.createElement("div");
    row.className = "glass rounded-xl p-3 border border-slate-800 flex items-start justify-between gap-3";

    const left = document.createElement("div");
    left.className = "min-w-0";

    const title = document.createElement("div");
    title.className = "text-sm font-semibold";
    title.textContent = o.title || "Заказ";

    const meta = document.createElement("div");
    meta.className = "text-xs text-slate-500 mt-1";
    const route = [o.origin, o.destination].filter(Boolean).join(" → ");
    meta.textContent = `${route || "—"} · статус: ${o.status || "—"}`;

    const details = document.createElement("div");
    details.className = "text-xs text-slate-400 mt-2";
    details.textContent = o.cargo_desc || "";

    left.appendChild(title);
    left.appendChild(meta);
    if (o.cargo_desc) left.appendChild(details);

    const canAccept = (o.status === "new" || o.status === "assigned") && !o.accepted_by_user_id;
    const btn = document.createElement("button");
    btn.className = "glass px-3 py-2 rounded-lg border border-slate-700 hover:border-emerald-400/60 transition flex items-center gap-2 text-sm whitespace-nowrap";
    btn.innerHTML = canAccept
      ? '<i class="fa-solid fa-circle-check text-emerald-300"></i> Принять'
      : '<i class="fa-solid fa-circle-check text-slate-500"></i> Принято';
    btn.disabled = !canAccept;
    if (!canAccept) btn.classList.add("opacity-70");

    btn.addEventListener("click", async () => {
      try {
        btn.disabled = true;
        btn.classList.add("opacity-70");
        await apiRequest(`/orders/${o.id}/accept`, token, { method: "POST" });
        await refreshOrders(token);
      } catch (e) {
        btn.disabled = false;
        btn.classList.remove("opacity-70");
        empty.textContent = e?.message || "Ошибка принятия";
        empty.classList.remove("hidden");
      }
    });

    row.appendChild(left);
    row.appendChild(btn);
    list.appendChild(row);
  }
}

async function refreshOrders(token) {
  const empty = document.getElementById("ordersEmpty");
  if (!token) {
    if (empty) {
      empty.textContent = "Демо-режим: нет токена";
      empty.classList.remove("hidden");
    }
    renderOrders([], token);
    return;
  }

  try {
    const orders = await apiRequest("/orders", token);
    renderOrders(orders, token);
  } catch {
    if (empty) {
      empty.textContent = "Не удалось загрузить заказы";
      empty.classList.remove("hidden");
    }
    renderOrders([], token);
  }
}

async function refreshAlerts(token) {
  const empty = document.getElementById("alertsEmpty");
  if (!token) {
    if (empty) {
      empty.textContent = "Демо-режим: нет токена";
      empty.classList.remove("hidden");
    }
    renderAlerts([], token);
    return;
  }

  try {
    const alerts = await apiRequest("/alerts/active", token);
    renderAlerts(alerts, token);
  } catch (e) {
    if (empty) {
      empty.textContent = "Не удалось загрузить тревоги";
      empty.classList.remove("hidden");
    }
    renderAlerts([], token);
  }
}

async function loadDemoData() {
  const res = await fetch("./assets/data/data.json");
  if (!res.ok) throw new Error("data.json missing");
  return await res.json();
}

function setCallLink(anchorId, phone) {
  const a = document.getElementById(anchorId);
  if (!a) return;

  if (!isValidPhoneLike(phone)) {
    a.href = "#";
    a.setAttribute("aria-disabled", "true");
    a.style.pointerEvents = "none";
    a.style.opacity = ".6";
    return;
  }

  a.href = `tel:${phoneToTel(phone)}`;
  a.removeAttribute("aria-disabled");
  a.style.pointerEvents = "auto";
  a.style.opacity = "1";
}

function getAcceptanceKey(vehicleTag) {
  return `driver_trip_accepted:${vehicleTag || ""}`;
}

function updateAcceptButton(vehicle) {
  const btn = document.getElementById("acceptBtn");
  if (!btn) return;

  const accepted = localStorage.getItem(getAcceptanceKey(vehicle?.tag)) === "1";
  btn.innerHTML = accepted
    ? '<i class="fa-solid fa-circle-check text-emerald-300"></i> Принято'
    : '<i class="fa-solid fa-circle-check text-emerald-300"></i> Принять';
}

window.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("auth_token");

  loadTheme();
  loadSettings();
  setupHeaderPanels();

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("auth_token");
      window.location.href = "./login.html";
    });
  }

  try {
    if (!token) throw new Error("no token");
    const me = await getMe(token);
    setText("meEmail", me.email);

    if (me.role !== "driver") {
      const target = me.role === "owner" ? "./owner.html" : "./index.html";
      window.location.href = target;
      return;
    }
  } catch {
    // Demo mode: allow UI without API
  }

  let data;
  try {
    data = await loadDemoData();
  } catch {
    data = { drivers: [], vehicles: [] };
  }

  const driver = (data.drivers || [])[0] || null;
  const vehicle = (data.vehicles || []).find((v) => v.driverId && v.driverId === driver?.id) || (data.vehicles || [])[0] || null;

  setText("tripTitle", vehicle ? `${vehicle.name}` : "—");
  setText("tripSubtitle", vehicle ? `Груз: ${vehicle.cargo || "—"}` : "—");
  renderStatusPills("tripStatuses", [vehicle?.status, vehicle?.status2, vehicle?.status3]);

  setText("tripFrom", vehicle?.origin || "—");
  setText("tripDepart", vehicle?.depart ? `Выезд: ${vehicle.depart}` : "—");
  setText("tripTo", vehicle?.destination || "—");
  setText("tripEta", vehicle?.eta ? `ETA: ${vehicle.eta}` : "—");
  setText("tripCargo", vehicle?.cargo || "—");
  setText("tripRoute", vehicle?.route || "—");
  setText("tripPlate", vehicle?.plate || "—");
  setText("tripLoad", typeof vehicle?.load === "number" ? `${vehicle.load}%` : "—");

  const img = document.getElementById("tripVehicleImage");
  if (img && vehicle?.image) img.src = vehicle.image;

  setText("driverName", driver?.name || "—");
  setText("driverHome", driver?.home ? `База: ${driver.home}` : "—");
  setText("driverPhone", formatPhone(driver?.phone));
  setCallLink("driverCall", driver?.phone);

  const refreshBtn = document.getElementById("alertsRefreshBtn");
  if (refreshBtn) refreshBtn.addEventListener("click", () => refreshAlerts(token));
  await refreshAlerts(token);

  const ordersRefreshBtn = document.getElementById("ordersRefreshBtn");
  if (ordersRefreshBtn) ordersRefreshBtn.addEventListener("click", () => refreshOrders(token));
  await refreshOrders(token);

});
