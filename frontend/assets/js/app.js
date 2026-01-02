// API Configuration
// Use relative URL when running through nginx on port 8080
const API_BASE_URL = window.location.port === "8080" ? "/api/v1" : "http://localhost:8000/api/v1";
let authToken = localStorage.getItem("auth_token") || null;

// API Helper functions
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  
  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("API request failed:", error);
    throw error;
  }
}

// Core state
let vehicles = [];
let drivers = [];
let mechanical = [];
let selected = null;
let cargoBreakdown = null;
// TODO: camera streams + cargo layout redesign hooks to be wired next iteration.
const prefs = { fuelUnit: "l", tempUnit: "c", tz: "UTC+3" };

// Small helpers used across UI rendering
const clamp = (val, min = 0, max = 100) => Math.min(Math.max(Number(val ?? 0), min), max);
const toOne = (val) => {
  const num = Number(val ?? 0);
  return num.toFixed(1).replace(/\.0$/, "");
};
const setText = (id, value) => {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
};
const minutesFromLabel = (label = "0ч 0м") => {
  const m = (label || "").match(/(?:(\d+)ч)?\s*(\d+)?/i) || [];
  const h = parseInt(m[1] || "0", 10);
  const min = parseInt(m[2] || "0", 10);
  return h * 60 + min;
};
const minutesToLabel = (mins = 0) => {
  const h = Math.floor(mins / 60);
  const m = Math.max(mins - h * 60, 0);
  return `${h}ч ${m}м`;
};

