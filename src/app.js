import { API } from './api.js';
import { store } from './store.js';
import { Router } from './router.js';
import { setLocale, getLocale, t, initI18n } from './i18n.js';
import { viewProfile, bindProfile } from './views/profile.js';
import { viewMessages, bindMessages } from './views/chat.js';
import { viewAdmin, bindAdmin } from './views/admin.js';

// Global helpers that views need
window.$ = (q, r = document) => r.querySelector(q);
window.$$ = (q, r = document) => Array.from(r.querySelectorAll(q));
window.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
window.uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
window.now = () => Date.now();
window.fmtMoney = n => (Number(n) || 0).toLocaleString('ru-RU') + ' ₽';
window.fmtDate = ts => {
  const d = new Date(ts), today = new Date();
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
};
window.fmtDateTime = ts => new Date(ts).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
window.initials = name => (name || '?').trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
window.colorFor = seed => {
  const palette = ['#1DBF73', '#ef4444', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6', '#84cc16', '#eab308', '#374151', '#6b7280'];
  let h = 0; for (const c of String(seed || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
};
window.aviHTML = u => u && u.avatar
  ? `<img src="${window.esc(u.avatar)}" alt="${window.esc(u.name)}" loading="lazy">`
  : window.initials(u?.name);

// Category catalog
const CATS = [
  { id: 'design',   name: 'Дизайн и Арт' },
  { id: 'dev',      name: 'Код и Скрипты' },
  { id: 'gaming',   name: 'Гейминг и Dota 2' },
  { id: 'text',     name: 'Тексты и Локализация' },
  { id: 'traffic',  name: 'Продвижение и Трафик' },
  { id: 'av',       name: 'Саунд и Видеомонтаж' },
  { id: 'ai',       name: 'ИИ и Нейросети' },
  { id: 'boost',    name: 'Буст и Услуги' },
];

// View registry: maps patterns to { view, bind } functions
const views = {};

// === HOME / LANDING ===
views['home'] = {
  view: () => {
    return viewHomeHTML();
  },
  bind: (container) => {
    bindHome(container);
  }
};

// === EXCHANGE (tasks listing) ===
views['exchange'] = {
  view: (params) => viewExchangeHTML(params),
  bind: (container, params) => bindExchange(container, params),
};

// === SERVICES ===
views['services'] = {
  view: (params) => viewServicesHTML(params),
  bind: (container, params) => bindServices(container, params),
};

// === TAVERN (projects) ===
views['tavern'] = {
  view: (params) => viewTavernHTML(params),
  bind: (container, params) => bindTavern(container, params),
};

// === FREELANCERS ===
views['freelancers'] = {
  view: () => viewFreelancersHTML(),
  bind: (container) => bindFreelancers(container),
};

// === OFFER (respond to task) ===
views['offer'] = {
  view: (params) => viewOfferHTML(params),
  bind: (container, params) => bindOffer(container, params),
};

// === PROFILE ===
views['profile'] = {
  view: (params) => viewProfile(params),
  bind: (container, params) => bindProfile(container, params),
};

// === ME (dashboard) ===
views['me'] = {
  view: (params) => viewMeHTML(params),
  bind: (container, params) => bindMe(container, params),
};

// === MESSAGES ===
views['messages'] = {
  view: (params) => viewMessages(params),
  bind: (container, params) => bindMessages(container, params),
};

// === ADMIN ===
views['admin'] = {
  view: () => viewAdmin(),
  bind: (container) => bindAdmin(container),
};

// === BOOKMARKS ===
views['bookmarks'] = {
  view: () => viewBookmarksHTML(),
  bind: (container) => bindBookmarks(container),
};

// === INFO PAGES (about, terms, privacy, faq, etc.) ===
views['about'] = { view: () => viewInfoPage('about'), bind: () => {} };
views['terms'] = { view: () => viewInfoPage('terms'), bind: () => {} };
views['privacy'] = { view: () => viewInfoPage('privacy'), bind: () => {} };
views['faq'] = { view: () => viewInfoPage('faq'), bind: () => {} };
views['how-it-works'] = { view: () => viewInfoPage('how-it-works'), bind: () => {} };
views['partners'] = { view: () => viewInfoPage('partners'), bind: () => {} };
views['careers'] = { view: () => viewInfoPage('careers'), bind: () => {} };
views['buyers'] = { view: () => viewInfoPage('buyers'), bind: () => {} };
views['cases'] = { view: () => viewInfoPage('cases'), bind: () => {} };
views['blog'] = { view: () => viewInfoPage('blog'), bind: () => {} };
views['mobile'] = { view: () => viewInfoPage('mobile'), bind: () => {} };

// Register all routes with the router
const router = new Router();
for (const [pattern, viewDef] of Object.entries(views)) {
  router.on(pattern, (params) => {
    const app = document.getElementById('app');
    try {
      const html = viewDef.view(params);
      app.innerHTML = html;
      viewDef.bind(app, params);
      return html;
    } catch (e) {
      console.error('View error:', pattern, e);
      const errHtml = `<div class="container"><div class="card"><h2>Ошибка</h2><p>${window.esc(e.message)}</p></div></div>`;
      app.innerHTML = errHtml;
      return errHtml;
    }
  });
}

// Initialize the app
(async () => {
  try {
    // Load i18n (JSON overrides on top of built-in fallbacks)
    await initI18n();
    
    // Boot Supabase session
    const session = await API.getSession();
    if (session?.user) {
      store.set('session', session.user.id);
      // Fetch all initial data
      await loadInitialData();
      await API.updateOnlineStatus(session.user.id);
    }
    store.set('ready', true);

    // Render header (login/register buttons or user menu)
    renderTopActions();

    // Resolve current route
    router.resolve();
    
    // Auth state listener
    globalThis.sb.auth.onAuthStateChange(async (event, sess) => {
      const newId = sess?.user?.id || null;
      if (newId !== store.userId()) {
        store.set('session', newId);
        if (newId) {
          await loadInitialData();
          await API.updateOnlineStatus(newId);
        } else {
          store.set('users', []);
          store.set('tasks', []);
          store.set('services', []);
          store.set('orders', []);
          store.set('chats', []);
          store.set('messages', []);
          store.set('bookmarks', []);
          store.set('notifications', []);
        }
        renderTopActions();
        router.resolve();
      }
    });
    
    // Register service worker
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('./sw.js');
      } catch (e) {
        console.warn('SW registration failed:', e);
      }
    }
    
    // PWA install prompt
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      deferredPrompt = e;
      const btn = document.querySelector('.pwa-install-btn');
      if (btn) btn.classList.add('visible');
    });
    document.addEventListener('click', async e => {
      const installBtn = e.target.closest('.pwa-install-btn');
      if (installBtn && deferredPrompt) {
        deferredPrompt.prompt();
        const result = await deferredPrompt.userChoice;
        deferredPrompt = null;
        installBtn.classList.remove('visible');
      }
    });
    
  } catch (e) {
    console.error('App init error:', e);
    document.getElementById('app').innerHTML = `<div class="container"><div class="card"><h2>Ошибка загрузки</h2><p>${window.esc(e.message)}</p></div></div>`;
  }
})();

