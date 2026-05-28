const locales = {};
let currentLocale = localStorage.getItem('minilit_lang') || 'ru';

async function loadLocale(locale) {
  if (locales[locale]) return locales[locale];
  try {
    const resp = await fetch(`./src/i18n/${locale}.json`);
    if (!resp.ok) throw new Error('Not found');
    locales[locale] = await resp.json();
    return locales[locale];
  } catch (e) {
    console.warn(`Failed to load locale "${locale}", falling back to inline`);
    locales[locale] = FALLBACKS[locale] || FALLBACKS.ru;
    return locales[locale];
  }
}

export async function initI18n() {
  document.documentElement.lang = currentLocale;
  await loadLocale(currentLocale);
}

export function setLocale(locale) {
  if (locales[locale]) {
    currentLocale = locale;
    localStorage.setItem('minilit_lang', locale);
    document.documentElement.lang = locale;
    window.dispatchEvent(new CustomEvent('locale-changed', { detail: { locale } }));
  }
}

export function getLocale() { return currentLocale; }

export function t(key, params) {
  const dict = locales[currentLocale];
  if (!dict) return key;
  let val = dict[key];
  if (val === undefined) {
    val = locales['en']?.[key];
    if (val === undefined) {
      val = FALLBACKS.en?.[key];
      if (val === undefined) return key;
    }
  }
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      val = String(val).replace(`{${k}}`, v);
    }
  }
  return val;
}

export function tExists(key) {
  return locales[currentLocale]?.[key] !== undefined || locales.en?.[key] !== undefined;
}

const FALLBACKS = {
  ru: {
    login: 'Войти', register: 'Регистрация', logout: 'Выйти',
    save: 'Сохранить', cancel: 'Отмена', delete: 'Удалить',
    edit: 'Редактировать', create: 'Создать', search: 'Поиск',
    loading: 'Загрузка...', error: 'Ошибка', success: 'Успешно',
    close: 'Закрыть', back: 'Назад', confirm: 'Подтвердить',
    profile_title: 'Личный кабинет', messages_title: 'Сообщения',
    notifications: 'Уведомления', balance: 'Баланс', connects: 'Коннекты',
    bookmarks_title: 'Избранное', admin_title: 'Админ-панель',
    nav_home: 'Главная', nav_exchange: 'Биржа', nav_tavern: 'Таверна',
    nav_orders: 'Заказы', nav_messages: 'Сообщения', nav_profile: 'Профиль',
    freelancer: 'Фрилансер', client: 'Заказчик',
    err_unauthorized: 'Войдите в аккаунт', err_network: 'Ошибка сети',
    err_unknown: 'Произошла неизвестная ошибка',
    hero_title: 'Найди исполнителя или<br>закажи услугу за минуту',
    order_status_completed: 'Завершён',
  },
  en: {
    login: 'Login', register: 'Sign Up', logout: 'Logout',
    save: 'Save', cancel: 'Cancel', delete: 'Delete',
    edit: 'Edit', create: 'Create', search: 'Search',
    loading: 'Loading...', error: 'Error', success: 'Success',
    close: 'Close', back: 'Back', confirm: 'Confirm',
    profile_title: 'Dashboard', messages_title: 'Messages',
    notifications: 'Notifications', balance: 'Balance', connects: 'Connects',
    bookmarks_title: 'Bookmarks', admin_title: 'Admin Panel',
    nav_home: 'Home', nav_exchange: 'Exchange', nav_tavern: 'Tavern',
    nav_orders: 'Orders', nav_messages: 'Messages', nav_profile: 'Profile',
    freelancer: 'Freelancer', client: 'Client',
    err_unauthorized: 'Please log in', err_network: 'Network error',
    err_unknown: 'An unknown error occurred',
    hero_title: 'Find a freelancer or<br>order a service in minutes',
    order_status_completed: 'Completed',
  }
};