function formatPhone(phone) {
  if (!phone) return "—";
  // Форматируем телефон для отображения
  const cleaned = phone.replace(/\D/g, "");
  // РФ: часто встречается 8XXXXXXXXXX
  if (cleaned.length === 11 && cleaned.startsWith("8")) {
    const normalized = `7${cleaned.slice(1)}`;
    return `+7 (${normalized.slice(1, 4)}) ${normalized.slice(4, 7)}-${normalized.slice(7, 9)}-${normalized.slice(9)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith("7")) {
    return `+7 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7, 9)}-${cleaned.slice(9)}`;
  } else if (cleaned.length === 12 && cleaned.startsWith("375")) {
    return `+375 (${cleaned.slice(3, 5)}) ${cleaned.slice(5, 8)}-${cleaned.slice(8, 10)}-${cleaned.slice(10)}`;
  }
  return phone;
}

function phoneToTel(phone) {
  const cleaned = (phone || "").replace(/\D/g, "");
  if (!cleaned) return "";
  // 10 digits -> assume RU
  if (cleaned.length === 10) return `+7${cleaned}`;
  // 11 digits RU starting with 8/7
  if (cleaned.length === 11 && cleaned.startsWith("8")) return `+7${cleaned.slice(1)}`;
  if (cleaned.length === 11 && cleaned.startsWith("7")) return `+${cleaned}`;
  // BY example: 375XXXXXXXXX
  if (cleaned.startsWith("375")) return `+${cleaned}`;
  return `+${cleaned}`;
}

function isValidPhoneLike(phone) {
  const digits = (phone || "").replace(/\D/g, "");
  return digits.length >= 10;
}

let pendingStatus = null;

const cityPairs = [
  { from: "Казань", to: "Минск" },
  { from: "Москва", to: "Смоленск" },
  { from: "Самара", to: "Ростов" },
  { from: "Нижний Новгород", to: "Калуга" },
  { from: "Пермь", to: "Екатеринбург" },
  { from: "Тверь", to: "Санкт-Петербург" },
  { from: "Тула", to: "Курск" }
];
const statusPresets = ["В сопровождении", "Под охраной", "В пути", "На разгрузке", "На погрузке", "Свободен", "Опоздание 15 мин"];
const primaryStatuses = ["В пути", "На погрузке", "На разгрузке", "Свободен", "Простаивает", "Обслуживание"];
const statusColors = {
  "В сопровождении": "bg-indigo-500/15 text-indigo-200 border-indigo-400/40",
  "Под охраной": "bg-amber-500/15 text-amber-200 border-amber-400/40",
  "В пути": "bg-emerald-500/15 text-emerald-200 border-emerald-400/40",
  "На разгрузке": "bg-sky-500/15 text-sky-200 border-sky-400/40",
  "На погрузке": "bg-cyan-500/15 text-cyan-200 border-cyan-400/40",
  "Свободен": "bg-neutral-500/15 text-slate-100 border-slate-400/40",
  "Опоздание 15 мин": "bg-red-500/15 text-red-200 border-red-400/40",
  "Простаивает": "bg-yellow-500/15 text-yellow-200 border-yellow-400/40",
  "Обслуживание": "bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-400/40",
};
const notificationPool = [
  { title: "Перегрев тормозов", level: "danger", detail: "Гос.номер SDK-3882, перегрев > 320°C" },
  { title: "Отклонение от маршрута", level: "warn", detail: "VOLVO FH ушёл на 3.2 км вправо" },
  { title: "Датчик влажности", level: "warn", detail: "POLARHALA SCOO · не отвечает 2 мин" },
  { title: "SLA заказа", level: "info", detail: "Заказ #4412: риск опоздания на 18 мин" }
];
const truckImages = {
  "MAN TGX": "./assets/images/truck-man-tgx.png",
  "MAN TGX #2": "./assets/images/truck-man-tgx.png",
  "SCANIA R-SERIES": "./assets/images/truck-scania-r-series.png",
  "Scania R500 #3": "./assets/images/truck-scania-r-series.png",
  "VOLVO FX": "./assets/images/truck-volvo-fx.png",
  "Volvo FH16 #1": "./assets/images/truck-volvo-fx.png",
  "FREIGHTLINER 260": "./assets/images/truck-freightliner-260.png",
  "DURASTAR": "./assets/images/truck-durastar.png",
  "FREIGHTLINER M2": "./assets/images/truck-freightliner-m2.png",
  "Mercedes Actros #4": "./assets/images/truck-freightliner-260.png",
  "DAF XF #5": "./assets/images/truck-durastar.png",
  "Iveco Stralis #6": "./assets/images/truck-freightliner-m2.png",
  "Renault T #7": "./assets/images/truck-man-tgx.png",
  "КАМАЗ 5490 #8": "./assets/images/truck-scania-r-series.png"
};
const cameraViews = {
  inside: { name: "Внутренний вид", src: "./assets/images/cab-view.png", desc: "Основная камера в кабине", label: "CabCam · 1080p HDR", zoom: "x2.4" },
  panorama: { name: "Панорама", src: "./assets/images/road-panorama.png", desc: "Широкий обзор дороги", label: "PanoCam · 4K", zoom: "x1.2" },
  cargo: { name: "Фото из кузова", src: "./assets/images/cargo-photo.png", desc: "Контроль груза и креплений", label: "CargoCam · 2K IR", zoom: "x1.8" }
};

const driverPool = [
  { id: "drv-01", name: "Артем Филатов", home: "Казань", status: "На линии · рейтинг 98%", experience: "9 лет", shift: "4ч 18м", rest: "через 1ч 05м", license: "CE", phone: "+7 917 555-44-33" },
  { id: "drv-02", name: "Антон Нечаев", home: "Москва", status: "На линии · рейтинг 96%", experience: "7 лет", shift: "2ч 40м", rest: "через 1ч 50м", license: "CE", phone: "+7 926 330-22-11" },
  { id: "drv-03", name: "Никита Крылов", home: "Н. Новгород", status: "На линии · рейтинг 94%", experience: "6 лет", shift: "3ч 05м", rest: "через 1ч 35м", license: "CE", phone: "+7 910 115-44-20" },
  { id: "drv-04", name: "Иван Гордеев", home: "Казань", status: "На линии · рейтинг 95%", experience: "8 лет", shift: "5ч 00м", rest: "через 0ч 55м", license: "CE", phone: "+7 917 332-18-77" },
  { id: "drv-05", name: "Павел Рогов", home: "Ростов", status: "На линии · рейтинг 93%", experience: "10 лет", shift: "1ч 50м", rest: "через 3ч 10м", license: "CE", phone: "+7 928 554-77-19" },
  { id: "drv-06", name: "Даниил Сорокин", home: "Минск", status: "На линии · рейтинг 92%", experience: "5 лет", shift: "2ч 15м", rest: "через 2ч 45м", license: "CE", phone: "+375 29 744-88-12" },
  { id: "drv-07", name: "Сергей Баранов", home: "Самара", status: "На линии · рейтинг 97%", experience: "11 лет", shift: "3ч 30м", rest: "через 2ч 00м", license: "CE", phone: "+7 927 555-14-71" },
  { id: "drv-08", name: "Владимир Ломакин", home: "Пермь", status: "На линии · рейтинг 95%", experience: "12 лет", shift: "5ч 30м", rest: "через 0ч 30м", license: "CE", phone: "+7 912 330-09-20" },
];

// DOM refs
let trackListEl;
let mechanicalListEl;
let themeToggle;
let themeToggleInput;
let deleteVehicleBtn;
let addVehicleBtn;
let mapBtn;
let alertBtn;
let addForm;
let notifBtn;
let settingsBtn;
let notifPanel;
let settingsPanel;
let notifDot;
let notifIconImg;
let notifUnread = 0;
let tzSelect;
let fuelUnitSelect;
let tempUnitSelect;
let alertModeSelect;
let profileForm;
let driverAvatarBtn;
let driverSelect;
let adminOrderForm;
let adminOrderTitle;
let adminOrderOrigin;
let adminOrderDestination;
let adminOrdersRefreshBtn;
let adminOrdersList;
let adminOrdersEmpty;
let adminOrdersNote;
let statusModal;
let statusMessage;
let statusYes;
let statusNo;
let cameraTabs = [];
let cameraImageEl;
let cameraTitleEl;
let cameraSubtitleEl;
let cameraLabelEl;
let cameraZoomEl;
let currentCamera = "inside";

// Fallback data if JSON not available
const fallbackData = {
  drivers: driverPool,
  vehicles: [
    {
      name: "MAN TGX",
      status: "В пути",
      status2: "Сопровождение",
      status3: "Под охраной",
      cargo: "Продукты ритейл",
      route: "М7 · Р239",
      origin: "Казань",
      destination: "Москва",
      depart: "07:40",
      eta: "18:25",
      avgSpeed: 72,
      load: 77,
      plate: "А123ВС 16 RUS",
      tag: "SDK",
      driver: { name: "Артем Филатов", home: "Казань", status: "На линии · рейтинг 98%", experience: "9 лет", shift: "4ч 18м", rest: "через 1ч 05м", license: "CE", phone: "+7 917 555-44-33" },
      vin: "XW8ZZZTGX001",
      series: "TGX 18.510",
      fuel: 74,
      tank: 720,
      pallets: 38,
      health: "94%",
      distanceTotal: 930,
      distanceDone: 420
    },
    {
      name: "SCANIA R-SERIES",
      status: "В пути",
      status2: "Под охраной",
      status3: "В сопровождении",
      cargo: "Медицинское оборудование",
      route: "М11 · А113",
      origin: "Москва",
      destination: "Санкт-Петербург",
      depart: "06:55",
      eta: "16:40",
      avgSpeed: 78,
      load: 92,
      plate: "О456МН 77 RUS",
      tag: "SDK",
      driver: { name: "Антон Нечаев", home: "Москва", status: "На линии · рейтинг 96%", experience: "7 лет", shift: "2ч 40м", rest: "через 1ч 50м", license: "CE", phone: "+7 926 330-22-11" },
      vin: "XLBZZZR50012",
      series: "R450",
      fuel: 62,
      tank: 700,
      pallets: 36,
      health: "92%",
      distanceTotal: 710,
      distanceDone: 390
    },
    {
      name: "VOLVO FX",
      status: "В пути",
      status2: "Сопровождение",
      status3: "Под охраной",
      cargo: "Фармацевтика (холод)",
      route: "М7 · Р132",
      origin: "Н. Новгород",
      destination: "Владимир",
      depart: "08:10",
      eta: "12:55",
      avgSpeed: 68,
      load: 68,
      plate: "К789АР 52 RUS",
      tag: "SDK",
      driver: { name: "Злата Кузьминчук", home: "Самара", status: "На линии", experience: "11 лет", shift: "5ч 05м", rest: "через 45м", license: "CE", phone: "+7 987 220-10-10" },
      vin: "YV2ZZZFX3012",
      series: "FX 500",
      fuel: 58,
      tank: 760,
      pallets: 40,
      health: "95%",
      distanceTotal: 220,
      distanceDone: 140
    },
    {
      name: "FREIGHTLINER 260",
      status: "В пути",
      load: 81,
      plate: "Р234ВО 63 RUS",
      tag: "SDK",
      status2: "Недогруз",
      status3: "Под охраной",
      cargo: "Промышленное оборудование",
      route: "Р22 · М4",
      origin: "Самара",
      destination: "Ростов-на-Дону",
      depart: "05:50",
      eta: "20:15",
      avgSpeed: 70,
      driver: { name: "Сергей Корниенко", home: "Ростов-на-Дону", status: "Плановый обгон", experience: "6 лет", shift: "3ч 32м", rest: "через 1ч 20м", license: "CE", phone: "+7 928 111-44-77" },
      vin: "1FUCH260003",
      series: "260",
      fuel: 65,
      tank: 690,
      pallets: 34,
      health: "91%",
      distanceTotal: 1270,
      distanceDone: 510
    },
    {
      name: "DURASTAR",
      status: "В пути",
      load: 54,
      plate: "В987НЕ 59 RUS",
      tag: "SDK",
      status2: "Недогруз",
      status3: "В сопровождении",
      cargo: "Стройматериалы",
      route: "Р242 · М5",
      origin: "Пермь",
      destination: "Уфа",
      depart: "07:15",
      eta: "15:05",
      avgSpeed: 64,
      driver: { name: "Макс Клюев", home: "Пермь", status: "На линии", experience: "5 лет", shift: "1ч 12м", rest: "через 2ч 30м", license: "C", phone: "+7 922 555-77-44" },
      vin: "1HTMMAAM55H",
      series: "DuraStar",
      fuel: 71,
      tank: 640,
      pallets: 32,
      health: "90%",
      distanceTotal: 520,
      distanceDone: 210
    },
    {
      name: "FREIGHTLINER M2",
      status: "В пути",
      load: 73,
      plate: "Т321КХ 69 RUS",
      tag: "SDK",
      status2: "Недогруз",
      status3: "Под охраной",
      cargo: "Электроника и бытовая техника",
      route: "М9 · Р132",
      origin: "Тверь",
      destination: "Москва",
      depart: "09:05",
      eta: "12:45",
      avgSpeed: 66,
      driver: { name: "Антон Нечаев", home: "Тверь", status: "На линии · e-лог", experience: "8 лет", shift: "3ч 05м", rest: "через 1ч 45м", license: "CE", phone: "+7 910 330-66-55" },
      vin: "1FVACWCS87HZ",
      series: "M2",
      fuel: 67,
      tank: 700,
      pallets: 35,
      health: "93%",
      distanceTotal: 170,
      distanceDone: 60
    }
  ],
  mechanical: ["ABS", "Тормозные колодки", "Давление шин", "Гидравлика", "Пневмо", "Подвеска", "Масло", "Тяга", "Аккумулятор"]
};

const STORAGE_KEY = "routox-fleet";
const DRIVER_STORAGE_KEY = "routox-drivers";
const STORAGE_VERSION = "v2"; // Increment to force cache refresh

// Check and clear outdated storage
function checkStorageVersion() {
  const storedVersion = localStorage.getItem("routox-version");
  if (storedVersion !== STORAGE_VERSION) {
    console.log("Storage version changed, clearing old data...");
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(DRIVER_STORAGE_KEY);
    localStorage.setItem("routox-version", STORAGE_VERSION);
  }
}

// Run version check on load
checkStorageVersion();

function readStoredVehicles() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(enrichVehicle) : [];
  } catch (err) {
    console.warn("Не удалось прочитать сохраненные фуры", err);
    return [];
  }
}

function readStoredDrivers() {
  try {
    const raw = localStorage.getItem(DRIVER_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("Не удалось прочитать сохраненных водителей", err);
    return [];
  }
}

function persistVehicles() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(vehicles));
  } catch (err) {
    console.warn("Не удалось сохранить фуры", err);
  }
}

function persistDrivers() {
  try {
    localStorage.setItem(DRIVER_STORAGE_KEY, JSON.stringify(drivers));
  } catch (err) {
    console.warn("Не удалось сохранить водителей", err);
  }
}

function updateCargoLayout() {
  if (!selected) return;
  const cold = Math.max(6, Math.round((selected.pallets || 32) * 0.38));
  const dry = Math.max(4, Math.round((selected.pallets || 32) * 0.32));
  const fragile = Math.max(3, Math.round((selected.pallets || 32) * 0.18));
  const aux = Math.max(2, (selected.pallets || 32) - cold - dry - fragile);

  setText("zoneColdValue", `${cold} пал.`);
  setText("zoneDryValue", `${dry} пал.`);
  setText("zoneFragileValue", `${fragile} пал.`);
  setText("zoneAuxValue", `${aux} пал.`);

  const coldTemp = (2 + Math.random() * 2).toFixed(1);
  const dryTemp = (10 + Math.random() * 3).toFixed(1);
  const fragileTemp = (16 + Math.random() * 2).toFixed(1);
  const auxTemp = (20 + Math.random() * 2).toFixed(1);

  const weight = (p) => `${toOne(p * 0.42)} т`;
  setText("zoneColdTemp", `${coldTemp}°C · вакуум · ${weight(cold)}`);
  setText("zoneDryTemp", `${dryTemp}°C · сухо · ${weight(dry)}`);
  setText("zoneFragileTemp", `${fragileTemp}°C · контроль · ${weight(fragile)}`);
  setText("zoneAuxTemp", `${auxTemp}°C · поддержка · ${weight(aux)}`);

  cargoBreakdown = {
    cold: { pallets: cold, temp: coldTemp, weight: weight(cold) },
    dry: { pallets: dry, temp: dryTemp, weight: weight(dry) },
    fragile: { pallets: fragile, temp: fragileTemp, weight: weight(fragile) },
    aux: { pallets: aux, temp: auxTemp, weight: weight(aux) }
  };

  document.querySelectorAll("[data-zone]").forEach((el) => {
    const key = el.dataset.zone;
    const info = cargoBreakdown[key];
    if (info) {
      el.dataset.payload = `${info.pallets} пал. · ${info.weight}`;
    }
  });

  setText("sketchColdMeta", `Холод: ${cold} пал.`);
  setText("sketchDryMeta", `Dry: ${dry} пал.`);
  setText("sketchFragileMeta", `Хрупкие: ${fragile} пал.`);
  setText("sketchAuxMeta", `Док: ${aux} пал.`);

  setText("cargoCoreTemp", `${(3 + Math.random()).toFixed(1)}°C`);
  setText("cargoHumidity", `${(48 + Math.random() * 6).toFixed(0)}%`);
  setText("cargoPressure", `${(1 + Math.random() * 0.04).toFixed(2)} бар`);
  const stamp = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  setText("cargoUpdated", `Обновлено: ${stamp}`);
  showCargoDetail("cold");
}
function dedupeVehicles(list = []) {
  const byKey = new Map();
  list.forEach((v) => {
    const key = v.plate || v.name;
    if (!key) return;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...v });
    } else {
      // Merge vehicles: API data takes priority for driver info
      // Apply stored user modifications for non-driver fields
      Object.keys(v).forEach((k) => {
        if (k === 'driver') return; // handle driver separately
        if (v[k] !== undefined && v[k] !== null && v[k] !== '') {
          if (existing[k] === undefined || existing[k] === null || existing[k] === '') {
            existing[k] = v[k];
          }
        }
      });
      // ALWAYS prefer driver with phone (from API)
      const hasExistingPhone = existing.driver && existing.driver.phone && existing.driver.phone.length > 5;
      const hasNewPhone = v.driver && v.driver.phone && v.driver.phone.length > 5;
      if (hasNewPhone && !hasExistingPhone) {
        existing.driver = { ...(existing.driver || {}), ...v.driver };
      } else if (!existing.driver && v.driver) {
        existing.driver = v.driver;
      }
    }
  });
  return Array.from(byKey.values());
}

function dedupeDrivers(list = []) {
  const seen = new Set();
  return list.filter((d) => {
    const key = d.id || d.name;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeStoredDrivers(baseDrivers = [], storedDrivers = []) {
  const byId = new Map(baseDrivers.map((d) => [d.id || d.name, { ...d }]));
  (storedDrivers || []).forEach((stored) => {
    const key = stored.id || stored.name;
    if (!key) return;
    const current = byId.get(key);
    if (!current) {
      byId.set(key, { ...stored });
      return;
    }
    // Apply user edits, but don't allow placeholders to overwrite real data.
    if (stored.name && stored.name !== "Новый водитель") current.name = stored.name;
    if (stored.home && stored.home !== "Не указана") current.home = stored.home;
    if (stored.status && stored.status !== "На линии") current.status = stored.status;
    if (stored.experience && stored.experience !== "5 лет") current.experience = stored.experience;
    if (stored.license && stored.license !== "CE") current.license = stored.license;
    if (stored.shift && stored.shift !== "3ч 00м") current.shift = stored.shift;
    if (stored.rest && stored.rest !== "через 2ч") current.rest = stored.rest;
    if (isValidPhoneLike(stored.phone)) current.phone = stored.phone;
  });
  return Array.from(byId.values());
}

function ensureFleetCount(list = [], min = 6) {
  const result = [...list];
  let idx = 0;
  while (result.length < min) {
    const template = enrichVehicle({ ...fallbackData.vehicles[idx % fallbackData.vehicles.length] }, result.length + idx);
    if (!result.find((v) => v.plate === template.plate || v.name === template.name)) {
      result.push(template);
    }
    idx += 1;
  }
  return result;
}

function resolveDriver(driverId, fallbackDriver) {
  // First try to find by driverId
  if (driverId) {
    const found = drivers.find((d) => d.id === driverId);
    if (found) return found;
  }
  // Then try fallback driver object (from API)
  if (fallbackDriver && fallbackDriver.name) {
    return {
      id: fallbackDriver.id || `api-${Date.now()}`,
      name: fallbackDriver.name,
      phone: fallbackDriver.phone || '',
      home: fallbackDriver.home || fallbackDriver.home_base || '',
      license: fallbackDriver.license || fallbackDriver.license_class || 'CE',
      status: fallbackDriver.status || `На линии · рейтинг ${fallbackDriver.rating || '95%'}`,
      rating: fallbackDriver.rating || '95%',
      experience: fallbackDriver.experience || '5 лет',
      shift: fallbackDriver.shift || '3ч 00м',
      rest: fallbackDriver.rest || 'через 2ч',
    };
  }
  // Finally return first driver from pool
  return drivers[0] || null;
}

function assignDriverToVehicle(vehicle, driverId) {
  if (!vehicle) return vehicle;
  // If vehicle already has driver from API, don't override
  if (vehicle.driver && vehicle.driver.name) {
    return vehicle;
  }
  const resolved = resolveDriver(driverId);
  if (resolved) {
    vehicle.driverId = resolved.id;
    vehicle.driver = resolved;
  }
  return vehicle;
}

function pickDriverId() {
  if (!drivers.length) return null;
  const counts = drivers.reduce((acc, d) => ({ ...acc, [d.id]: 0 }), {});
  vehicles.forEach((v) => {
    if (v.driverId && counts[v.driverId] !== undefined) counts[v.driverId] += 1;
  });
  return drivers.slice().sort((a, b) => counts[a.id] - counts[b.id])[0].id;
}

function shiftInfo(driver) {
  const used = minutesFromLabel(driver?.shift || "0ч 0м");
  const remaining = clamp(720 - used, 0, 720);
  return { usedLabel: minutesToLabel(used), remainingLabel: minutesToLabel(remaining) };
}

function enrichVehicle(v = {}, idx = 0) {
  const pair = cityPairs[idx % cityPairs.length];
  // Use provided values or fallback to defaults
  const distanceTotal = v.distanceTotal !== undefined ? v.distanceTotal : (620 + Math.floor(Math.random() * 320));
  const distanceDone = v.distanceDone !== undefined ? v.distanceDone : Math.max(140, Math.floor(distanceTotal * (0.35 + Math.random() * 0.45)));
  // Get image - try exact name match first, then partial match
  let img = v.image;
  if (!img && v.name) {
    // Try exact match
    img = truckImages[v.name];
    // If not found, try partial match (for API vehicles like "Volvo FH16 #1")
    if (!img) {
      const nameLower = v.name.toLowerCase();
      for (const [key, val] of Object.entries(truckImages)) {
        if (nameLower.includes(key.toLowerCase().split(' ')[0]) || key.toLowerCase().includes(nameLower.split(' ')[0])) {
          img = val;
          break;
        }
      }
    }
  }
  img = img || "./assets/images/truck-data.png";
  const driverId = v.driverId || driverPool[idx % driverPool.length].id;
  return {
    ...v,
    driverId,
    // Preserve API values, only use fallback if truly empty
    origin: v.origin || pair.from,
    destination: v.destination || pair.to,
    depart: v.depart || `${8 + (idx % 3)}:${(10 + idx * 7).toString().padStart(2, "0")}`,
    eta: v.eta || `${17 + (idx % 4)}:${(25 + idx * 3).toString().padStart(2, "0")}`,
    distanceTotal: distanceTotal,
    distanceDone: distanceDone,
    avgSpeed: v.avgSpeed !== undefined ? v.avgSpeed : (60 + Math.floor(Math.random() * 22)),
    statuses: v.statuses || [v.status || "В пути", v.status2 || "Недогруз", v.status3 || "Под охраной"],
    load: typeof v.load === "number" ? v.load : Number(v.load || 0),
    plate: v.plate || "А000АА 77 RUS",
    image: img,
  };
}

function enrichDriver(d = {}, idx = 0) {
  return {
    id: d.id || `drv-${(idx + 1).toString().padStart(2, "0")}`,
    name: d.name || "Новый водитель",
    home: d.home || d.home_base || "Не указана",
    status: d.status || "На линии",
    experience: d.experience || "5 лет",
    phone: d.phone || "",
    license: d.license || d.license_class || "CE",
    shift: d.shift || "3ч 00м",
    rest: d.rest || "через 2ч",
  };
}

function applyTheme(theme) {
  const isLight = theme === "light";
  document.body.classList.toggle("theme-light", isLight);
  document.documentElement.classList.toggle("theme-light", isLight);
  document.documentElement.style.colorScheme = isLight ? "light" : "dark";
  if (themeToggleInput) themeToggleInput.checked = isLight;
  if (themeToggle) {
    themeToggle.setAttribute(
      "aria-label",
      isLight ? "Выключить светлую тему" : "Включить светлую тему"
    );
  }
  try {
    localStorage.setItem("routox-theme", theme);
  } catch (err) {
    console.warn("Не удалось сохранить настройку темы", err);
  }
}

function loadTheme() {
  let saved = null;
  try {
    saved = localStorage.getItem("routox-theme");
  } catch (err) {
    saved = null;
  }
  applyTheme(saved || "dark");
}

function renderMechanical() {
  if (!mechanicalListEl) return;
  mechanicalListEl.innerHTML = (mechanical || [])
    .map((id) => {
      const status = Math.random() > 0.12 ? "ok" : Math.random() > 0.5 ? "warn" : "fail";
      const color = status === "ok" ? "text-emerald-400" : status === "warn" ? "text-amber-400" : "text-red-400";
      const label = status === "ok" ? "Ок" : status === "warn" ? "Внимание" : "Сбой";
      return `
        <button class="flex items-center justify-between glass rounded-lg p-2 border border-slate-800 sensor-item w-full text-left" data-sensor="${id}" data-status="${status}">
          <div class="flex items-center gap-2">
            <span class="led ${color}"></span>
            <span>${id}</span>
          </div>
          <span class="text-xs text-slate-400">${label}</span>
        </button>
      `;
    })
    .join("");
  
  // Also update the new visual mechanical condition bars
  updateMechanicalBars();
}

// New visual Mechanical Condition bars (like on the reference image)
function updateMechanicalBars() {
  if (!selected) return;
  
  // Generate values based on vehicle health
  const baseHealth = parseInt(selected.health) || 90;
  const jitter = () => Math.round(Math.random() * 6 - 3);
  
  const values = {
    engine: clamp(baseHealth - 4 + jitter(), 50, 100),
    brakes: clamp(baseHealth - 1 + jitter(), 50, 100),
    tires: clamp(baseHealth - 10 + jitter(), 50, 100),
    oil: clamp(baseHealth - 5 + jitter(), 50, 100),
    suspension: clamp(baseHealth + 2 + jitter(), 50, 100)
  };
  
  // Calculate overall
  const overall = Math.round((values.engine + values.brakes + values.tires + values.oil + values.suspension) / 5);
  
  // Update overall
  setText('mechOverallPercent', `${overall}%`);
  
  // Determine status label
  const overallStatus = document.querySelector('#mechOverallPercent + span');
  if (overallStatus) {
    if (overall >= 85) {
      overallStatus.className = 'flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      overallStatus.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400"></span> Optimal';
    } else if (overall >= 70) {
      overallStatus.className = 'flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30';
      overallStatus.innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-400"></span> Warning';
    } else {
      overallStatus.className = 'flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30';
      overallStatus.innerHTML = '<span class="w-2 h-2 rounded-full bg-red-400"></span> Critical';
    }
  }
  
  // Update each bar
  Object.entries(values).forEach(([key, value]) => {
    const percentEl = document.getElementById(`mech${capitalize(key)}Percent`);
    const barEl = document.getElementById(`mech${capitalize(key)}Bar`);
    
    if (percentEl) percentEl.textContent = `${value}%`;
    if (barEl) {
      barEl.style.height = `${value}%`;
      // Color based on value
      if (value >= 85) {
        barEl.style.background = 'linear-gradient(to top, #3b82f6 0%, #60a5fa 50%, #93c5fd 100%)';
      } else if (value >= 70) {
        barEl.style.background = 'linear-gradient(to top, #f59e0b 0%, #fbbf24 50%, #fde68a 100%)';
      } else {
        barEl.style.background = 'linear-gradient(to top, #ef4444 0%, #f87171 50%, #fca5a5 100%)';
      }
    }
  });
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function renderTrackList() {
  if (!trackListEl) return;
  trackListEl.innerHTML = "";
  if (!vehicles.length) {
    trackListEl.innerHTML = '<div class="text-sm text-slate-400">Нет доступных фур</div>';
    return;
  }
  vehicles.forEach((v) => {
    const loadLabel = `${toOne(v.load ?? 0)}%`;
    const progress = v.distanceTotal ? clamp((v.distanceDone / v.distanceTotal) * 100, 0, 100) : v.load || 0;
    const statusLabels = [v.status, v.status2, v.status3].filter(Boolean);
    const isFree = v.status === "Свободен" || v.status_main === "Свободен";
    const card = document.createElement("button");
    card.className = "w-full glass rounded-xl p-3 text-left border border-slate-800 hover:border-emerald-400/50 transition";
    if (v === selected) card.classList.add("card-active");
    
    if (isFree) {
      // Свободная фура - без груза и маршрута
      card.innerHTML = `
        <div class="flex items-center justify-between">
          <div class="font-semibold">${v.name}</div>
          <span class="text-xs px-2 py-1 rounded-full bg-emerald-800/30 border border-emerald-600/50 text-emerald-300">Свободен</span>
        </div>
        <div class="mt-1 text-xs text-slate-500">
          <span><i class="fa-solid fa-location-dot mr-1"></i>Без маршрута</span>
        </div>
        <div class="mt-2 flex items-center gap-2 text-xs text-slate-400">
          <span><i class="fa-solid fa-gas-pump mr-1"></i>${v.fuel || 100}%</span>
          <span><i class="fa-solid fa-heart-pulse mr-1"></i>${v.health || '100%'}</span>
          <span class="text-emerald-400/70"><i class="fa-solid fa-circle-check mr-1"></i>Готов к загрузке</span>
        </div>
      `;
    } else {
      // Фура в работе
      card.innerHTML = `
        <div class="flex items-center justify-between">
          <div class="font-semibold">${v.name}</div>
          <span class="text-xs px-2 py-1 rounded-full bg-slate-800 border border-slate-700">${v.tag || "SDK"}</span>
        </div>
        <div class="mt-1 text-xs text-slate-400 flex gap-2 flex-wrap">
          ${statusLabels.length ? statusLabels.map((s) => `<span>${s}</span>`).join("") : `<span>Без статусов</span>`}
          ${v.cargo ? `<span>Груз: ${v.cargo}</span>` : ""}
          ${v.route ? `<span>Маршрут: ${v.route}</span>` : ""}
          ${v.origin ? `<span>${v.origin} → ${v.destination}</span>` : ""}
        </div>
        <div class="mt-2 space-y-1">
          ${v.status === "Обслуживание"
          ? `<div class="text-xs text-amber-400">На обслуживании · загрузка не учитывается</div>`
          : `<div class="flex items-center justify-between text-xs">
              <span>Загрузка</span><span>${loadLabel}</span>
            </div>
            <div class="progress mt-1"><span style="width:${clamp(v.load ?? 0, 5, 100)}%" class="${(v.load ?? 0) > 85 ? "bg-amber-400/80" : "bg-emerald-500/70"}"></span></div>`}
          <div class="flex items-center justify-between text-[11px] text-slate-400">
            <span>Прогресс рейса</span>
            <span>${progress.toFixed(1)}%</span>
          </div>
          <div class="progress"><span style="width:${progress}%" class="bg-sky-400/70"></span></div>
        </div>
      `;
    }
    card.onclick = () => selectVehicle(v);
    trackListEl.appendChild(card);
  });
  renderHeaderMetrics();
}

function updateDriverCard() {
  if (!selected) return;
  const driver = resolveDriver(selected.driverId, selected.driver) || {};
  setText("driverName", driver.name || "Водитель не назначен");
  setText("driverStatus", driver.status || "Статус неизвестен");
  setText("driverHome", driver.home ? `База: ${driver.home}` : "База не указана");
  setText("driverExperience", driver.experience || "—");
  const shift = shiftInfo(driver);
  setText("driverShift", shift.usedLabel || driver.shift || "—");
  setText("driverRemaining", shift.remainingLabel || "—");
  setText("driverRest", driver.rest || "—");
  setText("driverLicense", driver.license || "C");
  const avatar = document.getElementById("driverAvatar");
  if (avatar) avatar.textContent = getInitials(driver.name);
  const phoneEl = document.getElementById("driverPhone");
  const phoneRaw = isValidPhoneLike(driver.phone || "") ? (driver.phone || "") : "";
  const phoneFormatted = formatPhone(phoneRaw);
  if (phoneEl) phoneEl.textContent = phoneFormatted;
  const callLink = document.getElementById("driverCall");
  if (callLink) {
    const tel = phoneToTel(phoneRaw);
    if (tel) {
      callLink.href = `tel:${tel}`;
      callLink.title = `Позвонить: ${phoneFormatted}`;
      callLink.setAttribute("aria-disabled", "false");
      callLink.style.pointerEvents = "auto";
      callLink.style.opacity = "1";
    } else {
      callLink.href = "#";
      callLink.title = "Телефон не указан";
      callLink.setAttribute("aria-disabled", "true");
      callLink.style.pointerEvents = "none";
      callLink.style.opacity = "0.6";
    }
  }
  setText("driverPhonePill", phoneFormatted);
  const driverSelect = document.getElementById("driverSelect");
  if (driverSelect) driverSelect.value = driver.id || "";
}

function renderDriverOptions() {
  const driverSelect = document.getElementById("driverSelect");
  if (!driverSelect) return;
  driverSelect.innerHTML = ['<option value="">Без назначения</option>', ...drivers.map((d) => `<option value="${d.id}">${d.name} · ${d.home}</option>`)].join("");
}

function updateTruckStats() {
  if (!selected) return;
  const load = selected.status === "Обслуживание" ? 0 : selected.load || 60;
  setText("truckLoadValue", selected.status === "Обслуживание" ? "—" : `${toOne(load)}%`);
  const loadBar = document.getElementById("truckLoadBar");
  if (loadBar) loadBar.style.width = selected.status === "Обслуживание" ? "0%" : clamp(load, 5, 100) + "%";
  const capacity = selected.pallets || 36;
  const loaded = Math.round((capacity * load) / 100);
  setText("truckPallets", `${loaded}/${capacity} пал.`);

  const fuelPercent = clamp(selected.fuel ?? 68, 18, 100);
  const tank = selected.tank || 700;
  const liters = Math.round((tank * fuelPercent) / 100);
  const fuelValue = prefs.fuelUnit === "gal" ? `${toOne(liters / 3.785)} гал.` : `${liters} л`;
  setText("truckFuelValue", fuelValue);
  setText("truckFuelStatus", `${fuelPercent}%`);
  const fuelBar = document.getElementById("truckFuelBar");
  if (fuelBar) fuelBar.style.width = fuelPercent + "%";

  setText("truckVin", selected.vin || "SDK-0000");
  setText("truckSeries", selected.series || selected.tag || "SDK");
  setText("truckHealthValue", selected.health || "92%");
  setText("truckChassis", selected.chassis || "6x4");
  setText("truckMass", selected.mass || "38 т");
  setText("truckSize", selected.size || "4.0 м / 13.6 м");
  setText("truckAxle", selected.axle || "11.5 / 10 / 10 т");
}

function updateCargoLayout() {
  if (!selected) return;
  const capacity = selected.pallets || 36;
  const load = clamp(selected.load || 60, 10, 100);
  const total = Math.max(4, Math.round((capacity * load) / 100));
  const cold = Math.max(2, Math.round(total * 0.35));
  const dry = Math.max(1, Math.round(total * 0.3));
  const fragile = Math.max(1, Math.round(total * 0.2));
  const aux = Math.max(1, total - cold - dry - fragile);

  setText("zoneColdValue", `${cold} пал.`);
  setText("zoneDryValue", `${dry} пал.`);
  setText("zoneFragileValue", `${fragile} пал.`);
  setText("zoneAuxValue", `${aux} пал.`);

  const coldTemp = (2 + Math.random() * 2).toFixed(1);
  const dryTemp = (10 + Math.random() * 3).toFixed(1);
  const fragileTemp = (16 + Math.random() * 2).toFixed(1);
  const auxTemp = (20 + Math.random() * 2).toFixed(1);

  const weight = (p) => `${toOne(p * 0.42)} т`;
  setText("zoneColdTemp", `${coldTemp}°C · вакуум · ${weight(cold)}`);
  setText("zoneDryTemp", `${dryTemp}°C · сухо · ${weight(dry)}`);
  setText("zoneFragileTemp", `${fragileTemp}°C · контроль · ${weight(fragile)}`);
  setText("zoneAuxTemp", `${auxTemp}°C · поддержка · ${weight(aux)}`);

  cargoBreakdown = {
    cold: { pallets: cold, temp: coldTemp, weight: weight(cold) },
    dry: { pallets: dry, temp: dryTemp, weight: weight(dry) },
    fragile: { pallets: fragile, temp: fragileTemp, weight: weight(fragile) },
    aux: { pallets: aux, temp: auxTemp, weight: weight(aux) }
  };

  document.querySelectorAll("[data-zone]").forEach((el) => {
    const key = el.dataset.zone;
    const info = cargoBreakdown[key];
    if (info) {
      el.dataset.payload = `${info.pallets} пал. · ${info.weight}`;
    }
  });

  setText("sketchColdMeta", `Холод: ${cold} пал.`);
  setText("sketchDryMeta", `Dry: ${dry} пал.`);
  setText("sketchFragileMeta", `Хрупкие: ${fragile} пал.`);
  setText("sketchAuxMeta", `Док: ${aux} пал.`);

  setText("cargoCoreTemp", `${(3 + Math.random()).toFixed(1)}°C`);
  setText("cargoHumidity", `${(48 + Math.random() * 6).toFixed(0)}%`);
  setText("cargoPressure", `${(1 + Math.random() * 0.04).toFixed(2)} бар`);
  const stamp = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  setText("cargoUpdated", `Обновлено: ${stamp}`);
  showCargoDetail("cold");
}

function showCargoDetail(zone) {
  if (!cargoBreakdown || !zone) return;
  const info = cargoBreakdown[zone];
  if (!info) return;
  const labels = {
    cold: "Фронт · Холод",
    dry: "Секция Dry",
    fragile: "Хрупкие",
    aux: "Aux / Док"
  };
  setText("cargoZoneLabel", labels[zone] || zone);
  setText("cargoZoneInfo", `${info.pallets} пал. · ${info.weight}`);
  document.querySelectorAll("[data-zone]").forEach((el) => {
    el.classList.toggle("active", el.dataset.zone === zone);
  });
}

function updateStatuses(newStatus, force = false) {
  if (!selected || !newStatus) return;
  const current = [selected.status, selected.status2, selected.status3].filter(Boolean);
  if (current.includes(newStatus)) {
    showToast("Такой статус уже есть");
    return;
  }

  const isPrimary = (val) => primaryStatuses.includes(val);
  const currentPrimary = current.find(isPrimary);
  const incomingPrimary = isPrimary(newStatus);

  // Ask before replacing an existing primary status with a different one
  if (incomingPrimary && currentPrimary && currentPrimary !== newStatus && !force) {
    if (statusMessage) statusMessage.textContent = `Заменить основной статус "${currentPrimary}" на "${newStatus}"?`;
    pendingStatus = newStatus;
    toggleModal("statusModal", true);
    return;
  }

  const secondary = current.filter((s) => !isPrimary(s));
  const next = incomingPrimary ? [newStatus, ...secondary] : [currentPrimary, ...secondary, newStatus].filter(Boolean);
  const unique = next.filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 3);
  [selected.status, selected.status2, selected.status3] = [unique[0] || "", unique[1] || "", unique[2] || ""];

  persistVehicles();
  updateSelected();
  renderTrackList();
  renderTrips();
  renderHeaderMetrics();

  const toastLabel = incomingPrimary && currentPrimary && currentPrimary !== newStatus ? `Основной статус изменен: ${newStatus}` : `Статус добавлен: ${newStatus}`;
  showToast(toastLabel);
}

function renderStatusBadges() {
  const wrap = document.getElementById("selStatuses");
  if (!wrap || !selected) return;
  const statuses = [
    { key: "status", label: selected.status },
    { key: "status2", label: selected.status2 },
    { key: "status3", label: selected.status3 },
  ].filter((s) => s.label);
  const pills = statuses.length
    ? statuses
        .map((s) => {
          const tone = statusColors[s.label] || "bg-slate-600/30 text-slate-200 border border-slate-500/50";
          return `<span class="status-pill ${tone}"><span>${s.label}</span><button class="status-remove" data-remove-status="${s.key}" aria-label="Удалить статус"><i class="fa-solid fa-xmark"></i></button></span>`;
        })
        .join("")
    : '<span class="pill-muted text-xs">Статусов нет</span>';
  const tag = `<span class="status-pill bg-slate-700 text-slate-100 border border-slate-600" aria-label="Тэг фуры">${selected.tag || "SDK"}</span>`;
  wrap.innerHTML = pills + tag;
}

function updateSelected() {
  if (!selected) return;
  setText("selName", selected.name || "—");
  const cargoLabel = selected.cargo || "Груз не указан";
  const routeLabel = selected.route || "Маршрут не указан";
  setText("selCargo", `Груз: ${cargoLabel} · Маршрут: ${routeLabel}`);
  renderStatusBadges();

  const rollVal = selected.load || 60;
  setText("rollValLabel", toOne(rollVal) + "%");
  const rollBar = document.getElementById("rollBar");
  if (rollBar) rollBar.style.width = rollVal + "%";
  const heroLoadInit = document.getElementById("heroLoadValue");
  if (heroLoadInit) heroLoadInit.textContent = selected.status === "Обслуживание" ? "—" : `${toOne(rollVal)}%`;
  const heroImage = document.getElementById("heroImage");
  if (heroImage) heroImage.src = selected.image || "./assets/images/truck-data.png";
  setText("heroPlateValue", selected.plate || "—");

  // Update cargo constructor truck thumbnail
  const cargoTruckThumb = document.getElementById("cargoTruckThumb");
  if (cargoTruckThumb) cargoTruckThumb.src = selected.image || "./assets/images/truck-data.png";
  setText("cargoTruckName", selected.name || "—");
  
  // Update cargo constructor truck SVG image
  updateCargoTruckImage();

  updateDriverCard();
  updateTruckStats();
  updateCargoLayout();
  updateRouteMap();
  updateMechanicalBars();
  metricTweaks();
  
  // Update camera vehicle ID
  setText('cameraVehicleId', selected.plate ? selected.plate.split(' ')[0] : 'TR-001');
}

// Update the truck SVG in cargo constructor based on selected vehicle
function updateCargoTruckImage() {
  if (!selected) return;
  
  const truckConfig = getTruckConfig(selected.name);
  const truckSvgContainer = document.getElementById('cargoTruckSvg');
  const cargoGridOverlay = document.getElementById('cargoGridOverlay');
  
  if (truckSvgContainer && truckConfig.image) {
    // Load the specific truck SVG
    fetch(truckConfig.image)
      .then(res => res.ok ? res.text() : null)
      .then(svgContent => {
        if (svgContent) {
          truckSvgContainer.innerHTML = svgContent;
        }
      })
      .catch(() => {});
  }
  
  // Update cargo grid position based on truck trailer dimensions
  if (cargoGridOverlay) {
    const style = getCargoGridStyle(truckConfig);
    cargoGridOverlay.style.cssText = style + ' position: absolute;';
  }
}

function metricTweaks() {
  if (!selected) return;
  const temp = 22 + Math.round(Math.random() * 6);
  const tempLabel = temp + "°C";
  setText("tempVal", tempLabel);
  const heroTemp = document.getElementById("heroTempValue");
  if (heroTemp) heroTemp.textContent = tempLabel;
  setText("truckTempValue", tempLabel);

  const dev = Number((Math.random() * 8 - 4).toFixed(1));
  const devWarn = Math.abs(dev) >= 1.5;
  const devCircleEl = document.getElementById("devCircle");
  if (devCircleEl) {
    devCircleEl.textContent = dev.toFixed(1) + "°";
    devCircleEl.classList.toggle("dev-warn", devWarn);
    devCircleEl.classList.toggle("dev-ok", !devWarn);
  }
  setText("devLabel", devWarn ? "Требует коррекции" : "Стабильно");

  const roll = (selected.load || 60) + (Math.random() * 6 - 3);
  const rollClamped = clamp(roll, 20, 98);
  setText("rollValLabel", rollClamped.toFixed(1) + "%");
  const rollBar = document.getElementById("rollBar");
  if (rollBar) rollBar.style.width = rollClamped + "%";
  const heroLoad = document.getElementById("heroLoadValue");
  if (heroLoad) heroLoad.textContent = rollClamped.toFixed(1) + "%";

  setText("metricActive", `${(3 + Math.random() * 3).toFixed(1)}ч`);
  setText("metricDry", `${Math.round(5 + Math.random() * 5)} циклов`);
  const baseSpeed = selected.avgSpeed || 68;
  const jitterSpeed = clamp(baseSpeed + Math.random() * 6 - 3, 40, 110).toFixed(0);
  const speedLabel = `${jitterSpeed} км/ч`;
  setText("metricSpeed", speedLabel);
  const heroSpeed = document.getElementById("heroSpeedValue");
  if (heroSpeed) heroSpeed.textContent = speedLabel;
  setText("metricTrunk", Math.random() > 0.2 ? "Включено" : "Выключено");
  setText("metricRunway", Math.random() > 0.2 ? "Штатный день" : "Контроль погоды");
  setText("metricGymm", `${(30 + Math.random() * 25).toFixed(0)} ед`);

  const heading = Math.floor(Math.random() * 360);
  const headings = ["С", "СВ", "В", "ЮВ", "Ю", "ЮЗ", "З", "СЗ"];
  const dir = headings[Math.round(heading / 45) % headings.length];
  setText("cameraCourse", `${dir} · ${heading}°`);

  updateCargoLayout();
}

function randomizeFaults() {
  const faultBtns = document.querySelectorAll(".fault-btn");
  if (!faultBtns.length) return;
  faultBtns.forEach((btn) => {
    const active = Math.random() > 0.45;
    btn.classList.toggle("fault-off", !active);
    btn.classList.toggle("pulse", active);
  });
}

function toggleModal(id, show) {
  const el = document.getElementById(id);
  if (!el) return;
  if (show) {
    el.classList.remove("hidden");
    el.classList.add("flex");
  } else {
    el.classList.add("hidden");
    el.classList.remove("flex");
  }
}

function mapUrl(origin, destination) {
  const query = encodeURIComponent(`${origin || ""} to ${destination || ""}`.trim() || "Russia");
  return `https://www.google.com/maps?q=${query}&output=embed`;
}