async function loadInitialData() {
  try {
    const [profiles, tasks, services, orders, chats, notifs, bookmarks] = await Promise.all([
      API.fetchProfiles().catch(() => []),
      API.fetchTasks().catch(() => []),
      API.fetchServices().catch(() => []),
      API.fetchOrders().catch(() => []),
      store.userId() ? API.fetchChats(store.userId()).catch(() => []) : [],
      store.userId() ? API.fetchNotifications(store.userId()).catch(() => []) : [],
      store.userId() ? API.fetchBookmarks(store.userId()).catch(() => []) : [],
    ]);
    
    store.set('users', profiles);
    store.set('tasks', tasks);
    store.set('services', services);
    store.set('orders', orders);
    store.set('chats', chats);
    store.set('notifications', notifs);
    store.set('bookmarks', bookmarks);
    
    // Calculate unread counts
    const unread = chats.reduce((sum, c) => sum + (c.unread || 0), 0);
    store.set('unread', unread);
    const notifUnread = notifs.filter(n => !n.read).length;
    store.set('notifUnread', notifUnread);
    
  } catch (e) {
    console.error('loadInitialData error:', e);
    throw e;
  }
}

// ===== VIEW RENDERERS =====

function viewHomeHTML() {
  return `
  <div class="landing">
    <section class="landing-hero landing-section">
      <div class="parallax-bg"></div>
      <div class="particles">
        ${Array.from({ length: 12 }, (_, i) => `<div class="particle" style="left:${Math.random() * 100}%;top:${Math.random() * 100}%;animation-delay:${Math.random() * 8}s;animation-duration:${6 + Math.random() * 4}s"></div>`).join('')}
      </div>
      <div class="container" style="position:relative;z-index:2">
        <div class="landing-hero-content">
          <h1 class="hero-title">${t('hero_title')}</h1>
          <p class="hero-sub">${t('hero_sub')}</p>
          <div class="cta-group hero-cta">
            <a class="btn-primary btn-lg" href="#register" data-link>${t('hero_cta_start')}</a>
            <a class="btn-outline btn-lg" href="#exchange" data-link>${t('hero_cta_order')}</a>
          </div>
        </div>
      </div>
    </section>
    
    <section class="landing-stats">
      <div class="container">
        <div class="stats-grid">
          <div class="stat-mega premium-card reveal"><span class="counter-val" id="statTasks">0</span><span class="stat-label">${t('stats_tasks')}</span></div>
          <div class="stat-mega premium-card reveal"><span class="counter-val" id="statFreelancers">0</span><span class="stat-label">${t('stats_freelancers')}</span></div>
          <div class="stat-mega premium-card reveal"><span class="counter-val" id="statOrders">0</span><span class="stat-label">${t('stats_orders')}</span></div>
          <div class="stat-mega premium-card reveal"><span class="counter-val" id="statRating">0</span><span class="stat-label">${t('stats_rating')}</span></div>
        </div>
      </div>
    </section>
    
    <section class="landing-section" style="padding:60px 0">
      <div class="container">
        <h2 class="section-title" style="text-align:center;color:var(--t-text,#fff);margin-bottom:40px">${t('how_it_works')}</h2>
        <div class="hiw-grid">
          <div class="hiw-card premium-card reveal">
            <div class="hiw-num">1</div>
            <h3>${t('step_register')}</h3>
            <p>${t('step_register_desc')}</p>
          </div>
          <div class="hiw-card premium-card reveal">
            <div class="hiw-num">2</div>
            <h3>${t('step_find')}</h3>
            <p>${t('step_find_desc')}</p>
          </div>
          <div class="hiw-card premium-card reveal">
            <div class="hiw-num">3</div>
            <h3>${t('step_respond')}</h3>
            <p>${t('step_respond_desc')}</p>
          </div>
          <div class="hiw-card premium-card reveal">
            <div class="hiw-num">4</div>
            <h3>${t('step_earn')}</h3>
            <p>${t('step_earn_desc')}</p>
          </div>
        </div>
      </div>
    </section>
    
    <section class="categories-section">
      <div class="container">
        <h2 class="section-title">${t('nav_exchange')}</h2>
        <p class="section-subtitle">Выбери категорию и найди подходящую услугу или задание</p>
        <div class="categories-grid">
          ${CATS.map(c => `
          <a class="category-card premium-card reveal" data-category="${c.name}" href="#services?cat=${c.id}" data-link>
            <div class="category-icon-wrapper">
              <svg class="category-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
              </svg>
            </div>
            <h3 class="category-name">${esc(c.name)}</h3>
            <span class="category-count">...</span>
          </a>`).join('')}
        </div>
      </div>
    </section>
    
    <section class="final-cta">
      <div class="container">
        <div class="final-cta-inner">
          <h2>Готовы начать?</h2>
          <p>Присоединяйтесь к MiniLIT прямо сейчас — это бесплатно.</p>
          <a class="btn-primary btn-lg" href="#register" data-link>${t('hero_cta_start')}</a>
        </div>
      </div>
    </section>
  </div>`;
}

function bindHome(container) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  container.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  
  const animateCounter = (el, target) => {
    if (!el) return;
    const duration = 1500;
    const start = performance.now();
    const frame = () => {
      const elapsed = performance.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.floor(eased * target).toLocaleString('ru-RU');
      if (progress < 1) requestAnimationFrame(frame);
      else el.textContent = target.toLocaleString('ru-RU');
    };
    requestAnimationFrame(frame);
  };
  
  const statsObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(document.getElementById('statTasks'), store.tasks.length || 42);
        animateCounter(document.getElementById('statFreelancers'), store.users.filter(u => u.role === 'freelancer').length || 128);
        animateCounter(document.getElementById('statOrders'), store.orders.filter(o => o.status === 'completed').length || 256);
        animateCounter(document.getElementById('statRating'), 4.8);
        statsObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });
  const statsGrid = container.querySelector('.stats-grid');
  if (statsGrid) statsObserver.observe(statsGrid);
}

