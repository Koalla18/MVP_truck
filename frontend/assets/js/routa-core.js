/**
 * Routa Platform Core - Центральный модуль управления приложением
 * Единая система для всех продуктов: RoutaL, RoutaT, RoutaX, RoutaF, RoutaE, RoutaS
 * v2.0 - Multi-product Edition with Feature Flags
 */

// ============================================================================
// КОНФИГУРАЦИЯ ПЛАТФОРМЫ
// ============================================================================

const ROUTA_CONFIG = {
  API_BASE: window.location.port === "8080" ? "/api/v1" : "http://localhost:8000/api/v1",
  TOKEN_KEY: "routa_access_token",
  REFRESH_TOKEN_KEY: "routa_refresh_token",
  USER_KEY: "routa_user",
  THEME_KEY: "routa_theme",
  COMPANY_KEY: "routa_company",
  FEATURES_KEY: "routa_features",
  TOKEN_REFRESH_THRESHOLD: 5 * 60 * 1000,
  DEFAULT_THEME: "light",
};

// ============================================================================
// ПРОДУКТЫ (EDITIONS)
// ============================================================================

const EDITIONS = {
  routal: {
    name: "RoutaL",
    fullName: "RoutaL — Little",
    description: "Для малых компаний (1–10 ТС)",
    color: "#10b981",
    icon: "fa-truck-pickup",
    audience: "Малый бизнес",
  },
  routat: {
    name: "RoutaT",
    fullName: "RoutaT — Town",
    description: "Городские перевозки и стройка",
    color: "#f59e0b",
    icon: "fa-city",
    audience: "Город и смены",
  },
  routax: {
    name: "RoutaX",
    fullName: "RoutaX — Intercity",
    description: "Межгород и дальнобой",
    color: "#3b82f6",
    icon: "fa-truck-moving",
    audience: "Средний и крупный бизнес",
  },
  routaf: {
    name: "RoutaF",
    fullName: "RoutaF — Forwarder",
    description: "Экспедитор и подрядчики",
    color: "#8b5cf6",
    icon: "fa-people-carry-box",
    audience: "Экспедиторы",
  },
  routae: {
    name: "RoutaE",
    fullName: "RoutaE — Enterprise",
    description: "Холдинги и корпорации",
    color: "#ef4444",
    icon: "fa-building",
    audience: "Enterprise",
  },
  routas: {
    name: "RoutaS",
    fullName: "RoutaS — Subcontractor",
    description: "Кабинет подрядчика",
    color: "#06b6d4",
    icon: "fa-handshake",
    audience: "Подрядчики",
  },
};

// ============================================================================
// ТАРИФНЫЕ ПЛАНЫ
// ============================================================================

const PLANS = {
  start: {
    name: "Start",
    limits: { vehicles: 5, users: 3, integrations: 0 },
  },
  pro: {
    name: "Pro",
    limits: { vehicles: 50, users: 20, integrations: 3 },
  },
  business: {
    name: "Business",
    limits: { vehicles: -1, users: -1, integrations: -1 }, // -1 = unlimited
  },
};

// ============================================================================
// РОЛИ И ПРАВА ДОСТУПА
// ============================================================================

const ROLES = {
  platform_admin: {
    name: "Platform Admin",
    displayName: "Администратор платформы",
    icon: "fa-shield-halved",
    color: "rose",
    level: 1000,
    platform: true,
  },
  support: {
    name: "Support",
    displayName: "Поддержка",
    icon: "fa-headset",
    color: "cyan",
    level: 500,
    platform: true,
  },
  owner: {
    name: "Owner",
    displayName: "Владелец",
    icon: "fa-crown",
    color: "purple",
    level: 100,
    platform: false,
  },
  admin: {
    name: "Admin",
    displayName: "Администратор",
    icon: "fa-user-gear",
    color: "blue",
    level: 50,
    platform: false,
  },
  dispatcher: {
    name: "Dispatcher",
    displayName: "Диспетчер",
    icon: "fa-headset",
    color: "emerald",
    level: 30,
    platform: false,
  },
  driver: {
    name: "Driver",
    displayName: "Водитель",
    icon: "fa-id-card",
    color: "green",
    level: 10,
    platform: false,
  },
};

