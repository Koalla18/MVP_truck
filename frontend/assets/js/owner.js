const API_BASE_URL = "http://localhost:8000/api/v1";

const SETTINGS_KEY = "routox-settings";
const prefs = { tz: "UTC+3", fuel: "l", temp: "c", alert: "push" };
let lastAudit = [];
let lastNotifications = [];

async function getMe(token) {
  const res = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("auth/me failed");
  return await res.json();
}

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
  const items = Array.isArray(lastNotifications) ? lastNotifications.slice(0, 20) : [];
  if (items.length) {
    list.innerHTML = items
      .map((n) => {
        const title = (n.title || "Уведомление").replaceAll("<", "&lt;");
        const body = (n.detail ?? n.body ?? "").toString().replaceAll("<", "&lt;");
        const isUnread = !n.read_at;
        return `<div class="notif-item">
          <div class="notif-icon bg-slate-800 ${isUnread ? "text-amber-300" : "text-sky-300"}"><i class="fa-solid fa-info-circle"></i></div>
          <div>
            <div class="text-sm font-semibold">${title}${isUnread ? " · новое" : ""}</div>
            <div class="text-xs text-slate-400">${body}</div>
          </div>
        </div>`;
      })
      .join("");
    return;
  }

  list.innerHTML = '<div class="text-sm text-slate-400">Нет уведомлений</div>';
}