// ===== EXCHANGE VIEW =====
function viewExchangeHTML(params) {
  const cat = params.cat || '';
  const tasks = store.tasks.filter(t => t.status === 'open' && (!cat || t.category === cat));
  const services = store.services.filter(s => (!cat || s.category === cat));
  
  return `
  <div class="container">
    <div class="page-title">
      <h1>${cat ? catName(cat) : 'Биржа'}</h1>
      <button class="btn-primary btn-sm" id="btnNewTask">+ Новое задание</button>
    </div>
    
    <div class="grid-2">
      <div>
        <h3>📋 Задания</h3>
        <div class="stagger-list">
          ${tasks.length === 0 ? `<div class="card muted" style="text-align:center;padding:40px">Заданий пока нет</div>` :
            tasks.map(t => `
            <div class="list-card">
              <div class="body">
                <div class="title" data-link="#task/${t.id}">${esc(t.title)}</div>
                <div class="desc">${esc(t.description)}</div>
                <div class="meta">
                  <span>#${catName(t.category)}</span>
                  <span>💰 <b>${window.fmtMoney(t.budget)}</b></span>
                  <span>📅 ${window.fmtDate(t.createdAt)}</span>
                </div>
              </div>
              <div class="right">
                <span class="price">${window.fmtMoney(t.budget)}</span>
                <button class="btn-outline btn-sm" data-view-task="${t.id}">Подробнее</button>
              </div>
            </div>`).join('')}
        </div>
      </div>
      <div>
        <h3>🛒 Услуги</h3>
        <div class="svc-grid">
          ${services.length === 0 ? `<div class="card muted" style="text-align:center;padding:40px;grid-column:1/-1">Услуг пока нет</div>` :
            services.map(s => `
            <div class="svc-card c-${s.category}" data-link="#service/${s.id}">
              <div class="svc-cover">${esc(s.title)}</div>
              <div class="svc-body">
                <div class="svc-title">${esc(s.title)}</div>
                <div class="svc-meta">
                  <span>#${catName(s.category)}</span>
                  <span class="price">${window.fmtMoney(s.price)}</span>
                </div>
              </div>
            </div>`).join('')}
        </div>
      </div>
    </div>
  </div>`;
}

function bindExchange(container, params) {
  container.querySelector('[data-link="#task/"]')?.addEventListener('click', () => {});
  container.querySelectorAll('[data-view-task]').forEach(btn => {
    btn.addEventListener('click', () => router.navigate(`#task/${btn.dataset.viewTask}`));
  });
  container.querySelector('#btnNewTask')?.addEventListener('click', () => {
    if (!store.isLoggedIn()) return toast('Войдите в аккаунт', 'error');
    openTaskForm();
  });
  container.querySelectorAll('.svc-card').forEach(card => {
    card.addEventListener('click', () => {
      const href = card.getAttribute('data-link');
      if (href) router.navigate(href);
    });
  });
  
  container.querySelectorAll('.stagger-list > .list-card').forEach((el, i) => {
    el.style.animationDelay = (i * 60) + 'ms';
  });
}

// ===== SERVICES VIEW =====
function viewServicesHTML(params) {
  const cat = params.cat || '';
  const list = store.services.filter(s => (!cat || s.category === cat));
  
  return `
  <div class="container">
    <div class="page-title">
      <h1>${cat ? catName(cat) : 'Услуги'}</h1>
      ${store.me()?.role === 'freelancer' ? `<button class="btn-primary btn-sm" id="btnNewService">+ Новая услуга</button>` : ''}
    </div>
    <div class="svc-grid stagger-list">
      ${list.length === 0 ? `<div class="card muted" style="text-align:center;padding:40px;grid-column:1/-1">Услуг пока нет</div>` :
        list.map(s => `
        <div class="svc-card c-${s.category}" data-link="#service/${s.id}">
          <div class="svc-cover">${esc(s.title)}</div>
          <div class="svc-body">
            <div class="svc-title">${esc(s.title)}</div>
            <div class="svc-meta">
              <span>#${catName(s.category)}</span>
              <span class="price">${window.fmtMoney(s.price)}</span>
            </div>
          </div>
        </div>`).join('')}
    </div>
  </div>`;
}

function bindServices(container, params) {
  container.querySelector('#btnNewService')?.addEventListener('click', () => openServiceForm());
  container.querySelectorAll('.svc-card').forEach(card => {
    card.addEventListener('click', () => {
      const href = card.getAttribute('data-link');
      if (href) router.navigate(href);
    });
  });
}

// ===== TAVERN VIEW (projects) =====
function viewTavernHTML(params) {
  return `<div class="container"><h2>Таверна</h2><div class="card muted" style="text-align:center;padding:40px">Раздел в разработке</div></div>`;
}

function bindTavern(container, params) {}

// ===== FREELANCERS VIEW =====
function viewFreelancersHTML() {
  const freelancers = store.users.filter(u => u.role === 'freelancer');
  
  return `
  <div class="container">
    <div class="page-title">
      <h1>Фрилансеры</h1>
    </div>
    <div class="stagger-list">
      ${freelancers.length === 0 ? `<div class="card muted" style="text-align:center;padding:40px">Фрилансеров пока нет</div>` :
        freelancers.map(f => `
        <a class="fl-card" href="#profile/${f.id}" data-link>
          <div class="fl-avi ${f.avatar ? '' : ''}">
            ${f.avatar ? `<img src="${esc(f.avatar)}" alt="${esc(f.name)}">` : window.initials(f.name)}
          </div>
          <div class="fl-body">
            <div class="fl-name">${esc(f.name)}</div>
            <div class="fl-spec">${esc(f.specialization || 'Фрилансер')}</div>
            <div class="fl-meta">
              <span>⭐ ${f.rating.toFixed(1)} (${f.reviews_count} ${window.reviewsWord(f.reviews_count)})</span>
              <span>✅ ${f.orders_done} ${window.ordersWord(f.orders_done)}</span>
            </div>
          </div>
        </a>`).join('')}
    </div>
  </div>`;
}

function bindFreelancers(container) {}

// ===== OFFER VIEW (respond to task) =====
function viewOfferHTML(params) {
  return `<div class="container"><h2>Отклик на задание</h2><div class="card muted" style="text-align:center;padding:40px">Раздел в разработке</div></div>`;
}

function bindOffer(container, params) {}

