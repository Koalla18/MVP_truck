/**
 * RoutoX Unified JavaScript
 * Общий JavaScript для всех страниц платформы
 * v2.0
 */

// ========== Theme Management ==========
// Use same key as routa-core.js for consistency
const THEME_KEY = 'routa_theme';

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  document.body.classList.toggle('theme-light', saved === 'light');
  document.documentElement.style.colorScheme = saved === 'light' ? 'light' : 'dark';
  
  // Update toggle visual
  const toggle = document.querySelector('.theme-toggle-track');
  if (toggle) {
    toggle.classList.toggle('light', saved === 'light');
  }
  
  return saved;
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  document.body.classList.toggle('theme-light', next === 'light');
  document.documentElement.style.colorScheme = next === 'light' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, next);
  
  // Update toggle visual
  const toggle = document.querySelector('.theme-toggle-track');
  if (toggle) {
    toggle.classList.toggle('light', next === 'light');
  }
  
  // Dispatch custom event for components that need to react
  window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: next } }));
  
  return next;
}

function isDarkTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

// ========== Chart Colors ==========
function getChartColors() {
  const isDark = isDarkTheme();
  return {
    gridColor: isDark ? 'rgba(71, 85, 105, 0.2)' : 'rgba(226, 232, 240, 0.8)',
    textColor: isDark ? '#94a3b8' : '#64748b',
    tooltipBg: isDark ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.95)',
    tooltipText: isDark ? '#fff' : '#1e293b',
    // Brand colors
    blue: '#3b82f6',
    emerald: '#10b981',
    purple: '#8b5cf6',
    amber: '#f59e0b',
    rose: '#f43f5e',
    cyan: '#06b6d4'
  };
}

// ========== Notification System ==========
function showNotification(message, type = 'success') {
  const colors = {
    success: { bg: 'emerald', icon: 'check' },
    error: { bg: 'red', icon: 'xmark' },
    warning: { bg: 'amber', icon: 'exclamation' },
    info: { bg: 'blue', icon: 'info' }
  };
  
  const { bg, icon } = colors[type] || colors.success;
  
  const notif = document.createElement('div');
  notif.className = `fixed bottom-4 right-4 glass-panel px-4 py-3 flex items-center gap-3 z-50`;
  notif.style.cssText = 'animation: slideUp 0.3s ease;';
  notif.innerHTML = `
    <div class="w-8 h-8 rounded-lg bg-${bg}-500/20 flex items-center justify-center">
      <i class="fa-solid fa-${icon} text-${bg}-500"></i>
    </div>
    <span class="font-medium">${message}</span>
  `;
  
  document.body.appendChild(notif);
  
  setTimeout(() => {
    notif.style.opacity = '0';
    notif.style.transform = 'translateY(20px)';
    setTimeout(() => notif.remove(), 300);
  }, 3000);
}

// ========== Modal Management ==========
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

// Close modals on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-backdrop.active').forEach(modal => {
      modal.classList.remove('active');
    });
    document.body.style.overflow = '';
  }
});