function updateMapFrame() {
  const frame = document.getElementById("mapFrame");
  const fallback = document.getElementById("mapFallback");
  if (!frame) return;
  const url = mapUrl(selected?.origin, selected?.destination);
  frame.src = url;
  if (fallback) fallback.classList.add("hidden");
  frame.onerror = () => fallback?.classList.remove("hidden");
}

function showToast(msg) {
  const toast = document.getElementById("toast");
  const msgEl = document.getElementById("toastMsg");
  if (!toast || !msgEl) return;
  msgEl.textContent = msg;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 2400);
}

function showSensorDetail(name, status) {
  const nameEl = document.getElementById("sensorName");
  const statusEl = document.getElementById("sensorStatus");
  const hintEl = document.getElementById("sensorHint");
  if (nameEl) nameEl.textContent = name || "—";
  const label = status === "ok" ? "Работает" : status === "warn" ? "Потеря пакетов" : "Сбой";
  if (statusEl) statusEl.textContent = label;
  const hint = status === "ok" ? "Телеметрия стабильна" : status === "warn" ? "Проверить соединение CAN, задержка 3-5с" : "Требуется диагностика: питание/проводка";
  if (hintEl) hintEl.textContent = hint;
  toggleModal("sensorModal", true);
}

function selectVehicle(v) {
  selected = v;
  updateSelected();
  renderTrackList();
  renderTrips();
  renderGeoMap();
  renderAnalytics();
  // Load cargo for selected vehicle
  if (typeof loadDemoCargoForVehicle === 'function') {
    loadDemoCargoForVehicle(v);
  }
}

