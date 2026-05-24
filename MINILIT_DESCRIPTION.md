# MiniLIT — Фриланс-маркетплейс

**URL:** https://dzektomas059-ctrl.github.io/minilit-freelance/  
**Репозиторий:** `github.com/dzektomas059-ctrl/minilit-freelance`  
**Хостинг:** GitHub Pages (ветка `main`, папка `docs/`)  
**База данных:** Supabase (PostgreSQL)  
**Файл:** Единственный SPА-файл `docs/index.html` (6436 строк). В нём всё: CSS, HTML, JS.

---

## 1. СТРУКТУРА ПРОЕКТА

```
learn/
├── docs/                          # Публикуется на GitHub Pages
│   ├── index.html                 # Единственный SPА-файл (6436 строк)
│   ├── manifest.json              # PWA Web App Manifest
│   ├── server.py                  # Локальный dev-сервер (Python)
│   ├── setup_supabase.sql         # Полный SQL для Supabase (22 таблицы)
│   ├── schema.sql                 # Альтернативная схема
│   ├── rls.sql                    # Row-Level Security политики
│   ├── seed.py                    # Сидер демо-данных (пользователи, задания, услуги)
│   ├── run_sql.py                 # Скрипт выполнения SQL
│   ├── email_triggers.sql         # Триггеры отправки email
│   ├── covers.sql                 # SQL для бакета covers
│   ├── proposals_storage.sql      # SQL для бакета portfolio_videos
│   ├── README.md                  # Описание проекта
│   ├── icons/                     # Иконки для PWA
│   │   ├── icon-192.png
│   │   ├── icon-512.png
│   │   ├── apple-touch-icon.png
│   │   └── favicon.ico
│   └── supabase/
│       └── functions/send-email/  # Edge Function отправки писем
│           ├── index.ts
│           └── deno.json
├── supabase/
│   └── functions/
│       ├── stripe-webhook/index.ts       # Stripe вебхук
│       ├── confirm-payment/index.ts      # Подтверждение платежа
│       └── create-payment-intent/index.ts # Создание платежа
└── MINILIT_DESCRIPTION.md (this file)
```

---

## 2. АРХИТЕКТУРА

### 2.1. Single-Page Application (SPA)
Всё приложение — один файл `index.html`. Внутри:
1. **CSS-стили** (тёмная и светлая темы, все компоненты) — ~1000 строк
2. **HTML-разметка** (шапка, навигация, подвал, info-страницы) — ~300 строк
3. **JavaScript** (4 inline-блока):
   - **script 0** (407 символов): CDN-ссылки Supabase
   - **script 1** (513 символов): Создание Supabase клиента
   - **script 2** (~252 000 символов): ВСЁ приложение (App, views, utils, CSS)
   - **script 3** (3357 символов): Инициализация темы и PWA

### 2.2. Маршрутизация (Hash-based SPA)
Парсинг `location.hash`:
- `#home` — главная
- `#exchange` — биржа заданий
- `#tavern` — таверна (проекты)
- `#task/:id` — детальная страница задания
- `#services` — каталог услуг
- `#service/:id` — детальная страница услуги
- `#messages?chat=:id` — чаты
- `#profile/:id` — профиль пользователя
- `#me?tab=:tab` — личный кабинет
- `#bookmarks` — закладки
- `#freelancers` — фрилансеры
- `#mytasks` — мои задания
- `#offer/:taskId` — предложить услугу
- `#admin*` — админка (jobs, services, users, complaints, withdrawals)
- `#about, #terms, #privacy, #faq...` — info-страницы (12 шт.)

### 2.3. База данных — Supabase (PostgreSQL + Realtime)

**Таблицы (22 шт.):**
| Таблица | Назначение |
|---------|-----------|
| `profiles` | Пользователи (имя, роль, баланс, connects, is_admin, banned) |
| `jobs` | Биржевые задания |
| `services` | Услуги фрилансеров |
| `applications` | Отклики на задания |
| `orders` | Заказы на услуги |
| `chats` | Диалоги |
| `messages` | Сообщения (текст + image_url, доставка/прочтение) |
| `reviews` | Отзывы (двусторонние: target_role) |
| `proposals` | Предложения на заказ (через offer page) |
| `portfolio` | Портфолио фрилансеров |
| `notifications` | Уведомления |
| `bookmarks` | Закладки (job/service/freelancer) |
| `complaints` | Жалобы |
| `withdrawals` | Запросы на вывод средств |
| `tavern_projects` | Проекты таверны |
| `tavern_proposals` | Отклики на проекты таверны |
| `covers`, `avatars`, `portfolio`, `portfolio_videos` | Storage buckets |

