import { store } from '../store.js';
import { API } from '../api.js';
import { t } from '../i18n.js';

export function viewProfile(params) {
  return `
<div class="profile-page" data-view="profile" data-profile-id="${esc(params.id || '')}">
  <div class="container">
    <div class="profile-nav mb-2">
      <a data-link href="#" class="back-link muted" onclick="window.history.back();return false">&larr; ${t('back')}</a>
    </div>

    <div id="profile-skeleton">
      <div class="card"><div class="d-flex gap-3" style="display:flex;gap:16px"><div class="skel skel-circle" style="width:80px;height:80px;border-radius:50%"></div><div style="flex:1"><div class="skel skel-block w-60" style="width:60%;height:20px;margin-bottom:10px"></div><div class="skel skel-block w-40" style="width:40%;height:14px;margin-bottom:10px"></div><div class="skel skel-block w-80" style="width:80%;height:14px"></div></div></div></div>
      <div class="card" style="margin-top:12px"><div class="skel skel-block" style="height:14px;margin-bottom:8px"></div><div class="skel skel-block" style="height:14px;margin-bottom:8px"></div><div class="skel skel-block w-60" style="width:60%;height:14px"></div></div>
      <div class="card" style="margin-top:12px"><div class="skel skel-block" style="height:16px;width:40%;margin-bottom:12px"></div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px"><div class="skel skel-block" style="height:160px"></div><div class="skel skel-block" style="height:160px"></div><div class="skel skel-block" style="height:160px"></div></div></div>
    </div>

    <div id="profile-empty" style="display:none">
      <div class="card"><h2>${t('error')}</h2><p>${t('empty')}</p></div>
    </div>

    <div id="profile-login-prompt" style="display:none">
      <div class="card"><h2>${t('err_unauthorized')}</h2><p style="margin:10px 0 16px">${t('login')}</p><a data-link href="#login" class="btn btn-primary">${t('login')}</a></div>
    </div>

    <div id="profile-content" style="display:none">
      <div class="card" style="padding:0;overflow:hidden">
        <div class="profile-cover" id="profile-cover">
          <button class="cover-edit" id="btn-edit-cover" style="display:none">📷 ${t('upload_photo')}</button>
        </div>
        <div class="profile-header">
          <div class="avatar-xl" id="p-avatar-wrap"></div>
          <div class="info">
            <h1 id="p-name"></h1>
            <p class="role-line" id="p-spec"></p>
            <div style="display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap">
              <span id="p-status-dot" class="status-indicator-dot" style="display:none"></span>
              <span id="p-status-label" class="status-text-label" style="display:none"></span>
            </div>
            <div id="p-stats" style="display:flex;align-items:center;gap:16px;margin-top:10px;font-size:13px;flex-wrap:wrap"></div>
          </div>
        </div>
        <div class="profile-actions" id="p-actions"></div>
      </div>

      <div class="card" id="p-bio-card">
        <h2>${t('profile_bio')}</h2>
        <p id="p-bio" class="muted"></p>
      </div>

      <div class="card" id="p-onboarding-card" style="display:none;text-align:center;padding:28px">
        <div style="font-size:40px;margin-bottom:10px">🚀</div>
        <h2>${t('profile_title')}</h2>
        <p class="muted" style="margin-bottom:16px">${t('profile_bio')}</p>
        <button id="btn-setup-profile" class="btn btn-primary">${t('profile_edit')}</button>
      </div>

      <div class="card" id="p-portfolio-card">
        <h2>${t('portfolio')}</h2>
        <div class="portfolio-grid" id="p-portfolio-grid"></div>
        <div class="portfolio-empty" id="p-portfolio-empty">${t('empty')}</div>
      </div>

      <div class="card" id="p-reviews-card">
        <h2>${t('reviews')}</h2>
        <div id="p-reviews-list"></div>
        <div class="muted" id="p-reviews-empty" style="text-align:center;padding:24px">${t('empty')}</div>
      </div>
    </div>
  </div>
</div>`;
}