// Async API version
async function addVehicle(payload) {
  try {
    const apiPayload = {
      name: payload.name || "Новый транспорт",
      plate: payload.plate || `А${Math.floor(Math.random() * 900 + 100)}АА 77 RUS`,
      vin: payload.vin || `SDK-${Math.floor(Math.random() * 9000 + 1000)}`,
      series: payload.series || "SDK",
      tag: "SDK",
      status_main: payload.status || "В пути",
      status_secondary: payload.status === "Обслуживание" ? [] : ["Недогруз", "В сопровождении"],
      cargo_desc: payload.cargo || "Груз не указан",
      route_code: payload.route || "Маршрут не указан",
      origin: payload.origin || "",
      destination: payload.destination || "",
      depart_at: payload.depart || "",
      eta_at: payload.eta || "",
      distance_total_km: payload.distanceTotal || 0,
      distance_done_km: payload.distanceDone || 0,
      avg_speed: payload.avgSpeed || 0,
      load_pct: payload.status === "Обслуживание" ? 0 : Number(payload.load) || 60,
      fuel_pct: payload.fuel ?? 70,
      tank_l: payload.tank || 700,
      pallets_capacity: payload.pallets || 32,
      health_pct: payload.health ? parseFloat(payload.health.replace('%', '')) : 92,
      image_url: payload.image || undefined,
      driver_profile_id: payload.driverId || pickDriverId(),
    };
    
    if (authToken) {
      const newVehicle = await apiRequest("/vehicles", {
        method: "POST",
        body: JSON.stringify(apiPayload),
      });
      
      const v = {
        ...newVehicle,
        status: newVehicle.status_main || "В пути",
        status2: newVehicle.status_secondary?.[0] || "",
        status3: newVehicle.status_secondary?.[1] || "",
        load: newVehicle.load_pct || 0,
        fuel: newVehicle.fuel_pct || 0,
        tank: newVehicle.tank_l || 0,
        pallets: newVehicle.pallets_capacity || 0,
        health: newVehicle.health_pct ? `${newVehicle.health_pct}%` : "100%",
        cargo: newVehicle.cargo_desc || "",
        route: newVehicle.route_code || "",
        plate: newVehicle.plate || "",
        vin: newVehicle.vin || "",
        series: newVehicle.series || "",
        tag: newVehicle.tag || "",
        image: newVehicle.image_url || undefined,
        driverId: newVehicle.driver_profile_id || undefined,
        origin: newVehicle.origin || "",
        destination: newVehicle.destination || "",
        depart: newVehicle.depart_at || "",
        eta: newVehicle.eta_at || "",
        distanceTotal: newVehicle.distance_total_km || 0,
        distanceDone: newVehicle.distance_done_km || 0,
        avgSpeed: newVehicle.avg_speed || 0,
      };
      const enriched = enrichVehicle(v, vehicles.length);
      vehicles.unshift(enriched);
      selectVehicle(enriched);
      toggleModal("addModal", false);
      showToast("Фура добавлена");
      renderTrackList();
      updateSelected();
      renderHeaderMetrics();
    } else {
      // Fallback to local
      addVehicleLocal(payload);
    }
  } catch (error) {
    console.error("Failed to add vehicle:", error);
    showToast(`Ошибка: ${error.message}`);
    // Fallback to local on error
    addVehicleLocal(payload);
  }
}

// This is the fallback local version
function addVehicleLocal(payload) {
  const v = {
    name: payload.name || "Новый транспорт",
    status: payload.status || "В пути",
    status2: "Недогруз",
    status3: "В сопровождении",
    load: payload.status === "Обслуживание" ? 0 : Number(payload.load) || 60,
    tag: "SDK",
    driverId: payload.driverId || pickDriverId(),
    vin: payload.vin || `SDK-${Math.floor(Math.random() * 9000 + 1000)}`,
    series: payload.series || "SDK",
    fuel: payload.fuel ?? 70,
    tank: payload.tank || 700,
    pallets: payload.pallets || 32,
    health: payload.health || "92%",
    cargo: payload.cargo || "Груз не указан",
    route: payload.route || "Маршрут не указан",
    origin: payload.origin || "",
    destination: payload.destination || "",
    depart: payload.depart || "",
    eta: payload.eta || "",
    distanceTotal: payload.distanceTotal || 0,
    distanceDone: payload.distanceDone || 0,
    avgSpeed: payload.avgSpeed || 0,
    plate: payload.plate || "А000АА 77 RUS",
    image: payload.image || undefined,
  };
  const enriched = enrichVehicle(v, vehicles.length);
  vehicles.unshift(enriched);
  persistVehicles();
  selectVehicle(enriched);
  toggleModal("addModal", false);
  showToast("Транспорт добавлен");
  renderTrips();
  renderGeoMap();
  renderAnalytics();
  renderHeaderMetrics();
}

// Leaflet map instance
let routeLeafletMap = null;
let routeMarkers = [];
let routeLine = null;
let truckMarker = null;

// City coordinates for demo routes
const cityCoords = {
  'Казань': [55.7887, 49.1221],
  'Москва': [55.7558, 37.6173],
  'Минск': [53.9006, 27.5590],
  'Санкт-Петербург': [59.9311, 30.3609],
  'Нижний Новгород': [56.2965, 43.9361],
  'Екатеринбург': [56.8389, 60.6057],
  'Самара': [53.1959, 50.1002],
  'Воронеж': [51.6720, 39.1843],
  'Краснодар': [45.0355, 38.9753],
  'Ростов-на-Дону': [47.2357, 39.7015],
  'Новосибирск': [55.0084, 82.9357],
  'Челябинск': [55.1644, 61.4368],
  'Пермь': [58.0105, 56.2502],
  'Уфа': [54.7388, 55.9721],
  'Красноярск': [56.0153, 92.8932],
  'Рига': [56.9496, 24.1052],
  'Киев': [50.4501, 30.5234],
  'Варшава': [52.2297, 21.0122],
  'Берлин': [52.5200, 13.4050],
  'Прага': [50.0755, 14.4378],
};