**Realtime:** Подписка на изменения всех таблиц через `postgres_changes` + polling fallback (3 секунды) для сообщений.

---

## 3. ВСЕ ФУНКЦИИ ПРИЛОЖЕНИЯ

### 3.1. Ядро (App Store, строка ~1499)

**Состояние приложения** (объект `App.state`):
- `users`, `tasks`, `responses`, `services`, `orders` — основные сущности
- `chats`, `messages` — чаты
- `reviews`, `proposals`, `portfolio` — отзывы/предложения/портфолио
- `session` — авторизация
- `notifications`, `unread`, `notifUnread` — уведомления
- `bookmarks` — закладки
- `ready` — флаг загрузки
- `demo` — режим без Supabase

**Внутренние поля:** `_channels` (realtime-каналы), `_tavernProjects`, `_tavernProposals`, `_pollTimer`, `_lastMsgCount`

### 3.2. Методы App

#### Инициализация и авторизация
- `App.init()` — загрузка: обработка OAuth, получение сессии, fetchAll, ensureProfile, подписка Realtime, auth listener, online touch
- `App.login(email, password)` — вход с 12s timeout
- `App.register({name, email, password, role})` — регистрация
- `App.logout()` — выход
- `App.resetPassword(email)` / `App.updatePassword(new)` — сброс пароля
- `App.me()` — текущий пользователь (null если забанен)

#### CRUD — Задания (Jobs)
- `App.createTask({title, description, category, budget})` — создать задание, уведомить всех фрилансеров
- `App.deleteTask(id)` — удалить задание + отклики

#### CRUD — Услуги (Services)
- `App.createService({title, description, price, category})` — создать услугу
- `App.deleteService(id)` — удалить услугу

#### CRUD — Заказы (Orders)
- `App.orderService(serviceId, message)` — заказать услугу, создать чат
- `App.setOrderStatus(id, status, paymentProof)` — изменить статус (с валидацией переходов), начислить деньги фрилансеру

#### Чат
- `App.ensureChat(a, b, ctx)` — найти или создать диалог
- `App.sendMessage(chatId, senderId, text, imageUrl)` — отправить сообщение, обновить превью чата, уведомить
- `App.chatsFor(userId)` — чаты пользователя
- `App.messagesIn(chatId)` — сообщения чата
- `App.markMessageDelivered(messageId)` — отметить доставку
- `App.markMessagesRead(chatId)` — отметить прочтение

#### Профиль
- `App.updateProfile(fields)` — обновить профиль
- `App.uploadAvatar(file)` / `App.uploadCover(file)` — загрузить аватар/обложку в Supabase Storage
- `App.addPortfolio({...})` / `App.deletePortfolio(id)` / `App.updatePortfolio(id, fields)` — портфолио
- `App.touchOnline()` / `App.isOnline(profile)` — онлайн-статус

#### Отзывы
- `App.addReview({orderId, rating, text, targetRole})` — оставить отзыв
- `App.reviewsFor(userId)` / `App.metrics(userId)` — отзывы/метрики

#### Баланс и вывод
- `App.deposit(amount)` — пополнить баланс
- `App.withdraw(amount)` — вывести средства (RPC atomic_withdraw)
- `App.getWithdrawals()` / `App.approveWithdrawal(id)` / `App.rejectWithdrawal(id)` — админка

#### Таверна (проекты)
- `App.loadTavernProjects()` — загрузить открытые проекты
- `App.createTavernProject(data)` — создать проект
- `App.closeTavernProject(id)` — закрыть проект
- `App.respondTavern(projectId, coverLetter, price)` — откликнуться, тратит 1 connect
- `App.tavernProjects(params)` — отфильтровать проекты

#### Закладки
- `App.toggleBookmark(targetType, targetId)` — добавить/удалить закладку

#### Админка
- `App.isAdmin()` — проверка прав
- `App.moderateJob(id, status)` / `App.moderateService(id, status)` — модерация
- `App.banUser(id)` / `App.unbanUser(id)` — блокировка
- `App.setUserRole(id, role)` / `App.setUserAdmin(id, isAdmin)` — роли
- `App.fileComplaint(targetType, targetId, reason)` — жалоба
- `App.getComplaints()` / `App.resolveComplaint(id, status)` — жалобы

#### Realtime
- `App.subscribeRealtime()` — подписка на postgres_changes по 12 таблицам
- `App.startMessagePolling()` — polling 3s для сообщений
- `_onMessage`, `_onChat`, `_onJob`, `_onService`, `_onApplication`, `_onOrder`, `_onProfile`, `_onReview`, `_onProposal`, `_onTavernProject`, `_onTavernProposal`, `_onNotification` — обработчики изменений

