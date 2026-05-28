let currentLocale = localStorage.getItem('minilit_lang') || 'ru';
let loaded = false;

// Start loading the locale JSON immediately
const loadPromise = loadLocale(currentLocale);

async function loadLocale(locale) {
  try {
    const resp = await fetch(`./src/i18n/${locale}.json`);
    if (!resp.ok) throw new Error('Not found');
    const dict = await resp.json();
    // Deep-merge: overlay loaded JSON on top of fallbacks
    Object.assign(FALLBACKS[locale] || FALLBACKS.ru, dict);
    loaded = true;
  } catch (e) {
    console.warn(`Failed to load locale "${locale}", using built-in fallbacks`);
    loaded = true;
  }
}

export async function initI18n() {
  document.documentElement.lang = currentLocale;
  await loadPromise;
}

export function setLocale(locale) {
  if (FALLBACKS[locale]) {
    currentLocale = locale;
    localStorage.setItem('minilit_lang', locale);
    document.documentElement.lang = locale;
    window.dispatchEvent(new CustomEvent('locale-changed', { detail: { locale } }));
  }
}

export function getLocale() { return currentLocale; }

export function t(key, params) {
  const dict = FALLBACKS[currentLocale] || FALLBACKS.ru;
  let val = dict[key];
  if (val === undefined) {
    val = FALLBACKS.en?.[key];
    if (val === undefined) return key;
  }
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      val = String(val).replace(`{${k}}`, v);
    }
  }
  return val;
}

export function tExists(key) {
  return FALLBACKS[currentLocale]?.[key] !== undefined || FALLBACKS.en?.[key] !== undefined;
}