function initRouteLeafletMap() {
  const mapContainer = document.getElementById('routeMapLeaflet');
  if (!mapContainer) return;
  
  // Destroy previous instance if exists
  if (routeLeafletMap) {
    routeLeafletMap.remove();
    routeLeafletMap = null;
  }
  
  // Initialize map centered on Russia
  routeLeafletMap = L.map('routeMapLeaflet', {
    center: [55.7558, 49.0],
    zoom: 5,
    zoomControl: true,
    attributionControl: false,
  });
  
  // Dark theme tile layer
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
  }).addTo(routeLeafletMap);
  
  // Custom truck icon
  const truckIcon = L.divIcon({
    html: '<div class="truck-map-marker"><i class="fa-solid fa-truck text-lg"></i></div>',
    className: 'truck-marker-wrapper',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
  
  // Add empty truck marker (will be positioned in updateRouteMap)
  truckMarker = L.marker([55.7558, 49.0], { icon: truckIcon }).addTo(routeLeafletMap);
}

function updateRouteMap() {
  if (!selected) return;
  const total = selected.distanceTotal || 0;
  const done = clamp(selected.distanceDone || 0, 0, total || 1);
  const progress = total ? clamp((done / total) * 100, 0, 100) : 0;
  setText("routeProgressLabel", `Пройдено ${progress.toFixed(1)}%`);
  
  // Update route info
  const origin = selected.origin || "Точка отправления";
  const destination = selected.destination || "Точка назначения";
  setText("routeFrom", origin);
  setText("routeTo", destination);
  setText("routeDistance", `${done.toFixed(0)} / ${total.toFixed(0)} км`);
  setText("routeSpeed", `Ср. скорость ${selected.avgSpeed || 68} км/ч`);
  setText("routeStartTime", `Старт ${selected.depart || "—"}`);
  setText("routeEta", `ETA ${selected.eta || "—"}`);
  
  // Route code
  const routeCode = selected.route || "Маршрут не указан";
  setText("routeCode", routeCode);
  
  // Time calculations
  const timeElapsed = total && selected.avgSpeed ? (done / selected.avgSpeed).toFixed(1) : "—";
  const timeRemaining = total && selected.avgSpeed ? ((total - done) / selected.avgSpeed).toFixed(1) : "—";
  setText("routeTimeElapsed", `${timeElapsed} ч в пути`);
  setText("routeTimeRemaining", `${timeRemaining} ч осталось`);
  
  const remaining = Math.max(total - done, 0);
  setText("heroDistance", `${remaining.toFixed(0)} км осталось`);
  setText("heroEta", selected.eta || "—");
  
  // Progress bar
  const progressBar = document.getElementById("routeProgressBar");
  if (progressBar) {
    progressBar.style.width = `${progress}%`;
  }
  
  // Update Leaflet map if available
  if (routeLeafletMap && typeof L !== 'undefined') {
    updateLeafletRoute(origin, destination, progress);
  }
}

function updateLeafletRoute(origin, destination, progress) {
  if (!routeLeafletMap) return;
  
  // Clear previous markers and line
  routeMarkers.forEach(m => routeLeafletMap.removeLayer(m));
  routeMarkers = [];
  if (routeLine) {
    routeLeafletMap.removeLayer(routeLine);
    routeLine = null;
  }
  
  // Get coordinates for origin and destination
  const originCoords = cityCoords[origin] || [55.7558, 37.6173]; // Default Moscow
  const destCoords = cityCoords[destination] || [53.9006, 27.5590]; // Default Minsk
  
  // Create markers
  const startIcon = L.divIcon({
    html: '<div class="route-marker start-marker"><i class="fa-solid fa-circle text-emerald-500"></i></div>',
    className: 'route-marker-wrapper',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
  
  const endIcon = L.divIcon({
    html: '<div class="route-marker end-marker"><i class="fa-solid fa-flag-checkered text-orange-500"></i></div>',
    className: 'route-marker-wrapper',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
  
  const startMarker = L.marker(originCoords, { icon: startIcon })
    .bindPopup(`<b>Пункт А:</b> ${origin}`)
    .addTo(routeLeafletMap);
  
  const endMarker = L.marker(destCoords, { icon: endIcon })
    .bindPopup(`<b>Пункт B:</b> ${destination}`)
    .addTo(routeLeafletMap);
  
  routeMarkers.push(startMarker, endMarker);
  
  // Draw route line (curved for visual appeal)
  const midLat = (originCoords[0] + destCoords[0]) / 2;
  const midLng = (originCoords[1] + destCoords[1]) / 2;
  const offset = Math.abs(originCoords[1] - destCoords[1]) * 0.1;
  
  // Create curved path points
  const curvePoints = [
    originCoords,
    [midLat + offset, (originCoords[1] + midLng) / 2],
    [midLat, midLng],
    [midLat - offset, (destCoords[1] + midLng) / 2],
    destCoords,
  ];
  
  // Draw full route (gray)
  const fullRoute = L.polyline(curvePoints, {
    color: '#475569',
    weight: 4,
    opacity: 0.6,
    dashArray: '10, 10',
  }).addTo(routeLeafletMap);
  
  // Draw completed portion (green gradient effect)
  const progressIndex = Math.floor((progress / 100) * (curvePoints.length - 1));
  const completedPoints = curvePoints.slice(0, progressIndex + 1);
  
  // Interpolate current position
  const segmentProgress = (progress / 100) * (curvePoints.length - 1) - progressIndex;
  if (progressIndex < curvePoints.length - 1) {
    const currentLat = curvePoints[progressIndex][0] + 
      (curvePoints[progressIndex + 1][0] - curvePoints[progressIndex][0]) * segmentProgress;
    const currentLng = curvePoints[progressIndex][1] + 
      (curvePoints[progressIndex + 1][1] - curvePoints[progressIndex][1]) * segmentProgress;
    completedPoints.push([currentLat, currentLng]);
    
    // Update truck marker position
    if (truckMarker) {
      truckMarker.setLatLng([currentLat, currentLng]);
    }
  }
  
  // Draw completed route (green)
  if (completedPoints.length > 1) {
    const completedRoute = L.polyline(completedPoints, {
      color: '#22c55e',
      weight: 5,
      opacity: 0.9,
    }).addTo(routeLeafletMap);
    routeMarkers.push(completedRoute);
  }
  
  routeMarkers.push(fullRoute);
  routeLine = fullRoute;
  
  // Fit map to show full route
  const bounds = L.latLngBounds([originCoords, destCoords]);
  routeLeafletMap.fitBounds(bounds, { padding: [40, 40] });
}

function renderTrips() {
  const tripsEl = document.getElementById("tripsList");
  if (!tripsEl) return;
  tripsEl.innerHTML = (vehicles || [])
    .map((v, idx) => {
      const progress = v.distanceTotal ? clamp((v.distanceDone / v.distanceTotal) * 100, 0, 100) : 0;
      const loadLabel = `${toOne(v.load ?? 0)}%`;
      const driver = resolveDriver(v.driverId, v.driver) || {};
      const timeElapsed = v.distanceTotal && v.avgSpeed ? (v.distanceDone / v.avgSpeed).toFixed(1) : "—";
      const timeRemaining = v.distanceTotal && v.avgSpeed ? ((v.distanceTotal - v.distanceDone) / v.avgSpeed).toFixed(1) : "—";
      const vehicleId = v.id || `trip-${idx}`;
      return `
        <div class="glass rounded-xl p-3 border border-slate-800 flex flex-col gap-2 cursor-pointer hover:border-emerald-500/50 transition-colors trip-card" data-vehicle-id="${vehicleId}" data-vehicle-index="${idx}">
          <div class="flex items-center justify-between">
            <div class="font-semibold text-base">${v.origin || "Точка А"} → ${v.destination || "Точка B"}</div>
            <span class="pill-muted">${v.name}</span>
          </div>
          <div class="text-xs text-slate-400 flex flex-wrap gap-2">
            <span><i class="fa-solid fa-clock"></i> ${v.depart || "—"}</span>
            <span><i class="fa-solid fa-flag-checkered"></i> ETA ${v.eta || "—"}</span>
            <span class="status-pill ${statusColors[v.status] || 'bg-slate-600/30'}">${v.status || "В пути"}</span>
          </div>
          <div class="progress"><span style="width:${progress}%"></span></div>
          <div class="flex justify-between text-xs text-slate-400">
            <span><i class="fa-solid fa-box"></i> Загрузка ${loadLabel}</span>
            <span><i class="fa-solid fa-route"></i> ${(v.distanceDone || 0).toFixed(0)} / ${(v.distanceTotal || 0).toFixed(0)} км</span>
          </div>
          <div class="flex justify-between text-xs text-slate-500 mt-1">
            <span><i class="fa-solid fa-user"></i> ${driver.name || "Водитель не назначен"}</span>
            <span><i class="fa-solid fa-truck"></i> ${v.plate || "—"}</span>
          </div>
        </div>
      `;
    })
    .join("");
  
  // Добавляем обработчики кликов на рейсы
  const tripCards = tripsEl.querySelectorAll(".trip-card");
  tripCards.forEach(card => {
    card.addEventListener("click", () => {
      const vehicleIndex = parseInt(card.dataset.vehicleIndex);
      const vehicle = vehicles[vehicleIndex];
      if (vehicle) {
        showTripDetails(vehicle);
      }
    });
  });
}

function showTripDetails(vehicle) {
  if (!vehicle) return;
  
  const driver = resolveDriver(vehicle.driverId, vehicle.driver) || {};
  const progress = vehicle.distanceTotal ? clamp((vehicle.distanceDone / vehicle.distanceTotal) * 100, 0, 100) : 0;
  const timeElapsed = vehicle.distanceTotal && vehicle.avgSpeed ? (vehicle.distanceDone / vehicle.avgSpeed).toFixed(1) : "—";
  const timeRemaining = vehicle.distanceTotal && vehicle.avgSpeed ? ((vehicle.distanceTotal - vehicle.distanceDone) / vehicle.avgSpeed).toFixed(1) : "—";
  
  // Заполняем информацию о маршруте
  setText("tripDetailOrigin", vehicle.origin || "Не указано");
  setText("tripDetailDestination", vehicle.destination || "Не указано");
  setText("tripDetailRoute", vehicle.route || "Не указан");
  setText("tripDetailDistance", `${(vehicle.distanceTotal || 0).toFixed(0)} км`);
  setText("tripDetailProgress", `${(vehicle.distanceDone || 0).toFixed(0)} км (${progress.toFixed(1)}%)`);
  setText("tripDetailRemaining", `${Math.max((vehicle.distanceTotal || 0) - (vehicle.distanceDone || 0), 0).toFixed(0)} км`);
  
  // Временные параметры
  setText("tripDetailDepart", vehicle.depart || "Не указано");
  setText("tripDetailEta", vehicle.eta || "Не указано");
  setText("tripDetailTimeElapsed", timeElapsed !== "—" ? `${timeElapsed} ч` : "—");
  setText("tripDetailTimeRemaining", timeRemaining !== "—" ? `${timeRemaining} ч` : "—");
  setText("tripDetailAvgSpeed", `${(vehicle.avgSpeed || 0).toFixed(0)} км/ч`);
  
  // Транспорт
  setText("tripDetailVehicleName", vehicle.name || "—");
  setText("tripDetailPlate", vehicle.plate || "—");
  setText("tripDetailVin", vehicle.vin || "—");
  setText("tripDetailSeries", vehicle.series || "—");
  setText("tripDetailStatus", vehicle.status || "—");
  
  // Груз
  setText("tripDetailCargo", vehicle.cargo || "Не указан");
  setText("tripDetailLoad", `${toOne(vehicle.load || 0)}%`);
  setText("tripDetailPallets", vehicle.pallets ? `${vehicle.pallets} шт` : "—");
  setText("tripDetailFuel", `${toOne(vehicle.fuel || 0)}%`);
  setText("tripDetailHealth", vehicle.health || "—");
  
  // Водитель
  setText("tripDetailDriverName", driver.name || "Не назначен");
  const phoneFormatted = formatPhone(driver.phone || "");
  setText("tripDetailDriverPhone", phoneFormatted);
  const phoneLink = document.getElementById("tripDetailDriverPhoneLink");
  if (phoneLink) {
    const tel = phoneToTel(driver.phone || "");
    if (tel) {
      phoneLink.href = `tel:${tel}`;
      phoneLink.title = `Позвонить: ${phoneFormatted}`;
      phoneLink.setAttribute("aria-disabled", "false");
      phoneLink.style.pointerEvents = "auto";
      phoneLink.style.opacity = "1";
    } else {
      phoneLink.href = "#";
      phoneLink.title = "Телефон не указан";
      phoneLink.setAttribute("aria-disabled", "true");
      phoneLink.style.pointerEvents = "none";
      phoneLink.style.opacity = "0.6";
    }
  }
  setText("tripDetailDriverHome", driver.home || "—");
  setText("tripDetailDriverExperience", driver.experience || "—");
  setText("tripDetailDriverLicense", driver.license || "—");
  setText("tripDetailDriverShift", driver.shift || "—");
  
  // Прогресс
  setText("tripDetailProgressPercent", `${progress.toFixed(1)}%`);
  const progressBar = document.getElementById("tripDetailProgressBar");
  if (progressBar) {
    progressBar.style.width = `${progress}%`;
  }
  setText("tripDetailDoneKm", (vehicle.distanceDone || 0).toFixed(0));
  setText("tripDetailTotalKm", (vehicle.distanceTotal || 0).toFixed(0));
  
  // Сохраняем выбранный транспорт для кнопки "Открыть на карте"
  selected = vehicle;
  
  toggleModal("tripDetailsModal", true);
}

function renderGeoMap() {
  const map = document.getElementById("geoMap");
  if (!map) return;
  const items = vehicles.slice(0, 6);
  map.innerHTML = `
    <div class="geo-list">
      ${items
        .map((v) => {
          const progress = v.distanceTotal ? clamp((v.distanceDone / v.distanceTotal) * 100, 0, 100) : 0;
          return `
            <div class="geo-card">
              <div class="geo-card-row">
                <div class="font-semibold">${v.origin || "A"} → ${v.destination || "B"}</div>
                <span class="pill-muted">${v.name}</span>
              </div>
              <div class="geo-card-row text-xs text-slate-400">${v.route || "Маршрут"} · ${v.status || "В пути"}</div>
              <div class="progress geo-progress"><span style="width:${progress}%"></span></div>
              <div class="geo-card-row text-xs text-slate-400"><span>ETA ${v.eta || "—"}</span><span>${(v.distanceDone || 0).toFixed(0)} / ${(v.distanceTotal || 0).toFixed(0)} км</span></div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderAnalytics() {
  const board = document.getElementById("analyticsBoard");
  if (!board) return;
  const avgLoad = vehicles.length ? vehicles.reduce((s, v) => s + (v.load || 0), 0) / vehicles.length : 0;
  const onGuard = vehicles.filter((v) => v.status3 && v.status3.toLowerCase().includes("охра")).length;
  const risk = Math.min(100, Math.round(Math.random() * 18 + 8));
  const cards = [
    { title: "Средняя загрузка", value: `${avgLoad.toFixed(1)}%`, bar: avgLoad },
    { title: "Под охраной", value: `${onGuard} фур`, bar: clamp((onGuard / (vehicles.length || 1)) * 100, 0, 100) },
    { title: "Опоздания (риск)", value: `${risk}%`, bar: risk },
    { title: "SLA заказов", value: `${Math.floor(92 + Math.random() * 5)}%`, bar: 92 }
  ];
  board.innerHTML = cards
    .map(
      (c) => `
        <div class="analytics-card">
          <div class="flex items-center justify-between">
            <div class="text-sm text-slate-300 font-semibold">${c.title}</div>
            <div class="text-xs pill-muted">${prefs.tz}</div>
          </div>
          <div class="text-2xl font-semibold mt-1">${c.value}</div>
          <div class="analytics-bar"><span style="width:${clamp(c.bar, 4, 100)}%"></span></div>
        </div>
      `
    )
    .join("");
}

function renderHeaderMetrics() {
  const active = vehicles.filter((v) => (v.status || "").toLowerCase() !== "обслуживание").length;
  const maintenance = vehicles.filter((v) => (v.status || "").toLowerCase() === "обслуживание").length;
  const efficiency = vehicles.length ? vehicles.reduce((s, v) => s + (v.load || 0), 0) / vehicles.length : 0;
  const cargo = vehicles.reduce((s, v) => s + (v.pallets || 0), 0);
  setText("metricActiveFleet", active || "0");
  setText("metricActiveHint", active ? "фур онлайн" : "нет рейсов");
  setText("metricMaintenance", maintenance || "0");
  setText("metricMaintenanceHint", maintenance ? "в сервисе" : "все на линии");
  setText("metricEfficiency", efficiency ? `${efficiency.toFixed(1)}%` : "—");
  setText("metricEfficiencyHint", "средняя загрузка");
  setText("metricCargoValue", cargo || "0");
  setText("metricCargoHint", cargo ? "паллет в пути" : "нет данных");
}

function renderInventory() {
  const invEl = document.getElementById("inventoryList");
  if (!invEl) return;
  const items = [
    { name: "Датчики (температура)", qty: 42, status: "Работают" },
    { name: "Камеры кабины", qty: 18, status: "HD 1080p" },
    { name: "Шины зимние", qty: 64, status: "Склад 3" },
    { name: "ЗИП · ремни", qty: 120, status: "Резерв" },
    { name: "Топливо резерв", qty: prefs.fuelUnit === "gal" ? "820 гал." : "3100 л", status: "Доступно" },
  ];
  invEl.innerHTML = items
    .map(
      (i) => `
        <div class="inventory-item">
          <div>
            <div class="font-semibold">${i.name}</div>
            <div class="text-xs text-slate-400">${i.status}</div>
          </div>
          <span class="pill-muted">${i.qty}</span>
        </div>
      `
    )
    .join("");
}

function setCameraView(viewKey) {
  const view = cameraViews[viewKey];
  if (!view || !cameraImageEl) return;
  currentCamera = viewKey;
  cameraImageEl.src = view.src;
  cameraImageEl.alt = view.name;
  if (cameraTitleEl) cameraTitleEl.textContent = view.name;
  if (cameraSubtitleEl) cameraSubtitleEl.textContent = view.desc;
  if (cameraLabelEl) cameraLabelEl.textContent = view.label;
  if (cameraZoomEl) cameraZoomEl.textContent = view.zoom || "x2.4";
  cameraTabs.forEach((btn) => btn.classList.toggle("camera-tab-active", btn.dataset.view === viewKey));
  
  // Update vehicle ID in camera section
  if (selected) {
    setText('cameraVehicleId', selected.plate ? selected.plate.split(' ')[0] : 'TR-001');
  }
}

// Camera timestamp updater
let cameraTimestampInterval = null;

function updateCameraTimestamp() {
  const el = document.getElementById('cameraTimestamp');
  if (el) {
    const now = new Date();
    el.textContent = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}

function initCamera() {
  cameraTabs = Array.from(document.querySelectorAll(".camera-tab"));
  cameraImageEl = document.getElementById("cameraImage");
  cameraTitleEl = document.getElementById("cameraTitle");
  cameraSubtitleEl = document.getElementById("cameraSubtitle");
  cameraLabelEl = document.getElementById("cameraLabel");
  cameraZoomEl = document.getElementById("cameraZoom");
  const refreshBtn = document.getElementById("cameraRefresh");
  if (!cameraImageEl || !cameraTabs.length) return;
  cameraTabs.forEach((btn) => btn.addEventListener("click", () => setCameraView(btn.dataset.view)));
  if (refreshBtn) refreshBtn.onclick = () => setCameraView(currentCamera || "cargo");
  setCameraView(currentCamera || cameraTabs[0].dataset.view || "cargo");
  
  // Start timestamp updater
  if (cameraTimestampInterval) clearInterval(cameraTimestampInterval);
  updateCameraTimestamp();
  cameraTimestampInterval = setInterval(updateCameraTimestamp, 1000);
}

function renderNotifications() {
  const list = document.getElementById("notifList");
  if (!list) return;
  const active = notificationPool.slice(0, 6);
  list.innerHTML = active
    .map((n) => {
      const color = n.level === "danger" ? "text-red-400" : n.level === "warn" ? "text-amber-300" : "text-sky-300";
      const icon = n.level === "danger" ? "fa-triangle-exclamation" : n.level === "warn" ? "fa-circle-exclamation" : "fa-info-circle";
      return `<div class="notif-item">
        <div class="notif-icon bg-slate-800 ${color}"><i class="fa-solid ${icon}"></i></div>
        <div>
          <div class="text-sm font-semibold">${n.title}</div>
          <div class="text-xs text-slate-400">${n.detail}</div>
        </div>
      </div>`;
    })
    .join("");
}

function ensureNotifDot() {
  if (!notifBtn) return null;
  let dot = notifBtn.querySelector(".notif-dot");
  if (!dot) {
    dot = document.createElement("span");
    dot.className = "notif-dot hidden";
    notifBtn.appendChild(dot);
  }
  return dot;
}

function updateNotifBadge() {
  notifDot = ensureNotifDot();
  if (notifDot) notifDot.classList.toggle("hidden", notifUnread === 0);
  if (notifIconImg) notifIconImg.classList.toggle("hidden", notifUnread === 0);
}

function pushNotification(item) {
  notificationPool.unshift(item);
  notifUnread += 1;
  updateNotifBadge();
}

async function deleteSelectedVehicle() {
  if (!selected) {
    showToast("Нет выбранной фуры");
    return;
  }
  if (vehicles.length <= 1) {
    showToast("Нельзя удалить последнюю фуру");
    return;
  }
  
  try {
    if (authToken && selected.id) {
      await apiRequest(`/vehicles/${selected.id}`, {
        method: "DELETE",
      });
    }
    
    const index = vehicles.indexOf(selected);
    if (index > -1) {
      vehicles.splice(index, 1);
      selected = vehicles[Math.min(index, vehicles.length - 1)] || null;
      if (!authToken) {
        persistVehicles();
      }
      renderTrackList();
      updateSelected();
      renderHeaderMetrics();
      showToast("Фура удалена");
    }
  } catch (error) {
    console.error("Failed to delete vehicle:", error);
    showToast(`Ошибка: ${error.message}`);
  }
}

async function loadData() {
  try {
    // Try to load from API first
    if (authToken) {
      const apiVehicles = await apiRequest("/vehicles");
      vehicles = (apiVehicles || []).map(v => ({
        ...v,
        status: v.status_main || "В пути",
        status2: v.status_secondary?.[0] || "",
        status3: v.status_secondary?.[1] || "",
        load: v.load_pct || 0,
        fuel: v.fuel_pct || 0,
        tank: v.tank_l || 0,
        pallets: v.pallets_capacity || 0,
        health: v.health_pct ? `${v.health_pct}%` : "100%",
        cargo: v.cargo_desc || "",
        route: v.route_code || "",
        plate: v.plate || "",
        vin: v.vin || "",
        series: v.series || "",
        tag: v.tag || "",
        image: v.image_url || undefined,
        driverId: v.driver_profile_id || undefined,
        // Map driver data from API relationship
        driver: v.driver ? {
          id: v.driver.id,
          name: v.driver.name,
          phone: v.driver.phone || "",
          home: v.driver.home_base || "",
          license: v.driver.license_class || "CE",
          status: `На линии · рейтинг ${v.driver.rating || "95%"}`,
          rating: v.driver.rating || "95%",
          experience: v.driver.experience || "5 лет",
          shift: v.driver.shift || "3ч 00м",
          rest: v.driver.rest || "через 2ч",
        } : undefined,
        // Map route data
        origin: v.origin || "",
        destination: v.destination || "",
        depart: v.depart_at || "",
        eta: v.eta_at || "",
        distanceTotal: v.distance_total_km || 0,
        distanceDone: v.distance_done_km || 0,
        avgSpeed: v.avg_speed || 0,
      })).map(enrichVehicle);
      
      // Load drivers from local data (API doesn't have drivers endpoint yet)
      const res = await fetch("./assets/data/data.json", { cache: "no-cache" });
      if (res.ok) {
        const json = await res.json();
        drivers = (json.drivers || []).map(enrichDriver);
        mechanical = (json.mechanical && json.mechanical.length ? json.mechanical : fallbackData.mechanical || []);
      } else {
        drivers = driverPool.map(enrichDriver);
        mechanical = fallbackData.mechanical;
      }
    } else {
      // Fallback to local data if no auth token
      const res = await fetch("./assets/data/data.json", { cache: "no-cache" });
      if (!res.ok) throw new Error("data.json not found");
      const json = await res.json();
      vehicles = (json.vehicles || []).map(enrichVehicle);
      drivers = (json.drivers || []).map(enrichDriver);
      mechanical = (json.mechanical && json.mechanical.length ? json.mechanical : fallbackData.mechanical || []);
    }
  } catch (err) {
    console.warn("Использую встроенные данные", err);
    vehicles = fallbackData.vehicles.map(enrichVehicle);
    drivers = (fallbackData.drivers || driverPool).map(enrichDriver);
    mechanical = fallbackData.mechanical;
  }
  
  const stored = readStoredVehicles();
  const storedDrivers = readStoredDrivers();
  const baseDrivers = dedupeDrivers([...drivers, ...driverPool.map(enrichDriver)]);
  drivers = mergeStoredDrivers(baseDrivers, (storedDrivers || []).map(enrichDriver));
  // API data first to preserve driver info, then stored user modifications
  vehicles = dedupeVehicles([...vehicles, ...(stored.length ? stored : [])]).map((v, idx) => {
    if (!v.driverId && v.driver?.name) {
      const match = drivers.find((d) => d.name === v.driver.name);
      v.driverId = match?.id || undefined;
    }
    return assignDriverToVehicle(v, v.driverId || drivers[idx % drivers.length]?.id);
  });
  vehicles = ensureFleetCount(vehicles, 6).map((v, idx) => assignDriverToVehicle(v, v.driverId || drivers[idx % drivers.length]?.id));
  selected = vehicles[0] || null;
  renderMechanical();
  renderTrackList();
  updateSelected();
  renderTrips();
  renderGeoMap();
  renderAnalytics();
  renderInventory();
  renderNotifications();
  renderHeaderMetrics();
  renderDriverOptions();
  persistDrivers();
  persistVehicles();
}

function bindUI() {
  trackListEl = document.getElementById("trackList");
  mechanicalListEl = document.getElementById("mechanicalList");
  themeToggle = document.getElementById("themeToggle");
  themeToggleInput = document.getElementById("themeToggleInput");
  deleteVehicleBtn = document.getElementById("deleteVehicleBtn");
  addVehicleBtn = document.getElementById("addVehicleBtn");
  mapBtn = document.getElementById("mapBtn");
  alertBtn = document.getElementById("alertBtn");
  addForm = document.getElementById("addForm");
  notifBtn = document.getElementById("notifBtn");
  notifIconImg = document.getElementById("notifIcon");
  settingsBtn = document.getElementById("settingsBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  notifPanel = document.getElementById("notifPanel");
  settingsPanel = document.getElementById("settingsPanel");
  tzSelect = document.getElementById("tzSelect");
  fuelUnitSelect = document.getElementById("fuelUnitSelect");
  tempUnitSelect = document.getElementById("tempUnitSelect");
  alertModeSelect = document.getElementById("alertModeSelect");
  profileForm = document.getElementById("profileForm");
  driverAvatarBtn = document.getElementById("driverAvatarBtn");
  driverSelect = document.getElementById("driverSelect");
  adminOrderForm = document.getElementById("adminOrderForm");
  adminOrderTitle = document.getElementById("adminOrderTitle");
  adminOrderOrigin = document.getElementById("adminOrderOrigin");
  adminOrderDestination = document.getElementById("adminOrderDestination");
  adminOrdersRefreshBtn = document.getElementById("ordersAdminRefreshBtn");
  adminOrdersList = document.getElementById("ordersAdminList");
  adminOrdersEmpty = document.getElementById("ordersAdminEmpty");
  adminOrdersNote = document.getElementById("adminOrdersNote");
  const addStatus = document.getElementById("addStatus");
  const loadField = document.getElementById("loadField");

  if (themeToggleInput) {
    themeToggleInput.addEventListener("change", () => {
      applyTheme(themeToggleInput.checked ? "light" : "dark");
    });
  }

  if (mapBtn) mapBtn.onclick = () => { updateMapFrame(); toggleModal("mapModal", true); };
  if (alertBtn) alertBtn.onclick = () => showToast(`Тревога отправлена: ${selected?.name || "фура"}`);
  if (addVehicleBtn) addVehicleBtn.onclick = () => toggleModal("addModal", true);
  if (deleteVehicleBtn) deleteVehicleBtn.addEventListener("click", deleteSelectedVehicle);
  if (logoutBtn) logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("auth_token");
    authToken = null;
    window.location.href = "./login.html";
  });

  const closePanels = () => {
    if (notifPanel) notifPanel.classList.add("hidden");
    if (settingsPanel) settingsPanel.classList.add("hidden");
  };
  if (notifBtn) notifBtn.onclick = (e) => {
    e.stopPropagation();
    closePanels();
    if (notifPanel) notifPanel.classList.toggle("hidden");
    notifUnread = 0;
    updateNotifBadge();
    renderNotifications();
  };
  if (settingsBtn) settingsBtn.onclick = (e) => {
    e.stopPropagation();
    closePanels();
    if (settingsPanel) settingsPanel.classList.toggle("hidden");
  };
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".floating-panel") && !e.target.closest("#notifBtn") && !e.target.closest("#settingsBtn")) {
      closePanels();
    }
  });

  if (tzSelect) tzSelect.onchange = () => { prefs.tz = tzSelect.value; renderAnalytics(); };
  if (fuelUnitSelect) fuelUnitSelect.onchange = () => { prefs.fuelUnit = fuelUnitSelect.value; updateTruckStats(); renderInventory(); };
  if (tempUnitSelect) tempUnitSelect.onchange = () => { prefs.tempUnit = tempUnitSelect.value; showToast("Температура будет отображаться в новой системе"); };
  if (alertModeSelect) alertModeSelect.onchange = () => showToast(`Оповещения: ${alertModeSelect.value}`);
  if (tzSelect) tzSelect.value = prefs.tz;
  if (fuelUnitSelect) fuelUnitSelect.value = prefs.fuelUnit;
  if (tempUnitSelect) tempUnitSelect.value = prefs.tempUnit;
  if (driverSelect) driverSelect.onchange = () => {
    if (!selected) return;
    assignDriverToVehicle(selected, driverSelect.value || undefined);
    persistVehicles();
    updateSelected();
    renderTrackList();
    showToast("Водитель назначен");
  };
  if (driverAvatarBtn) driverAvatarBtn.onclick = () => {
    const d = resolveDriver(selected?.driverId, selected?.driver);
    if (profileForm && d) {
      profileForm.name.value = d.name || "";
      profileForm.phone.value = d.phone || "";
      profileForm.home.value = d.home || "";
      profileForm.status.value = d.status || "";
    }
    toggleModal("profileModal", true);
  };

  if (addForm) {
    addForm.onsubmit = (e) => {
      e.preventDefault();
      const data = new FormData(e.target);
      const payload = {
        name: data.get("name"),
        status: data.get("status"),
        load: data.get("load"),
        plate: data.get("plate"),
        vin: data.get("vin"),
        series: data.get("series"),
        cargo: data.get("cargo"),
        route: data.get("route"),
      };
      const file = data.get("photo");
      if (file && file.size) {
        const reader = new FileReader();
        reader.onload = () => {
          payload.image = reader.result;
          if (authToken) {
            addVehicle(payload);
          } else {
            addVehicleLocal(payload);
          }
        };
        reader.readAsDataURL(file);
      } else {
        if (authToken) {
          addVehicle(payload);
        } else {
          addVehicleLocal(payload);
        }
      }
      e.target.reset();
    };
  }

  if (addStatus && loadField) {
    const syncLoadField = () => {
      const isService = addStatus.value === "Обслуживание";
      loadField.classList.toggle("hidden", isService);
    };
    addStatus.addEventListener("change", syncLoadField);
    syncLoadField();
  }

  const mapModal = document.getElementById("mapModal");
  if (mapModal) {
    mapModal.addEventListener("click", (e) => {
      if (e.target.id === "mapModal") toggleModal("mapModal", false);
    });

    if (adminOrdersRefreshBtn) adminOrdersRefreshBtn.addEventListener("click", () => refreshAdminOrders());
    if (adminOrderForm) {
      adminOrderForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (adminOrdersNote) adminOrdersNote.classList.add("hidden");
        try {
          const title = (adminOrderTitle?.value || "").trim();
          const origin = (adminOrderOrigin?.value || "").trim() || null;
          const destination = (adminOrderDestination?.value || "").trim() || null;
          if (!title) {
            showToast("Введите название заказа");
            return;
          }
          await apiRequest("/orders", {
            method: "POST",
            body: JSON.stringify({ title, origin, destination }),
          });
          if (adminOrdersNote) {
            adminOrdersNote.textContent = "Заказ создан";
            adminOrdersNote.classList.remove("hidden");
          }
          if (adminOrderTitle) adminOrderTitle.value = "";
          if (adminOrderOrigin) adminOrderOrigin.value = "";
          if (adminOrderDestination) adminOrderDestination.value = "";
          await refreshAdminOrders();
        } catch (err) {
          const msg = err?.message || "Ошибка создания заказа";
          if (adminOrdersNote) {
            adminOrdersNote.textContent = msg;
            adminOrdersNote.classList.remove("hidden");
          }
          showToast(`Ошибка: ${msg}`);
        }
      });
    }
  }

  function renderAdminOrders(orders = []) {
    if (!adminOrdersList || !adminOrdersEmpty) return;
    const items = Array.isArray(orders) ? orders : [];
    adminOrdersList.innerHTML = "";
    adminOrdersEmpty.classList.toggle("hidden", items.length > 0);
    if (!items.length) {
      adminOrdersEmpty.textContent = "Нет заказов";
      return;
    }
    adminOrdersEmpty.textContent = "";
    items.slice(0, 10).forEach((o) => {
      const row = document.createElement("div");
      row.className = "glass rounded-xl p-3 border border-slate-800";
      const route = [o.origin, o.destination].filter(Boolean).join(" → ") || "—";
      row.innerHTML = `
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <div class="text-sm font-semibold truncate">${o.title || "Заказ"}</div>
            <div class="text-xs text-slate-500 mt-1">${route} · статус: ${o.status || "—"}</div>
          </div>
          <span class="text-xs px-2 py-1 rounded-full bg-slate-800 border border-slate-700 whitespace-nowrap">${o.accepted_at ? "принят" : "ожидает"}</span>
        </div>
      `;
      adminOrdersList.appendChild(row);
    });
  }

  async function refreshAdminOrders() {
    if (!adminOrdersList || !adminOrdersEmpty) return;
    if (!authToken) {
      adminOrdersEmpty.textContent = "Нет токена";
      adminOrdersEmpty.classList.remove("hidden");
      renderAdminOrders([]);
      return;
    }
    try {
      const orders = await apiRequest("/orders");
      renderAdminOrders(orders);
    } catch (err) {
      adminOrdersEmpty.textContent = "Не удалось загрузить заказы";
      adminOrdersEmpty.classList.remove("hidden");
      renderAdminOrders([]);
    }
  }
  const addModal = document.getElementById("addModal");
  if (addModal) {
    addModal.addEventListener("click", (e) => {
      if (e.target.id === "addModal") toggleModal("addModal", false);
    });
  }
  const sensorModal = document.getElementById("sensorModal");
  if (sensorModal) {
    sensorModal.addEventListener("click", (e) => {
      if (e.target.id === "sensorModal") toggleModal("sensorModal", false);
    });
  }

  if (mechanicalListEl) {
    mechanicalListEl.addEventListener("click", (e) => {
      const btn = e.target.closest(".sensor-item");
      if (!btn) return;
      showSensorDetail(btn.dataset.sensor, btn.dataset.status);
    });
  }

  if (profileForm) {
    profileForm.onsubmit = (e) => {
      e.preventDefault();
      if (!selected) return;
      const data = new FormData(profileForm);
      const driver = resolveDriver(selected.driverId, selected.driver) || {};
      driver.name = data.get("name") || driver.name;
      driver.phone = data.get("phone") || driver.phone;
      driver.home = data.get("home") || driver.home;
      driver.status = data.get("status") || driver.status;
      if (driver.id) {
        const idx = drivers.findIndex((d) => d.id === driver.id);
        if (idx > -1) drivers[idx] = driver;
      }
      selected.driverId = driver.id;
      persistDrivers();
      persistVehicles();
      updateSelected();
      renderTrackList();
      showToast("Профиль обновлен");
      toggleModal("profileModal", false);
    };
  }

  const cargoLayout = document.getElementById("cargoLayout");
  if (cargoLayout) {
    cargoLayout.addEventListener("click", (e) => {
      const zone = e.target.closest("[data-zone]");
      if (!zone || !cargoBreakdown) return;
      showCargoDetail(zone.dataset.zone);
    });
  }
  const sketch = document.querySelector(".cargo-sketch");
  if (sketch) {
    sketch.addEventListener("click", (e) => {
      const zone = e.target.closest("[data-zone]");
      if (!zone || !cargoBreakdown) return;
      showCargoDetail(zone.dataset.zone);
    });
  }

  const statusControls = document.getElementById("statusControls");
  if (statusControls) {
    statusControls.addEventListener("click", (e) => {
      const btn = e.target.closest(".status-btn");
      if (!btn || !selected) return;
      updateStatuses(btn.dataset.status);
    });
  }

  const statusWrap = document.getElementById("selStatuses");
  if (statusWrap) {
    statusWrap.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-remove-status]");
      if (!btn || !selected) return;
      const field = btn.dataset.removeStatus;
      if (field && selected[field]) {
        selected[field] = "";
        const compact = [selected.status, selected.status2, selected.status3].filter(Boolean);
        [selected.status, selected.status2, selected.status3] = [compact[0] || "", compact[1] || "", compact[2] || ""];
        persistVehicles();
        updateSelected();
        renderTrackList();
        renderTrips();
        renderHeaderMetrics();
        showToast("Статус удален");
      }
    });
  }

  statusModal = document.getElementById("statusModal");
  statusMessage = document.getElementById("statusMessage");
  statusYes = document.getElementById("statusYes");
  statusNo = document.getElementById("statusNo");
  if (statusYes) statusYes.onclick = () => {
    const next = pendingStatus;
    pendingStatus = null;
    toggleModal("statusModal", false);
    if (next) updateStatuses(next, true);
  };
  if (statusNo) statusNo.onclick = () => {
    pendingStatus = null;
    toggleModal("statusModal", false);
  };

  document.querySelectorAll(".fault-grid, .hero-faults").forEach((faultWrap) => {
    faultWrap.addEventListener("click", (e) => {
      const btn = e.target.closest(".fault-btn");
      if (!btn) return;
      showSensorDetail(btn.dataset.fault, "warn");
    });
  });

  updateNotifBadge();
  
  // Initialize cargo constructor
  initCargoConstructor();
  
  // Initialize Leaflet map for route display
  if (typeof L !== 'undefined') {
    setTimeout(() => {
      initRouteLeafletMap();
      // Update map with selected vehicle data after init
      if (selected) {
        updateRouteMap();
      }
    }, 200);
  } else {
    console.warn('Leaflet (L) not loaded - map features disabled');
  }

  // expose public api for debugging
  window.fleetApp = {
    addVehicle,
    deleteVehicle: deleteSelectedVehicle,
    selectVehicle,
    toggleTheme: applyTheme,
  };
}