### 3.3. Views (Функции рендеринга)

| View | Маршрут | Что рендерит |
|------|---------|-------------|
| `viewHome()` | `#home` | Герой-секция, метрики (users/tasks/services/orders), 4 последних задания, 3 топ-услуги |
| `viewExchange(params)` | `#exchange` | Фильтры (категория, бюджет, поиск), кнопка "Разместить задание", список заданий с откликом/закладкой |
| `viewTavern(params)` | `#tavern` | Сайдбар (фильтры, connects, "Создать проект"), список проектов таверны + задания биржи с пометкой isJob, пагинация, детальная страница проекта |
| `viewTask(id)` | `#task/:id` | Детально: категория, заголовок, описание, автор, бюджет, кнопки отклика/предложения услуги, отклики, отзывы |
| `viewServices(params)` | `#services` | Фильтры, кнопка "Создать услугу", сетка услуг |
| `viewService(id)` | `#service/:id` | Детально: категория, заголовок, описание, фрилансер, цена, кнопка заказа/удаления |
| `viewMessages(chatId)` | `#messages` | Список диалогов с превью, активный чат с пузырьками (статусы доставки/прочтения), форма отправки текста + прикрепления фото |
| `viewProfile(id)` | `#profile/:id` | Обложка, аватар, имя, специализация, рейтинг, биография, услуги, портфолио, отзывы |
| `viewMe(tab)` | `#me` | Кабинет: метрики, вкладки (Заказы/Услуги/Задания/Отклики) |
| `viewBookmarks()` | `#bookmarks` | Закладки: задания, услуги, фрилансеры |
| `viewMyTasks()` | `#mytasks` | Мои задания со счётчиком откликов |
| `viewFreelancers(params)` | `#freelancers` | Поиск фрилансеров по имени/специализации |
| `viewOffer(taskId)` | `#offer/:taskId` | Форма "Предложить услугу": детали заказа, форма с заголовком, ценой, сроком, rich-text описанием, видео, валидацией |
| `viewAdmin*()` | `#admin*` | Админка: модерация заданий/услуг, пользователи, жалобы, вывод средств |
| `viewInfo(slug)` | `#about, #terms, #privacy, #faq, #blog...` | 12 статических info-страниц |

### 3.4. Utility-функции

| Функция | Назначение |
|---------|-----------|
| `$(q, r)` / `$$(q, r)` | querySelector/querySelectorAll (Array) |
| `esc(s)` | Экранирование HTML (XSS) |
| `fmtMoney(n)` | Формат "1 234 ₽" |
| `fmtDate(ts)` | "сегодня 14:30" / "1 января" |
| `fmtDateTime(ts)` | "1 янв, 14:30" |
| `initials(name)` | Две заглавные буквы из имени |
| `plural(n, forms)` | Склонение ("1 отзыв", "2 отзыва", "5 отзывов") |
| `colorFor(seed)` | Детерминированный цвет из строки (для аватаров) |
| `debounce(fn, ms)` | Debounce |
| `toast(msg, kind)` | Всплывающее уведомление (2.8s) |
| `openModal(html)` | Модальное окно с drag-to-dismiss на мобилках |
| `closeModal()` | Закрыть модалку |
| `navigate(hash)` / `render()` | Маршрутизация |
| `sanitiseRichText(html)` | Очистка HTML от XSS (только разрешённые теги) |
| `stripTagsToText(html)` | HTML → plain text |
| `stars(rating)` | "★★★★☆" |
| `catName(id)` | ID категории → русское название |
| `aviHTML(user, cls)` | Аватар с индикатором онлайн |

### 3.5. UI-компоненты

| Компонент | Назначение |
|-----------|-----------|
| `taskCard(t, responded, own)` | Карточка задания (аватар, заголовок, описание, мета, цена, кнопки) |
| `myTaskCard(t)` | Карточка задания в "Мои задания" |
| `serviceCard(s)` | Карточка услуги (градиент категории, аватар, цена, закладка) |
| `freelancerCard(u)` | Карточка фрилансера (аватар, имя, специализация, рейтинг) |
| `tavernProjectCard(p, me)` | Карточка проекта таверны (Kwork-стиль: зелёный заголовок, бюджет справа, блок заказчика, футер) |
| `paginationHtml(page, total, params)` | Пагинация "1 2 3 ... N ›" |
| `emptyState(text, cta)` | Пустое состояние |
| `aviHTML(user, cls)` | Аватар с фото/инициалами + онлайн-индикатор |
| `meOrders(orders, me)` | Карточки заказов с действиями (оплатить, начать, сдать, одобрить, отзыв, чат) |