export async function bindProfile(container, params) {
  const skel = container.querySelector('#profile-skeleton');
  const empty = container.querySelector('#profile-empty');
  const loginPrompt = container.querySelector('#profile-login-prompt');
  const content = container.querySelector('#profile-content');

  if (!store.isLoggedIn()) {
    skel.style.display = 'none';
    loginPrompt.style.display = 'block';
    return;
  }

  const profileId = params.id || store.userId();

  try {
    skel.style.display = 'block';

    const { data: rawProfile, error } = await API.sb.from('profiles').select('*').eq('id', profileId).single();
    if (error || !rawProfile) {
      skel.style.display = 'none';
      empty.style.display = 'block';
      return;
    }

    store.upsert('users', rawProfile);

    const user = store.user(profileId);
    const me = store.me();
    const isOwn = profileId === store.userId();
    const isOnline = user.lastSeen > Date.now() - 120000;

    renderProfile(content, user, isOwn, isOnline);
    loadPortfolio(content, profileId);
    loadReviews(content, profileId);

    skel.style.display = 'none';
    content.style.display = 'block';

    bindProfileEvents(container, user, isOwn, params);
  } catch (e) {
    skel.style.display = 'none';
    empty.style.display = 'block';
    console.error(e);
  }
}

function renderProfile(content, user, isOwn, isOnline) {
  const avatarWrap = content.querySelector('#p-avatar-wrap');
  avatarWrap.innerHTML = aviHTML(user.name, user.avatar, 120);
  if (isOnline) avatarWrap.closest('.avatar-xl')?.classList.add('online');

  content.querySelector('#p-name').textContent = user.name;
  content.querySelector('#p-spec').textContent = user.specialization || t('profile_specialization');
  if (user.role) {
    content.querySelector('#p-spec').textContent += ` \u2022 ${t(user.role)}`;
  }

  const dot = content.querySelector('#p-status-dot');
  const label = content.querySelector('#p-status-label');
  const status = user.activity_status || 'free';
  dot.className = 'status-indicator-dot status-' + status;
  dot.style.display = 'inline-block';
  const statusKeys = { free: 'status_free', busy: 'status_busy', gaming: 'status_gaming' };
  label.textContent = t(statusKeys[status] || 'status_free');
  label.style.display = 'inline';

  const stats = content.querySelector('#p-stats');
  stats.innerHTML = '';
  if (user.rating > 0) {
    const r = document.createElement('span');
    r.className = 'rating';
    r.innerHTML = `<span class="stars">${'★'.repeat(Math.round(user.rating))}${'☆'.repeat(5 - Math.round(user.rating))}</span><span class="n">${user.rating.toFixed(1)}</span>`;
    stats.appendChild(r);
  }
  const rc = document.createElement('span');
  rc.className = 'muted';
  rc.textContent = `${user.reviews_count || 0} ${reviewsWord(user.reviews_count)}`;
  stats.appendChild(rc);
  const od = document.createElement('span');
  od.className = 'muted';
  od.textContent = `${user.orders_done || 0} ${ordersWord(user.orders_done)}`;
  stats.appendChild(od);

  const bio = content.querySelector('#p-bio');
  bio.textContent = user.bio || t('profile_bio');
  bio.style.fontStyle = user.bio ? 'normal' : 'italic';

  const onboarding = content.querySelector('#p-onboarding-card');
  if (isOwn && user.role === 'client' && !user.bio) {
    onboarding.style.display = 'block';
  }

  const cover = content.querySelector('#profile-cover');
  if (user.cover_url) {
    cover.style.background = `url(${esc(user.cover_url)}) center/cover`;
  }
  if (isOwn) {
    const coverBtn = content.querySelector('#btn-edit-cover');
    coverBtn.style.display = 'flex';
  }

  const actions = content.querySelector('#p-actions');
  actions.innerHTML = '';
  if (isOwn) {
    actions.innerHTML = `
      <button class="btn btn-outline btn-sm" id="btn-edit-profile">${t('profile_edit')}</button>
      <div class="status-selector-wrapper" style="display:inline-flex;align-items:center;gap:6px">
        <span class="muted small">${t('status')}:</span>
        <select id="user-status-select">
          <option value="free" ${status === 'free' ? 'selected' : ''}>${t('status_free')}</option>
          <option value="busy" ${status === 'busy' ? 'selected' : ''}>${t('status_busy')}</option>
          <option value="gaming" ${status === 'gaming' ? 'selected' : ''}>${t('status_gaming')}</option>
        </select>
      </div>
      <span class="spacer" style="flex:1"></span>
      <span class="muted small">${t('connects')}: <b style="color:var(--green)">${user.connectsRemaining}</b></span>
      <span class="muted small">${t('balance')}: <b style="color:var(--green)">${fmtMoney(user.balance)}</b></span>
      <button class="btn btn-sm btn-primary" id="btn-deposit">${t('balance')} +</button>
      <button class="btn btn-sm btn-outline" id="btn-withdraw">${t('balance')} -</button>
    `;
  } else {
    actions.innerHTML = `
      <button class="btn btn-primary btn-sm" id="btn-start-chat">${t('start_chat')}</button>
      ${user.role === 'freelancer' ? `<button class="btn btn-outline btn-sm" id="btn-book-service">${t('service_order')}</button>` : ''}
    `;
  }
}