// ============================================
// CARGO CONSTRUCTOR - Liquid Glass Style with Cell Merging
// ============================================

const CARGO_GRID_ROWS = 3;
const CARGO_GRID_COLS = 8;
const CARGO_TOTAL_CELLS = CARGO_GRID_ROWS * CARGO_GRID_COLS;

// Truck trailer configurations - coordinates in SVG viewBox (900x280)
// Trailer area: where cargo grid should be positioned inside the trailer
const truckTrailerConfigs = {
  'volvo-fh16': { 
    image: '/assets/images/trucks/volvo-fh16.svg',
    brand: 'VOLVO', color: '#0ea5e9',
    // Trailer inner area (after rear door, before connection)
    trailer: { x: 85, y: 72, width: 530, height: 138 }
  },
  'man-tgx': { 
    image: '/assets/images/trucks/man-tgx.svg',
    brand: 'MAN', color: '#fbbf24',
    trailer: { x: 85, y: 72, width: 530, height: 138 }
  },
  'scania-r500': { 
    image: '/assets/images/trucks/scania-r500.svg',
    brand: 'SCANIA', color: '#dc2626',
    trailer: { x: 85, y: 72, width: 530, height: 138 }
  },
  'mercedes-actros': { 
    image: '/assets/images/trucks/mercedes-actros.svg',
    brand: 'MERCEDES', color: '#6b7280',
    trailer: { x: 85, y: 72, width: 530, height: 138 }
  },
  'daf-xf': { 
    image: '/assets/images/trucks/daf-xf.svg',
    brand: 'DAF', color: '#1d4ed8',
    trailer: { x: 85, y: 72, width: 530, height: 138 }
  },
  'iveco-stralis': { 
    image: '/assets/images/trucks/iveco-stralis.svg',
    brand: 'IVECO', color: '#16a34a',
    trailer: { x: 85, y: 72, width: 530, height: 138 }
  },
  'renault-t': { 
    image: '/assets/images/trucks/renault-t.svg',
    brand: 'RENAULT', color: '#a855f7',
    trailer: { x: 85, y: 72, width: 530, height: 138 }
  },
  'kamaz-5490': { 
    image: '/assets/images/trucks/kamaz-5490.svg',
    brand: 'КАМАЗ', color: '#14b8a6',
    trailer: { x: 85, y: 72, width: 530, height: 138 }
  },
  'default': { 
    image: null, // Use inline SVG
    brand: 'RoutoX', color: '#0ea5e9',
    trailer: { x: 85, y: 72, width: 530, height: 138 }
  }
};

// Get truck config from vehicle name
function getTruckConfig(vehicleName = '') {
  const name = (vehicleName || '').toLowerCase();
  if (name.includes('volvo')) return truckTrailerConfigs['volvo-fh16'];
  if (name.includes('man')) return truckTrailerConfigs['man-tgx'];
  if (name.includes('scania')) return truckTrailerConfigs['scania-r500'];
  if (name.includes('mercedes') || name.includes('actros')) return truckTrailerConfigs['mercedes-actros'];
  if (name.includes('daf')) return truckTrailerConfigs['daf-xf'];
  if (name.includes('iveco')) return truckTrailerConfigs['iveco-stralis'];
  if (name.includes('renault')) return truckTrailerConfigs['renault-t'];
  if (name.includes('камаз') || name.includes('kamaz')) return truckTrailerConfigs['kamaz-5490'];
  return truckTrailerConfigs['default'];
}

// Calculate cargo grid overlay position from truck config
function getCargoGridStyle(config) {
  const svgWidth = 900;
  const svgHeight = 280;
  const t = config.trailer;
  
  const left = (t.x / svgWidth * 100).toFixed(2);
  const top = (t.y / svgHeight * 100).toFixed(2);
  const width = (t.width / svgWidth * 100).toFixed(2);
  const height = (t.height / svgHeight * 100).toFixed(2);
  
  return `top: ${top}%; left: ${left}%; width: ${width}%; height: ${height}%;`;
}

const cargoTypes = {
  cold: { name: 'Холодильный', color: '#38bdf8', icon: 'snowflake', bgClass: 'bg-sky-500/40', borderClass: 'border-sky-500/60', temp: '2-6°C', weight: 0.8, tempZone: 'cold' },
  hot: { name: 'Горячий', color: '#ef4444', icon: 'fire', bgClass: 'bg-red-500/40', borderClass: 'border-red-500/60', temp: '60-80°C', weight: 0.7, tempZone: 'hot' },
  dry: { name: 'Сухой', color: '#f97316', icon: 'box', bgClass: 'bg-orange-500/40', borderClass: 'border-orange-500/60', temp: '18-22°C', weight: 0.6, tempZone: 'neutral' },
  fragile: { name: 'Хрупкое', color: '#a855f7', icon: 'wine-glass', bgClass: 'bg-purple-500/40', borderClass: 'border-purple-500/60', temp: '15-20°C', weight: 0.4, tempZone: 'neutral' },
  hazmat: { name: 'Опасный (ADR)', color: '#ef4444', icon: 'radiation', bgClass: 'bg-red-500/40', borderClass: 'border-red-500/60', temp: 'Контроль', weight: 1.0, tempZone: 'neutral' },
  general: { name: 'Общий груз', color: '#6b7280', icon: 'cubes', bgClass: 'bg-slate-500/40', borderClass: 'border-slate-500/60', temp: 'Любая', weight: 0.5, tempZone: 'neutral' }
};

// Temperature conflict check
function checkTemperatureConflict() {
  let hasCold = false;
  let hasHot = false;
  
  cargoGrid.forEach(cellData => {
    if (cellData) {
      const type = typeof cellData === 'string' ? cellData : cellData.type;
      if (type === 'cold') hasCold = true;
      if (type === 'hot') hasHot = true;
    }
  });
  
  const warningEl = document.getElementById('tempConflictWarning');
  if (hasCold && hasHot) {
    if (warningEl) {
      warningEl.classList.remove('hidden');
    } else {
      showToast('⚠️ ВНИМАНИЕ: Холодный и горячий груз нельзя перевозить вместе!', 'danger');
    }
    return true;
  } else {
    if (warningEl) {
      warningEl.classList.add('hidden');
    }
    return false;
  }
}