// ============================================================================
// НАВИГАЦИЯ ПО РОЛЯМ (строгий порядок из ТЗ)
// ============================================================================

const NAV_CONFIG = {
  // Порядок вкладок для Owner (строго по ТЗ)
  owner: [
    { page: "staff.html", title: "Персонал", icon: "fa-users", feature: "staff" },
    { page: "fleet.html", title: "Флот", icon: "fa-truck", feature: "fleet" },
    { page: "trips.html", title: "Рейсы", icon: "fa-route", feature: "trips" },
    { page: "geozones.html", title: "Геозоны", icon: "fa-map-location-dot", feature: "geozones" },
    { page: "analytics.html", title: "Аналитика", icon: "fa-chart-line", feature: "analytics" },
    { page: "fuel.html", title: "Топливо", icon: "fa-gas-pump", feature: "fuel" },
    { page: "maintenance.html", title: "ТО", icon: "fa-wrench", feature: "maintenance" },
    { page: "documents.html", title: "Документы", icon: "fa-file-lines", feature: "documents" },
    { page: "inventory.html", title: "Инвентарь", icon: "fa-boxes-stacked", feature: "inventory" },
  ],
  // Порядок вкладок для Admin (строго по ТЗ - без Персонала)
  admin: [
    { page: "fleet.html", title: "Флот", icon: "fa-truck", feature: "fleet" },
    { page: "trips.html", title: "Рейсы", icon: "fa-route", feature: "trips" },
    { page: "geozones.html", title: "Геозоны", icon: "fa-map-location-dot", feature: "geozones" },
    { page: "analytics.html", title: "Аналитика", icon: "fa-chart-line", feature: "analytics_limited" },
    { page: "fuel.html", title: "Топливо", icon: "fa-gas-pump", feature: "fuel" },
    { page: "maintenance.html", title: "ТО", icon: "fa-wrench", feature: "maintenance" },
    { page: "documents.html", title: "Документы", icon: "fa-file-lines", feature: "documents" },
    { page: "inventory.html", title: "Инвентарь", icon: "fa-boxes-stacked", feature: "inventory" },
  ],
  // Диспетчер (опционально)
  dispatcher: [
    { page: "fleet.html", title: "Флот", icon: "fa-truck", feature: "fleet" },
    { page: "trips.html", title: "Рейсы", icon: "fa-route", feature: "trips" },
    { page: "geozones.html", title: "Геозоны", icon: "fa-map-location-dot", feature: "geozones" },
  ],
  // Водитель - отдельный интерфейс
  driver: [
    { page: "driver.html", title: "Мои рейсы", icon: "fa-route", feature: "driver_trips" },
    { page: "driver-documents.html", title: "Мои документы", icon: "fa-file-lines", feature: "driver_documents" },
  ],
  // Platform Admin - SaaS панель
  platform_admin: [
    { page: "saas-tenants.html", title: "Тенанты", icon: "fa-building", feature: "saas_tenants" },
    { page: "saas-billing.html", title: "Биллинг", icon: "fa-credit-card", feature: "saas_billing" },
    { page: "saas-usage.html", title: "Usage", icon: "fa-chart-bar", feature: "saas_usage" },
    { page: "saas-audit.html", title: "Audit Logs", icon: "fa-clipboard-list", feature: "saas_audit" },
    { page: "saas-features.html", title: "Features", icon: "fa-toggle-on", feature: "saas_features" },
    { page: "saas-support.html", title: "Support", icon: "fa-headset", feature: "saas_support" },
  ],
};