// ===== ME (dashboard) VIEW =====
function viewMeHTML(params) {
  const me = store.me();
  if (!me) return `<div class="container">${emptyStateHTML('Войдите, чтобы увидеть личный кабинет.', '<button class="btn-primary" id="ctaLogin">Войти</button>')}</div>`;
  
  const tab = params.tab || 'overview';
  const isFreelancer = me.role === 'freelancer';
  
  const orders = store.orders;
  const myOrders = orders.filter(o => isFreelancer ? o.freelancerId === me.id : o.clientId === me.id);
  const activeOrders = myOrders.filter(o => o.status === 'in_progress' || o.status === 'paid');
  const completedOrders = myOrders.filter(o => o.status === 'completed');
  
  return `
  <div class="container">
    <div class="page-title">
      <h1>${t('profile_title')}</h1>
      <button class="btn-outline btn-sm" id="editProfile">${t('profile_edit')}</button>
    </div>
    
    <div class="tabs">
      <button class="tab ${tab === 'overview' ? 'active' : ''}" data-tab="overview">Обзор</button>
      <button class="tab ${tab === 'orders' ? 'active' : ''}" data-tab="orders">${t('nav_orders')}</button>
      <button class="tab ${tab === 'notifications' ? 'active' : ''}" data-tab="notifications">${t('notifications')}</button>
      ${isFreelancer ? `<button class="tab ${tab === 'portfolio' ? 'active' : ''}" data-tab="portfolio">${t('portfolio')}</button>` : ''}
    </div>
    
    <div id="meTabContent">
      ${renderMeTab(tab, me, myOrders, activeOrders, completedOrders)}
    </div>
  </div>`;
}

function renderMeTab(tab, me, myOrders, activeOrders, completedOrders) {
  switch (tab) {
    case 'overview':
      return `
      <div class="metric-tiles" style="margin-bottom:18px">
        <div class="tile"><div class="label">${t('balance')}</div><div class="value">${window.fmtMoney(me.balance)}</div></div>
        <div class="tile"><div class="label">${t('connects')}</div><div class="value">${me.connectsRemaining ?? 50}</div></div>
        <div class="tile"><div class="label">${t('rating')}</div><div class="value">${me.rating.toFixed(1)}</div></div>
        <div class="tile"><div class="label">${t('orders_done')}</div><div class="value">${me.orders_done}</div></div>
      </div>
      <div class="card">
        <h3>Активные заказы (${activeOrders.length})</h3>
        ${activeOrders.length === 0 ? `<div class="muted">Нет активных заказов</div>` :
          activeOrders.map(o => `
          <div class="list-card" style="margin-bottom:8px">
            <div class="body">
              <div class="title">${esc(o.title)}</div>
              <div class="meta">
                <span class="status ${o.status === 'in_progress' ? 'progress' : 'new'}">${orderStatusLabel(o.status)}</span>
                <span>💰 ${window.fmtMoney(o.price)}</span>
              </div>
            </div>
          </div>`).join('')}
      </div>`;
    
    case 'orders':
      return `
      <div class="card">
        <h3>Мои заказы</h3>
        ${myOrders.length === 0 ? `<div class="muted">Нет заказов</div>` :
          myOrders.map(o => `
          <div class="list-card" style="margin-bottom:8px">
            <div class="body">
              <div class="title">${esc(o.title)}</div>
              <div class="meta">
                <span class="status ${o.status === 'completed' ? 'done' : o.status === 'cancelled' ? 'cancelled' : o.status === 'disputed' ? 'progress' : 'new'}">${orderStatusLabel(o.status)}</span>
                <span>💰 ${window.fmtMoney(o.price)}</span>
                <span>📅 ${window.fmtDate(o.createdAt)}</span>
              </div>
            </div>
            <div class="right">
              <a class="btn-outline btn-sm" href="#messages?chat=${o.id}" data-link>Чат</a>
            </div>
          </div>`).join('')}
      </div>`;
    
    case 'notifications':
      return `
      <div class="card">
        <div class="between">
          <h3>${t('notifications')}</h3>
          <button class="btn-ghost btn-sm" id="markAllNotifRead">${t('mark_all_read')}</button>
        </div>
        <div id="notifList">
          ${store.notifications.length === 0 ? `<div class="muted">${t('notif_empty')}</div>` :
            store.notifications.map(n => `
            <div class="notif-item ${!n.read ? 'unread' : ''}" data-nid="${n.id}">
              <div class="ni-icon ni-${n.type}">${notifIcon(n.type)}</div>
              <div class="ni-body">
                <div class="ni-title">${esc(n.title)}</div>
                <div class="ni-text">${esc(n.body)}</div>
                <div class="ni-time">${window.fmtDate(n.createdAt)}</div>
              </div>
            </div>`).join('')}
        </div>
        <div class="notif-settings" style="margin-top:18px;padding-top:18px;border-top:1px solid var(--line)">
          <h4>${t('notif_settings')}</h4>
          <label class="notif-toggle"><input type="checkbox" data-ntype="order" ${(me.notifPrefs?.order ?? true) ? 'checked' : ''}> ${t('notif_order')}</label>
          <label class="notif-toggle"><input type="checkbox" data-ntype="message" ${(me.notifPrefs?.message ?? true) ? 'checked' : ''}> ${t('notif_message')}</label>
          <label class="notif-toggle"><input type="checkbox" data-ntype="proposal" ${(me.notifPrefs?.proposal ?? true) ? 'checked' : ''}> ${t('notif_proposal')}</label>
          <label class="notif-toggle"><input type="checkbox" data-ntype="review" ${(me.notifPrefs?.review ?? true) ? 'checked' : ''}> ${t('notif_review')}</label>
          <label class="notif-toggle"><input type="checkbox" data-ntype="system" ${(me.notifPrefs?.system ?? true) ? 'checked' : ''}> ${t('notif_system')}</label>
        </div>
      </div>`;
    
    case 'portfolio':
      return `<div class="card"><h3>${t('portfolio')}</h3><div class="muted">Управление портфолио</div></div>`;
    
    default:
      return '';
  }
}

function bindMe(container, params) {
  container.querySelector('#editProfile')?.addEventListener('click', () => openEditProfile());
  container.querySelectorAll('[data-tab]').forEach(b => {
    b.addEventListener('click', () => router.navigate('#me?tab=' + b.dataset.tab));
  });
  container.querySelector('#ctaLogin')?.addEventListener('click', () => showLogin());
  container.querySelector('#markAllNotifRead')?.addEventListener('click', async () => {
    if (!store.userId()) return;
    await API.markAllNotifsRead(store.userId());
    store.notifications.forEach(n => n.read = true);
    store.set('notifUnread', 0);
    renderTopActions();
    bindMe(container, params);
  });
  container.querySelectorAll('.notif-item').forEach(item => {
    item.addEventListener('click', async () => {
      const nid = item.dataset.nid;
      await API.markNotifRead(nid);
      const n = store.notification(nid);
      if (n) { n.read = true; store.set('notifUnread', store.notifications.filter(x => !x.read).length); }
      item.classList.remove('unread');
    });
  });
  container.querySelectorAll('.notif-toggle input').forEach(cb => {
    cb.addEventListener('change', async () => {
      const me = store.me(); if (!me) return;
      const type = cb.dataset.ntype; if (!type) return;
      me.notifPrefs = me.notifPrefs || {};
      me.notifPrefs[type] = cb.checked;
      await API.updateNotifPrefs(me.id, me.notifPrefs);
      toast('Настройка сохранена', 'success');
    });
  });
}