### 3.6. Модальные окна

| Функция | Назначение |
|---------|-----------|
| `showLogin()` | Вход (email/пароль, демо-креды, Google OAuth) |
| `showRegister()` | Регистрация (имя, email, пароль, выбор роли, Google OAuth) |
| `showForgotPassword()` | Восстановление пароля |
| `showSetNewPassword()` | Установка нового пароля |
| `showRolePrompt()` | Выбор роли после Google OAuth |
| `showDepositModal(mode)` | Пополнение/вывод баланса |
| `openTaskForm()` | Создание задания |
| `openServiceForm()` | Создание услуги |
| `openRespondForm(taskId)` | Отклик на задание |
| `openOrderForm(serviceId)` | Заказ услуги |
| `openReviewForm(orderId, targetRole)` | Отзыв (со звёздами) |
| `openPaymentModal(orderId)` | Оплата заказа |
| `openEditProfile()` | Редактирование профиля + загрузка аватара |
| `openPortfolioModal()` | Добавление работы в портфолио |
| `openTavernCreateModal()` | Создание проекта таверны |
| `openTavernRespondModal(projectId)` | Отклик на проект таверны |
| `openChatWith(userId)` | Начать чат с пользователем |

---

## 4. КАТЕГОРИИ

```javascript
const CATS = [
  { id: 'design', name: 'Дизайн' },
  { id: 'dev',    name: 'Разработка и IT' },
  { id: 'text',   name: 'Тексты и переводы' },
  { id: 'seo',    name: 'SEO и трафик' },
  { id: 'smm',    name: 'Соцсети и маркетинг' },
  { id: 'av',     name: 'Аудио, видео, съёмка' },
  { id: 'biz',    name: 'Бизнес и жизнь' },
];
```

---

## 5. ТЕМЫ ОФОРМЛЕНИЯ

