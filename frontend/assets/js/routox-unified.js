/**
 * RoutoX Unified JavaScript
 * Общий JavaScript для всех страниц платформы
 * v2.0
 */

// ========== Theme Management ==========
const THEME_KEY = 'routoxTheme';

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  return saved;
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(THEME_KEY, next);
  
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

// ========== Export ==========
window.RoutoX = {
  initTheme,
  toggleTheme,
  isDarkTheme,
  getChartColors,
  showNotification,
  openModal,
  closeModal,
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
    admin: { class: 'admin', text: 'Администратор', icon: 'fa-user-gear' },
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