// Доступ к страницам (для проверки прав)
const PAGE_ACCESS = {
  "staff.html": { roles: ["owner"], feature: "staff" },
  "fleet.html": { roles: ["owner", "admin", "dispatcher"], feature: "fleet" },
  "trips.html": { roles: ["owner", "admin", "dispatcher"], feature: "trips" },
  "geozones.html": { roles: ["owner", "admin", "dispatcher"], feature: "geozones" },
  "analytics.html": { roles: ["owner", "admin"], feature: "analytics" },
  "fuel.html": { roles: ["owner", "admin"], feature: "fuel" },
  "maintenance.html": { roles: ["owner", "admin"], feature: "maintenance" },
  "documents.html": { roles: ["owner", "admin", "driver"], feature: "documents" },
  "inventory.html": { roles: ["owner", "admin"], feature: "inventory" },
  "notifications.html": { roles: ["owner", "admin", "dispatcher", "driver"], feature: "notifications" },
  "driver.html": { roles: ["driver"], feature: "driver_dashboard" },
  "driver-documents.html": { roles: ["driver"], feature: "driver_documents" },
  // SaaS Admin pages
  "saas-tenants.html": { roles: ["platform_admin"], feature: "saas_tenants" },
  "saas-billing.html": { roles: ["platform_admin"], feature: "saas_billing" },
  "saas-usage.html": { roles: ["platform_admin"], feature: "saas_usage" },
  "saas-audit.html": { roles: ["platform_admin", "support"], feature: "saas_audit" },
  "saas-features.html": { roles: ["platform_admin"], feature: "saas_features" },
  "saas-support.html": { roles: ["platform_admin", "support"], feature: "saas_support" },
  // Public pages
  "login.html": { roles: [], public: true },
  "register.html": { roles: [], public: true },
  "landing.html": { roles: [], public: true },
  "password-reset.html": { roles: [], public: true },
};

// ============================================================================
// FEATURE FLAGS ПО EDITIONS
// ============================================================================

const EDITION_FEATURES = {
  routal: {
    start: ["fleet", "trips", "fuel", "maintenance", "documents", "notifications"],
    pro: ["fleet", "trips", "fuel", "maintenance", "documents", "notifications", "geozones", "analytics_limited", "inventory", "ai_basic"],
  },
  routat: {
    start: ["fleet", "trips", "fuel", "maintenance", "documents", "notifications", "geozones"],
    pro: ["fleet", "trips", "fuel", "maintenance", "documents", "notifications", "geozones", "analytics", "inventory", "ai_basic", "fuel_anomalies"],
  },
  routax: {
    pro: ["fleet", "trips", "fuel", "maintenance", "documents", "notifications", "geozones", "analytics", "inventory", "ai_basic", "fuel_anomalies", "trip_economics", "staff"],
    business: ["fleet", "trips", "fuel", "maintenance", "documents", "notifications", "geozones", "analytics", "inventory", "ai_advanced", "fuel_anomalies", "trip_economics", "staff", "integrations_gps", "integrations_fuel", "audit"],
  },
  routaf: {
    pro: ["fleet", "trips", "documents", "notifications", "analytics", "carriers", "ai_basic"],
    business: ["fleet", "trips", "documents", "notifications", "analytics", "carriers", "ai_advanced", "integrations_1c"],
  },
  routae: {
    business: ["fleet", "trips", "fuel", "maintenance", "documents", "notifications", "geozones", "analytics", "inventory", "ai_advanced", "fuel_anomalies", "trip_economics", "staff", "integrations_gps", "integrations_fuel", "integrations_1c", "sso", "audit_extended", "carriers"],
  },
  routas: {
    start: ["driver_dashboard", "driver_trips", "driver_documents", "notifications"],
    pro: ["driver_dashboard", "driver_trips", "driver_documents", "notifications", "ai_basic"],
  },
};

// ============================================================================
// УТИЛИТЫ
// ============================================================================

const RoutaUtils = {
  escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  },

  formatDate(date, format = "short") {
    const d = new Date(date);
    if (isNaN(d)) return "—";
    const options = format === "full"
      ? { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }
      : { day: "2-digit", month: "2-digit", year: "numeric" };
    return d.toLocaleDateString("ru-RU", options);
  },

  formatMoney(amount, currency = "₽") {
    return new Intl.NumberFormat("ru-RU").format(amount) + " " + currency;
  },

  debounce(fn, delay) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), delay);
    };
  },

  getCurrentPage() {
    const path = window.location.pathname;
    return path.substring(path.lastIndexOf("/") + 1) || "index.html";
  },

  uuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  },
};

// ============================================================================
// ХРАНИЛИЩЕ
// ============================================================================

const RoutaStorage = {
  get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },

  clear() {
    try {
      localStorage.clear();
      return true;
    } catch {
      return false;
    }
  },
};

// ============================================================================
// АВТОРИЗАЦИЯ
// ============================================================================

