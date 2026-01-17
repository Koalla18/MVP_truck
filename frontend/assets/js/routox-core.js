/**
 * RoutoX Core - Центральный модуль управления приложением
 * Навигация, роли, авторизация, UI компоненты
 */

// ============================================================================
// КОНФИГУРАЦИЯ
// ============================================================================

const ROUTOX_CONFIG = {
  API_BASE: window.location.port === "8080" ? "/api/v1" : "http://localhost:8000/api/v1",
  TOKEN_KEY: "routox_access_token",
  REFRESH_TOKEN_KEY: "routox_refresh_token",
  USER_KEY: "routox_user",
  THEME_KEY: "routox_theme",
  SETTINGS_KEY: "routox_settings",
  TOKEN_REFRESH_THRESHOLD: 5 * 60 * 1000, // Обновлять за 5 минут до истечения
};

// ============================================================================
// РОЛИ И ПРАВА ДОСТУПА
// ============================================================================

const ROLES = {
  owner: {
    name: "Владелец",
    icon: "fa-crown",
    color: "purple",
    level: 100,
  },
  admin: {
    name: "Администратор",
    icon: "fa-user-gear",
    color: "blue",
    level: 50,
  },
  driver: {
    name: "Водитель",
    icon: "fa-id-card",
    color: "green",
    level: 10,
  },
};

// Определение страниц и прав доступа
// Порядок определяет порядок отображения в навигации
const PAGES = {
  // Только для владельца - первым в навигации
  "staff.html": { roles: ["owner"], title: "Персонал", icon: "fa-users", nav: true, order: 1 },
  
  // Общие для owner и admin (в указанном порядке)
  "fleet.html": { roles: ["owner", "admin"], title: "Флот", icon: "fa-truck", nav: true, order: 2 },
  "trips.html": { roles: ["owner", "admin"], title: "Рейсы", icon: "fa-route", nav: true, order: 3 },
  "geozones.html": { roles: ["owner", "admin"], title: "Геозоны", icon: "fa-map-location-dot", nav: true, order: 4 },
  "analytics.html": { roles: ["owner", "admin"], title: "Аналитика", icon: "fa-chart-line", nav: true, order: 5 },
  "fuel.html": { roles: ["owner", "admin"], title: "Топливо", icon: "fa-gas-pump", nav: true, order: 6 },
  "maintenance.html": { roles: ["owner", "admin"], title: "ТО", icon: "fa-wrench", nav: true, order: 7 },
  "documents.html": { roles: ["owner", "admin"], title: "Документы", icon: "fa-file-lines", nav: true, order: 8 },
  "inventory.html": { roles: ["owner", "admin"], title: "Инвентарь", icon: "fa-boxes-stacked", nav: true, order: 9 },
  
  // Старые страницы (перенаправим на новые)
  "index.html": { roles: ["owner", "admin"], title: "Флот", icon: "fa-truck", nav: false, redirect: "fleet.html" },
  "owner.html": { roles: ["owner"], title: "Персонал", icon: "fa-users", nav: false, redirect: "staff.html" },
  
  // Страницы для водителей
  "driver.html": { roles: ["driver"], title: "Кабинет водителя", icon: "fa-steering-wheel", nav: false },
  "driver-new.html": { roles: ["driver"], title: "Новый рейс", icon: "fa-plus", nav: false },
  
  // Публичные страницы
  "login.html": { roles: [], title: "Вход", icon: "fa-sign-in", nav: false, public: true },
  "landing.html": { roles: [], title: "RoutoX", icon: "fa-home", nav: false, public: true },
  
  // Дополнительные страницы
  "notifications.html": { roles: ["owner", "admin", "driver"], title: "Уведомления", icon: "fa-bell", nav: false },
  "crm.html": { roles: ["owner", "admin"], title: "CRM", icon: "fa-address-book", nav: false },
  "admin-dashboard.html": { roles: ["owner"], title: "Админ-панель", icon: "fa-shield", nav: false },
};

// ============================================================================
// УТИЛИТЫ
// ============================================================================