// ===== BOOKMARKS VIEW =====
function viewBookmarksHTML() {
  const me = store.me();
  if (!me) return `<div class="container">${emptyStateHTML('Войдите, чтобы увидеть избранное.', '<button class="btn-primary" id="ctaLogin">Войти</button>')}</div>`;
  
  const bks = store.bookmarks;
  const has = bks.length > 0;
  
  return `
  <div class="container">
    <div class="page-title">
      <h1>${t('bookmarks_title')}</h1>
    </div>
    ${has ? bks.map(b => {
      const target = b.targetType === 'job' ? store.task(b.targetId) :
        b.targetType === 'service' ? store.service(b.targetId) :
        b.targetType === 'freelancer' ? store.user(b.targetId) : null;
      if (!target) return '';
      return `
      <div class="list-card">
        <div class="body">
          <div class="title" ${b.targetType !== 'freelancer' ? `data-link="#${b.targetType}/${b.targetId}"` : `data-link="#profile/${b.targetId}"`}>${esc(target.title || target.name)}</div>
          <div class="meta">
            <span>${b.targetType === 'job' ? '📋 Задание' : b.targetType === 'service' ? '🛒 Услуга' : '👤 Фрилансер'}</span>
          </div>
        </div>
        <div class="right">
          <button class="btn-bookmark on" data-bookmark="${b.targetType}|${b.targetId}" title="Убрать из избранного">★</button>
        </div>
      </div>`;
    }).join('') : emptyStateHTML(t('no_bookmarks'))}
  </div>`;
}

function bindBookmarks(container) {
  container.querySelector('#ctaLogin')?.addEventListener('click', () => showLogin());
  container.querySelectorAll('[data-bookmark]').forEach(b => {
    b.onclick = async () => {
      const [targetType, targetId] = b.dataset.bookmark.split('|', 2);
      await API.toggleBookmark(store.userId(), targetType, targetId);
      const now = store.bookmarks.some(x => x.targetType === targetType && x.targetId === targetId);
      if (!now) b.closest('.list-card')?.remove();
      b.classList.toggle('on', now);
      b.title = now ? 'В избранном' : 'В избранное';
      b.textContent = now ? '★' : '☆';
    };
  });
}

// ===== INFO PAGES =====
function viewInfoPage(page) {
  const pages = {
    about: { title: 'О проекте', content: 'MiniLIT — фриланс-маркетплейс нового поколения. Мы соединяем заказчиков и исполнителей в сфере цифровых услуг: дизайн, разработка, маркетинг, контент и многое другое.' },
    terms: { title: 'Пользовательское соглашение', content: 'Используя MiniLIT, вы соглашаетесь с условиями настоящего соглашения. Все сделки проходят через безопасную систему эскроу.' },
    privacy: { title: 'Политика конфиденциальности', content: 'Мы собираем только необходимые данные для обеспечения работы сервиса. Ваши личные данные не передаются третьим лицам.' },
    faq: { title: 'Вопрос — Ответ', content: 'Часто задаваемые вопросы о работе платформы: как создать задание, как оплатить услугу, как работают коннекты и система эскроу.' },
  };
  
  const info = pages[page] || { title: 'Страница', content: 'Содержание скоро появится.' };
  return `
  <div class="container">
    <a href="#" onclick="history.back();return false" class="info-back">← Назад</a>
    <div class="card info-page">
      <h1>${esc(info.title)}</h1>
      <div class="info-body"><p>${esc(info.content)}</p></div>
    </div>
  </div>`;
}

// ===== HELPERS =====
function emptyStateHTML(msg, action) {
  return `<div class="empty-state" style="text-align:center;padding:60px 20px;background:var(--card-bg);border-radius:10px">
    <div style="font-size:48px;margin-bottom:12px">📭</div>
    <h3 style="margin:0 0 8px;color:var(--t-text,#1f2937)">${esc(msg)}</h3>
    ${action || ''}
  </div>`;
}

function orderStatusLabel(status) {
  const labels = {
    'pending_payment': t('order_status_pending'),
    'paid': t('order_status_paid'),
    'in_progress': t('order_status_in_progress'),
    'completed': t('order_status_completed'),
    'cancelled': t('order_status_cancelled'),
    'disputed': t('order_status_disputed'),
  };
  return labels[status] || status;
}

function notifIcon(type) {
  const icons = { payment: '💰', message: '💬', order: '📦', proposal: '📋', system: '🔔', review: '⭐' };
  return icons[type] || '🔔';
}

// Stubs — TODO: implement properly
window.openTaskForm = function openTaskForm() { toast('Форма создания задания — в разработке', 'error'); };
window.openServiceForm = function openServiceForm() { toast('Форма создания услуги — в разработке', 'error'); };
window.openEditProfile = function openEditProfile() { toast('Редактирование профиля — в разработке', 'error'); };

// ===== MODAL / TOAST HELPERS =====
window.toast = function toast(msg, kind) {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  const wrap = document.getElementById('toastWrap');
  if (wrap) wrap.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(20px)'; el.style.transition = '.3s'; }, 2400);
  setTimeout(() => el.remove(), 2800);
};

window.openModal = function openModal(html) {
  const root = document.getElementById('modalRoot');
  if (!root) return;
  root.innerHTML = `<div class="modal-bg open"><div class="modal-wrap"><div class="modal">${html}</div></div></div>`;
  const bg = root.firstElementChild;
  bg.addEventListener('click', e => { if (e.target === bg) closeModal(); });
  document.addEventListener('keydown', escClose);
  const modal = bg.querySelector('.modal');
  if (modal) trapFocus(modal);
  if (modal && window.matchMedia('(max-width: 900px)').matches) enableSheetDragDismiss(modal);
  setTimeout(() => (modal?.querySelector('input,textarea,select,button,[tabindex]') || modal)?.focus(), 50);
  document.body.classList.add('modal-open');
  return bg;
};

window.closeModal = function closeModal() {
  const root = document.getElementById('modalRoot');
  if (root) root.innerHTML = '';
  document.removeEventListener('keydown', escClose);
  document.body.classList.remove('modal-open');
};