const RoutaAuth = {
  getAccessToken() {
    return RoutaStorage.get(ROUTA_CONFIG.TOKEN_KEY);
  },

  getRefreshToken() {
    return RoutaStorage.get(ROUTA_CONFIG.REFRESH_TOKEN_KEY);
  },

  setTokens(accessToken, refreshToken = null) {
    RoutaStorage.set(ROUTA_CONFIG.TOKEN_KEY, accessToken);
    if (refreshToken) {
      RoutaStorage.set(ROUTA_CONFIG.REFRESH_TOKEN_KEY, refreshToken);
    }
  },

  clearSession() {
    RoutaStorage.remove(ROUTA_CONFIG.TOKEN_KEY);
    RoutaStorage.remove(ROUTA_CONFIG.REFRESH_TOKEN_KEY);
    RoutaStorage.remove(ROUTA_CONFIG.USER_KEY);
    RoutaStorage.remove(ROUTA_CONFIG.COMPANY_KEY);
    RoutaStorage.remove(ROUTA_CONFIG.FEATURES_KEY);
  },

  // Алиас для совместимости
  clearTokens() {
    this.clearSession();
  },

  getCachedUser() {
    return RoutaStorage.get(ROUTA_CONFIG.USER_KEY);
  },

  setCachedUser(user) {
    RoutaStorage.set(ROUTA_CONFIG.USER_KEY, user);
  },

  getCachedFeatures() {
    return RoutaStorage.get(ROUTA_CONFIG.FEATURES_KEY, []);
  },

  setCachedFeatures(features) {
    RoutaStorage.set(ROUTA_CONFIG.FEATURES_KEY, features);
  },

  parseJwt(token) {
    try {
      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
      return JSON.parse(jsonPayload);
    } catch {
      return null;
    }
  },

  isTokenExpired(token) {
    const payload = this.parseJwt(token);
    if (!payload || !payload.exp) return true;
    return Date.now() >= payload.exp * 1000;
  },

  isDemoMode() {
    const token = this.getAccessToken();
    return token && token.startsWith("demo_");
  },

  createDemoToken(email, role, edition = "routax", plan = "pro") {
    const payload = { email, role, edition, plan, demo: true };
    return "demo_" + btoa(JSON.stringify(payload));
  },

  parseDemoToken(token) {
    try {
      const payload = JSON.parse(atob(token.replace("demo_", "")));
      return {
        id: "demo-user-" + payload.role,
        email: payload.email,
        role: payload.role,
        company_id: "demo-company",
        edition: payload.edition || "routax",
        plan: payload.plan || "pro",
      };
    } catch {
      return null;
    }
  },

  logout() {
    this.clearSession();
    window.location.href = "./login.html";
  },
};

// ============================================================================
// API КЛИЕНТ
// ============================================================================

