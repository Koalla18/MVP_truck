/**
 * RoutoX Smooth Navigation System
 * Плавные переходы между страницами с анимациями
 */

(function() {
    'use strict';

    // Создание overlay для переходов
    function createTransitionOverlay() {
        let overlay = document.getElementById('page-transition-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'page-transition-overlay';
            overlay.className = 'page-transition-overlay';
            document.body.appendChild(overlay);
        }
        return overlay;
    }

    // Плавный переход к новой странице
    function smoothNavigate(url) {
        const overlay = createTransitionOverlay();
        
        // Показать overlay
        overlay.classList.add('active');
        
        // Через короткое время перейти на новую страницу
        setTimeout(() => {
            window.location.href = url;
        }, 300);
    }

    // Перехват кликов по ссылкам навигации
    function interceptNavigation() {
        // Перехватываем все ссылки внутри nav
        document.querySelectorAll('nav a').forEach(link => {
            link.addEventListener('click', function(e) {
                const href = this.getAttribute('href');
                
                // Только для внутренних ссылок
                if (href && !href.startsWith('http') && !href.startsWith('#')) {
                    e.preventDefault();
                    smoothNavigate(href);
                }
            });
        });
    }

    // Убрать overlay при загрузке страницы
    function hideOverlayOnLoad() {
        const overlay = document.getElementById('page-transition-overlay');
        if (overlay) {
            setTimeout(() => {
                overlay.classList.remove('active');
            }, 100);
        }
    }

    // Инициализация при загрузке DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            createTransitionOverlay();
            interceptNavigation();
            hideOverlayOnLoad();
        });
    } else {
        createTransitionOverlay();
        interceptNavigation();
        hideOverlayOnLoad();
    }

    // Экспорт в глобальный namespace
    window.RoutoXNav = {
        navigate: smoothNavigate
    };
})();
