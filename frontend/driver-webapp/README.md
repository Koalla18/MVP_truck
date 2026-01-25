<p align="center">
  <img src="https://img.shields.io/badge/RoutoX-Driver%20App-0066FF?style=for-the-badge&logo=react&logoColor=white" alt="RoutoX Driver App"/>
</p>

<h1 align="center">📱 RoutoX Driver WebApp</h1>

<p align="center">
  <strong>React + TypeScript + Vite</strong><br>
  Мобильное приложение водителя для системы RoutoX
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18+-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React"/>
  <img src="https://img.shields.io/badge/TypeScript-5+-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/Vite-5+-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite"/>
  <img src="https://img.shields.io/badge/TailwindCSS-3+-38B2AC?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind"/>
</p>

---

## 📋 Содержание

- [О проекте](#-о-проекте)
- [Функциональность](#-функциональность)
- [Технологии](#-технологии)
- [Быстрый старт](#-быстрый-старт)
- [Разработка](#-разработка)

---

## 🎯 О проекте

Прогрессивное веб-приложение (PWA) для водителей грузового транспорта.

**Возможности:**
- 📋 Просмотр списка рейсов и заданий
- 📍 GPS навигация и построение маршрутов
- ✅ Обновление статусов рейса
- 📄 Загрузка документов (ТТН, CMR)
- 💬 Чат с диспетчером
- 🔔 Push-уведомления
- 📶 Работа оффлайн

---

## ⚙️ Функциональность

- ✅ Аутентификация водителя
- ✅ Список активных рейсов
- ✅ Детали рейса с точками маршрута
- ✅ Обновление статусов (в пути, загрузка, разгрузка, завершен)
- ✅ Фотофиксация документов
- ✅ Геолокация в реальном времени
- 🔄 Синхронизация с backend API

---

## 🛠️ Технологии

- **React** 18+ — UI библиотека
- **TypeScript** 5+ — типизация
- **Vite** 5+ — сборщик
- **TailwindCSS** 3+ — стилизация
- **React Router** — навигация
- **Zustand** — state management
- **React Query** — работа с API
- **Leaflet** — карты

---

## 🚀 Быстрый старт

```bash
cd frontend/driver-webapp
npm install
npm run dev
```

Приложение будет доступно на `http://localhost:5173`.

---

## 🔧 Разработка

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