const FALLBACKS = {
  ru: {
    nav_home: 'Главная', nav_exchange: 'Биржа', nav_tavern: 'Таверна',
    nav_services: 'Услуги', nav_freelancers: 'Фрилансеры', nav_orders: 'Заказы',
    nav_messages: 'Сообщения', nav_profile: 'Профиль', nav_bookmarks: 'Избранное',
    nav_admin: 'Админ-панель',
    login: 'Войти', register: 'Регистрация', logout: 'Выйти',
    email: 'Email', password: 'Пароль', name: 'Имя',
    sign_in: 'Войти в аккаунт', sign_up: 'Создать аккаунт',
    google_sign_in: 'Войти через Google', or: 'или', forgot_password: 'Забыли пароль?',
    save: 'Сохранить', cancel: 'Отмена', delete: 'Удалить', edit: 'Редактировать',
    create: 'Создать', search: 'Поиск', loading: 'Загрузка...',
    error: 'Ошибка', success: 'Успешно', close: 'Закрыть', back: 'Назад',
    confirm: 'Подтвердить', skip: 'Пропустить', empty: 'Нет данных',
    all: 'Все', filter: 'Фильтр', sort: 'Сортировка',
    profile_title: 'Личный кабинет', profile_edit: 'Редактировать профиль',
    profile_specialization: 'Специализация', profile_bio: 'О себе',
    profile_payment: 'Реквизиты для оплаты', profile_role: 'Роль',
    freelancer: 'Фрилансер', client: 'Заказчик',
    balance: 'Баланс', connects: 'Коннекты', rating: 'Рейтинг',
    reviews: 'Отзывы', orders_done: 'Заказов выполнено', portfolio: 'Портфолио',
    status: 'Статус', status_free: 'Свободен', status_busy: 'Занят',
    status_gaming: 'В игре', upload_photo: 'Загрузить фото',
    messages_title: 'Сообщения', chat_placeholder: 'Написать сообщение...',
    send: 'Отправить', voice_record: 'Голосовое сообщение',
    attach_file: 'Прикрепить файл', no_messages: 'Нет сообщений',
    no_chats: 'Нет чатов', start_chat: 'Начните диалог',
    task_create: 'Новое задание', task_title: 'Название',
    task_description: 'Описание', task_category: 'Категория',
    task_budget: 'Бюджет', task_publish: 'Опубликовать',
    task_edit: 'Редактировать задание', task_delete: 'Закрыть задание',
    task_apply: 'Откликнуться', task_applications: 'Отклики',
    no_tasks: 'Заданий пока нет',
    service_create: 'Новая услуга', service_title: 'Название',
    service_description: 'Описание', service_category: 'Категория',
    service_price: 'Цена', service_publish: 'Опубликовать',
    service_order: 'Заказать', no_services: 'Услуг пока нет',
    order_status_pending: 'Ожидает оплаты', order_status_paid: 'Оплачено',
    order_status_in_progress: 'В работе', order_status_completed: 'Завершён',
    order_status_cancelled: 'Отменён', order_status_disputed: 'Спор',
    confirm_complete: 'Подтвердить выполнение', open_dispute: 'Открыть спор',
    bookmarks_title: 'Избранное', no_bookmarks: 'Нет избранных записей',
    bookmark_add: 'Добавить в избранное', bookmark_remove: 'Убрать из избранного',
    notifications: 'Уведомления', notif_empty: 'Нет уведомлений',
    notif_settings: 'Настройки уведомлений',
    notif_order: 'Изменения заказов', notif_message: 'Новые сообщения',
    notif_proposal: 'Отклики', notif_review: 'Отзывы', notif_system: 'Системные',
    mark_all_read: 'Все прочитано',
    quests_title: 'Ежедневные квесты',
    quests_subtitle: 'Выполняй задания и зарабатывай коннекты',
    quest_claim: 'Забрать награду', quest_done: 'Выполнено',
    quest_progress: 'В процессе', quest_connects: 'коннектов',
    quest_empty: 'Войди, чтобы получать квесты',
    admin_title: 'Админ-панель', admin_complaints: 'Жалобы',
    admin_disputes: 'Арбитраж', admin_users: 'Пользователи',
    admin_ban: 'Заблокировать', admin_unban: 'Разблокировать',
    hero_title: 'Найди исполнителя или<br>закажи услугу за минуту',
    hero_sub: 'MiniLIT — фриланс-маркетплейс нового поколения. Заказчики находят исполнителей за пару кликов, а фрилансеры получают стабильный поток заказов.',
    hero_cta_start: 'Начать зарабатывать', hero_cta_order: 'Заказать услугу',
    stats_tasks: 'Активных заданий', stats_freelancers: 'Фрилансеров',
    stats_orders: 'Выполнено заказов', stats_rating: 'Рейтинг платформы',
    how_it_works: 'Как это работает',
    step_register: 'Зарегистрируйтесь',
    step_register_desc: 'Создайте аккаунт за 30 секунд через Google или почту.',
    step_find: 'Найдите задание или услугу',
    step_find_desc: 'Просматривайте биржу заданий или каталог услуг.',
    step_respond: 'Откликнитесь или закажите',
    step_respond_desc: 'Фрилансеры откликаются на проекты, заказчики покупают услуги.',
    step_earn: 'Работайте и зарабатывайте',
    step_earn_desc: 'Безопасные сделки с эскроу и гарантией оплаты.',
    err_required: 'обязательно', err_min_length: 'Минимум {n} символов',
    err_invalid_email: 'Некорректный email', err_min_value: 'Минимальное значение {n}',
    err_unauthorized: 'Войдите в аккаунт', err_no_connects: 'Недостаточно коннектов',
    err_network: 'Ошибка сети. Проверьте подключение.',
    err_unknown: 'Произошла неизвестная ошибка',
    admin_only: 'Только для администраторов',
    freelancer_only: 'Только для фрилансеров',
    client_only: 'Только для заказчиков',
  },
  en: {
    nav_home: 'Home', nav_exchange: 'Exchange', nav_tavern: 'Tavern',
    nav_services: 'Services', nav_freelancers: 'Freelancers', nav_orders: 'Orders',
    nav_messages: 'Messages', nav_profile: 'Profile', nav_bookmarks: 'Bookmarks',
    nav_admin: 'Admin Panel',
    login: 'Login', register: 'Sign Up', logout: 'Logout',
    email: 'Email', password: 'Password', name: 'Name',
    sign_in: 'Sign In', sign_up: 'Create Account',
    google_sign_in: 'Sign in with Google', or: 'or', forgot_password: 'Forgot password?',
    save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit',
    create: 'Create', search: 'Search', loading: 'Loading...',
    error: 'Error', success: 'Success', close: 'Close', back: 'Back',
    confirm: 'Confirm', skip: 'Skip', empty: 'No data',
    all: 'All', filter: 'Filter', sort: 'Sort',
    profile_title: 'Dashboard', profile_edit: 'Edit Profile',
    profile_specialization: 'Specialization', profile_bio: 'About',
    profile_payment: 'Payment Details', profile_role: 'Role',
    freelancer: 'Freelancer', client: 'Client',
    balance: 'Balance', connects: 'Connects', rating: 'Rating',
    reviews: 'Reviews', orders_done: 'Orders Done', portfolio: 'Portfolio',
    status: 'Status', status_free: 'Available', status_busy: 'Busy',
    status_gaming: 'In Game', upload_photo: 'Upload Photo',
    messages_title: 'Messages', chat_placeholder: 'Type a message...',
    send: 'Send', voice_record: 'Voice message',
    attach_file: 'Attach file', no_messages: 'No messages',
    no_chats: 'No chats', start_chat: 'Start a conversation',
    task_create: 'New Task', task_title: 'Title',
    task_description: 'Description', task_category: 'Category',
    task_budget: 'Budget', task_publish: 'Publish',
    task_edit: 'Edit Task', task_delete: 'Close Task',
    task_apply: 'Apply', task_applications: 'Applications',
    no_tasks: 'No tasks yet',
    service_create: 'New Service', service_title: 'Title',
    service_description: 'Description', service_category: 'Category',
    service_price: 'Price', service_publish: 'Publish',
    service_order: 'Order', no_services: 'No services yet',
    order_status_pending: 'Pending Payment', order_status_paid: 'Paid',
    order_status_in_progress: 'In Progress', order_status_completed: 'Completed',
    order_status_cancelled: 'Cancelled', order_status_disputed: 'Disputed',
    confirm_complete: 'Confirm Completion', open_dispute: 'Open Dispute',
    bookmarks_title: 'Bookmarks', no_bookmarks: 'No bookmarks',
    bookmark_add: 'Add to bookmarks', bookmark_remove: 'Remove from bookmarks',
    notifications: 'Notifications', notif_empty: 'No notifications',
    notif_settings: 'Notification Settings',
    notif_order: 'Order updates', notif_message: 'New messages',
    notif_proposal: 'Proposals', notif_review: 'Reviews', notif_system: 'System',
    mark_all_read: 'Mark all read',
    quests_title: 'Daily Quests',
    quests_subtitle: 'Complete tasks and earn connects',
    quest_claim: 'Claim reward', quest_done: 'Completed',
    quest_progress: 'In progress', quest_connects: 'connects',
    quest_empty: 'Log in to get quests',
    admin_title: 'Admin Panel', admin_complaints: 'Complaints',
    admin_disputes: 'Arbitration', admin_users: 'Users',
    admin_ban: 'Ban', admin_unban: 'Unban',
    hero_title: 'Find a freelancer or<br>order a service in minutes',
    hero_sub: 'MiniLIT — next-gen freelance marketplace. Clients find performers in a few clicks, freelancers get a steady flow of orders.',
    hero_cta_start: 'Start earning', hero_cta_order: 'Order a service',
    stats_tasks: 'Active tasks', stats_freelancers: 'Freelancers',
    stats_orders: 'Orders completed', stats_rating: 'Platform rating',
    how_it_works: 'How it works',
    step_register: 'Register',
    step_register_desc: 'Create an account in 30 seconds via Google or email.',
    step_find: 'Find a task or service',
    step_find_desc: 'Browse the task exchange or service catalog.',
    step_respond: 'Respond or order',
    step_respond_desc: 'Freelancers apply to projects, clients purchase services.',
    step_earn: 'Work and earn',
    step_earn_desc: 'Secure escrow deals with payment guarantees.',
    err_required: 'is required', err_min_length: 'Minimum {n} characters',
    err_invalid_email: 'Invalid email', err_min_value: 'Minimum value {n}',
    err_unauthorized: 'Please log in', err_no_connects: 'Not enough connects',
    err_network: 'Network error. Check connection.',
    err_unknown: 'An unknown error occurred',
    admin_only: 'Admins only',
    freelancer_only: 'Freelancers only',
    client_only: 'Clients only',
  }
};