async function loadPortfolio(content, userId) {
  const grid = content.querySelector('#p-portfolio-grid');
  const empty = content.querySelector('#p-portfolio-empty');
  try {
    const { data } = await API.sb.from('portfolio').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    const items = (data || []).map(p => ({ id: p.id, title: p.title || '', description: p.description || '', imageUrl: p.image_url || '', projectUrl: p.project_url || '' }));
    if (items.length === 0) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    grid.innerHTML = '';
    items.forEach(item => {
      const el = document.createElement('div');
      el.className = 'portfolio-item';
      el.innerHTML = `
        ${item.imageUrl ? `<img src="${esc(item.imageUrl)}" alt="${esc(item.title)}" loading="lazy">` : '<div style="height:140px;background:var(--green-l);display:flex;align-items:center;justify-content:center;font-size:32px">📁</div>'}
        <div class="p-info">
          <h4 class="p-title">${esc(item.title)}</h4>
          ${item.description ? `<p class="p-desc">${esc(item.description)}</p>` : ''}
          ${item.projectUrl ? `<a href="${esc(item.projectUrl)}" target="_blank" rel="noopener" class="small" style="color:var(--green)">${item.projectUrl}</a>` : ''}
        </div>
      `;
      grid.appendChild(el);
    });
  } catch (e) {
    empty.style.display = 'block';
  }
}

async function loadReviews(content, userId) {
  const list = content.querySelector('#p-reviews-list');
  const empty = content.querySelector('#p-reviews-empty');
  try {
    const { data } = await API.sb.from('reviews').select('*').eq('freelancer_id', userId).order('created_at', { ascending: false });
    const items = (data || []).map(r => ({ id: r.id, reviewerId: r.reviewer_id, rating: r.stars || 0, text: r.text || '', createdAt: r.created_at ? Date.parse(r.created_at) : 0 }));
    if (items.length === 0) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    list.innerHTML = '';
    for (const item of items) {
      let reviewer = store.user(item.reviewerId);
      if (!reviewer) {
        try {
          const { data: rp } = await API.sb.from('profiles').select('id,name,avatar_url').eq('id', item.reviewerId).single();
          if (rp) { reviewer = rp; store.upsert('users', rp); }
        } catch (_) {}
      }
      const el = document.createElement('div');
      el.className = 'review';
      el.innerHTML = `
        <div class="top">
          ${reviewer ? aviHTML(reviewer.name, reviewer.avatar_url, 32) : '<div class="avi" style="width:32px;height:32px;font-size:12px">?</div>'}
          <span class="name">${reviewer ? esc(reviewer.name) : '---'}</span>
          <span class="stars">${'★'.repeat(item.rating)}${'☆'.repeat(5 - item.rating)}</span>
          <span class="muted small" style="margin-left:auto">${fmtDate(item.createdAt)}</span>
        </div>
        ${item.text ? `<p class="text">${esc(item.text)}</p>` : ''}
      `;
      list.appendChild(el);
    }
  } catch (e) {
    empty.style.display = 'block';
  }
}