// cargoGrid stores: null for empty, { type: string, mergeId?: string } for filled
// mergedCells stores merge groups: { id: { cells: [indices], type: string, size: number } }
let cargoGrid = Array(CARGO_TOTAL_CELLS).fill(null);
let mergedCells = {};
let selectedCargoType = 'cold';
let isDraggingCargo = false;
let mergeStartCell = null; // For cell merging feature

function initCargoConstructor() {
  const gridContainer = document.getElementById('cargoGrid');
  if (!gridContainer) return;
  
  // Generate grid cells
  generateCargoGrid();
  
  // Bind palette buttons
  bindCargoPalette();
  
  // Bind clear button
  const clearBtn = document.getElementById('clearCargoBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', clearCargoGrid);
  }
  
  // Load saved cargo from localStorage
  loadCargoFromStorage();
  
  // Update stats
  updateCargoStats();
}

function generateCargoGrid() {
  const gridContainer = document.getElementById('cargoGrid');
  if (!gridContainer) return;
  
  gridContainer.innerHTML = '';
  
  for (let i = 0; i < CARGO_TOTAL_CELLS; i++) {
    const cell = document.createElement('div');
    const col = i % CARGO_GRID_COLS;
    const row = Math.floor(i / CARGO_GRID_COLS);
    
    // Add zone border every 2 columns
    const isZoneBorder = col > 0 && col % 2 === 0;
    const borderLeft = isZoneBorder ? '2px solid rgba(148, 163, 184, 0.4)' : '1px dashed rgba(255,255,255,0.2)';
    
    cell.className = 'cargo-cell-item relative rounded-sm transition-all duration-150 cursor-pointer flex items-center justify-center';
    cell.style.cssText = `
      background: rgba(255,255,255,0.05);
      border: 1px dashed rgba(255,255,255,0.2);
      border-left: ${borderLeft};
      min-height: 100%;
      aspect-ratio: 1.2;
    `;
    cell.dataset.index = i;
    cell.dataset.row = row;
    cell.dataset.col = col;
    cell.dataset.zone = ['А', 'Б', 'В', 'Г'][Math.floor(col / 2)]; // Zone A, B, C, D
    
    // Click handler with modifier keys
    cell.addEventListener('click', (e) => handleCellClick(i, e));
    
    // Drag & Drop
    cell.addEventListener('dragover', (e) => handleDragOver(e, i));
    cell.addEventListener('dragleave', (e) => handleDragLeave(e, i));
    cell.addEventListener('drop', (e) => handleDrop(e, i));
    
    gridContainer.appendChild(cell);
  }
}

function bindCargoPalette() {
  const palette = document.getElementById('cargoPalette');
  if (!palette) return;
  
  const buttons = palette.querySelectorAll('.cargo-type-btn');
  buttons.forEach(btn => {
    const type = btn.dataset.type;
    
    // Click to select
    btn.addEventListener('click', () => {
      selectedCargoType = type;
      buttons.forEach(b => b.classList.remove('ring-2', 'ring-white/50'));
      btn.classList.add('ring-2', 'ring-white/50');
    });
    
    // Drag start
    btn.addEventListener('dragstart', (e) => {
      isDraggingCargo = true;
      e.dataTransfer.setData('text/plain', type);
      e.dataTransfer.effectAllowed = 'copy';
      btn.style.opacity = '0.5';
    });
    
    btn.addEventListener('dragend', () => {
      isDraggingCargo = false;
      btn.style.opacity = '1';
    });
  });
  
  // Select first type by default
  if (buttons.length > 0) {
    buttons[0].classList.add('ring-2', 'ring-white/50');
  }
}

function handleCellClick(index, event) {
  const isShift = event && event.shiftKey;
  const isCtrl = event && (event.ctrlKey || event.metaKey);
  
  // Ctrl+Click: Split merged cells
  if (isCtrl) {
    const cellData = cargoGrid[index];
    if (cellData && cellData.mergeId) {
      splitMergedCells(cellData.mergeId);
      return;
    }
  }
  
  // Shift+Click: Start/complete merge
  if (isShift) {
    if (mergeStartCell === null) {
      // Start merge selection
      if (cargoGrid[index] || getMergeIdForCell(index)) {
        showToast('Выберите пустую ячейку для начала объединения');
        return;
      }
      mergeStartCell = index;
      highlightMergeStart(index);
      showToast('Теперь Shift+клик на конечную ячейку');
      return;
    } else {
      // Complete merge
      if (index === mergeStartCell) {
        cancelMergeSelection();
        return;
      }
      performMerge(mergeStartCell, index);
      mergeStartCell = null;
      return;
    }
  }
  
  // Cancel any pending merge on normal click
  if (mergeStartCell !== null) {
    cancelMergeSelection();
  }
  
  // Normal click
  const cellData = cargoGrid[index];
  if (cellData) {
    // Show cargo details modal (for both simple and merged cells)
    const type = typeof cellData === 'string' ? cellData : cellData.type;
    showCargoDetailModal(index, type);
  } else {
    // Place cargo in empty cell
    cargoGrid[index] = selectedCargoType;
    renderCargoGrid();
    updateCargoStats();
    saveCargoToStorage();
  }
}

function getMergeIdForCell(index) {
  const cellData = cargoGrid[index];
  if (cellData && typeof cellData === 'object' && cellData.mergeId) {
    return cellData.mergeId;
  }
  return null;
}

function highlightMergeStart(index) {
  const gridContainer = document.getElementById('cargoGrid');
  if (!gridContainer) return;
  const cells = gridContainer.querySelectorAll('.cargo-cell-item');
  if (cells[index]) {
    cells[index].style.border = '2px solid #22c55e';
    cells[index].style.boxShadow = '0 0 10px rgba(34, 197, 94, 0.5)';
  }
}

function cancelMergeSelection() {
  mergeStartCell = null;
  renderCargoGrid();
  showToast('Объединение отменено');
}

function performMerge(startIdx, endIdx) {
  // Validate indices are within grid bounds
  if (startIdx < 0 || startIdx >= CARGO_TOTAL_CELLS || endIdx < 0 || endIdx >= CARGO_TOTAL_CELLS) {
    showToast('Ошибка: выход за границы сетки');
    renderCargoGrid();
    return;
  }
  
  // Calculate rectangle bounds
  const startRow = Math.floor(startIdx / CARGO_GRID_COLS);
  const startCol = startIdx % CARGO_GRID_COLS;
  const endRow = Math.floor(endIdx / CARGO_GRID_COLS);
  const endCol = endIdx % CARGO_GRID_COLS;
  
  const minRow = Math.min(startRow, endRow);
  const maxRow = Math.max(startRow, endRow);
  const minCol = Math.min(startCol, endCol);
  const maxCol = Math.max(startCol, endCol);
  
  // Ensure bounds don't exceed grid limits
  if (maxRow >= CARGO_GRID_ROWS || maxCol >= CARGO_GRID_COLS) {
    showToast('Ошибка: объединение выходит за границы прицепа');
    renderCargoGrid();
    return;
  }
  
  // Check if all cells in range are empty
  const cellsToMerge = [];
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      const idx = r * CARGO_GRID_COLS + c;
      if (cargoGrid[idx]) {
        showToast('Нельзя объединить: некоторые ячейки заняты');
        renderCargoGrid();
        return;
      }
      cellsToMerge.push(idx);
    }
  }
  
  if (cellsToMerge.length < 2) {
    showToast('Выберите минимум 2 ячейки');
    renderCargoGrid();
    return;
  }
  
  // Create merge group
  const mergeId = `merge-${Date.now()}`;
  const mergeData = {
    cells: cellsToMerge,
    type: selectedCargoType,
    size: cellsToMerge.length,
    bounds: { minRow, maxRow, minCol, maxCol }
  };
  
  mergedCells[mergeId] = mergeData;
  
  // Mark all cells as part of this merge
  cellsToMerge.forEach(idx => {
    cargoGrid[idx] = { type: selectedCargoType, mergeId };
  });
  
  renderCargoGrid();
  updateCargoStats();
  saveCargoToStorage();
  showToast(`Объединено ${cellsToMerge.length} ячеек`);
}

function splitMergedCells(mergeId) {
  if (!mergedCells[mergeId]) return;
  
  const { cells } = mergedCells[mergeId];
  cells.forEach(idx => {
    cargoGrid[idx] = null;
  });
  
  delete mergedCells[mergeId];
  
  renderCargoGrid();
  updateCargoStats();
  saveCargoToStorage();
  showToast('Ячейки разделены');
}

// Store current cargo cell index for modal actions
let currentCargoModalIndex = null;

// Demo cargo contents database
const cargoContents = {
  cold: [
    { name: 'Мясо говядина', weight: '850 кг', temp: '2-4°C', expiry: '15.01.2026', sender: 'ООО «МясТорг»', receiver: 'ООО «Продмаркет»', conditions: 'Не размораживать, температурный режим' },
    { name: 'Рыба замороженная', weight: '620 кг', temp: '-18°C', expiry: '20.03.2026', sender: 'ИП Рыбкин', receiver: 'Сеть «Океан»', conditions: 'Глубокая заморозка, хрупкое' },
    { name: 'Молочная продукция', weight: '480 кг', temp: '2-6°C', expiry: '28.01.2026', sender: 'МолЗавод №1', receiver: 'Магазин «Свежесть»', conditions: 'Температурный режим, срочная доставка' },
    { name: 'Мороженое', weight: '320 кг', temp: '-25°C', expiry: '01.06.2026', sender: 'Фабрика «Айс»', receiver: 'ТЦ «Мега»', conditions: 'Строгий температурный режим' },
  ],
  dry: [
    { name: 'ДСП листы', weight: '1200 кг', temp: 'н/д', expiry: 'н/д', sender: 'ЛесПром', receiver: 'СтройМаркет', conditions: 'Беречь от влаги' },
    { name: 'Мука пшеничная', weight: '950 кг', temp: '15-20°C', expiry: '15.08.2026', sender: 'МельКомбинат', receiver: 'Пекарня №3', conditions: 'Сухое хранение' },
    { name: 'Крупы ассорти', weight: '780 кг', temp: '10-25°C', expiry: '01.12.2026', sender: 'ЗерноТрейд', receiver: 'Оптовая база', conditions: 'Сухое место, беречь от грызунов' },
    { name: 'Текстиль', weight: '450 кг', temp: 'н/д', expiry: 'н/д', sender: 'ТканьОпт', receiver: 'Швейная фабрика', conditions: 'Беречь от влаги и солнца' },
  ],
  fragile: [
    { name: 'Стеклопакеты', weight: '680 кг', temp: 'н/д', expiry: 'н/д', sender: 'СтеклоПром', receiver: 'ОконСервис', conditions: 'Не кантовать! Хрупкое!' },
    { name: 'Электроника', weight: '280 кг', temp: '10-25°C', expiry: 'н/д', sender: 'ТехноИмпорт', receiver: 'DNS Магазин', conditions: 'Хрупкое, боится влаги, не бросать' },
    { name: 'Керамика', weight: '520 кг', temp: 'н/д', expiry: 'н/д', sender: 'КерамАрт', receiver: 'СтройДом', conditions: 'Особо хрупкое, вертикальное хранение' },
    { name: 'Посуда стекло', weight: '390 кг', temp: 'н/д', expiry: 'н/д', sender: 'Богемия Импорт', receiver: 'Посуда Центр', conditions: 'Хрупкое, осторожно при погрузке' },
  ],
  hazmat: [
    { name: 'Химреагенты', weight: '560 кг', temp: '5-15°C', expiry: '01.01.2027', sender: 'ХимПром', receiver: 'НИИ Химии', conditions: 'ADR класс 8, кислоты, спецразрешение' },
    { name: 'Топливо авиа', weight: '1800 кг', temp: 'н/д', expiry: 'н/д', sender: 'НефтеБаза', receiver: 'Аэропорт', conditions: 'ADR класс 3, огнеопасно' },
    { name: 'Аккумуляторы Li-ion', weight: '420 кг', temp: '15-25°C', expiry: 'н/д', sender: 'БаттериТех', receiver: 'ЭлектроСклад', conditions: 'ADR класс 9, литий, не замыкать' },
  ],
  general: [
    { name: 'Одежда сезонная', weight: '380 кг', temp: 'н/д', expiry: 'н/д', sender: 'FashionОпт', receiver: 'ТЦ «Европа»', conditions: 'Беречь от влаги' },
    { name: 'Мебель IKEA', weight: '890 кг', temp: 'н/д', expiry: 'н/д', sender: 'IKEA Склад', receiver: 'IKEA Магазин', conditions: 'Не ставить тяжёлое сверху' },
    { name: 'Канцтовары', weight: '240 кг', temp: 'н/д', expiry: 'н/д', sender: 'ОфисМаг', receiver: 'Школа №15', conditions: 'Стандартные условия' },
    { name: 'Игрушки детские', weight: '310 кг', temp: 'н/д', expiry: 'н/д', sender: 'ТойсОпт', receiver: 'Детский мир', conditions: 'Сертифицировано, не мочить' },
  ],
};

// Large cargo items for merged cells
const largeCargo = {
  cold: [
    { name: 'Контейнер рефрижераторный', weight: '2400 кг', temp: '-20°C', conditions: 'Большой объём, заморозка' },
    { name: 'Партия мороженого', weight: '1800 кг', temp: '-25°C', conditions: 'Строгий температурный контроль' },
  ],
  dry: [
    { name: 'Поддон ДСП 50 листов', weight: '3200 кг', temp: 'н/д', conditions: 'Крупногабаритный груз' },
    { name: 'Контейнер с мукой', weight: '2800 кг', temp: '15-20°C', conditions: 'Сухое хранение' },
  ],
  fragile: [
    { name: 'Партия LCD мониторов', weight: '1600 кг', temp: '10-25°C', conditions: 'Особо хрупкое, не кантовать' },
  ],
  hazmat: [
    { name: 'Цистерна с топливом', weight: '5000 кг', temp: 'н/д', conditions: 'ADR класс 3, огнеопасно' },
  ],
  general: [
    { name: 'Мебельный гарнитур', weight: '1500 кг', temp: 'н/д', conditions: 'Крупногабарит' },
    { name: 'Промышленное оборудование', weight: '2200 кг', temp: 'н/д', conditions: 'Тяжёлый груз' },
  ],
};

function showCargoDetailModal(index, typeOverride) {
  const cellData = cargoGrid[index];
  if (!cellData) return;
  
  const type = typeOverride || (typeof cellData === 'string' ? cellData : cellData.type);
  if (!type || !cargoTypes[type]) return;
  
  currentCargoModalIndex = index;
  const cfg = cargoTypes[type];
  
  // Check if this is a merged cell
  const mergeId = typeof cellData === 'object' ? cellData.mergeId : null;
  const isMerged = mergeId && mergedCells[mergeId];
  const mergeSize = isMerged ? mergedCells[mergeId].size : 1;
  
  // Get content based on merge size
  let content;
  if (isMerged && mergeSize >= 2) {
    const largeContents = largeCargo[type] || largeCargo.general;
    const seed = index * 7 + type.charCodeAt(0);
    content = largeContents[seed % largeContents.length];
    content = { ...content, expiry: 'н/д', sender: 'Оптовый склад', receiver: 'Распределительный центр' };
  } else {
    const contents = cargoContents[type] || cargoContents.general;
    const seed = index * 7 + type.charCodeAt(0);
    content = contents[seed % contents.length];
  }
  
  // Calculate position
  const row = Math.floor(index / CARGO_GRID_COLS) + 1;
  const col = (index % CARGO_GRID_COLS) + 1;
  
  // Update modal content
  const iconEl = document.getElementById('cargoDetailIcon');
  if (iconEl) {
    iconEl.style.background = `${cfg.color}30`;
    iconEl.style.color = cfg.color;
    iconEl.innerHTML = `<i class="fa-solid fa-${cfg.icon}"></i>`;
  }
  
  const sizeLabel = isMerged ? ` (${mergeSize} ячеек)` : '';
  setText('cargoDetailTitle', content.name);
  setText('cargoDetailPosition', `Позиция: Ряд ${row}, Ячейка ${col}${sizeLabel}`);
  setText('cargoDetailType', cfg.name);
  setText('cargoDetailContent', content.name);
  setText('cargoDetailWeight', content.weight);
  setText('cargoDetailTemp', content.temp);
  setText('cargoDetailExpiry', content.expiry || 'н/д');
  setText('cargoDetailSender', `${content.sender || '—'} → ${content.receiver || '—'}`);
  setText('cargoDetailConditions', content.conditions);
  
  toggleModal('cargoDetailModal', true);
}

