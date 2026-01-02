// Shared frontend helpers for RoutoX static pages (vanilla JS)
// Use relative URL - nginx proxies /api/* to backend
const ROUTOX_API_BASE_URL = window.location.port === "8080" ? "/api/v1" : "http://localhost:8000/api/v1";

function routoxGetToken() {
  try {
    return localStorage.getItem("auth_token");
  } catch {
    return null;
  }
}

function routoxClearToken() {
  try {
    localStorage.removeItem("auth_token");
  } catch {
    // ignore
  }
}

async function routoxApiRequest(endpoint, token, options = {}) {
  const url = `${ROUTOX_API_BASE_URL}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(url, { ...options, headers });
  } catch (err) {
    const isFile = typeof window !== "undefined" && window.location && window.location.protocol === "file:";
    const hint = isFile
      ? "Откройте фронтенд через http://localhost:5173 (не file://), иначе браузер блокирует запросы к API."
      : "Проверьте, что backend запущен на http://localhost:8000 и CORS разрешает этот origin.";
    const e = new Error(`Не удалось обратиться к API (${endpoint}). ${hint}`);
    e.cause = err;
    throw e;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const e = new Error(err.detail || `HTTP ${res.status}`);
    e.status = res.status;
    throw e;
  }
  return await res.json();
}

async function routoxFetchMe(token) {
  // Check if demo token (for local mode without backend)
  if (token && token.startsWith("demo_")) {
    try {
      const payload = JSON.parse(atob(token.replace("demo_", "")));
      return { 
        email: payload.email, 
        role: payload.role,
        name: payload.email.split("@")[0]
      };
    } catch {
      throw new Error("Invalid demo token");
    }
  }
  return await routoxApiRequest("/auth/me", token);
}

function isDemoMode() {
  return localStorage.getItem("demo_mode") === "true";
}

// Theme + settings
const ROUTOX_SETTINGS_KEY = "routox-settings";
const routoxPrefs = { tz: "UTC+3", fuel: "l", temp: "c", alert: "push" };

function routoxApplyTheme(theme) {
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

function routoxLoadTheme() {
  try {
    routoxApplyTheme(localStorage.getItem("routox-theme") || "dark");
  } catch {
    routoxApplyTheme("dark");
  }
}

function routoxLoadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(ROUTOX_SETTINGS_KEY) || "{}");
    Object.assign(routoxPrefs, saved);
  } catch {
    // ignore
  }

  const tz = document.getElementById("tzSelect");
  const fuel = document.getElementById("fuelUnitSelect");
  const temp = document.getElementById("tempUnitSelect");
  const alert = document.getElementById("alertModeSelect");
  if (tz) tz.value = routoxPrefs.tz;
  if (fuel) fuel.value = routoxPrefs.fuel;
  if (temp) temp.value = routoxPrefs.temp;
  if (alert) alert.value = routoxPrefs.alert;
}

function routoxPersistSettings() {
  try {
    localStorage.setItem(ROUTOX_SETTINGS_KEY, JSON.stringify(routoxPrefs));
  } catch {
    // ignore
  }
}

function routoxUpdateNotifBadge(unread) {
  const btn = document.getElementById("notifBtn");
  const dot = btn?.querySelector(".notif-dot");
  const icon = document.getElementById("notifIcon");
  const has = unread > 0;
  dot?.classList.toggle("hidden", !has);
  icon?.classList.toggle("hidden", !has);
}

function routoxEscapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function routoxInitHeaderPanels(token) {
  routoxLoadTheme();
  routoxLoadSettings();

  const themeInput = document.getElementById("themeToggleInput");
  themeInput?.addEventListener("change", (e) => routoxApplyTheme(e.target.checked ? "light" : "dark"));

  const notifBtn = document.getElementById("notifBtn");
  const settingsBtn = document.getElementById("settingsBtn");
  const notifPanel = document.getElementById("notifPanel");
  const settingsPanel = document.getElementById("settingsPanel");

  const closePanels = () => {
    notifPanel?.classList.add("hidden");
    settingsPanel?.classList.add("hidden");
  };

  let lastNotifications = [];

  async function refreshNotifications() {
    if (!token) {
      lastNotifications = [];
      routoxUpdateNotifBadge(0);
      return;
    }
    try {
      const rows = await routoxApiRequest("/notifications?limit=20", token);
      lastNotifications = Array.isArray(rows) ? rows : [];
      const unread = lastNotifications.filter((n) => !n.read_at).length;
      routoxUpdateNotifBadge(unread);
    } catch {
      lastNotifications = [];
      routoxUpdateNotifBadge(0);
    }
  }

  function renderNotifPanel() {
    const list = document.getElementById("notifList");
    if (!list) return;

    const items = Array.isArray(lastNotifications) ? lastNotifications.slice(0, 20) : [];
    if (!items.length) {
      list.innerHTML = '<div class="text-sm text-slate-400">Нет уведомлений</div>';
      return;
    }

    list.innerHTML = items
      .map((n) => {
        const title = routoxEscapeHtml(n.title || "Уведомление");
        const detail = routoxEscapeHtml(n.detail ?? n.body ?? "");
        const isUnread = !n.read_at;
        return `<div class="notif-item">
          <div class="notif-icon bg-slate-800 ${isUnread ? "text-amber-300" : "text-sky-300"}"><i class="fa-solid fa-info-circle"></i></div>
          <div>
            <div class="text-sm font-semibold">${title}${isUnread ? " · новое" : ""}</div>
            <div class="text-xs text-slate-400">${detail}</div>
          </div>
        </div>`;
      })
      .join("");
  }

  notifBtn?.addEventListener("click", async (e) => {
    e.stopPropagation();
    closePanels();
    await refreshNotifications();
    renderNotifPanel();
    notifPanel?.classList.toggle("hidden");

    // Mark unread as read when opening.
    const unreadIds = (lastNotifications || []).filter((n) => n?.id && !n.read_at).map((n) => n.id);
    if (token && unreadIds.length) {
      try {
        await routoxApiRequest("/notifications/read", token, {
          method: "POST",
          body: JSON.stringify({ ids: unreadIds }),
        });
        await refreshNotifications();
      } catch {
        // ignore
      }
    }
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
      routoxPrefs[settingMap[id]] = e.target.value;
      routoxPersistSettings();
    });
  });

  await refreshNotifications();
}

async function routoxRequireAuth({ allowRoles = null } = {}) {
  const token = routoxGetToken();
  if (!token) {
    window.location.href = "./login.html";
    return { token: null, me: null };
  }

  let me;
  try {
    me = await routoxFetchMe(token);
  } catch (e) {
    // Only clear token + redirect when we are sure it's an auth problem.
    if (e?.status === 401 || e?.status === 403) {
      routoxClearToken();
      window.location.href = "./login.html";
      return { token: null, me: null };
    }
    throw e;
  }

  if (Array.isArray(allowRoles) && allowRoles.length) {
    if (!allowRoles.includes(me.role)) {
      const target = me.role === "driver" ? "./driver.html" : me.role === "owner" ? "./owner.html" : "./index.html";
      window.location.href = target;
      return { token: null, me: null };
    }
  }

  return { token, me };
}

window.RoutoxCommon = {
  apiRequest: routoxApiRequest,
  fetchMe: routoxFetchMe,
  getToken: routoxGetToken,
  clearToken: routoxClearToken,
  initHeaderPanels: routoxInitHeaderPanels,
  requireAuth: routoxRequireAuth,
};