// ========== Number Formatting ==========
function formatCurrency(value, currency = '₽') {
  if (value >= 1000000) {
    return `${currency} ${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `${currency} ${(value / 1000).toFixed(1)}K`;
  }
  return `${currency} ${value.toLocaleString('ru-RU')}`;
}

function formatNumber(value) {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toLocaleString('ru-RU');
}

function formatPercent(value) {
  return `${value.toFixed(1)}%`;
}

// ========== Date/Time Formatting ==========
function formatDateTime(date) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function formatRelativeTime(date) {
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'только что';
  if (minutes < 60) return `${minutes} мин назад`;
  if (hours < 24) return `${hours} ч назад`;
  if (days < 7) return `${days} дн назад`;
  
  return formatDateTime(date);
}

// ========== Random Data Generators (for demo) ==========
function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFromArray(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Sample Russian names for demo
const SAMPLE_NAMES = [
  'Иванов Алексей', 'Петров Сергей', 'Сидоров Михаил', 'Козлов Дмитрий',
  'Новиков Андрей', 'Морозов Николай', 'Волков Виктор', 'Соколов Игорь',
  'Кузнецов Максим', 'Попов Артём', 'Лебедев Роман', 'Семёнов Павел'
];

const SAMPLE_CITIES = [
  'Москва', 'Санкт-Петербург', 'Казань', 'Екатеринбург', 'Новосибирск',
  'Нижний Новгород', 'Самара', 'Ростов-на-Дону', 'Краснодар', 'Воронеж'
];

// ========== Truck Plates Generator ==========
function generateTruckPlate() {
  const letters = 'АВЕКМНОРСТУХ';
  const l1 = letters[randomBetween(0, letters.length - 1)];
  const l2 = letters[randomBetween(0, letters.length - 1)];
  const l3 = letters[randomBetween(0, letters.length - 1)];
  const num = String(randomBetween(100, 999));
  const region = randomFromArray(['77', '78', '16', '50', '52', '23', '61', '63']);
  return `${l1}${num}${l2}${l3} ${region}`;
}

// ========== Random Avatar Photo URLs ==========
function getRandomAvatarUrl(gender = 'men', index = null) {
  const id = index !== null ? index : randomBetween(1, 99);
  return `https://randomuser.me/api/portraits/${gender}/${id}.jpg`;
}

// ========== Tab Switching ==========
function initTabs(containerSelector = '.tab-btn') {
  document.querySelectorAll(containerSelector).forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      
      // Deactivate all tabs
      document.querySelectorAll(containerSelector).forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      // Activate clicked tab
      btn.classList.add('active');
      const content = document.getElementById(tabId) || document.getElementById(`tab-${tabId}`);
      if (content) content.classList.add('active');
    });
  });
}

// ========== Drag & Drop Utilities ==========
let draggedElement = null;

function initDragDrop(itemSelector, containerSelector, onDrop) {
  document.querySelectorAll(itemSelector).forEach(item => {
    item.addEventListener('dragstart', (e) => {
      draggedElement = e.target;
      e.target.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    
    item.addEventListener('dragend', (e) => {
      e.target.classList.remove('dragging');
      document.querySelectorAll(containerSelector).forEach(c => c.classList.remove('drag-over'));
    });
  });
  
  document.querySelectorAll(containerSelector).forEach(container => {
    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      container.classList.add('drag-over');
    });
    
    container.addEventListener('dragleave', (e) => {
      container.classList.remove('drag-over');
    });
    
    container.addEventListener('drop', (e) => {
      e.preventDefault();
      container.classList.remove('drag-over');
      if (onDrop && draggedElement) {
        onDrop(draggedElement, container, e);
      }
    });
  });
}