function setupHeaderPanels() {
  const themeInput = document.getElementById("themeToggleInput");
  themeInput?.addEventListener("change", (e) => applyTheme(e.target.checked ? "light" : "dark"));

  const notifBtn = document.getElementById("notifBtn");
  const settingsBtn = document.getElementById("settingsBtn");
  const notifPanel = document.getElementById("notifPanel");
  const settingsPanel = document.getElementById("settingsPanel");

  const closePanels = () => {
    notifPanel?.classList.add("hidden");
    settingsPanel?.classList.add("hidden");
  };

  notifBtn?.addEventListener("click", async (e) => {
    e.stopPropagation();
    closePanels();
    // Refresh notifications on open
    try {
      const token = localStorage.getItem("auth_token");
      if (token) {
        lastNotifications = await apiRequest("/notifications?limit=20", token);
        const unreadIds = (lastNotifications || []).filter((n) => n?.id && !n.read_at).map((n) => n.id);
        if (unreadIds.length) {
          await apiRequest("/notifications/read", token, { method: "POST", body: JSON.stringify({ ids: unreadIds }) });
          lastNotifications = await apiRequest("/notifications?limit=20", token);
        }
        updateNotifBadge((lastNotifications || []).filter((n) => !n.read_at).length);
      }
    } catch {
      // ignore, fallback to audit
    }
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

function renderUsers(users, token) {
  const empty = document.getElementById("usersEmpty");
  const list = document.getElementById("usersList");
  if (!empty || !list) return;

  const items = Array.isArray(users) ? users : [];
  const owners = items.filter((u) => u.role === "owner").length;
  const admins = items.filter((u) => u.role === "admin").length;
  const drivers = items.filter((u) => u.role === "driver").length;
  setText("ownerCount", String(owners));
  setText("adminCount", String(admins));
  setText("driverCount", String(drivers));

  list.innerHTML = "";
  empty.classList.toggle("hidden", items.length > 0);
  if (!items.length) {
    empty.textContent = "Нет пользователей";
    return;
  }
  empty.textContent = "";

  for (const u of items) {
    const row = document.createElement("div");
    row.className = "glass rounded-xl p-3 border border-slate-800 flex items-center justify-between gap-3";

    const left = document.createElement("div");
    left.className = "min-w-0";
    const title = document.createElement("div");
    title.className = "text-sm font-semibold truncate";
    title.textContent = u.email;
    const meta = document.createElement("div");
    meta.className = "text-xs text-slate-500";
    meta.textContent = `id: ${u.id} · active: ${u.is_active ? "yes" : "no"}`;
    left.appendChild(title);
    left.appendChild(meta);

    const right = document.createElement("div");
    right.className = "flex items-center gap-2";
    const select = document.createElement("select");
    select.className = "input-select";
    ["driver", "admin", "owner"].forEach((r) => {
      const opt = document.createElement("option");
      opt.value = r;
      opt.textContent = r;
      if (u.role === r) opt.selected = true;
      select.appendChild(opt);
    });
    const save = document.createElement("button");
    save.className = "glass px-3 py-2 rounded-lg border border-slate-700 hover:border-sky-400/60 transition text-sm";
    save.textContent = "Сохранить";
    save.addEventListener("click", async () => {
      try {
        save.disabled = true;
        await apiRequest(`/users/${u.id}`, token, {
          method: "PATCH",
          body: JSON.stringify({ role: select.value }),
        });
        await refreshUsers(token);
      } catch (e) {
        save.disabled = false;
        if (empty) {
          empty.textContent = e?.message || "Ошибка обновления роли";
          empty.classList.remove("hidden");
        }
      }
    });
    right.appendChild(select);
    right.appendChild(save);

    row.appendChild(left);
    row.appendChild(right);
    list.appendChild(row);
  }
}

async function refreshUsers(token) {
  const empty = document.getElementById("usersEmpty");
  if (!token) {
    if (empty) {
      empty.textContent = "Нет токена";
      empty.classList.remove("hidden");
    }
    renderUsers([], token);
    return;
  }
  try {
    const users = await apiRequest("/users", token);
    renderUsers(users, token);
  } catch (e) {
    if (empty) {
      empty.textContent = e?.message || "Не удалось загрузить пользователей";
      empty.classList.remove("hidden");
    }
    renderUsers([], token);
  }
}

function renderOrders(orders) {
  const empty = document.getElementById("ordersEmpty");
  const list = document.getElementById("ordersList");
  if (!empty || !list) return;

  const items = Array.isArray(orders) ? orders : [];
  list.innerHTML = "";
  empty.classList.toggle("hidden", items.length > 0);
  if (!items.length) {
    empty.textContent = "Нет заказов";
    return;
  }
  empty.textContent = "";

  for (const o of items.slice(0, 20)) {
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
    left.appendChild(title);
    left.appendChild(meta);

    const right = document.createElement("div");
    right.className = "text-xs text-slate-400 whitespace-nowrap";
    right.textContent = o.accepted_at ? "принят" : "не принят";

    row.appendChild(left);
    row.appendChild(right);
    list.appendChild(row);
  }
}

async function refreshOrders(token) {
  const empty = document.getElementById("ordersEmpty");
  if (!token) {
    if (empty) {
      empty.textContent = "Нет токена";
      empty.classList.remove("hidden");
    }
    renderOrders([]);
    return;
  }
  try {
    const orders = await apiRequest("/orders", token);
    renderOrders(orders);
  } catch (e) {
    if (empty) {
      empty.textContent = e?.message || "Не удалось загрузить заказы";
      empty.classList.remove("hidden");
    }
    renderOrders([]);
  }
}

async function refreshAudit(token) {
  if (!token) return;
  try {
    const rows = await apiRequest("/audit?limit=30", token);
    lastAudit = Array.isArray(rows) ? rows : [];
    // Only use audit as a fallback signal.
    if (!Array.isArray(lastNotifications) || lastNotifications.length === 0) {
      updateNotifBadge(lastAudit.length ? 1 : 0);
    }
  } catch {
    lastAudit = [];
  }
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
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

  if (!token) {
    window.location.href = "./login.html";
    return;
  }

  if (!token) {
    window.location.href = "./login.html";
    return;
  }

  try {
    const me = await getMe(token);
    setText("meEmail", me.email);

    if (me.role !== "owner") {
      const target = me.role === "driver" ? "./driver.html" : "./index.html";
      window.location.href = target;
      return;
    }

    setText("apiStatus", "Подключено");
  } catch {
    setText("apiStatus", "Нет связи с API");
  }

  const inviteForm = document.getElementById("inviteForm");
  const inviteNote = document.getElementById("inviteNote");
  inviteForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!inviteNote) return;
    inviteNote.classList.add("hidden");
    try {
      const email = document.getElementById("inviteEmail")?.value?.trim();
      const password = document.getElementById("invitePassword")?.value;
      const role = document.getElementById("inviteRole")?.value;
      await apiRequest("/users", token, {
        method: "POST",
        body: JSON.stringify({ email, password, role }),
      });
      inviteNote.textContent = "Пользователь создан";
      inviteNote.classList.remove("hidden");
      await refreshUsers(token);
    } catch (e2) {
      inviteNote.textContent = e2?.message || "Ошибка создания пользователя";
      inviteNote.classList.remove("hidden");
    }
  });

  document.getElementById("usersRefreshBtn")?.addEventListener("click", () => refreshUsers(token));
  document.getElementById("ordersRefreshBtn")?.addEventListener("click", () => refreshOrders(token));

  await refreshUsers(token);
  await refreshOrders(token);
  try {
    lastNotifications = await apiRequest("/notifications?limit=20", token);
    updateNotifBadge((lastNotifications || []).filter((n) => !n.read_at).length);
  } catch {
    // ignore
  }
  await refreshAudit(token);
});