function removeCargoFromModal() {
  if (currentCargoModalIndex !== null && cargoGrid[currentCargoModalIndex]) {
    const cellData = cargoGrid[currentCargoModalIndex];
    
    // Check if it's a merged cell - remove entire merged group
    if (typeof cellData === 'object' && cellData.mergeId && mergedCells[cellData.mergeId]) {
      const { cells } = mergedCells[cellData.mergeId];
      cells.forEach(idx => {
        cargoGrid[idx] = null;
      });
      delete mergedCells[cellData.mergeId];
      showToast('Объединённый груз выгружен');
    } else {
      cargoGrid[currentCargoModalIndex] = null;
      showToast('Груз выгружен из ячейки');
    }
    
    renderCargoGrid();
    updateCargoStats();
    saveCargoToStorage();
  }
  toggleModal('cargoDetailModal', false);
  currentCargoModalIndex = null;
}

// Make function global for onclick
window.removeCargoFromModal = removeCargoFromModal;

function handleDragOver(e, index) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  
  const cell = e.currentTarget;
  cell.style.background = 'rgba(16, 185, 129, 0.25)';
  cell.style.borderColor = '#10b981';
  cell.style.borderStyle = 'solid';
  cell.style.transform = 'scale(1.05)';
}

function handleDragLeave(e, index) {
  const cell = e.currentTarget;
  restoreCellStyle(cell, index);
}

function handleDrop(e, index) {
  e.preventDefault();
  const type = e.dataTransfer.getData('text/plain');
  
  if (type && cargoTypes[type]) {
    cargoGrid[index] = type;
    renderCargoGrid();
    updateCargoStats();
    saveCargoToStorage();
  }
  
  const cell = e.currentTarget;
  restoreCellStyle(cell, index);
}

function restoreCellStyle(cell, index) {
  const type = cargoGrid[index];
  if (type && cargoTypes[type]) {
    const cfg = cargoTypes[type];
    cell.style.background = `linear-gradient(135deg, ${cfg.color}80, ${cfg.color}40)`;
    cell.style.borderColor = `${cfg.color}99`;
    cell.style.borderStyle = 'solid';
  } else {
    cell.style.background = 'rgba(255,255,255,0.05)';
    cell.style.borderColor = 'rgba(255,255,255,0.2)';
    cell.style.borderStyle = 'dashed';
  }
  cell.style.transform = 'scale(1)';
  cell.style.boxShadow = 'none';
}

function renderCargoGrid() {
  const gridContainer = document.getElementById('cargoGrid');
  if (!gridContainer) return;
  
  // Полностью перегенерируем grid для корректного позиционирования
  gridContainer.innerHTML = '';
  
  // Track which cells are part of merged groups
  const cellMergeInfo = {};
  Object.entries(mergedCells).forEach(([mergeId, data]) => {
    if (data.cells && data.cells.length > 0) {
      data.cells.forEach((idx, i) => {
        cellMergeInfo[idx] = { mergeId, data, isPrimary: i === 0 };
      });
    }
  });
  
  // Generate cell ID like BX-01, BX-02 etc.
  const getCellId = (index) => {
    const num = (index + 1).toString().padStart(2, '0');
    return `BX-${num}`;
  };
  
  // Get weight for cell based on its type
  const getCellWeight = (type, size = 1) => {
    const baseWeights = {
      cold: 400, dry: 350, fragile: 300, hot: 350, hazmat: 500, general: 400
    };
    const base = baseWeights[type] || 400;
    return `${base * size} kg`;
  };
  
  // Create all cells - including placeholder cells for merged areas
  for (let i = 0; i < CARGO_TOTAL_CELLS; i++) {
    const mergeInfo = cellMergeInfo[i];
    const col = i % CARGO_GRID_COLS;
    const row = Math.floor(i / CARGO_GRID_COLS);
    
    // Skip non-primary cells in merged groups - they are covered by the primary cell span
    if (mergeInfo && !mergeInfo.isPrimary) {
      continue;
    }
    
    const cell = document.createElement('div');
    cell.className = 'cargo-cell-item relative transition-all duration-150 cursor-pointer flex flex-col items-center justify-center';
    cell.dataset.index = i;
    
    const cellId = getCellId(i);
    
    if (mergeInfo && mergeInfo.isPrimary) {
      // Merged cell - visually spans multiple grid cells (like removing walls between cells)
      const { bounds, type, size } = mergeInfo.data;
      const cfg = cargoTypes[type] || cargoTypes['general'];
      const colSpan = bounds.maxCol - bounds.minCol + 1;
      const rowSpan = bounds.maxRow - bounds.minRow + 1;
      
      // Ensure merged cells stay within grid bounds
      const safeColSpan = Math.min(colSpan, CARGO_GRID_COLS - bounds.minCol);
      const safeRowSpan = Math.min(rowSpan, CARGO_GRID_ROWS - bounds.minRow);
      
      const weight = getCellWeight(type, size);
      
      cell.style.cssText = `
        grid-column: ${bounds.minCol + 1} / span ${safeColSpan};
        grid-row: ${bounds.minRow + 1} / span ${safeRowSpan};
        background: linear-gradient(135deg, ${cfg.color}90, ${cfg.color}60);
        border: 2px solid ${cfg.color};
        border-radius: 6px;
        color: #fff;
        box-shadow: inset 0 2px 0 rgba(255,255,255,0.25), 0 4px 12px ${cfg.color}40;
        padding: 4px;
      `;
      
      cell.innerHTML = `
        <span class="text-[7px] font-semibold opacity-70 absolute top-1 left-1">${cellId}</span>
        <div class="flex flex-col items-center justify-center gap-0.5 text-center">
          <div class="w-6 h-6 rounded-full border border-white/30 flex items-center justify-center" style="background: rgba(255,255,255,0.15);">
            <i class="fa-solid fa-eye text-[10px] opacity-80"></i>
          </div>
          <span class="text-[8px] font-bold mt-1">${weight}</span>
        </div>
      `;
      cell.title = `${cellId}: ${cfg.name} (${size} ячеек, ${weight}) | Ctrl+клик для разделения`;
      cell.dataset.mergeId = mergeInfo.mergeId;
    } else {
      // Regular single cell
      const cellData = cargoGrid[i];
      const isZoneBorder = col > 0 && col % 2 === 0;
      const weight = getCellWeight(cellData ? (typeof cellData === 'string' ? cellData : cellData.type) : 'general');
      
      if (cellData && typeof cellData !== 'object') {
        // Single filled cell (not part of merge)
        const type = typeof cellData === 'string' ? cellData : cellData.type;
        const cfg = cargoTypes[type];
        if (cfg) {
          cell.style.cssText = `
            grid-column: ${col + 1};
            grid-row: ${row + 1};
            background: linear-gradient(135deg, ${cfg.color}90, ${cfg.color}60);
            border: 2px solid ${cfg.color};
            border-radius: 6px;
            color: #fff;
            box-shadow: inset 0 2px 0 rgba(255,255,255,0.2), 0 2px 8px ${cfg.color}30;
            padding: 2px;
          `;
          cell.innerHTML = `
            <span class="text-[6px] font-semibold opacity-70 absolute top-0.5 left-1">${cellId}</span>
            <div class="flex flex-col items-center justify-center gap-0 text-center">
              <div class="w-5 h-5 rounded-full border border-white/30 flex items-center justify-center" style="background: rgba(255,255,255,0.15);">
                <i class="fa-solid fa-eye text-[8px] opacity-80"></i>
              </div>
              <span class="text-[7px] font-bold">${weight}</span>
            </div>
          `;
          cell.title = `${cellId}: ${cfg.name} | ${cfg.temp} | ${weight}`;
        }
      } else if (!cellData) {
        // Empty cell - show cell ID and "+" for adding cargo
        cell.style.cssText = `
          grid-column: ${col + 1};
          grid-row: ${row + 1};
          background: rgba(255,255,255,0.03);
          border: 1px dashed rgba(255,255,255,0.2);
          border-radius: 4px;
          ${isZoneBorder ? 'border-left: 2px solid rgba(148, 163, 184, 0.35);' : ''}
          padding: 2px;
        `;
        cell.innerHTML = `
          <span class="text-[6px] font-semibold text-slate-500 absolute top-0.5 left-1">${cellId}</span>
          <div class="flex flex-col items-center justify-center gap-0 text-center">
            <div class="w-5 h-5 rounded-full border border-slate-600/50 flex items-center justify-center text-slate-500">
              <i class="fa-solid fa-plus text-[8px]"></i>
            </div>
            <span class="text-[7px] text-slate-500">400 kg</span>
          </div>
        `;
        cell.title = `${cellId}: Пустая ячейка | Клик для добавления груза`;
      }
    }
    
    // Event handlers
    cell.addEventListener('click', (e) => handleCellClick(parseInt(cell.dataset.index), e));
    cell.addEventListener('dragover', (e) => handleDragOver(e, parseInt(cell.dataset.index)));
    cell.addEventListener('dragleave', (e) => handleDragLeave(e, parseInt(cell.dataset.index)));
    cell.addEventListener('drop', (e) => handleDrop(e, parseInt(cell.dataset.index)));
    
    gridContainer.appendChild(cell);
  }
}

function updateCargoStats() {
  const counts = { cold: 0, hot: 0, dry: 0, fragile: 0, hazmat: 0, general: 0 };
  let totalWeight = 0;
  let totalCells = 0;
  
  cargoGrid.forEach(cellData => {
    if (cellData) {
      const type = typeof cellData === 'string' ? cellData : cellData.type;
      if (type && cargoTypes[type]) {
        counts[type] = (counts[type] || 0) + 1;
        totalWeight += cargoTypes[type].weight;
        totalCells++;
      }
    }
  });
  
  const loadPercent = Math.round((totalCells / CARGO_TOTAL_CELLS) * 100);
  
  // Check for temperature conflict
  checkTemperatureConflict();
  
  // Update hero badges
  setText('heroCargoLoad', `${loadPercent}%`);
  setText('heroPalletCount', totalCells);
  setText('heroCargoWeight', totalWeight.toFixed(1));
  setText('cargoLoadPercent', `${loadPercent}%`);
  
  // Update progress bar
  const progressBar = document.getElementById('cargoProgressBar');
  const progressLabel = document.getElementById('cargoProgressLabel');
  if (progressBar) {
    progressBar.style.width = `${loadPercent}%`;
    // Color based on load
    if (loadPercent > 90) {
      progressBar.style.background = 'linear-gradient(90deg, #ef4444, #f97316)';
    } else if (loadPercent > 70) {
      progressBar.style.background = 'linear-gradient(90deg, #f59e0b, #eab308)';
    } else {
      progressBar.style.background = 'linear-gradient(90deg, #10b981, #06b6d4)';
    }
  }
  if (progressLabel) {
    progressLabel.textContent = `${totalCells} / ${CARGO_TOTAL_CELLS} ячеек`;
  }
  
  // Update type counters
  setText('statColdCount', counts.cold);
  setText('statHotCount', counts.hot || 0);
  setText('statDryCount', counts.dry);
  setText('statFragileCount', counts.fragile);
  setText('statHazmatCount', counts.hazmat);
  setText('statGeneralCount', counts.general);
  
  // Update temperature based on cargo mix
  if (counts.hot > 0) {
    setText('heroCargoTemp', `${60 + Math.round(Math.random() * 15)}°C`);
    setText('cargoCoreTemp', `${(65 + Math.random() * 10).toFixed(1)}°C`);
  } else if (counts.cold > 0) {
    setText('heroCargoTemp', `${2 + Math.round(Math.random() * 3)}°C`);
    setText('cargoCoreTemp', `${(2 + Math.random() * 2).toFixed(1)}°C`);
  } else if (counts.hazmat > 0) {
    setText('heroCargoTemp', '15°C');
    setText('cargoCoreTemp', '15.0°C');
  } else {
    setText('heroCargoTemp', '18°C');
    setText('cargoCoreTemp', '18.0°C');
  }
}

function clearCargoGrid() {
  cargoGrid = Array(CARGO_TOTAL_CELLS).fill(null);
  mergedCells = {};
  renderCargoGrid();
  updateCargoStats();
  saveCargoToStorage();
  showToast('Груз очищен');
}

function saveCargoToStorage() {
  try {
    localStorage.setItem('routox_cargo_grid', JSON.stringify(cargoGrid));
    localStorage.setItem('routox_merged_cells', JSON.stringify(mergedCells));
  } catch (e) {
    console.warn('Failed to save cargo grid:', e);
  }
}

function loadCargoFromStorage() {
  try {
    const saved = localStorage.getItem('routox_cargo_grid');
    const savedMerged = localStorage.getItem('routox_merged_cells');
    
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length === CARGO_TOTAL_CELLS) {
        cargoGrid = parsed;
      }
    }
    
    if (savedMerged) {
      const parsedMerged = JSON.parse(savedMerged);
      if (parsedMerged && typeof parsedMerged === 'object') {
        mergedCells = parsedMerged;
      }
    }
    
    renderCargoGrid();
  } catch (e) {
    console.warn('Failed to load cargo grid:', e);
  }
}

// Load demo cargo for selected vehicle
function loadDemoCargoForVehicle(vehicle) {
  if (!vehicle) return;
  
  // Generate deterministic cargo based on vehicle id/name
  const seed = (vehicle.name || 'demo').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const random = (i) => ((seed * (i + 1) * 9301 + 49297) % 233280) / 233280;
  
  const load = vehicle.load || 60;
  const cellsToFill = Math.round((load / 100) * CARGO_TOTAL_CELLS);
  
  // Clear and fill
  cargoGrid = Array(CARGO_TOTAL_CELLS).fill(null);
  mergedCells = {};
  const types = ['cold', 'dry', 'fragile', 'general'];
  
  // Create some merged cells for demo
  if (cellsToFill > 6 && random(999) > 0.3) {
    // Add a merged cargo block
    const mergeId = `merge-demo-${seed}`;
    const startRow = random(500) > 0.5 ? 0 : 1;
    const startCol = Math.floor(random(501) * 4);
    const width = 2;
    const height = random(502) > 0.5 ? 2 : 1;
    
    const mergeCells = [];
    for (let r = startRow; r < startRow + height && r < CARGO_GRID_ROWS; r++) {
      for (let c = startCol; c < startCol + width && c < CARGO_GRID_COLS; c++) {
        const idx = r * CARGO_GRID_COLS + c;
        mergeCells.push(idx);
      }
    }
    
    if (mergeCells.length >= 2) {
      const mergeType = types[Math.floor(random(503) * types.length)];
      mergedCells[mergeId] = {
        cells: mergeCells,
        type: mergeType,
        size: mergeCells.length,
        bounds: { minRow: startRow, maxRow: startRow + height - 1, minCol: startCol, maxCol: startCol + width - 1 }
      };
      mergeCells.forEach(idx => {
        cargoGrid[idx] = { type: mergeType, mergeId };
      });
    }
  }
  
  // Fill remaining cells
  for (let i = 0; i < cellsToFill; i++) {
    const cellIndex = Math.floor(random(i) * CARGO_TOTAL_CELLS);
    if (!cargoGrid[cellIndex]) {
      const typeIndex = Math.floor(random(i + 100) * types.length);
      cargoGrid[cellIndex] = types[typeIndex];
    }
  }
  
  renderCargoGrid();
  updateCargoStats();
}

// ============================================
// END CARGO CONSTRUCTOR
// ============================================

function startJitter() {
  randomizeFaults();
  setInterval(randomizeFaults, 5200);
  // Demo-only notifications.
  if (!authToken) {
    setInterval(() => {
      pushNotification({ title: "Новый сигнал", level: Math.random() > 0.6 ? "danger" : "warn", detail: `Фура ${selected?.name || "SDK"} · ${Math.round(Math.random() * 12)} мин` });
    }, 15000);
  }
  setInterval(() => {
    if (!selected) return;
    if (authToken) return;
    selected.load = clamp((selected.load || 60) + (Math.random() * 6 - 3), 35, 98);
    if (typeof selected.fuel === "number") {
      selected.fuel = clamp(selected.fuel - Math.random() * 1.2, 14, 100);
    }
    if (typeof selected.distanceDone === "number" && typeof selected.distanceTotal === "number") {
      selected.distanceDone = clamp(selected.distanceDone + Math.random() * 12, 0, selected.distanceTotal);
    }
    updateSelected();
    renderTrackList();
    renderMechanical();
    renderTrips();
    renderGeoMap();
    renderAnalytics();
  }, 7000);
}

async function init() {
  // Check for auth token
  authToken = localStorage.getItem("auth_token");
  const page = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
  const shouldRoleRedirect = page === "" || page === "index.html" || page === "fleet.html";
  
  // If no token, redirect to login (but allow fallback to local data)
  if (!authToken) {
    console.warn("No auth token found. Using local data. Login at /login.html to use API.");
  } else {
    // If token exists and API is reachable, route user to role-specific screen
    try {
      if (shouldRoleRedirect) {
        const me = await apiRequest("/auth/me");
        if (me?.role === "driver") {
          window.location.href = "./driver.html";
          return;
        }
      }
    } catch {
      // Ignore API errors; keep demo UI functional.
    }
  }
  
  bindUI();
  initCamera();
  loadTheme();
  loadData();
  await refreshAdminOrders();
  // Jitter is demo-only. Avoid randomizing UI when authenticated.
  startJitter();
}

document.addEventListener("DOMContentLoaded", init);

// Keep toggleModal global for inline close buttons
window.toggleModal = toggleModal;