function bindProfileEvents(container, user, isOwn, params) {
  if (isOwn) {
    const statusSelect = container.querySelector('#user-status-select');
    if (statusSelect) {
      statusSelect.addEventListener('change', async () => {
        const val = statusSelect.value;
        try {
          await API.updateActivityStatus(store.userId(), val);
          const dot = container.querySelector('#p-status-dot');
          const label = container.querySelector('#p-status-label');
          dot.className = 'status-indicator-dot status-' + val;
          const keys = { free: 'status_free', busy: 'status_busy', gaming: 'status_gaming' };
          label.textContent = t(keys[val] || 'status_free');
          user.activity_status = val;
          const me = store.me();
          if (me) { me.activity_status = val; }
          toast(t('success'));
        } catch (e) {
          toast(e.message);
          statusSelect.value = user.activity_status || 'free';
        }
      });
    }

    const editBtn = container.querySelector('#btn-edit-profile');
    if (editBtn) {
      editBtn.addEventListener('click', () => openEditProfileModal(container, user));
    }

    const setupBtn = container.querySelector('#btn-setup-profile');
    if (setupBtn) {
      setupBtn.addEventListener('click', () => openEditProfileModal(container, user));
    }

    const depositBtn = container.querySelector('#btn-deposit');
    if (depositBtn) {
      depositBtn.addEventListener('click', () => openDepositModal(container));
    }

    const withdrawBtn = container.querySelector('#btn-withdraw');
    if (withdrawBtn) {
      withdrawBtn.addEventListener('click', () => openWithdrawModal(container));
    }

    const coverBtn = container.querySelector('#btn-edit-cover');
    if (coverBtn) {
      coverBtn.addEventListener('click', () => {
        const inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = 'image/*';
        inp.onchange = async () => {
          const file = inp.files[0];
          if (!file) return;
          try {
            const url = await API.uploadAvatar(file);
            await API.updateProfile(store.userId(), { cover_url: url });
            container.querySelector('#profile-cover').style.background = `url(${url}) center/cover`;
            toast(t('success'));
          } catch (e) { toast(e.message); }
        };
        inp.click();
      });
    }
  } else {
    const chatBtn = container.querySelector('#btn-start-chat');
    if (chatBtn) {
      chatBtn.addEventListener('click', async () => {
        const me = store.me();
        if (!me) { toast(t('err_unauthorized')); return; }
        const myId = store.userId();
        const clientId = me.role === 'client' ? myId : user.id;
        const freelancerId = me.role === 'freelancer' ? myId : user.id;
        try {
          const existing = store.get('chats').find(c =>
            c.participants.includes(clientId) && c.participants.includes(freelancerId)
          );
          if (existing) {
            window.location.hash = `#messages?chat=${existing.id}`;
            return;
          }
          const chat = await API.createChat(clientId, freelancerId, null, null);
          store.upsert('chats', chat);
          window.location.hash = `#messages?chat=${chat.id}`;
        } catch (e) { toast(e.message); }
      });
    }
  }
}

function openEditProfileModal(container, user) {
  const html = `
    <div class="modal-wrap">
      <h2>${t('profile_edit')}</h2>
      <div class="sub">${t('profile_title')}</div>
      <form id="edit-profile-form">
        <div class="form-row">
          <label>${t('name')}</label>
          <input class="input" name="name" value="${esc(user.name)}" required>
          <div class="err" id="err-name"></div>
        </div>
        <div class="form-row">
          <label>${t('profile_specialization')}</label>
          <input class="input" name="specialization" value="${esc(user.specialization || '')}">
          <div class="err" id="err-specialization"></div>
        </div>
        <div class="form-row">
          <label>${t('profile_bio')}</label>
          <textarea class="textarea" name="bio" rows="4">${esc(user.bio || '')}</textarea>
          <div class="err" id="err-bio"></div>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
          <button type="button" class="btn btn-ghost" id="modal-cancel">${t('cancel')}</button>
          <button type="submit" class="btn btn-primary">${t('save')}</button>
        </div>
      </form>
    </div>
  `;
  openModal(html);
  const form = document.querySelector('#edit-profile-form');
  const cancelBtn = document.querySelector('#modal-cancel');
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      clearErrors(form);
      const fd = new FormData(form);
      const data = { name: fd.get('name'), specialization: fd.get('specialization'), bio: fd.get('bio') };
      if (!data.name) { setErr(form, 'name', t('err_required')); return; }
      const btn = form.querySelector('[type="submit"]');
      btn.disabled = true;
      btn.textContent = t('loading');
      try {
        const updated = await API.updateProfile(store.userId(), data);
        store.upsert('users', updated);
        closeModal();
        container.querySelector('#p-name').textContent = updated.name;
        container.querySelector('#p-spec').textContent = updated.specialization || t('profile_specialization');
        container.querySelector('#p-bio').textContent = updated.bio || t('profile_bio');
        container.querySelector('#p-bio').style.fontStyle = updated.bio ? 'normal' : 'italic';
        const onboarding = container.querySelector('#p-onboarding-card');
        if (updated.bio) onboarding.style.display = 'none';
        const avatarWrap = container.querySelector('#p-avatar-wrap');
        avatarWrap.innerHTML = aviHTML(updated.name, updated.avatar, 120);
        toast(t('success'));
      } catch (e) { toast(e.message); }
      btn.disabled = false;
      btn.textContent = t('save');
    });
  }
}