// ========== Settings Modal ==========
function openSettingsModal() {
  // Check if modal already exists
  let modal = document.getElementById('globalSettingsModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'globalSettingsModal';
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="glass-panel p-0 w-full max-w-2xl max-h-[90vh] overflow-hidden" onclick="event.stopPropagation()">
        <div class="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 class="text-xl font-bold">Настройки</h2>
            <p class="text-sm text-muted mt-1">Персонализация и параметры системы</p>
          </div>
          <button onclick="closeSettingsModal()" class="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        
        <div class="overflow-y-auto max-h-[calc(90vh-180px)]">
          <!-- Profile Section -->
          <div class="p-6 border-b border-white/10">
            <h3 class="text-sm font-semibold text-muted uppercase tracking-wider mb-4">
              <i class="fa-solid fa-user mr-2"></i>Профиль
            </h3>
            <div class="flex items-center gap-4">
              <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold" id="settingsAvatar">
                АД
              </div>
              <div class="flex-1">
                <input type="text" id="settingsUserName" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-lg font-medium focus:border-blue-500/50 outline-none" value="Диспетчер" placeholder="Ваше имя">
                <p class="text-sm text-muted mt-1" id="settingsUserRole">Роль: Диспетчер</p>
              </div>
              <button class="px-4 py-2 rounded-xl bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors text-sm">
                <i class="fa-solid fa-camera mr-2"></i>Фото
              </button>
            </div>
          </div>
          
          <!-- Appearance Section -->
          <div class="p-6 border-b border-white/10">
            <h3 class="text-sm font-semibold text-muted uppercase tracking-wider mb-4">
              <i class="fa-solid fa-palette mr-2"></i>Внешний вид
            </h3>
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <p class="font-medium">Тема оформления</p>
                  <p class="text-sm text-muted">Выберите светлую или тёмную тему</p>
                </div>
                <div class="flex gap-2">
                  <button onclick="setTheme('light')" class="theme-option px-4 py-2 rounded-xl border border-white/10 hover:border-blue-500/50 transition-all" data-theme="light">
                    <i class="fa-solid fa-sun mr-2"></i>Светлая
                  </button>
                  <button onclick="setTheme('dark')" class="theme-option px-4 py-2 rounded-xl border border-white/10 hover:border-blue-500/50 transition-all" data-theme="dark">
                    <i class="fa-solid fa-moon mr-2"></i>Тёмная
                  </button>
                </div>
              </div>
              <div class="flex items-center justify-between">
                <div>
                  <p class="font-medium">Компактный режим</p>
                  <p class="text-sm text-muted">Уменьшенные отступы для больше информации</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" id="compactMode" class="sr-only peer" onchange="toggleCompactMode()">
                  <div class="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                </label>
              </div>
            </div>
          </div>
          
          <!-- Notifications Section -->
          <div class="p-6 border-b border-white/10">
            <h3 class="text-sm font-semibold text-muted uppercase tracking-wider mb-4">
              <i class="fa-solid fa-bell mr-2"></i>Уведомления
            </h3>
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <p class="font-medium">Push-уведомления</p>
                  <p class="text-sm text-muted">Получать уведомления в браузере</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" id="pushNotifications" class="sr-only peer" checked>
                  <div class="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                </label>
              </div>
              <div class="flex items-center justify-between">
                <div>
                  <p class="font-medium">Email-уведомления</p>
                  <p class="text-sm text-muted">Дублировать важные события на почту</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" id="emailNotifications" class="sr-only peer">
                  <div class="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                </label>
              </div>
              <div class="flex items-center justify-between">
                <div>
                  <p class="font-medium">Звуковые оповещения</p>
                  <p class="text-sm text-muted">Звук при критических событиях</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" id="soundNotifications" class="sr-only peer" checked>
                  <div class="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                </label>
              </div>
            </div>
          </div>
          
          <!-- Regional Section -->
          <div class="p-6 border-b border-white/10">
            <h3 class="text-sm font-semibold text-muted uppercase tracking-wider mb-4">
              <i class="fa-solid fa-globe mr-2"></i>Регион и язык
            </h3>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm text-muted mb-2">Язык интерфейса</label>
                <select id="settingsLanguage" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:border-blue-500/50 outline-none">
                  <option value="ru" selected>🇷🇺 Русский</option>
                  <option value="en">🇬🇧 English</option>
                  <option value="kz">🇰🇿 Қазақша</option>
                  <option value="by">🇧🇾 Беларуская</option>
                </select>
              </div>
              <div>
                <label class="block text-sm text-muted mb-2">Часовой пояс</label>
                <select id="settingsTimezone" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:border-blue-500/50 outline-none">
                  <option value="Europe/Moscow" selected>Москва (UTC+3)</option>
                  <option value="Europe/Minsk">Минск (UTC+3)</option>
                  <option value="Asia/Almaty">Алматы (UTC+6)</option>
                  <option value="Europe/Kaliningrad">Калининград (UTC+2)</option>
                  <option value="Asia/Yekaterinburg">Екатеринбург (UTC+5)</option>
                </select>
              </div>
            </div>
          </div>
          
          <!-- System Section -->
          <div class="p-6">
            <h3 class="text-sm font-semibold text-muted uppercase tracking-wider mb-4">
              <i class="fa-solid fa-gear mr-2"></i>Система
            </h3>
            <div class="space-y-3">
              <button onclick="clearCache()" class="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                <div class="flex items-center gap-3">
                  <i class="fa-solid fa-broom text-amber-400"></i>
                  <div class="text-left">
                    <p class="font-medium">Очистить кэш</p>
                    <p class="text-sm text-muted">Удалить временные данные приложения</p>
                  </div>
                </div>
                <i class="fa-solid fa-chevron-right text-muted"></i>
              </button>
              <button onclick="exportData()" class="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                <div class="flex items-center gap-3">
                  <i class="fa-solid fa-download text-blue-400"></i>
                  <div class="text-left">
                    <p class="font-medium">Экспорт данных</p>
                    <p class="text-sm text-muted">Скачать все ваши данные</p>
                  </div>
                </div>
                <i class="fa-solid fa-chevron-right text-muted"></i>
              </button>
              <button onclick="showAbout()" class="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                <div class="flex items-center gap-3">
                  <i class="fa-solid fa-info-circle text-purple-400"></i>
                  <div class="text-left">
                    <p class="font-medium">О программе</p>
                    <p class="text-sm text-muted">RoutoX v2.0 · Информация о системе</p>
                  </div>
                </div>
                <i class="fa-solid fa-chevron-right text-muted"></i>
              </button>
            </div>
          </div>
        </div>
        
        <div class="flex items-center justify-between p-6 border-t border-white/10 bg-white/5">
          <button onclick="resetSettings()" class="px-4 py-2 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors">
            <i class="fa-solid fa-rotate-left mr-2"></i>Сбросить
          </button>
          <div class="flex gap-3">
            <button onclick="closeSettingsModal()" class="px-6 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
              Отмена
            </button>
            <button onclick="saveSettings()" class="px-6 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium hover:opacity-90 transition-opacity">
              <i class="fa-solid fa-check mr-2"></i>Сохранить
            </button>
          </div>
        </div>
      </div>
    `;
    modal.onclick = closeSettingsModal;
    document.body.appendChild(modal);
    
    // Load saved settings
    loadSettings();
  }
  
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
  updateThemeButtons();
}

function closeSettingsModal() {
  const modal = document.getElementById('globalSettingsModal');
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

function loadSettings() {
  // Load saved settings from localStorage
  const settings = JSON.parse(localStorage.getItem('routox_settings') || '{}');
  
  // Update form values
  if (settings.userName) {
    const nameInput = document.getElementById('settingsUserName');
    if (nameInput) nameInput.value = settings.userName;
  }
  
  if (settings.compactMode) {
    const compactToggle = document.getElementById('compactMode');
    if (compactToggle) compactToggle.checked = settings.compactMode;
  }
  
  if (settings.language) {
    const langSelect = document.getElementById('settingsLanguage');
    if (langSelect) langSelect.value = settings.language;
  }
  
  if (settings.timezone) {
    const tzSelect = document.getElementById('settingsTimezone');
    if (tzSelect) tzSelect.value = settings.timezone;
  }
  
  // Notifications
  const pushToggle = document.getElementById('pushNotifications');
  if (pushToggle) pushToggle.checked = settings.pushNotifications !== false;
  
  const emailToggle = document.getElementById('emailNotifications');
  if (emailToggle) emailToggle.checked = settings.emailNotifications === true;
  
  const soundToggle = document.getElementById('soundNotifications');
  if (soundToggle) soundToggle.checked = settings.soundNotifications !== false;
  
  // Update avatar initials
  const avatar = document.getElementById('settingsAvatar');
  const userName = document.getElementById('settingsUserName');
  if (avatar && userName) {
    const name = userName.value || 'User';
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    avatar.textContent = initials;
  }
  
  // Update role display
  const roleDisplay = document.getElementById('settingsUserRole');
  if (roleDisplay) {
    const role = localStorage.getItem('user_role') || 'admin';
    const roleNames = { owner: 'Владелец', admin: 'Диспетчер', driver: 'Водитель' };
    roleDisplay.textContent = `Роль: ${roleNames[role] || 'Пользователь'}`;
  }
}

function saveSettings() {
  const settings = {
    userName: document.getElementById('settingsUserName')?.value || '',
    compactMode: document.getElementById('compactMode')?.checked || false,
    language: document.getElementById('settingsLanguage')?.value || 'ru',
    timezone: document.getElementById('settingsTimezone')?.value || 'Europe/Moscow',
    pushNotifications: document.getElementById('pushNotifications')?.checked ?? true,
    emailNotifications: document.getElementById('emailNotifications')?.checked || false,
    soundNotifications: document.getElementById('soundNotifications')?.checked ?? true
  };
  
  localStorage.setItem('routox_settings', JSON.stringify(settings));
  
  // Apply compact mode
  if (settings.compactMode) {
    document.body.classList.add('compact-mode');
  } else {
    document.body.classList.remove('compact-mode');
  }
  
  showNotification('Настройки сохранены', 'success');
  closeSettingsModal();
}

function resetSettings() {
  if (confirm('Сбросить все настройки до значений по умолчанию?')) {
    localStorage.removeItem('routox_settings');
    loadSettings();
    showNotification('Настройки сброшены', 'info');
  }
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.body.classList.toggle('theme-light', theme === 'light');
  document.documentElement.style.colorScheme = theme === 'light' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, theme);
  
  const toggle = document.querySelector('.theme-toggle-track');
  if (toggle) {
    toggle.classList.toggle('light', theme === 'light');
  }
  
  updateThemeButtons();
  window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
}

function updateThemeButtons() {
  const currentTheme = localStorage.getItem(THEME_KEY) || 'light';
  document.querySelectorAll('.theme-option').forEach(btn => {
    const isActive = btn.dataset.theme === currentTheme;
    btn.classList.toggle('bg-blue-500/20', isActive);
    btn.classList.toggle('border-blue-500/50', isActive);
    btn.classList.toggle('text-blue-400', isActive);
  });
}

function toggleCompactMode() {
  const isCompact = document.getElementById('compactMode')?.checked;
  document.body.classList.toggle('compact-mode', isCompact);
}

function clearCache() {
  if (confirm('Очистить весь кэш приложения?')) {
    // Clear various caches
    localStorage.removeItem('routox_cache');
    sessionStorage.clear();
    
    // Clear service worker caches if available
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
    
    showNotification('Кэш очищен', 'success');
  }
}

function exportData() {
  const data = {
    settings: JSON.parse(localStorage.getItem('routox_settings') || '{}'),
    theme: localStorage.getItem(THEME_KEY),
    role: localStorage.getItem('user_role'),
    exportDate: new Date().toISOString()
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `routox-export-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  showNotification('Данные экспортированы', 'success');
}

function showAbout() {
  alert(`RoutoX Fleet Management Platform\n\nВерсия: 2.0.0\nДата сборки: ${new Date().toLocaleDateString('ru-RU')}\n\n© 2024 RoutoX Team\nВсе права защищены.\n\nСистема управления автопарком нового поколения.`);
}

// ========== Export ==========
window.RoutoX = {
  initTheme,
  toggleTheme,
  isDarkTheme,
  getChartColors,
  showNotification,
  openModal,
  closeModal,
  openSettingsModal,
  closeSettingsModal,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatDateTime,
  formatRelativeTime,
  randomBetween,
  randomFromArray,
  generateTruckPlate,
  getRandomAvatarUrl,
  initTabs,
  initDragDrop,
  SAMPLE_NAMES,
  SAMPLE_CITIES,
  checkRole,
  updateRoleBadge
};

// Make settings functions globally available
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.saveSettings = saveSettings;
window.resetSettings = resetSettings;
window.setTheme = setTheme;
window.toggleCompactMode = toggleCompactMode;
window.clearCache = clearCache;
window.exportData = exportData;
window.showAbout = showAbout;

// Make theme functions globally available
window.toggleTheme = toggleTheme;
window.initTheme = initTheme;
window.isDarkTheme = isDarkTheme;

// ========== Role Management ==========
function checkRole() {
  const role = localStorage.getItem('user_role') || 'admin';
  return role;
}

function updateRoleBadge() {
  const role = checkRole();
  const roleBadge = document.getElementById('roleBadge');
  const roleText = document.getElementById('roleText');
  
  if (!roleBadge || !roleText) return role;
  
  const roleConfig = {
    owner: { class: 'owner', text: 'Владелец', icon: 'fa-crown' },
    admin: { class: 'admin', text: 'Диспетчер', icon: 'fa-user-gear' },
    driver: { class: 'driver', text: 'Водитель', icon: 'fa-truck' }
  };
  
  const config = roleConfig[role] || roleConfig.admin;
  roleBadge.className = `role-badge ${config.class}`;
  roleText.textContent = config.text;
  
  const iconEl = roleBadge.querySelector('i');
  if (iconEl) {
    iconEl.className = `fa-solid ${config.icon}`;
  }
  
  return role;
}

// Auto-init theme on load
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
});

// Add animation styles
const style = document.createElement('style');
style.textContent = `
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }
`;
document.head.appendChild(style);