const RoutaAPI = {
  async request(endpoint, options = {}) {
    const url = `${ROUTA_CONFIG.API_BASE}${endpoint}`;
    const token = RoutaAuth.getAccessToken();

    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };

    if (token && !RoutaAuth.isDemoMode()) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, { ...options, headers });

      if (response.status === 401) {
        const refreshed = await this.tryRefreshToken();
        if (refreshed) {
          headers.Authorization = `Bearer ${RoutaAuth.getAccessToken()}`;
          const retryResponse = await fetch(url, { ...options, headers });
          if (!retryResponse.ok) throw await this.handleError(retryResponse);
          return await retryResponse.json();
        } else {
          RoutaAuth.logout();
          throw new Error("Сессия истекла");
        }
      }

      if (!response.ok) throw await this.handleError(response);
      return await response.json();
    } catch (error) {
      if (error.name === "TypeError" && error.message.includes("fetch")) {
        throw new Error("Не удалось подключиться к серверу.");
      }
      throw error;
    }
  },

  async handleError(response) {
    let message = `Ошибка ${response.status}`;
    try {
      const data = await response.json();
      message = data.detail || data.message || message;
    } catch {}
    const error = new Error(message);
    error.status = response.status;
    return error;
  },

  async tryRefreshToken() {
    const refreshToken = RoutaAuth.getRefreshToken();
    if (!refreshToken) return false;
    try {
      const response = await fetch(`${ROUTA_CONFIG.API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (response.ok) {
        const data = await response.json();
        RoutaAuth.setTokens(data.access_token, data.refresh_token);
        return true;
      }
    } catch {}
    return false;
  },

  get(endpoint) {
    return this.request(endpoint, { method: "GET" });
  },

  post(endpoint, body) {
    return this.request(endpoint, { method: "POST", body: JSON.stringify(body) });
  },

  patch(endpoint, body) {
    return this.request(endpoint, { method: "PATCH", body: JSON.stringify(body) });
  },

  put(endpoint, body) {
    return this.request(endpoint, { method: "PUT", body: JSON.stringify(body) });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: "DELETE" });
  },

  // Auth methods
  async login(email, password) {
    const demoCreds = {
      "owner@example.com": { password: "owner123", role: "owner", edition: "routax", plan: "pro" },
      "admin@example.com": { password: "admin123", role: "admin", edition: "routax", plan: "pro" },
      "driver@example.com": { password: "driver123", role: "driver", edition: "routas", plan: "start" },
      "platform@example.com": { password: "platform123", role: "platform_admin", edition: null, plan: null },
    };

    const demo = demoCreds[email];

    const loginAsDemo = () => {
      const token = RoutaAuth.createDemoToken(email, demo.role, demo.edition, demo.plan);
      RoutaAuth.setTokens(token, null);
      const user = {
        id: "demo-user-" + demo.role,
        email,
        role: demo.role,
        company_id: demo.role === "platform_admin" ? null : "demo-company",
        edition: demo.edition,
        plan: demo.plan,
      };
      RoutaAuth.setCachedUser(user);
      
      // Set features based on edition/plan
      if (demo.edition && demo.plan && EDITION_FEATURES[demo.edition]?.[demo.plan]) {
        RoutaAuth.setCachedFeatures(EDITION_FEATURES[demo.edition][demo.plan]);
      } else if (demo.role === "platform_admin") {
        RoutaAuth.setCachedFeatures(["saas_tenants", "saas_billing", "saas_usage", "saas_audit", "saas_features", "saas_support"]);
      }
      
      return { success: true, demo: true, access_token: token };
    };

    try {
      const response = await this.post("/auth/login", { email, password });
      RoutaAuth.setTokens(response.access_token, response.refresh_token);
      return { success: true, ...response };
    } catch (error) {
      if (demo && password === demo.password) {
        return loginAsDemo();
      }
      throw error;
    }
  },

  async getMe() {
    if (RoutaAuth.isDemoMode()) {
      const token = RoutaAuth.getAccessToken();
      return RoutaAuth.parseDemoToken(token);
    }
    return this.get("/auth/me");
  },

  async getFeatures() {
    if (RoutaAuth.isDemoMode()) {
      return RoutaAuth.getCachedFeatures();
    }
    try {
      const response = await this.get("/features/me");
      return response.features || [];
    } catch {
      return [];
    }
  },
};

// ============================================================================
// НАВИГАЦИЯ
// ============================================================================

const RoutaNav = {
  generateNavItems(role, features = []) {
    const navConfig = NAV_CONFIG[role];
    if (!navConfig) return [];

    const currentPage = RoutaUtils.getCurrentPage();
    const items = [];

    for (const item of navConfig) {
      // Проверяем feature flag только если есть features
      if (features.length > 0 && item.feature && !features.includes(item.feature)) {
        // Для некоторых features делаем исключения (базовые модули)
        const alwaysAvailable = ["staff", "fleet", "trips", "notifications"];
        if (!alwaysAvailable.includes(item.feature)) {
          continue;
        }
      }

      items.push({
        href: `./${item.page}`,
        title: item.title,
        icon: item.icon,
        active: currentPage === item.page,
      });
    }

    return items;
  },

  renderNav(containerId, role, features = []) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const items = this.generateNavItems(role, features);

    container.innerHTML = items
      .map(
        (item) => `
        <a href="${item.href}" 
           class="nav-pill ${item.active ? "active" : ""}"
           title="${item.title}">
          <i class="fa-solid ${item.icon}"></i>
          <span>${item.title}</span>
        </a>
      `
      )
      .join("");
  },

  checkAccess(role, features = []) {
    const currentPage = RoutaUtils.getCurrentPage();
    const pageConfig = PAGE_ACCESS[currentPage];

    if (!pageConfig) return true;
    if (pageConfig.public) return true;
    if (!pageConfig.roles.includes(role)) return false;

    // Check feature flag
    if (features.length > 0 && pageConfig.feature) {
      const alwaysAvailable = ["staff", "fleet", "trips", "notifications", "driver_dashboard"];
      if (!alwaysAvailable.includes(pageConfig.feature) && !features.includes(pageConfig.feature)) {
        return false;
      }
    }

    return true;
  },

  getDefaultPage(role) {
    switch (role) {
      case "platform_admin":
        return "./saas-tenants.html";
      case "support":
        return "./saas-support.html";
      case "driver":
        return "./driver.html";
      case "owner":
        return "./staff.html";
      default:
        return "./fleet.html";
    }
  },

  redirectByRole(role) {
    window.location.href = this.getDefaultPage(role);
  },
};

// ============================================================================
// ТЕМА
// ============================================================================

const RoutaTheme = {
  apply(theme) {
    const isLight = theme === "light";
    document.documentElement.setAttribute("data-theme", theme);
    document.body.classList.toggle("theme-light", isLight);
    document.documentElement.classList.toggle("theme-light", isLight);
    document.documentElement.style.colorScheme = isLight ? "light" : "dark";

    const toggle = document.querySelector(".theme-toggle-track");
    if (toggle) {
      toggle.classList.toggle("light", isLight);
    }

    RoutaStorage.set(ROUTA_CONFIG.THEME_KEY, theme);
  },

  load() {
    const savedTheme = RoutaStorage.get(ROUTA_CONFIG.THEME_KEY, ROUTA_CONFIG.DEFAULT_THEME);
    this.apply(savedTheme);
    return savedTheme;
  },

  toggle() {
    const current = RoutaStorage.get(ROUTA_CONFIG.THEME_KEY, ROUTA_CONFIG.DEFAULT_THEME);
    const newTheme = current === "dark" ? "light" : "dark";
    this.apply(newTheme);
    return newTheme;
  },

  get() {
    return RoutaStorage.get(ROUTA_CONFIG.THEME_KEY, ROUTA_CONFIG.DEFAULT_THEME);
  },
};

// ============================================================================
// UI КОМПОНЕНТЫ
// ============================================================================

const RoutaUI = {
  toast(message, type = "info", duration = 3000) {
    const container = document.getElementById("toast-container") || this.createToastContainer();

    const toast = document.createElement("div");
    toast.className = `routa-toast routa-toast-${type}`;
    toast.innerHTML = `
      <i class="fa-solid ${this.getToastIcon(type)}"></i>
      <span>${RoutaUtils.escapeHtml(message)}</span>
      <button class="toast-close" onclick="this.parentElement.remove()">
        <i class="fa-solid fa-xmark"></i>
      </button>
    `;

    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));

    if (duration > 0) {
      setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 300);
      }, duration);
    }

    return toast;
  },

  createToastContainer() {
    const container = document.createElement("div");
    container.id = "toast-container";
    container.className = "routa-toast-container";
    document.body.appendChild(container);
    return container;
  },

  getToastIcon(type) {
    const icons = {
      success: "fa-check-circle",
      error: "fa-exclamation-circle",
      warning: "fa-exclamation-triangle",
      info: "fa-info-circle",
    };
    return icons[type] || icons.info;
  },

  modal(options) {
    const { title, content, buttons = [], size = "md", closable = true } = options;

    const overlay = document.createElement("div");
    overlay.className = "routa-modal-overlay";
    overlay.innerHTML = `
      <div class="routa-modal routa-modal-${size}">
        <div class="routa-modal-header">
          <h3>${RoutaUtils.escapeHtml(title)}</h3>
          ${closable ? '<button class="routa-modal-close"><i class="fa-solid fa-xmark"></i></button>' : ""}
        </div>
        <div class="routa-modal-body">${content}</div>
        ${buttons.length ? `<div class="routa-modal-footer">${buttons.map((btn, i) => `
          <button class="btn ${btn.class || "btn-secondary"}" data-action="${i}">
            ${btn.icon ? `<i class="fa-solid ${btn.icon}"></i>` : ""}
            ${btn.text}
          </button>
        `).join("")}</div>` : ""}
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("show"));

    const close = () => {
      overlay.classList.remove("show");
      setTimeout(() => overlay.remove(), 300);
    };

    if (closable) {
      overlay.querySelector(".routa-modal-close")?.addEventListener("click", close);
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) close();
      });
    }

    buttons.forEach((btn, i) => {
      overlay.querySelector(`[data-action="${i}"]`)?.addEventListener("click", () => {
        if (btn.onClick) btn.onClick(close);
        else close();
      });
    });

    return { close, overlay };
  },

  confirm(message, onConfirm, onCancel) {
    return this.modal({
      title: "Подтверждение",
      content: `<p>${RoutaUtils.escapeHtml(message)}</p>`,
      buttons: [
        { text: "Отмена", class: "btn-secondary", onClick: (close) => { close(); onCancel?.(); } },
        { text: "Подтвердить", class: "btn-primary", onClick: (close) => { close(); onConfirm?.(); } },
      ],
    });
  },

  updateRoleBadge(role, edition = null) {
    const badge = document.getElementById("roleBadge");
    if (!badge || !role) return;

    const roleConfig = ROLES[role] || ROLES.admin;
    const editionConfig = edition ? EDITIONS[edition] : null;

    badge.className = `role-badge ${roleConfig.color}`;
    badge.innerHTML = `
      <i class="fa-solid ${roleConfig.icon}"></i>
      <span id="roleText">${roleConfig.displayName}</span>
      ${editionConfig ? `<span class="edition-tag" style="background: ${editionConfig.color}20; color: ${editionConfig.color}">${editionConfig.name}</span>` : ""}
    `;
  },

  updateEditionBadge(edition, plan) {
    const editionBadge = document.getElementById("editionBadge");
    if (!editionBadge) return;

    const editionConfig = EDITIONS[edition];
    const planConfig = PLANS[plan];

    if (editionConfig) {
      editionBadge.innerHTML = `
        <i class="fa-solid ${editionConfig.icon}" style="color: ${editionConfig.color}"></i>
        <span>${editionConfig.name}</span>
        ${planConfig ? `<span class="plan-tag">${planConfig.name}</span>` : ""}
      `;
      editionBadge.style.display = "flex";
    } else {
      editionBadge.style.display = "none";
    }
  },

  showLoading(container) {
    const el = typeof container === "string" ? document.getElementById(container) : container;
    if (!el) return;

    el.innerHTML = `
      <div class="routa-loading">
        <div class="routa-spinner"></div>
        <span>Загрузка...</span>
      </div>
    `;
  },

  showError(container, message) {
    const el = typeof container === "string" ? document.getElementById(container) : container;
    if (!el) return;

    el.innerHTML = `
      <div class="routa-error">
        <i class="fa-solid fa-exclamation-triangle"></i>
        <span>${RoutaUtils.escapeHtml(message)}</span>
      </div>
    `;
  },

  showAccessDenied(message = "У вас нет доступа к этому разделу") {
    document.body.innerHTML = `
      <div class="access-denied-screen">
        <div class="access-denied-card">
          <i class="fa-solid fa-lock"></i>
          <h2>Нет доступа</h2>
          <p>${RoutaUtils.escapeHtml(message)}</p>
          <button class="btn btn-primary" onclick="Routa.Nav.redirectByRole(Routa.App.user?.role || 'admin')">
            Перейти на доступный раздел
          </button>
        </div>
      </div>
    `;
  },
};