function openDepositModal(container) {
  const me = store.me();
  if (!me) { toast(t('err_unauthorized')); return; }
  const html = `
    <div class="modal-wrap">
      <h2>${t('balance')}</h2>
      <div class="sub">${t('balance')}</div>
      <form id="deposit-form">
        <div class="form-row">
          <label>${t('balance')}</label>
          <input class="input" name="amount" type="number" min="1" step="0.01" value="10" required>
          <div class="err" id="err-amount"></div>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
          <button type="button" class="btn btn-ghost" id="modal-cancel">${t('cancel')}</button>
          <button type="submit" class="btn btn-primary">${t('confirm')}</button>
        </div>
      </form>
    </div>
  `;
  openModal(html);
  const form = document.querySelector('#deposit-form');
  const cancelBtn = document.querySelector('#modal-cancel');
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(form);
      const amount = parseFloat(fd.get('amount'));
      if (!amount || amount <= 0) { setErr(form, 'amount', t('err_min_value')); return; }
      const btn = form.querySelector('[type="submit"]');
      btn.disabled = true;
      btn.textContent = t('loading');
      try {
        const newBalance = (me.balance || 0) + amount;
        await API.updateProfile(store.userId(), { balance: newBalance });
        me.balance = newBalance;
        closeModal();
        const bc = container.querySelector('#p-actions .muted small b');
        if (bc) bc.textContent = fmtMoney(newBalance);
        toast(t('success'));
      } catch (e) { toast(e.message); }
      btn.disabled = false;
      btn.textContent = t('confirm');
    });
  }
}

function openWithdrawModal(container) {
  const me = store.me();
  if (!me || !me.balance || me.balance <= 0) { toast(t('empty')); return; }
  const html = `
    <div class="modal-wrap">
      <h2>${t('balance')}</h2>
      <div class="sub">${t('balance')}</div>
      <form id="withdraw-form">
        <div class="form-row">
          <label>${t('balance')}</label>
          <input class="input" name="amount" type="number" min="1" step="0.01" max="${me.balance}" value="${Math.min(10, me.balance)}" required>
          <div class="err" id="err-amount"></div>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
          <button type="button" class="btn btn-ghost" id="modal-cancel">${t('cancel')}</button>
          <button type="submit" class="btn btn-primary">${t('confirm')}</button>
        </div>
      </form>
    </div>
  `;
  openModal(html);
  const form = document.querySelector('#withdraw-form');
  const cancelBtn = document.querySelector('#modal-cancel');
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(form);
      const amount = parseFloat(fd.get('amount'));
      if (!amount || amount <= 0) { setErr(form, 'amount', t('err_min_value')); return; }
      if (amount > (me.balance || 0)) { setErr(form, 'amount', t('err_min_value')); return; }
      const btn = form.querySelector('[type="submit"]');
      btn.disabled = true;
      btn.textContent = t('loading');
      try {
        const newBalance = (me.balance || 0) - amount;
        await API.updateProfile(store.userId(), { balance: newBalance });
        me.balance = newBalance;
        closeModal();
        const bc = container.querySelector('#p-actions .muted small b');
        if (bc) bc.textContent = fmtMoney(newBalance);
        toast(t('success'));
      } catch (e) { toast(e.message); }
      btn.disabled = false;
      btn.textContent = t('confirm');
    });
  }
}