function escClose(e) { if (e.key === 'Escape') closeModal(); }

function trapFocus(container) {
  const focusable = 'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
  container.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const els = [...container.querySelectorAll(focusable)].filter(el => el.offsetParent !== null);
    if (!els.length) return;
    const first = els[0], last = els[els.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
}

function enableSheetDragDismiss(el) {
  let startY = 0, dy = 0, dragging = false;
  const onStart = e => {
    const t = e.touches ? e.touches[0] : e;
    const rect = el.getBoundingClientRect();
    if (t.clientY - rect.top > 64 && el.scrollTop > 0) return;
    startY = t.clientY; dy = 0; dragging = true;
    el.style.transition = 'none';
  };
  const onMove = e => {
    if (!dragging) return;
    const t = e.touches ? e.touches[0] : e;
    dy = Math.max(0, t.clientY - startY);
    if (dy > 4 && e.cancelable) e.preventDefault();
    el.style.transform = `translateY(${dy}px)`;
  };
  const onEnd = () => {
    if (!dragging) return;
    dragging = false;
    el.style.transition = 'transform .22s ease';
    if (dy > 110) { el.style.transform = 'translateY(100%)'; setTimeout(closeModal, 180); }
    else { el.style.transform = ''; }
  };
  el.addEventListener('touchstart', onStart, { passive: true });
  el.addEventListener('touchmove', onMove, { passive: false });
  el.addEventListener('touchend', onEnd, { passive: true });
  el.addEventListener('touchcancel', onEnd, { passive: true });
}

// ===== AUTH HELPERS =====
function bindAuthCommon() {
  const root = document.getElementById('modalRoot');
  if (!root) return;
  root.querySelector('[data-close]')?.addEventListener('click', closeModal);
  root.querySelectorAll('[data-switch]').forEach(a => a.addEventListener('click', () => {
    closeModal();
    a.dataset.switch === 'register' ? showRegister() : showLogin();
  }));
}

function setErr(form, field, msg) {
  const inp = form.querySelector(`[name="${field}"]`);
  const er = form.querySelector(`[data-err="${field}"]`);
  if (inp) inp.classList.add('error');
  if (er) er.textContent = msg;
}

function clearErrors(form) {
  form.querySelectorAll('.input').forEach(i => i.classList.remove('error'));
  form.querySelectorAll('.err').forEach(e => e.textContent = '');
}

function validateForm(rules, formData) {
  const errors = {};
  for (const field of Object.keys(rules)) {
    const val = (formData[field] || '').toString().trim();
    const rule = rules[field];
    if (rule.required && !val) { errors[field] = rule.label + ' обязательно'; continue; }
    if (rule.fieldType === 'email' && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) { errors[field] = 'Некорректный email'; continue; }
    if (rule.minLen && val.length < rule.minLen) { errors[field] = 'Минимум ' + rule.minLen + ' символов'; continue; }
    if ((rule.fieldType === 'number' || rule.fieldType === 'money')) {
      const num = Number(val);
      if (val && (isNaN(num) || num < (rule.minVal || 0))) { errors[field] = 'Минимальное значение ' + (rule.minVal || 0); continue; }
      if (val && rule.maxVal && num > rule.maxVal) { errors[field] = 'Максимум ' + rule.maxVal; continue; }
    }
  }
  return Object.keys(errors).length ? errors : null;
}

// ===== AUTH MODALS =====
window.showLogin = function showLogin() {
  openModal(`
    <button class="close" data-close>&times;</button>
    <h2>Вход в MiniLIT</h2>
    <p class="sub">Используйте demo@mail.ru / 123456 для входа в демо-аккаунт.</p>
    <form id="loginForm">
      <div class="form-row">
        <label>Email</label>
        <input class="input" type="email" name="email" required placeholder="you@mail.ru" value="demo@mail.ru">
        <div class="err" data-err="email"></div>
      </div>
      <div class="form-row">
        <label>Пароль</label>
        <input class="input" type="password" name="password" required minlength="6" placeholder="••••••" value="123456">
        <div class="err" data-err="password"></div>
      </div>
      <button class="btn-primary btn-block btn-lg" type="submit">${t('login')}</button>
      <div style="text-align:center;margin-top:10px">
        <a id="forgotPwdLink" style="font-size:13px;color:var(--green);cursor:pointer">${t('forgot_password')}</a>
      </div>
    </form>
    <div class="auth-divider">${t('or')}</div>
    <button class="btn-google" id="googleLoginBtn">
      <svg viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20H42V20H24v8h11.3c-1.1 3.4-4 5.8-7.6 6.6l.1.1 6.2 4.8.4.2C39.2 36.4 44 30.8 44 24c0-1.4-.1-2.8-.4-4z"/><path fill="#FF3D00" d="M10.5 28.2 10.4 28.2l-6.2-4.8-.2-.2C3.1 25.3 3 26.7 3 28c0 5.2 2.1 10 5.6 13.4l.1-.1 6.2-4.8.1-.1C13.1 34.2 11.5 31.3 10.5 28.2z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.8 13.5-4.8l-6.2-4.8c-1.8 1.2-4.1 2-6.7 2-3.1 0-5.9-1.2-8-3.2l-.1.1-6.2 4.8-.1.1C11.9 40.4 17.6 44 24 44z"/><path fill="#1976D2" d="M24 12c3.1 0 5.9 1.2 8 3.2l.1-.1 5.5-5.5.1-.1C33.8 6.4 29.1 4 24 4 17.6 4 11.9 7.6 8.9 12.6l.1.1 6.2 4.8.1-.1C14.8 16.3 16.3 13.3 19 11.7 20.5 10.7 22.2 12 24 12z"/></svg>
      <span>${t('google_sign_in')}</span>
    </button>
    <div class="switch-link">Нет аккаунта? <a data-switch="register">${t('register')}</a></div>
  `);
  bindAuthCommon();
  document.getElementById('googleLoginBtn')?.addEventListener('click', () => { API.signInWithGoogle(); });
  document.getElementById('loginForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const email = fd.get('email').toString();
    const password = fd.get('password').toString();
    const btn = e.target.querySelector('button[type=submit]');
    clearErrors(e.target);
    if (!email) return setErr(e.target, 'email', 'Введите email');
    if (password.length < 6) return setErr(e.target, 'password', 'Минимум 6 символов');
    const oldText = btn.textContent;
    btn.disabled = true; btn.textContent = 'Входим…';
    try {
      await API.signIn(email, password);
      closeModal();
      const me = store.me();
      toast('Добро пожаловать, ' + (me?.name || '') + '!', 'success');
      renderTopActions();
      router.resolve();
    } catch (err) {
      const m = /Invalid login|invalid_grant|invalid|email/i.test(err?.message || '')
        ? 'Неверный email или пароль' : (err?.message || 'Не удалось войти');
      setErr(e.target, 'password', m);
    } finally {
      if (btn && btn.isConnected) { btn.disabled = false; btn.textContent = oldText; }
    }
  });
  document.getElementById('forgotPwdLink')?.addEventListener('click', () => { closeModal(); setTimeout(showForgotPassword, 100); });
};