// ============================================================================
// ПРИЛОЖЕНИЕ
// ============================================================================

const RoutaApp = {
  user: null,
  features: [],
  initialized: false,

  async init(options = {}) {
    if (this.initialized) return this.user;

    const { requireAuth = true, allowRoles = null, currentPage = null } = options;

    // Применяем тему ДО рендера (предотвращает мигание)
    RoutaTheme.load();

    // Проверка публичной страницы
    const page = currentPage || RoutaUtils.getCurrentPage();
    const pageConfig = PAGE_ACCESS[page];

    if (pageConfig?.public) {
      this.initialized = true;
      return null;
    }

    // Проверка авторизации
    if (requireAuth) {
      const token = RoutaAuth.getAccessToken();

      if (!token) {
        window.location.href = "./login.html";
        return null;
      }

      try {
        this.user = await RoutaAPI.getMe();
        RoutaAuth.setCachedUser(this.user);

        // Получаем features
        this.features = await RoutaAPI.getFeatures();
        RoutaAuth.setCachedFeatures(this.features);
      } catch (error) {
        console.error("Auth error:", error);
        RoutaAuth.logout();
        return null;
      }

      // Проверка доступа к странице
      if (!RoutaNav.checkAccess(this.user.role, this.features)) {
        RoutaUI.showAccessDenied();
        return null;
      }

      // Проверка разрешённых ролей
      if (allowRoles && !allowRoles.includes(this.user.role)) {
        RoutaNav.redirectByRole(this.user.role);
        return null;
      }

      // Обновляем UI
      this.updateUI();
    }

    // Инициализация обработчиков
    this.initHandlers();

    this.initialized = true;
    return this.user;
  },

  updateUI() {
    if (!this.user) return;

    // Навигация
    RoutaNav.renderNav("mainNav", this.user.role, this.features);

    // Бейдж роли
    RoutaUI.updateRoleBadge(this.user.role, this.user.edition);

    // Бейдж издания
    if (this.user.edition) {
      RoutaUI.updateEditionBadge(this.user.edition, this.user.plan);
    }

    // Имя пользователя
    const userNameEl = document.getElementById("userName");
    if (userNameEl) {
      userNameEl.textContent = this.user.email?.split("@")[0] || "Пользователь";
    }
  },

  initHandlers() {
    // Переключение темы
    document.querySelectorAll(".theme-toggle-track, #themeToggle").forEach((el) => {
      el.addEventListener("click", () => RoutaTheme.toggle());
    });

    // Выход
    document.querySelectorAll("[onclick*='logout'], .logout-btn").forEach((el) => {
      el.onclick = (e) => {
        e.preventDefault();
        RoutaAuth.logout();
      };
    });

    // Глобальные функции
    window.logout = () => RoutaAuth.logout();
    window.toggleTheme = () => RoutaTheme.toggle();
  },

  getUser() {
    return this.user;
  },

  getFeatures() {
    return this.features;
  },

  hasFeature(feature) {
    return this.features.includes(feature);
  },

  hasRole(role) {
    return this.user?.role === role;
  },

  hasMinRole(role) {
    if (!this.user) return false;
    const userLevel = ROLES[this.user.role]?.level || 0;
    const requiredLevel = ROLES[role]?.level || 0;
    return userLevel >= requiredLevel;
  },

  isOwnerOrAdmin() {
    return this.hasRole("owner") || this.hasRole("admin");
  },

  isPlatformRole() {
    return ROLES[this.user?.role]?.platform === true;
  },
};