- **Светлая тема** (`data-theme="light"`): белый фон, зелёный акцент (#1DBF73)
- **Тёмная тема** (`data-theme="dark"`): чёрный фон (#000000), карты #141416, линии #2a2a2a, серый текст #8c8c8c/#999
- Переключение через `#themeToggle` → выпадашка
- Сохраняется в `localStorage('minilit_theme')`
- По умолчанию — системная тема (`prefers-color-scheme`)

### CSS-переменные тёмной темы:
```
--t-bg: #000000         (фон страницы)
--t-surface: #141416    (карточки, панели)
--t-line: #2a2a2a       (границы)
--t-text: #e8e8e8       (основной текст)
--t-muted: #8c8c8c      (второстепенный текст)
--t-bar: #15181f        (шапка/подвал)
--card-bg: #111111      (альтернативный фон карт)
--green: #1DBF73        (единственный цветовой акцент)
```

---

## 6. PWA (Progressive Web App)

- **manifest.json**: иконки 192/512, shortcuts (Биржа, Мои задания, Сообщения), standalone display
- **Service Worker**: удалён из-за кэширования проблем (commit 14f681e)
- **PWA Install**: кнопка в футере через `beforeinstallprompt`
- **iOS**: apple-touch-icon, status-bar black-translucent

---

## 7. ИСТОРИЯ РАЗРАБОТКИ (48 коммитов)

### Последние изменения (мы с тобой):

| Коммит | Описание |
|--------|----------|
| `2dba8f5` | **Вернул BOM** в index.html — GitHub Pages не определяет UTF-8 без BOM |
| `d05757c` | Удалил BOM + добавил charset=utf-8 в server.py (откачено предыдущим) |
| `6a7d7f9` | **Глобальная фикс кодировки**: все double-encoded строки (Р¤СЂРёР»Р°РЅСЃ → фриланс) конвертированы в правильный UTF-8 |
| `1e5d9e3` | **Чат: image upload** — прикрепление фото через FileReader, preview, base64 в image_url; чёрный текст в исходящих пузырьках |
| `8125219` | **Статистика**: тёмные tiles (#141416 bg, #222 border), мягкие лейблы (#8c8c8c), яркие значения (#ffffff) |
| `885d88c` | **Глобальный редизайн**: все синие/слейт оттенки заменены на нейтрально-чёрные (slate #334155 → #333, #1e293b → #222) |
| `2d90567` | **Kwork-редизайн Таверны**: зелёный жирный заголовок слева, бюджет справа, блок заказчика (аватар + ссылка + статистика), пагинация, 50 connects |
| `663e8a2` | **Таверна: реальные задания**: в ленте таверны показываются задания биржи + проекты, сортировка по дате |
| `cdf7d8f` | **Manifest**: URL shortcuts absolute → relative |
| `2731461` | **SyntaxError fix**: восстановлена missing `function viewExchange(params)`, --t-bar #15181f |

### Ранние коммиты (основополагающие):

| Коммит | Описание |
|--------|----------|
| `1fac0cf` | Тёмная тема чата + glassmorphism модалки |
| `98f270d` | **Таверна** — биржа проектов с connects-based откликами |
| `768a0b3` | Чат: клавиатура не закрывается после отправки |
| `732c83c` | Уведомления: мобильный layout, пропуск своих уведомлений |
| `14f681e` | **Удалён Service Worker** — постоянные проблемы с кэшем |
| `e31d71f` | Web Audio как основной звук, Page Visibility API |
| `38fea5f` | Мобильный чат: без полного re-render при отправке |
| `8cec5c6` | Исправление синтаксических ошибок JS |
| `9f83c82` | **Google OAuth**, редизайн статистики, таблица portfolio/proposals |
| `4bf278f` | Новый Supabase URL и ключ |
| `4cbcafa` | Graceful fallback при недоступности Supabase |
| `6d14ae0` | **Initial commit** — весь проект |

---

## 8. СХЕМА БАЗЫ ДАННЫХ (ключевые таблицы)

### profiles
```
id (uuid PK), email, name, role (freelancer|client), bio, specialization,
avatar_url, cover_url, balance (int), connects_remaining (int default 50),
rating_avg (float), orders_total, orders_done, last_seen (timestamptz),
is_admin (bool), banned (bool), payment_details (text)
```

### jobs (биржевые задания)
```
id, title, description, budget (int), category, status (open|in_progress|done|cancelled),
client_id (FK→profiles), responses_count, moderation_status (approved|pending|rejected), created_at
```

### services (услуги)
```
id, title, description, price (int), category, freelancer_id, status (active|inactive|moderated),
moderation_status, created_at
```

### orders (заказы на услуги)
```
id, service_id, client_id, freelancer_id, status (pending|active|in_review|done|cancelled|disputed),
price, title, payment_proof, created_at
```

### chats / messages
```
chats: id, client_id, freelancer_id, job_id, order_id, last_text, last_at
messages: id, chat_id, sender_id, text, image_url, read, delivered_at, read_at
```

### tavern_projects / tavern_proposals
```
tavern_projects: id, title, description, budget, category, client_id, status, proposal_count
tavern_proposals: id, project_id, freelancer_id, cover_letter, price, status
```

---

## 9. ИЗВЕСТНЫЕ ПРОБЛЕМЫ И ОСОБЕННОСТИ

1. **Service Worker удалён** (commit 14f681e) — были проблемы с кэшированием. PWA работает без SW.
2. **Кодировка:** двойная перекодировка (UTF-8 → CP-1251 → UTF-8) исправлена в 6a7d7f9. BOM обязателен для GitHub Pages (2dba8f5).
3. **Realtime + Polling:** сообщения получаются и через postgres_changes, и через polling каждые 3 секунды для надёжности.
4. **Баланс:** в коммитах — Stripe интеграция (create-payment-intent, confirm-payment), на фронтенде — заглушка `showDepositModal`.
5. **Google OAuth:** после входа через Google пользователь должен выбрать роль (фрилансер/заказчик).
6. **Rich-text описание:** для offer page — XSS-safe санитайзер (разрешены только div, p, br, b, strong, i, em, u, ul, ol, li, span).

---

## 10. КРАТКОЕ ОПИСАНИЕ РАБОТЫ СИСТЕМЫ

1. **Пользователь** регистрируется/входит (email или Google) → выбирает роль
2. **Заказчик** может: создавать задания в биржу → получать отклики → создавать проекты в таверну → просматривать отклики → заказывать услуги → общаться в чате → оставлять отзывы
3. **Фрилансер** может: откликаться на задания (тратит 1 connect из 50) → откликаться на проекты таверны → создавать услуги → получать заказы → общаться в чате → пополнять портфолио → выводить средства
4. **Админ** может: модерировать задания и услуги → банить пользователей → назначать роли → обрабатывать жалобы → подтверждать вывод средств
5. **Данные** синхронизируются через Supabase Realtime (мгновенные обновления чата, уведомлений, статусов)
6. **Уведомления** приходят внутри приложения (счётчик в шапке) + звуковой сигнал через Web Audio API