window.showRegister = function showRegister() {
  openModal(`
    <button class="close" data-close>&times;</button>
    <h2>Регистрация</h2>
    <p class="sub">Создайте аккаунт за 30 секунд. Никакого SMS и почты.</p>
    <form id="regForm">
      <div class="form-row">
        <label>Имя</label>
        <input class="input" name="name" required minlength="2" placeholder="Например, Алексей Иванов">
        <div class="err" data-err="name"></div>
      </div>
      <div class="form-row">
        <label>Email</label>
        <input class="input" type="email" name="email" required placeholder="you@mail.ru">
        <div class="err" data-err="email"></div>
      </div>
      <div class="form-row">
        <label>Пароль</label>
        <input class="input" type="password" name="password" required minlength="6" placeholder="не менее 6 символов">
        <div class="err" data-err="password"></div>
      </div>
      <div class="form-row">
        <label>Я хочу...</label>
        <div class="chips" data-role-picker>
          <span class="chip active" data-role="freelancer">Выполнять заказы (Фрилансер)</span>
          <span class="chip" data-role="client">Размещать заказы (Заказчик)</span>
        </div>
        <input type="hidden" name="role" value="freelancer">
      </div>
      <button class="btn-primary btn-block btn-lg" type="submit">${t('register')}</button>
    </form>
    <div class="auth-divider">${t('or')}</div>
    <button class="btn-google" id="googleRegisterBtn">
      <svg viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20H42V20H24v8h11.3c-1.1 3.4-4 5.8-7.6 6.6l.1.1 6.2 4.8.4.2C39.2 36.4 44 30.8 44 24c0-1.4-.1-2.8-.4-4z"/><path fill="#FF3D00" d="M10.5 28.2 10.4 28.2l-6.2-4.8-.2-.2C3.1 25.3 3 26.7 3 28c0 5.2 2.1 10 5.6 13.4l.1-.1 6.2-4.8.1-.1C13.1 34.2 11.5 31.3 10.5 28.2z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.8 13.5-4.8l-6.2-4.8c-1.8 1.2-4.1 2-6.7 2-3.1 0-5.9-1.2-8-3.2l-.1.1-6.2 4.8-.1.1C11.9 40.4 17.6 44 24 44z"/><path fill="#1976D2" d="M24 12c3.1 0 5.9 1.2 8 3.2l.1-.1 5.5-5.5.1-.1C33.8 6.4 29.1 4 24 4 17.6 4 11.9 7.6 8.9 12.6l.1.1 6.2 4.8.1-.1C14.8 16.3 16.3 13.3 19 11.7 20.5 10.7 22.2 12 24 12z"/></svg>
      <span>${t('google_sign_in')}</span>
    </button>
    <div class="switch-link">Уже есть аккаунт? <a data-switch="login">${t('login')}</a></div>
  `);
  bindAuthCommon();
  const picker = document.querySelector('[data-role-picker]');
  if (picker) {
    picker.addEventListener('click', e => {
      const c = e.target.closest('.chip'); if (!c) return;
      picker.querySelectorAll('.chip').forEach(x => x.classList.remove('active'));
      c.classList.add('active');
      document.querySelector('input[name=role]').value = c.dataset.role;
    });
  }
  document.getElementById('googleRegisterBtn')?.addEventListener('click', () => { API.signInWithGoogle(); });
  document.getElementById('regForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      name: fd.get('name').toString().trim(),
      email: fd.get('email').toString().trim(),
      password: fd.get('password').toString(),
      role: fd.get('role').toString(),
    };
    const btn = e.target.querySelector('button[type=submit]');
    clearErrors(e.target);
    const errs = validateForm({
      name: { required: true, label: 'Имя', minLen: 2 },
      email: { required: true, label: 'Email', fieldType: 'email' },
      password: { required: true, label: 'Пароль', minLen: 6 },
    }, data);
    if (errs) { Object.entries(errs).forEach(([f, m]) => setErr(e.target, f, m)); return; }
    const oldText = btn.textContent;
    btn.disabled = true; btn.textContent = 'Регистрируем…';
    try {
      await API.signUp(data.email, data.password, data.name);
      closeModal();
      toast('Аккаунт создан! Добро пожаловать на MiniLIT.', 'success');
      renderTopActions();
      router.resolve();
    } catch (err) {
      const m = err?.message || '';
      let msg = m;
      if (/already registered|exists|duplicate/i.test(m)) msg = 'Пользователь с таким email уже зарегистрирован';
      else if (/password/i.test(m) && /short|6|weak/i.test(m)) msg = 'Пароль слишком короткий (минимум 6 символов)';
      else if (/email/i.test(m) && /invalid|valid/i.test(m)) msg = 'Некорректный email';
      else if (/rate.?limit|too many/i.test(m)) msg = 'Слишком много попыток. Подождите минуту.';
      setErr(e.target, 'password', msg);
    } finally {
      if (btn && btn.isConnected) { btn.disabled = false; btn.textContent = oldText; }
    }
  });
};

function showForgotPassword() {
  openModal(`
    <button class="close" data-close>&times;</button>
    <h2>Восстановление пароля</h2>
    <p class="sub">Мы отправим ссылку для сброса пароля на ваш email.</p>
    <form id="resetPwdForm">
      <div class="form-row">
        <label>Email</label>
        <input class="input" type="email" name="email" required placeholder="you@mail.ru">
        <div class="err" data-err="email"></div>
      </div>
      <button class="btn-primary btn-block btn-lg" type="submit">Отправить</button>
    </form>
    <div class="switch-link"><a data-switch="login">Вернуться ко входу</a></div>
  `);
  bindAuthCommon();
  document.getElementById('resetPwdForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const email = new FormData(e.target).get('email').toString();
    const btn = e.target.querySelector('button[type=submit]');
    clearErrors(e.target);
    if (!email) return setErr(e.target, 'email', 'Введите email');
    const oldText = btn.textContent;
    btn.disabled = true; btn.textContent = 'Отправляем…';
    try {
      await API.resetPassword(email);
      closeModal();
      toast('Ссылка для сброса отправлена на почту', 'success');
    } catch (err) {
      setErr(e.target, 'email', (err?.message) || 'Ошибка отправки');
    } finally {
      if (btn && btn.isConnected) { btn.disabled = false; btn.textContent = oldText; }
    }
  });
}