// ============================================================================
// ГЛОБАЛЬНЫЙ ЭКСПОРТ
// ============================================================================

window.Routa = {
  Config: ROUTA_CONFIG,
  Editions: EDITIONS,
  Plans: PLANS,
  Roles: ROLES,
  NavConfig: NAV_CONFIG,
  PageAccess: PAGE_ACCESS,
  EditionFeatures: EDITION_FEATURES,
  Utils: RoutaUtils,
  Storage: RoutaStorage,
  Auth: RoutaAuth,
  API: RoutaAPI,
  Nav: RoutaNav,
  Theme: RoutaTheme,
  UI: RoutaUI,
  App: RoutaApp,
};

// Совместимость со старым RoutoX API
window.RoutoX = window.Routa;

// Автоинициализация темы
document.addEventListener("DOMContentLoaded", () => {
  RoutaTheme.load();
});

// Применить тему немедленно (до DOMContentLoaded)
(function() {
  const theme = localStorage.getItem("routa_theme") || localStorage.getItem("routox_theme");
  if (theme) {
    try {
      const parsed = JSON.parse(theme);
      document.documentElement.setAttribute("data-theme", parsed);
    } catch {
      document.documentElement.setAttribute("data-theme", theme);
    }
  }
})();

console.log("🚛 Routa Platform Core loaded");
