/**
 * RoutoX AI Assistant
 * Intelligent assistant for fleet management
 * Supports all roles: owner, admin, driver
 */

(function() {
  'use strict';

  // AI Assistant Configuration
  const AI_CONFIG = {
    name: 'RoutoX AI',
    avatar: 'R',
    model: 'gpt-4-turbo', // Can be changed to local model
    apiEndpoint: '/api/v1/ai/chat',
    maxTokens: 2000,
    temperature: 0.7
  };

  // Role-specific prompts and capabilities
  const ROLE_CONTEXTS = {
    owner: {
      systemPrompt: `Ты - AI-помощник RoutoX для владельца транспортной компании. 
        Помогай с анализом бизнес-показателей, прибыльности рейсов, оптимизацией расходов.
        Давай конкретные рекомендации на основе данных. Будь кратким и по делу.`,
      suggestions: [
        'Какая прибыль за этот месяц?',
        'Какие рейсы самые прибыльные?',
        'Где можно сократить расходы?',
        'Прогноз выручки на следующий месяц',
        'Сравни показатели с прошлым годом'
      ],
      capabilities: ['analytics', 'forecasting', 'optimization', 'reporting']
    },
    admin: {
      systemPrompt: `Ты - AI-помощник RoutoX для диспетчера. 
        Помогай планировать рейсы, находить свободных водителей, контролировать документы.
        Предупреждай о проблемах и просрочках. Будь оперативным.`,
      suggestions: [
        'Какие водители свободны сегодня?',
        'Спланируй оптимальный маршрут в Казань',
        'У кого заканчивается ОСАГО?',
        'Какие рейсы задерживаются?',
        'Сформируй путевой лист'
      ],
      capabilities: ['planning', 'scheduling', 'documents', 'alerts']
    },
    driver: {
      systemPrompt: `Ты - AI-помощник RoutoX для водителя. 
        Помогай с маршрутами, подсказывай где заправиться дешевле, 
        напоминай о режиме труда-отдыха. Говори просто и понятно.`,
      suggestions: [
        'Где ближайшая дешёвая заправка?',
        'Сколько мне осталось до отдыха?',
        'Какой мой следующий рейс?',
        'Есть ли пробки на маршруте?',
        'Как оформить ТТН?'
      ],
      capabilities: ['navigation', 'fuel', 'rto', 'documents']
    }
  };

  // Quick actions by context
  const CONTEXT_ACTIONS = {
    'index.html': ['Покажи статус всех ТС', 'Где сейчас грузовик X?', 'Кто на маршруте?'],
    'trips.html': ['Рассчитай рентабельность', 'Оптимизируй маршрут', 'Добавь рейс'],
    'fuel.html': ['Анализ расхода топлива', 'Подозрительные заправки', 'Где дешевле топливо?'],
    'maintenance.html': ['Кому нужно ТО?', 'Запланируй обслуживание', 'История ремонтов'],
    'analytics.html': ['Сравни периоды', 'Топ водителей', 'Экспорт в Excel'],
    'driver.html': ['Мой статус РТО', 'Маршрут до точки', 'Связь с диспетчером']
  };

  // Message templates
  const MESSAGE_TEMPLATES = {
    welcome: {
      owner: 'Здравствуйте! Я ваш AI-помощник. Могу помочь с аналитикой, прогнозами и оптимизацией бизнеса.',
      admin: 'Привет! Я помогу с планированием рейсов, контролем документов и управлением водителями.',
      driver: 'Привет! Я твой помощник в дороге. Подскажу маршрут, заправки и напомню об отдыхе.'
    },
    thinking: 'Анализирую данные...',
    error: 'Произошла ошибка. Попробуйте ещё раз.',
    offline: 'Нет подключения. Некоторые функции недоступны.'
  };

  class RoutoXAI {
    constructor() {
      this.isOpen = false;
      this.messages = [];
      this.role = this.detectRole();
      this.currentPage = this.detectPage();
      this.context = ROLE_CONTEXTS[this.role] || ROLE_CONTEXTS.admin;
      
      this.init();
    }

    detectRole() {
      if (typeof RoutoX !== 'undefined' && RoutoX.Auth) {
        return RoutoX.Auth.getRole() || 'admin';
      }
      return localStorage.getItem('user_role') || 'admin';
    }

    detectPage() {
      const path = window.location.pathname;
      const page = path.split('/').pop() || 'index.html';
      return page;
    }

    init() {
      this.createWidget();
      this.attachEventListeners();
      this.loadHistory();
    }

    createWidget() {
      // Create floating button
      const button = document.createElement('div');
      button.id = 'ai-assistant-btn';
      button.className = 'ai-assistant-btn';
      button.innerHTML = `
        <div class="ai-btn-inner">
          <i class="fa-solid fa-robot"></i>
        </div>
        <div class="ai-btn-pulse"></div>
      `;

      // Create chat panel
      const panel = document.createElement('div');
      panel.id = 'ai-assistant-panel';
      panel.className = 'ai-assistant-panel';
      panel.innerHTML = `
        <div class="ai-panel-header">
          <div class="ai-header-info">
            <div class="ai-avatar">
              <i class="fa-solid fa-robot"></i>
            </div>
            <div>
              <div class="ai-name">${AI_CONFIG.name}</div>
              <div class="ai-status">
                <span class="ai-status-dot"></span>
                Онлайн
              </div>
            </div>
          </div>
          <div class="ai-header-actions">
            <button class="ai-action-btn" id="ai-clear-btn" title="Очистить историю">
              <i class="fa-solid fa-trash"></i>
            </button>
            <button class="ai-action-btn" id="ai-close-btn" title="Закрыть">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>
        
        <div class="ai-panel-messages" id="ai-messages">
          <!-- Messages will be inserted here -->
        </div>
        
        <div class="ai-panel-suggestions" id="ai-suggestions">
          <!-- Quick suggestions -->
        </div>
        
        <div class="ai-panel-input">
          <input type="text" id="ai-input" placeholder="Спросите что-нибудь..." autocomplete="off">
          <button id="ai-send-btn" class="ai-send-btn">
            <i class="fa-solid fa-paper-plane"></i>
          </button>
          <button id="ai-voice-btn" class="ai-voice-btn" title="Голосовой ввод">
            <i class="fa-solid fa-microphone"></i>
          </button>
        </div>
      `;

      // Add styles
      const styles = document.createElement('style');
      styles.textContent = this.getStyles();
      document.head.appendChild(styles);

      // Add to DOM
      document.body.appendChild(button);
      document.body.appendChild(panel);

      // Show welcome message
      this.addMessage('assistant', MESSAGE_TEMPLATES.welcome[this.role]);
      this.renderSuggestions();
    }

    getStyles() {
      return `
        /* AI Assistant Button */
        .ai-assistant-btn {
          position: fixed;
          bottom: 24px;
          right: 24px;
          width: 60px;
          height: 60px;
          z-index: 9999;
          cursor: pointer;
        }

        .ai-btn-inner {
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 24px;
          box-shadow: 0 4px 20px rgba(59, 130, 246, 0.5);
          transition: all 0.3s ease;
        }

        .ai-assistant-btn:hover .ai-btn-inner {
          transform: scale(1.1);
          box-shadow: 0 6px 30px rgba(59, 130, 246, 0.6);
        }

        .ai-btn-pulse {
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          border: 2px solid #3b82f6;
          animation: aiPulse 2s ease-out infinite;
        }

        @keyframes aiPulse {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.5); opacity: 0; }
        }

        /* AI Assistant Panel */
        .ai-assistant-panel {
          position: fixed;
          bottom: 100px;
          right: 24px;
          width: 380px;
          height: 560px;
          background: #111827;
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          display: flex;
          flex-direction: column;
          z-index: 9998;
          opacity: 0;
          visibility: hidden;
          transform: translateY(20px) scale(0.95);
          transition: all 0.3s ease;
        }

        .ai-assistant-panel.open {
          opacity: 1;
          visibility: visible;
          transform: translateY(0) scale(1);
        }

        /* Header */
        .ai-panel-header {
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .ai-header-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .ai-avatar {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #3b82f6, #8b5cf6);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 18px;
        }

        .ai-name {
          color: white;
          font-weight: 600;
          font-size: 15px;
        }

        .ai-status {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #10b981;
          font-size: 12px;
        }

        .ai-status-dot {
          width: 6px;
          height: 6px;
          background: #10b981;
          border-radius: 50%;
          animation: statusBlink 2s infinite;
        }

        @keyframes statusBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .ai-header-actions {
          display: flex;
          gap: 8px;
        }

        .ai-action-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.05);
          border: none;
          color: #94a3b8;
          cursor: pointer;
          transition: all 0.2s;
        }

        .ai-action-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: white;
        }

        /* Messages */
        .ai-panel-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .ai-message {
          max-width: 85%;
          padding: 12px 16px;
          border-radius: 16px;
          font-size: 14px;
          line-height: 1.5;
          animation: messageSlide 0.3s ease;
        }

        @keyframes messageSlide {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .ai-message.user {
          align-self: flex-end;
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          color: white;
          border-bottom-right-radius: 4px;
        }

        .ai-message.assistant {
          align-self: flex-start;
          background: rgba(255, 255, 255, 0.08);
          color: #e2e8f0;
          border-bottom-left-radius: 4px;
        }

        .ai-message.typing {
          background: rgba(255, 255, 255, 0.05);
        }

        .ai-typing-dots {
          display: flex;
          gap: 4px;
        }

        .ai-typing-dots span {
          width: 6px;
          height: 6px;
          background: #64748b;
          border-radius: 50%;
          animation: typingBounce 1.4s infinite;
        }

        .ai-typing-dots span:nth-child(2) { animation-delay: 0.2s; }
        .ai-typing-dots span:nth-child(3) { animation-delay: 0.4s; }

        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }

        /* Suggestions */
        .ai-panel-suggestions {
          padding: 12px 16px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }

        .ai-suggestion {
          padding: 8px 14px;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.2);
          border-radius: 20px;
          color: #60a5fa;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .ai-suggestion:hover {
          background: rgba(59, 130, 246, 0.2);
          border-color: rgba(59, 130, 246, 0.4);
        }

        /* Input */
        .ai-panel-input {
          padding: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          gap: 8px;
        }

        .ai-panel-input input {
          flex: 1;
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          color: white;
          font-size: 14px;
          outline: none;
          transition: all 0.2s;
        }

        .ai-panel-input input:focus {
          border-color: rgba(59, 130, 246, 0.5);
          background: rgba(255, 255, 255, 0.08);
        }

        .ai-panel-input input::placeholder {
          color: #64748b;
        }

        .ai-send-btn, .ai-voice-btn {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
        }

        .ai-send-btn {
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          color: white;
        }

        .ai-send-btn:hover {
          transform: scale(1.05);
        }

        .ai-voice-btn {
          background: rgba(255, 255, 255, 0.05);
          color: #64748b;
        }

        .ai-voice-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: white;
        }

        .ai-voice-btn.recording {
          background: #ef4444;
          color: white;
          animation: voicePulse 1s infinite;
        }

        @keyframes voicePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          50% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
        }

        /* Mobile responsive */
        @media (max-width: 480px) {
          .ai-assistant-panel {
            width: calc(100% - 32px);
            right: 16px;
            bottom: 90px;
            height: 70vh;
          }

          .ai-assistant-btn {
            right: 16px;
            bottom: 16px;
          }
        }

        /* Scrollbar */
        .ai-panel-messages::-webkit-scrollbar {
          width: 4px;
        }

        .ai-panel-messages::-webkit-scrollbar-track {
          background: transparent;
        }

        .ai-panel-messages::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 2px;
        }

        /* Light theme support */
        [data-theme="light"] .ai-assistant-panel {
          background: #ffffff;
          border-color: rgba(0, 0, 0, 0.1);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
        }

        [data-theme="light"] .ai-panel-header {
          border-bottom-color: rgba(0, 0, 0, 0.1);
        }

        [data-theme="light"] .ai-name {
          color: #1e293b;
        }

        [data-theme="light"] .ai-action-btn {
          background: rgba(0, 0, 0, 0.05);
          color: #64748b;
        }

        [data-theme="light"] .ai-action-btn:hover {
          background: rgba(0, 0, 0, 0.1);
          color: #1e293b;
        }

        [data-theme="light"] .ai-message.assistant {
          background: rgba(0, 0, 0, 0.05);
          color: #1e293b;
        }

        [data-theme="light"] .ai-panel-suggestions {
          border-top-color: rgba(0, 0, 0, 0.05);
        }

        [data-theme="light"] .ai-panel-input {
          border-top-color: rgba(0, 0, 0, 0.1);
        }

        [data-theme="light"] .ai-panel-input input {
          background: rgba(0, 0, 0, 0.03);
          border-color: rgba(0, 0, 0, 0.1);
          color: #1e293b;
        }

        [data-theme="light"] .ai-panel-input input:focus {
          border-color: rgba(59, 130, 246, 0.5);
          background: rgba(0, 0, 0, 0.05);
        }

        [data-theme="light"] .ai-voice-btn {
          background: rgba(0, 0, 0, 0.05);
          color: #64748b;
        }

        [data-theme="light"] .ai-voice-btn:hover {
          background: rgba(0, 0, 0, 0.1);
          color: #1e293b;
        }

        [data-theme="light"] .ai-panel-messages::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.1);
        }
      `;
    }

    attachEventListeners() {
      const btn = document.getElementById('ai-assistant-btn');
      const closeBtn = document.getElementById('ai-close-btn');
      const clearBtn = document.getElementById('ai-clear-btn');
      const sendBtn = document.getElementById('ai-send-btn');
      const voiceBtn = document.getElementById('ai-voice-btn');
      const input = document.getElementById('ai-input');

      btn.addEventListener('click', () => this.toggle());
      closeBtn.addEventListener('click', () => this.close());
      clearBtn.addEventListener('click', () => this.clearHistory());
      sendBtn.addEventListener('click', () => this.sendMessage());
      voiceBtn.addEventListener('click', () => this.toggleVoice());

      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.sendMessage();
      });

      // Close on outside click
      document.addEventListener('click', (e) => {
        const panel = document.getElementById('ai-assistant-panel');
        const btn = document.getElementById('ai-assistant-btn');
        if (this.isOpen && !panel.contains(e.target) && !btn.contains(e.target)) {
          this.close();
        }
      });
    }

    toggle() {
      this.isOpen ? this.close() : this.open();
    }

    open() {
      this.isOpen = true;
      document.getElementById('ai-assistant-panel').classList.add('open');
      document.getElementById('ai-input').focus();
    }

    close() {
      this.isOpen = false;
      document.getElementById('ai-assistant-panel').classList.remove('open');
    }

    addMessage(type, content) {
      const messagesDiv = document.getElementById('ai-messages');
      const message = document.createElement('div');
      message.className = `ai-message ${type}`;
      message.textContent = content;
      messagesDiv.appendChild(message);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
      
      this.messages.push({ type, content, timestamp: Date.now() });
      this.saveHistory();
    }

    showTyping() {
      const messagesDiv = document.getElementById('ai-messages');
      const typing = document.createElement('div');
      typing.className = 'ai-message assistant typing';
      typing.id = 'ai-typing';
      typing.innerHTML = `
        <div class="ai-typing-dots">
          <span></span><span></span><span></span>
        </div>
      `;
      messagesDiv.appendChild(typing);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    hideTyping() {
      const typing = document.getElementById('ai-typing');
      if (typing) typing.remove();
    }

    renderSuggestions() {
      const suggestionsDiv = document.getElementById('ai-suggestions');
      const pageActions = CONTEXT_ACTIONS[this.currentPage] || [];
      const allSuggestions = [...this.context.suggestions.slice(0, 3), ...pageActions.slice(0, 2)];
      
      suggestionsDiv.innerHTML = allSuggestions.map(s => 
        `<button class="ai-suggestion" onclick="routoxAI.askSuggestion('${s}')">${s}</button>`
      ).join('');
    }

    askSuggestion(text) {
      document.getElementById('ai-input').value = text;
      this.sendMessage();
    }

    async sendMessage() {
      const input = document.getElementById('ai-input');
      const text = input.value.trim();
      if (!text) return;

      // Add user message
      this.addMessage('user', text);
      input.value = '';

      // Show typing indicator
      this.showTyping();

      try {
        // Try to get response from backend AI
        const response = await this.getAIResponse(text);
        this.hideTyping();
        this.addMessage('assistant', response);
      } catch (error) {
        this.hideTyping();
        // Fallback to local responses
        const localResponse = this.getLocalResponse(text);
        this.addMessage('assistant', localResponse);
      }
    }

    async getAIResponse(userMessage) {
      // Try backend API first
      try {
        const response = await fetch(AI_CONFIG.apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RoutoX.Auth.getToken()}`
          },
          body: JSON.stringify({
            message: userMessage,
            role: this.role,
            page: this.currentPage,
            context: this.context.systemPrompt
          })
        });

        if (response.ok) {
          const data = await response.json();
          return data.response;
        }
      } catch (e) {
        console.log('AI API unavailable, using local fallback');
      }

      // Fallback to local response
      return this.getLocalResponse(userMessage);
    }

    getLocalResponse(userMessage) {
      const msg = userMessage.toLowerCase();
      
      // Simple keyword matching for demo
      if (msg.includes('прибыль') || msg.includes('выручк')) {
        return 'За текущий месяц выручка составила 2.4 млн ₽, прибыль — 380 тыс. ₽ (маржа 15.8%). Это на 12% больше прошлого месяца. Самые прибыльные направления: Москва-Казань (+18%), Москва-СПб (+15%).';
      }
      
      if (msg.includes('водител') && (msg.includes('свобод') || msg.includes('доступ'))) {
        return 'Сегодня свободны 3 водителя:\n• Иванов А.С. — категория CE, свободен с 14:00\n• Петров В.М. — категория CE, весь день\n• Сидоров К.П. — категория C, свободен с 10:00\n\nНазначить кого-то на рейс?';
      }

      if (msg.includes('заправк') || msg.includes('топлив')) {
        return 'Ближайшие заправки с лучшими ценами:\n• Лукойл (2.3 км) — ДТ 58.90 ₽/л\n• Газпром (4.1 км) — ДТ 57.50 ₽/л ⭐\n• Роснефть (5.8 км) — ДТ 59.20 ₽/л\n\nРекомендую Газпром — экономия ~150₽ на полном баке.';
      }

      if (msg.includes('осаго') || msg.includes('страхов')) {
        return '⚠️ Внимание! ОСАГО истекает у 2 ТС:\n• А123ВС77 — через 5 дней (15.01.2026)\n• В456КМ50 — через 12 дней (22.01.2026)\n\nРекомендую продлить сейчас. Показать контакты страховых?';
      }

      if (msg.includes('рто') || msg.includes('отдых') || msg.includes('труд')) {
        return 'Ваш режим труда-отдыха:\n✅ Сегодня: 6ч 20мин / 9ч допустимо\n⏱️ До обязательного перерыва: 2ч 40мин\n📅 Недельный лимит: 38ч / 56ч\n\nВсё в норме! Следующий обязательный отдых — не позднее 16:40.';
      }

      if (msg.includes('маршрут') || msg.includes('пробк')) {
        return 'Оптимальный маршрут построен:\n📍 Время в пути: 4ч 35мин\n🛣️ Расстояние: 412 км\n⛽ Расход: ~120 л ДТ\n\n⚠️ На М7 ремонт дороги (км 245-252), задержка +20 мин. Рекомендую объезд через А108.';
      }

      if (msg.includes('привет') || msg.includes('здравст')) {
        return MESSAGE_TEMPLATES.welcome[this.role];
      }

      // Default response
      return 'Извините, я пока не могу ответить на этот вопрос. Попробуйте переформулировать или выберите один из предложенных вопросов ниже.';
    }

    toggleVoice() {
      const voiceBtn = document.getElementById('ai-voice-btn');
      
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert('Голосовой ввод не поддерживается в вашем браузере');
        return;
      }

      if (this.recognition && this.isRecording) {
        this.recognition.stop();
        this.isRecording = false;
        voiceBtn.classList.remove('recording');
        return;
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.lang = 'ru-RU';
      this.recognition.continuous = false;

      this.recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        document.getElementById('ai-input').value = text;
        voiceBtn.classList.remove('recording');
        this.isRecording = false;
      };

      this.recognition.onerror = () => {
        voiceBtn.classList.remove('recording');
        this.isRecording = false;
      };

      this.recognition.start();
      this.isRecording = true;
      voiceBtn.classList.add('recording');
    }

    saveHistory() {
      try {
        const history = this.messages.slice(-50); // Keep last 50 messages
        localStorage.setItem('routox_ai_history', JSON.stringify(history));
      } catch (e) {}
    }

    loadHistory() {
      try {
        const history = JSON.parse(localStorage.getItem('routox_ai_history') || '[]');
        if (history.length > 0) {
          const messagesDiv = document.getElementById('ai-messages');
          history.forEach(msg => {
            const message = document.createElement('div');
            message.className = `ai-message ${msg.type}`;
            message.textContent = msg.content;
            messagesDiv.appendChild(message);
          });
          this.messages = history;
        }
      } catch (e) {}
    }

    clearHistory() {
      this.messages = [];
      localStorage.removeItem('routox_ai_history');
      const messagesDiv = document.getElementById('ai-messages');
      messagesDiv.innerHTML = '';
      this.addMessage('assistant', MESSAGE_TEMPLATES.welcome[this.role]);
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.routoxAI = new RoutoXAI();
    });
  } else {
    window.routoxAI = new RoutoXAI();
  }

})();