// === TOP ACTIONS ===
window.renderTopActions = function renderTopActions() {
  const root = document.getElementById('topActions');
  if (!root) return;
  const me = store.me();
  if (!me) {
    root.innerHTML = `
      <button class="btn-ghost" id="openLogin">${t('login')}</button>
      <button class="btn-primary btn-sm" id="openRegister">${t('register')}</button>`;
    root.querySelector('#openLogin')?.addEventListener('click', () => showLogin());
    root.querySelector('#openRegister')?.addEventListener('click', () => showRegister());
    return;
  }
  
  const unread = store.unread || 0;
  const notifUnread = store.notifUnread || 0;
  
  root.innerHTML = `
    <a class="nav-chat" href="#messages" data-link aria-label="Сообщения">
      <span>Чат</span>
      <span class="chat-pill" data-zero="${unread === 0}">${unread}</span>
    </a>
    <div class="notif-wrap">
      <button class="notif-toggle" id="notifToggle" aria-label="Уведомления">🔔
        <span class="notif-badge" data-zero="${notifUnread === 0}">${notifUnread}</span>
      </button>
      <div class="notif-dropdown" id="notifDropdown"></div>
    </div>
    ${me.role === 'freelancer' ? `<div class="connects-widget" title="Коннекты"><span class="connects-icon">⚡</span><span class="connects-count">${me.connectsRemaining ?? 50}</span></div>` : ''}
    <div class="balance-menu">
      <button class="balance-widget" id="balanceTrigger" type="button">
        <span class="coin">₽</span>
        <span class="amount">${window.fmtMoney(me.balance)}</span>
      </button>
    </div>
    <div class="user-menu">
      <button class="user-trigger" id="userTrigger">
        <div class="avatar-sm" style="background-image:${me.avatar ? `url('${esc(me.avatar)}')` : 'none'};background-color:${window.colorFor(me.id)};background-size:cover;background-position:center">
          ${me.avatar ? '' : window.initials(me.name)}
        </div>
        <span>${esc(me.name.split(' ')[0] || 'я')}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="#6B7280"><path d="M7 10l5 5 5-5z"/></svg>
      </button>
      <div class="dropdown" id="userDropdown">
        <a href="#me" data-link>${t('profile_title')}</a>
        <a href="#bookmarks" data-link>${t('bookmarks_title')}</a>
        ${me.isAdmin ? '<a href="#admin" data-link>Админ-панель</a>' : ''}
        <div class="divider"></div>
        <button id="logoutBtn">${t('logout')}</button>
      </div>
    </div>`;
  
  bindTopActions();
};

function bindTopActions() {
  const root = document.getElementById('topActions');
  if (!root) return;
  
  const userTrigger = root.querySelector('#userTrigger');
  const userDropdown = root.querySelector('#userDropdown');
  if (userTrigger && userDropdown) {
    userTrigger.addEventListener('click', e => {
      e.stopPropagation();
      userDropdown.classList.toggle('open');
    });
    document.addEventListener('click', e => {
      if (!userTrigger.contains(e.target) && !userDropdown.contains(e.target)) {
        userDropdown?.classList.remove('open');
      }
    }, { once: false });
  }
  
  const balanceTrigger = root.querySelector('#balanceTrigger');
  if (balanceTrigger) {
    balanceTrigger.addEventListener('click', () => {
      toast('Баланс: ' + window.fmtMoney(store.me()?.balance || 0), 'success');
    });
  }
  
  root.querySelector('#logoutBtn')?.addEventListener('click', async () => {
    await API.signOut();
    store.set('session', null);
    store.set('users', []);
    store.set('tasks', []);
    store.set('services', []);
    store.set('orders', []);
    store.set('chats', []);
    store.set('messages', []);
    renderTopActions();
    router.navigate('#home');
    toast('Вы вышли из аккаунта', 'success');
  });
  
  const notifToggle = root.querySelector('#notifToggle');
  const notifDropdown = root.querySelector('#notifDropdown');
  if (notifToggle && notifDropdown) {
    notifToggle.addEventListener('click', e => {
      e.stopPropagation();
      const isOpen = notifDropdown.classList.toggle('open');
      if (isOpen) renderNotifDropdown(notifDropdown);
    });
    document.addEventListener('click', e => {
      if (!notifToggle.contains(e.target) && !notifDropdown.contains(e.target)) {
        notifDropdown?.classList.remove('open');
      }
    });
  }
  
  root.querySelectorAll('[data-zero]').forEach(el => {
    if (el.dataset.zero === 'true') {
      el.style.display = 'none';
    } else {
      el.style.display = '';
    }
  });
}

function renderNotifDropdown(dropdown) {
  const notifs = store.notifications.slice(0, 20);
  if (notifs.length === 0) {
    dropdown.innerHTML = '<div class="notif-empty">Нет уведомлений</div>';
    return;
  }
  dropdown.innerHTML = `
    <div class="nd-head">
      <span>Уведомления</span>
      <button id="ddMarkRead">Все прочитано</button>
    </div>
    ${notifs.map(n => `
      <div class="notif-item ${!n.read ? 'unread' : ''}" data-nid="${n.id}">
        <div class="ni-icon ni-${n.type}">${notifIcon(n.type)}</div>
        <div class="ni-body">
          <div class="ni-title">${esc(n.title)}</div>
          <div class="ni-text">${esc(n.body)}</div>
          <div class="ni-time">${window.fmtDate(n.createdAt)}</div>
        </div>
      </div>`).join('')}`;
  
  dropdown.querySelector('#ddMarkRead')?.addEventListener('click', async () => {
    if (!store.userId()) return;
    await API.markAllNotifsRead(store.userId());
    store.notifications.forEach(n => n.read = true);
    store.set('notifUnread', 0);
    renderNotifDropdown(dropdown);
    renderTopActions();
  });
  
  dropdown.querySelectorAll('.notif-item').forEach(item => {
    item.addEventListener('click', async () => {
      const nid = item.dataset.nid;
      await API.markNotifRead(nid);
      const n = store.notification(nid);
      if (n) { n.read = true; store.set('notifUnread', store.notifications.filter(x => !x.read).length); }
      renderTopActions();
    });
  });
}

store.on('session', () => {
  renderTopActions();
});

store.on('unread', () => {
  renderTopActions();
});

store.on('notifUnread', () => {
  renderTopActions();
});

export { router, views, loadInitialData };