const RoutoXUtils = {
  // Экранирование HTML
  escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  },

  // Форматирование даты
  formatDate(date, format = "short") {
    const d = new Date(date);
    if (isNaN(d)) return "—";
    
    const options = format === "full" 
      ? { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }
      : { day: "2-digit", month: "2-digit", year: "numeric" };
    
    return d.toLocaleDateString("ru-RU", options);
  },

  // Форматирование денег
  formatMoney(amount, currency = "₽") {
    return new Intl.NumberFormat("ru-RU").format(amount) + " " + currency;
  },

  // Дебаунс
  debounce(fn, delay) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), delay);
    };
  },

  // Получение текущей страницы
  getCurrentPage() {
    const path = window.location.pathname;
    return path.substring(path.lastIndexOf("/") + 1) || "index.html";
  },

  // Генерация UUID
  uuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  },
};

// ============================================================================
// ХРАНИЛИЩЕ (LocalStorage с обработкой ошибок)
// ============================================================================

const RoutoXStorage = {
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

const RoutoXAuth = {
  // Получение токена
  getAccessToken() {
    return RoutoXStorage.get(ROUTOX_CONFIG.TOKEN_KEY);
  },

  getRefreshToken() {
    return RoutoXStorage.get(ROUTOX_CONFIG.REFRESH_TOKEN_KEY);
  },

  // Сохранение токенов
  setTokens(accessToken, refreshToken = null) {
    RoutoXStorage.set(ROUTOX_CONFIG.TOKEN_KEY, accessToken);
    if (refreshToken) {
      RoutoXStorage.set(ROUTOX_CONFIG.REFRESH_TOKEN_KEY, refreshToken);
    }
  },

  // Очистка токенов
  clearTokens() {
    RoutoXStorage.remove(ROUTOX_CONFIG.TOKEN_KEY);
    RoutoXStorage.remove(ROUTOX_CONFIG.REFRESH_TOKEN_KEY);
    RoutoXStorage.remove(ROUTOX_CONFIG.USER_KEY);
  },

  // Получение пользователя из кэша
  getCachedUser() {
    return RoutoXStorage.get(ROUTOX_CONFIG.USER_KEY);
  },

  // Сохранение пользователя в кэш
  setCachedUser(user) {
    RoutoXStorage.set(ROUTOX_CONFIG.USER_KEY, user);
  },

  // Парсинг JWT токена
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

  // Проверка истечения токена
  isTokenExpired(token) {
    const payload = this.parseJwt(token);
    if (!payload || !payload.exp) return true;
    return Date.now() >= payload.exp * 1000;
  },

  // Проверка необходимости обновления токена
  shouldRefreshToken(token) {
    const payload = this.parseJwt(token);
    if (!payload || !payload.exp) return true;
    return Date.now() >= payload.exp * 1000 - ROUTOX_CONFIG.TOKEN_REFRESH_THRESHOLD;
  },

  // Проверка демо-режима
  isDemoMode() {
    const token = this.getAccessToken();
    return token && token.startsWith("demo_");
  },

  // Создание демо-токена
  createDemoToken(email, role) {
    const payload = { email, role, demo: true };
    return "demo_" + btoa(JSON.stringify(payload));
  },

  // Парсинг демо-токена
  parseDemoToken(token) {
    try {
      const payload = JSON.parse(atob(token.replace("demo_", "")));
      return {
        id: "demo-user-" + payload.role,
        email: payload.email,
        role: payload.role,
        company_id: "demo-company",
      };
    } catch {
      return null;
    }
  },

  // Выход
  logout() {
    this.clearTokens();
    window.location.href = "./login.html";
  },
};

// ============================================================================
// API КЛИЕНТ
// ============================================================================

const RoutoXAPI = {
  // Базовый запрос
  async request(endpoint, options = {}) {
    const url = `${ROUTOX_CONFIG.API_BASE}${endpoint}`;
    const token = RoutoXAuth.getAccessToken();

    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };

    if (token && !RoutoXAuth.isDemoMode()) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Обработка 401 - попытка обновить токен
      if (response.status === 401) {
        const refreshed = await this.tryRefreshToken();
        if (refreshed) {
          // Повторяем запрос с новым токеном
          headers.Authorization = `Bearer ${RoutoXAuth.getAccessToken()}`;
          const retryResponse = await fetch(url, { ...options, headers });
          if (!retryResponse.ok) {
            throw await this.handleError(retryResponse);
          }
          return await retryResponse.json();
        } else {
          RoutoXAuth.logout();
          throw new Error("Сессия истекла");
        }
      }

      if (!response.ok) {
        throw await this.handleError(response);
      }

      return await response.json();
    } catch (error) {
      if (error.name === "TypeError" && error.message.includes("fetch")) {
        throw new Error("Не удалось подключиться к серверу. Проверьте, что backend запущен.");
      }
      throw error;
    }
  },

  // Обработка ошибок
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

  // Попытка обновить токен
  async tryRefreshToken() {
    const refreshToken = RoutoXAuth.getRefreshToken();
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${ROUTOX_CONFIG.API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        RoutoXAuth.setTokens(data.access_token, data.refresh_token);
        return true;
      }
    } catch {}

    return false;
  },

  // Методы API
  get(endpoint) {
    return this.request(endpoint, { method: "GET" });
  },

  post(endpoint, body) {
    return this.request(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  patch(endpoint, body) {
    return this.request(endpoint, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  put(endpoint, body) {
    return this.request(endpoint, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: "DELETE" });
  },

  // Специфические методы
  async login(email, password) {
    const demoCreds = {
      "owner@example.com": { password: "owner123", role: "owner" },
      "admin@example.com": { password: "admin123", role: "admin" },
      "driver@example.com": { password: "driver123", role: "driver" },
    };

    const demo = demoCreds[email];

    const loginAsDemo = () => {
      const token = RoutoXAuth.createDemoToken(email, demo.role);
      RoutoXAuth.setTokens(token, null);
      RoutoXAuth.setCachedUser({
        id: "demo-user-" + demo.role,
        email,
        role: demo.role,
        company_id: "demo-company",
      });
      return { success: true, demo: true, access_token: token, refresh_token: null };
    };

    try {
      const response = await this.post("/auth/login", { email, password });
      RoutoXAuth.setTokens(response.access_token, response.refresh_token);
      return { success: true, ...response };
    } catch (error) {
      // If API is unreachable / CORS / demo users not seeded yet, allow demo login.
      if (demo && password === demo.password) {
        return loginAsDemo();
      }
      throw error;
    }
  },

  async register(data) {
    const response = await this.post("/auth/register", data);
    return response;
  },

  async getMe() {
    // Проверка демо-режима
    if (RoutoXAuth.isDemoMode()) {
      const token = RoutoXAuth.getAccessToken();
      return RoutoXAuth.parseDemoToken(token);
    }
    return this.get("/auth/me");
  },

  async requestPasswordReset(email) {
    return this.post("/auth/password-reset/request", { email });
  },

  async resetPassword(token, newPassword) {
    return this.post("/auth/password-reset/confirm", { token, new_password: newPassword });
  },
};

// ============================================================================
// НАВИГАЦИЯ
// ============================================================================

const RoutoXNav = {
  // Генерация навигации на основе роли
  generateNavItems(role) {
    const items = [];
    const currentPage = RoutoXUtils.getCurrentPage();

    for (const [page, config] of Object.entries(PAGES)) {
      if (!config.nav) continue;
      if (!config.roles.includes(role)) continue;

      items.push({
        href: `./${page}`,
        title: config.title,
        icon: config.icon,
        active: currentPage === page,
        ownerOnly: config.ownerOnly || false,
        order: config.order || 999,
      });
    }

    // Сортировка по order для правильного порядка
    items.sort((a, b) => a.order - b.order);

    return items;
  },

  // Рендеринг навигации
  renderNav(containerId, role) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const items = this.generateNavItems(role);

    container.innerHTML = items
      .map(
        (item) => `
        <a href="${item.href}" 
           class="nav-pill ${item.active ? "active" : ""} ${item.ownerOnly ? "owner-only" : ""}"
           title="${item.title}">
          <i class="fa-solid ${item.icon}"></i>
          <span>${item.title}</span>
        </a>
      `
      )
      .join("");
  },

  // Проверка доступа к странице
  checkAccess(role) {
    const currentPage = RoutoXUtils.getCurrentPage();
    const pageConfig = PAGES[currentPage];

    if (!pageConfig) return true; // Страница не в списке - разрешаем
    if (pageConfig.public) return true; // Публичная страница
    if (pageConfig.roles.length === 0) return true; // Нет ограничений

    return pageConfig.roles.includes(role);
  },

  // Редирект на правильную страницу по роли
  redirectByRole(role) {
    switch (role) {
      case "driver":
        window.location.href = "./driver.html";
        break;
      case "owner":
        window.location.href = "./staff.html"; // Персонал - первая страница владельца
        break;
      default:
        window.location.href = "./fleet.html"; // Флот - первая страница админа
    }
  },
};

// ============================================================================
// ТЕМЫ И UI
// ============================================================================

const RoutoXTheme = {
  // Применение темы
  apply(theme) {
    const isLight = theme === "light";
    document.documentElement.setAttribute("data-theme", theme);
    document.body.classList.toggle("theme-light", isLight);
    document.documentElement.classList.toggle("theme-light", isLight);
    document.documentElement.style.colorScheme = isLight ? "light" : "dark";

    // Обновление переключателя
    const toggle = document.querySelector(".theme-toggle-track");
    if (toggle) {
      toggle.classList.toggle("light", isLight);
    }

    RoutoXStorage.set(ROUTOX_CONFIG.THEME_KEY, theme);
  },

  // Загрузка сохранённой темы (по умолчанию - светлая)
  load() {
    const savedTheme = RoutoXStorage.get(ROUTOX_CONFIG.THEME_KEY, "light");
    this.apply(savedTheme);
    return savedTheme;
  },

  // Переключение темы
  toggle() {
    const current = RoutoXStorage.get(ROUTOX_CONFIG.THEME_KEY, "light");
    const newTheme = current === "dark" ? "light" : "dark";
    this.apply(newTheme);
    return newTheme;
  },
};

// ============================================================================
// UI КОМПОНЕНТЫ
// ============================================================================

const RoutoXUI = {
  // Показать уведомление (toast)
  toast(message, type = "info", duration = 3000) {
    const container = document.getElementById("toast-container") || this.createToastContainer();

    const toast = document.createElement("div");
    toast.className = `routox-toast routox-toast-${type}`;
    toast.innerHTML = `
      <i class="fa-solid ${this.getToastIcon(type)}"></i>
      <span>${RoutoXUtils.escapeHtml(message)}</span>
      <button class="toast-close" onclick="this.parentElement.remove()">
        <i class="fa-solid fa-xmark"></i>
      </button>
    `;

    container.appendChild(toast);

    // Анимация появления
    requestAnimationFrame(() => toast.classList.add("show"));

    // Автоудаление
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
    container.className = "routox-toast-container";
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

  // Показать модальное окно
  modal(options) {
    const { title, content, buttons = [], size = "md", closable = true } = options;

    const overlay = document.createElement("div");
    overlay.className = "routox-modal-overlay";
    overlay.innerHTML = `
      <div class="routox-modal routox-modal-${size}">
        <div class="routox-modal-header">
          <h3>${RoutoXUtils.escapeHtml(title)}</h3>
          ${closable ? '<button class="routox-modal-close"><i class="fa-solid fa-xmark"></i></button>' : ""}
        </div>
        <div class="routox-modal-body">${content}</div>
        ${
          buttons.length
            ? `<div class="routox-modal-footer">${buttons
                .map(
                  (btn, i) => `
                <button class="btn ${btn.class || "btn-secondary"}" data-action="${i}">
                  ${btn.icon ? `<i class="fa-solid ${btn.icon}"></i>` : ""}
                  ${btn.text}
                </button>
              `
                )
                .join("")}</div>`
            : ""
        }
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("show"));

    // Обработчики
    const close = () => {
      overlay.classList.remove("show");
      setTimeout(() => overlay.remove(), 300);
    };

    if (closable) {
      overlay.querySelector(".routox-modal-close")?.addEventListener("click", close);
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

  // Подтверждение действия
  confirm(message, onConfirm, onCancel) {
    return this.modal({
      title: "Подтверждение",
      content: `<p>${RoutoXUtils.escapeHtml(message)}</p>`,
      buttons: [
        { text: "Отмена", class: "btn-secondary", onClick: (close) => { close(); onCancel?.(); } },
        { text: "Подтвердить", class: "btn-primary", onClick: (close) => { close(); onConfirm?.(); } },
      ],
    });
  },

  // Обновление бейджа роли
  updateRoleBadge(role) {
    const badge = document.getElementById("roleBadge");
    const text = document.getElementById("roleText");
    
    if (!badge || !role) return;

    const roleConfig = ROLES[role] || ROLES.admin;

    badge.className = `role-badge ${roleConfig.color}`;
    badge.innerHTML = `
      <i class="fa-solid ${roleConfig.icon}"></i>
      <span id="roleText">${roleConfig.name}</span>
    `;
  },

  // Показать загрузку
  showLoading(container) {
    const el = typeof container === "string" ? document.getElementById(container) : container;
    if (!el) return;

    el.innerHTML = `
      <div class="routox-loading">
        <div class="routox-spinner"></div>
        <span>Загрузка...</span>
      </div>
    `;
  },

  // Показать ошибку
  showError(container, message) {
    const el = typeof container === "string" ? document.getElementById(container) : container;
    if (!el) return;

    el.innerHTML = `
      <div class="routox-error">
        <i class="fa-solid fa-exclamation-triangle"></i>
        <span>${RoutoXUtils.escapeHtml(message)}</span>
      </div>
    `;
  },
};

// ============================================================================
// ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
// ============================================================================

const RoutoXApp = {
  user: null,
  initialized: false,

  // Главная инициализация
  async init(options = {}) {
    if (this.initialized) return this.user;

    const { requireAuth = true, allowRoles = null } = options;

    // Загрузка темы
    RoutoXTheme.load();

    // Проверка публичной страницы
    const currentPage = RoutoXUtils.getCurrentPage();
    const pageConfig = PAGES[currentPage];
    
    if (pageConfig?.public) {
      this.initialized = true;
      return null;
    }

    // Проверка авторизации
    if (requireAuth) {
      const token = RoutoXAuth.getAccessToken();
      
      if (!token) {
        window.location.href = "./login.html";
        return null;
      }

      // Получение данных пользователя
      try {
        this.user = await RoutoXAPI.getMe();
        RoutoXAuth.setCachedUser(this.user);
      } catch (error) {
        console.error("Auth error:", error);
        RoutoXAuth.logout();
        return null;
      }

      // Проверка роли
      if (!RoutoXNav.checkAccess(this.user.role)) {
        RoutoXNav.redirectByRole(this.user.role);
        return null;
      }

      // Проверка разрешённых ролей
      if (allowRoles && !allowRoles.includes(this.user.role)) {
        RoutoXNav.redirectByRole(this.user.role);
        return null;
      }

      // Обновление UI
      this.updateUI();
    }

    // Инициализация обработчиков
    this.initHandlers();

    this.initialized = true;
    return this.user;
  },

  // Обновление UI на основе пользователя
  updateUI() {
    if (!this.user) return;

    // Навигация
    RoutoXNav.renderNav("mainNav", this.user.role);

    // Бейдж роли
    RoutoXUI.updateRoleBadge(this.user.role);

    // Имя пользователя
    const userNameEl = document.getElementById("userName");
    if (userNameEl) {
      userNameEl.textContent = this.user.email?.split("@")[0] || "Пользователь";
    }
  },

  // Инициализация обработчиков
  initHandlers() {
    // Переключение темы
    document.querySelectorAll(".theme-toggle-track, #themeToggle").forEach((el) => {
      el.addEventListener("click", () => RoutoXTheme.toggle());
    });

    // Выход
    document.querySelectorAll("[onclick*='logout'], .logout-btn").forEach((el) => {
      el.onclick = (e) => {
        e.preventDefault();
        RoutoXAuth.logout();
      };
    });

    // Глобальная функция для совместимости
    window.logout = () => RoutoXAuth.logout();
    window.toggleTheme = () => RoutoXTheme.toggle();
  },

  // Быстрый доступ к пользователю
  getUser() {
    return this.user;
  },

  // Проверка роли
  hasRole(role) {
    return this.user?.role === role;
  },

  // Проверка минимального уровня роли
  hasMinRole(role) {
    if (!this.user) return false;
    const userLevel = ROLES[this.user.role]?.level || 0;
    const requiredLevel = ROLES[role]?.level || 0;
    return userLevel >= requiredLevel;
  },
};

// ============================================================================
// ГЛОБАЛЬНЫЙ ЭКСПОРТ
// ============================================================================

window.RoutoX = {
  Config: ROUTOX_CONFIG,
  Roles: ROLES,
  Pages: PAGES,
  Utils: RoutoXUtils,
  Storage: RoutoXStorage,
  Auth: RoutoXAuth,
  API: RoutoXAPI,
  Nav: RoutoXNav,
  Theme: RoutoXTheme,
  UI: RoutoXUI,
  App: RoutoXApp,
};

// Совместимость со старым кодом
window.routoxGetToken = () => RoutoXAuth.getAccessToken();
window.routoxClearToken = () => RoutoXAuth.clearTokens();
window.logout = () => RoutoXAuth.logout();
window.toggleTheme = () => RoutoXTheme.toggle();

// Автоинициализация при загрузке DOM
document.addEventListener("DOMContentLoaded", () => {
  // Базовая инициализация темы
  RoutoXTheme.load();
});

console.log("🚛 RoutoX Core loaded");
