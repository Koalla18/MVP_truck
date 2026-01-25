/**
 * RoutoX Role-Based Theming System
 * Динамическое переключение цветовых схем на основе роли пользователя
 */

(function() {
    'use strict';

    const ROLE_THEMES = {
        logist: {
            primary: '#f59e0b',
            gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
            bg: '#FFF8F0',
            bgGradient: 'radial-gradient(at 0% 0%, hsla(30,100%,96%,1) 0, transparent 50%), radial-gradient(at 100% 0%, hsla(35,100%,96%,1) 0, transparent 50%)',
            text: 'text-amber-600',
            badge: 'bg-amber-50 border-amber-200 text-amber-800',
            shadow: 'rgba(245,158,11,0.15)',
            iconBg: 'from-amber-500 to-orange-600',
            label: 'LOGIST',
            icon: 'fa-route'
        },
        dispatcher: {
            primary: '#3b82f6',
            gradient: 'linear-gradient(135deg, #3b82f6, #2563eb)',
            bg: '#F5F5F7',
            bgGradient: 'radial-gradient(at 0% 0%, hsla(210,100%,96%,1) 0, transparent 50%), radial-gradient(at 100% 0%, hsla(220,100%,96%,1) 0, transparent 50%)',
            text: 'text-blue-600',
            badge: 'bg-blue-50 border-blue-200 text-blue-800',
            shadow: 'rgba(59,130,246,0.15)',
            iconBg: 'from-blue-500 to-blue-600',
            label: 'DISPATCHER',
            icon: 'fa-headset'
        },
        owner: {
            primary: '#8b5cf6',
            gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
            bg: '#F8F5FF',
            bgGradient: 'radial-gradient(at 0% 0%, hsla(270,100%,96%,1) 0, transparent 50%), radial-gradient(at 100% 0%, hsla(280,100%,96%,1) 0, transparent 50%)',
            text: 'text-purple-600',
            badge: 'bg-purple-50 border-purple-200 text-purple-800',
            shadow: 'rgba(139,92,246,0.15)',
            iconBg: 'from-purple-500 to-purple-600',
            label: 'OWNER',
            icon: 'fa-crown'
        },
        admin: {
            primary: '#06b6d4',
            gradient: 'linear-gradient(135deg, #06b6d4, #0891b2)',
            bg: '#F0FDFF',
            bgGradient: 'radial-gradient(at 0% 0%, hsla(190,100%,96%,1) 0, transparent 50%), radial-gradient(at 100% 0%, hsla(200,100%,96%,1) 0, transparent 50%)',
            text: 'text-cyan-600',
            badge: 'bg-cyan-50 border-cyan-200 text-cyan-800',
            shadow: 'rgba(6,182,212,0.15)',
            iconBg: 'from-cyan-500 to-cyan-600',
            label: 'ADMIN',
            icon: 'fa-gear'
        }
    };

    function getCurrentRole() {
        // Попробовать получить роль из localStorage
        const role = localStorage.getItem('routox_role') || 
                     localStorage.getItem('demo_role') ||
                     sessionStorage.getItem('user_role');
        
        // Проверить Routa.Auth, если доступен
        if (typeof Routa !== 'undefined' && Routa.Auth && Routa.Auth.getRole) {
            return Routa.Auth.getRole() || role || 'dispatcher';
        }
        
        return role || 'dispatcher';
    }

    function applyRoleTheme() {
        const role = getCurrentRole();
        const theme = ROLE_THEMES[role] || ROLE_THEMES.dispatcher;

        // Применить фоновые градиенты
        document.body.style.backgroundColor = theme.bg;
        document.body.style.backgroundImage = theme.bgGradient;

        // Обновить CSS переменные
        document.documentElement.style.setProperty('--role-primary', theme.primary);
        document.documentElement.style.setProperty('--role-gradient', theme.gradient);
        document.documentElement.style.setProperty('--role-shadow', theme.shadow);

        // Обновить кнопки и элементы с классом btn-primary
        const primaryBtns = document.querySelectorAll('.btn-primary');
        primaryBtns.forEach(btn => {
            btn.style.background = theme.gradient;
        });

        // Обновить активные элементы навигации
        const activeNavItems = document.querySelectorAll('.nav-item-active');
        activeNavItems.forEach(item => {
            item.style.color = theme.primary;
        });

        // Обновить tab-btn active
        const activeTabs = document.querySelectorAll('.tab-btn.active');
        activeTabs.forEach(tab => {
            tab.style.background = theme.gradient;
        });

        // Обновить иконку в хедере
        const headerIcon = document.querySelector('header .w-9.h-9.rounded-xl');
        if (headerIcon) {
            headerIcon.className = `w-9 h-9 rounded-xl bg-gradient-to-br ${theme.iconBg} flex items-center justify-center text-white font-extrabold text-xl shadow-lg`;
        }

        // Обновить лейбл роли
        const roleLabel = document.querySelector('header .text-\\[10px\\].text-slate-400');
        if (roleLabel) {
            roleLabel.textContent = theme.label;
        }

        // Обновить имя роли в профиле
        const userRole = document.getElementById('userRole');
        if (userRole) {
            userRole.textContent = theme.label.charAt(0) + theme.label.slice(1).toLowerCase();
            userRole.className = `text-[9px] ${theme.text} font-semibold mt-0.5`;
        }

        // Обновить stat-value градиенты
        const statValues = document.querySelectorAll('.stat-value');
        statValues.forEach(stat => {
            stat.style.background = theme.gradient;
            stat.style.webkitBackgroundClip = 'text';
            stat.style.webkitTextFillColor = 'transparent';
        });

        // Обновить бейджи ролей
        const roleBadges = document.querySelectorAll('.role-badge');
        roleBadges.forEach(badge => {
            if (badge.textContent.toLowerCase().includes(role)) {
                badge.className = `role-badge ${theme.badge.replace('bg-', 'bg-').replace('border-', 'border-').replace('text-', 'text-')}`;
            }
        });

        console.log(`[RoutoX Theme] Applied ${role} theme:`, theme);
    }

    // Применить тему при загрузке страницы
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyRoleTheme);
    } else {
        applyRoleTheme();
    }

    // Экспорт в глобальный namespace
    window.RoutoXTheme = {
        apply: applyRoleTheme,
        getCurrentRole,
        ROLE_THEMES
    };

    // Переприменить тему при изменении роли
    window.addEventListener('storage', function(e) {
        if (e.key === 'routox_role' || e.key === 'demo_role') {
            applyRoleTheme();
        }
    });
})();
