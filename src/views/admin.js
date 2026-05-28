import { store } from '../store.js';
import { API } from '../api.js';
import { t } from '../i18n.js';

export function viewAdmin() {
  return `
<div class="admin-page" data-view="admin">
  <div class="container">
    <div class="page-title">
      <h1>${t('admin_title')}</h1>
    </div>

    <div id="admin-error" style="display:none">
      <div class="card"><h2>${t('error')}</h2><p>${t('admin_only')}</p></div>
    </div>

    <div id="admin-content" style="display:none">
      <div class="tabs" id="admin-tabs">
        <button class="tab active" data-tab="disputes">${t('admin_disputes')}</button>
        <button class="tab" data-tab="complaints">${t('admin_complaints')}</button>
        <button class="tab" data-tab="users">${t('admin_users')}</button>
        <button class="tab" data-tab="transactions">${t('transactions')}</button>
      </div>

      <div id="admin-disputes" class="admin-tab-content" data-tab-content="disputes">
        <div id="disputes-skeleton">
          <div class="card"><div class="skel skel-block" style="height:60px;margin-bottom:8px"></div><div class="skel skel-block" style="height:60px;margin-bottom:8px"></div></div>
        </div>
        <div id="disputes-list"></div>
        <div id="disputes-empty" class="card" style="text-align:center;color:var(--gray);display:none">${t('empty')}</div>
      </div>

      <div id="admin-complaints" class="admin-tab-content" data-tab-content="complaints" style="display:none">
        <div id="complaints-skeleton">
          <div class="card"><div class="skel skel-block" style="height:60px;margin-bottom:8px"></div><div class="skel skel-block" style="height:60px;margin-bottom:8px"></div></div>
        </div>
        <div id="complaints-list"></div>
        <div id="complaints-empty" class="card" style="text-align:center;color:var(--gray);display:none">${t('empty')}</div>
      </div>

      <div id="admin-users" class="admin-tab-content" data-tab-content="users" style="display:none">
        <div class="card" style="margin-bottom:16px">
          <div style="display:flex;gap:10px;align-items:center">
            <input class="input" id="users-search-input" placeholder="${t('search')}..." style="flex:1">
            <button class="btn btn-primary btn-sm" id="users-search-btn">${t('search')}</button>
          </div>
        </div>
        <div id="users-skeleton">
          <div class="card"><div class="skel skel-block" style="height:50px;margin-bottom:8px"></div><div class="skel skel-block" style="height:50px;margin-bottom:8px"></div></div>
        </div>
        <div id="users-list"></div>
        <div id="users-empty" class="card" style="text-align:center;color:var(--gray);display:none">${t('empty')}</div>
        <div id="users-pagination" style="display:flex;gap:6px;justify-content:center;margin-top:16px;flex-wrap:wrap"></div>
      </div>

      <div id="admin-transactions" class="admin-tab-content" data-tab-content="transactions" style="display:none">
        <div class="card" style="margin-bottom:16px">
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <span class="muted small">${t('filter')}:</span>
            <select id="tx-filter" class="select" style="width:auto;min-width:140px">
              <option value="all">${t('all')}</option>
              <option value="payment">${t('balance')}</option>
              <option value="withdraw">${t('balance')}</option>
              <option value="escrow">Escrow</option>
            </select>
          </div>
        </div>
        <div id="transactions-skeleton">
          <div class="card"><div class="skel skel-block" style="height:40px;margin-bottom:6px"></div><div class="skel skel-block" style="height:40px;margin-bottom:6px"></div></div>
        </div>
        <div id="transactions-list"></div>
        <div id="transactions-empty" class="card" style="text-align:center;color:var(--gray);display:none">${t('empty')}</div>
      </div>
    </div>
  </div>
</div>`;
}

export async function bindAdmin(container) {
  if (!store.isAdmin()) {
    container.querySelector('#admin-error').style.display = 'block';
    container.querySelector('#admin-content').style.display = 'none';
    return;
  }
  container.querySelector('#admin-content').style.display = 'block';

  bindTabSwitching(container);
  loadDisputes(container);
  loadComplaints(container);
  loadUsers(container, '');
  loadTransactions(container, 'all');

  const searchBtn = container.querySelector('#users-search-btn');
  const searchInput = container.querySelector('#users-search-input');
  if (searchBtn && searchInput) {
    searchBtn.addEventListener('click', () => {
      loadUsers(container, searchInput.value.trim());
    });
    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        loadUsers(container, searchInput.value.trim());
      }
    });
  }

  const txFilter = container.querySelector('#tx-filter');
  if (txFilter) {
    txFilter.addEventListener('change', () => {
      loadTransactions(container, txFilter.value);
    });
  }
}

function bindTabSwitching(container) {
  const tabs = container.querySelectorAll('#admin-tabs .tab');
  const contents = {
    disputes: container.querySelector('#admin-disputes'),
    complaints: container.querySelector('#admin-complaints'),
    users: container.querySelector('#admin-users'),
    transactions: container.querySelector('#admin-transactions'),
  };

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      Object.entries(contents).forEach(([key, el]) => {
        el.style.display = key === tab.dataset.tab ? 'block' : 'none';
      });
    });
  });
}

async function loadDisputes(container) {
  const list = container.querySelector('#disputes-list');
  const skel = container.querySelector('#disputes-skeleton');
  const empty = container.querySelector('#disputes-empty');

  skel.style.display = 'block';
  list.innerHTML = '';
  empty.style.display = 'none';

  try {
    const { data } = await API.sb.from('orders').select('*').eq('status', 'disputed').order('updated_at', { ascending: false });
    const orders = (data || []).map(fromOrderRaw);

    skel.style.display = 'none';
    if (orders.length === 0) {
      empty.style.display = 'block';
      return;
    }

    orders.forEach(order => {
      const card = document.createElement('div');
      card.className = 'card';
      card.dataset.orderId = order.id;
      card.style.cursor = 'pointer';

      const client = store.user(order.clientId);
      const freelancer = store.user(order.freelancerId);

      card.innerHTML = `
        <div class="dispute-header" style="display:flex;justify-content:space-between;align-items:center;gap:10px">
          <div style="flex:1;min-width:0">
            <strong>${esc(order.title || t('empty'))}</strong>
            <div class="muted small" style="margin-top:4px">
              ${t('client')}: ${client ? esc(client.name) : '---'} &middot;
              ${t('freelancer')}: ${freelancer ? esc(freelancer.name) : '---'} &middot;
              ${fmtMoney(order.price)}
            </div>
            ${order.disputeReason ? `<div class="small" style="margin-top:4px;color:#b91c1c">${t('admin_complaints')}: ${esc(order.disputeReason)}</div>` : ''}
            <div class="muted small">${fmtDate(order.updatedAt)}</div>
          </div>
          <span class="status progress">${t('order_status_disputed')}</span>
        </div>
        <div class="dispute-details" style="display:none;margin-top:12px;padding-top:12px;border-top:1px solid var(--line)">
          <div id="dispute-messages-${order.id}" style="margin-bottom:12px;max-height:200px;overflow-y:auto">
            <div class="muted small">${t('loading')}</div>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-sm btn-outline dispute-refund-btn" data-order-id="${order.id}">${t('balance')} (Refund)</button>
            <button class="btn btn-sm btn-primary dispute-pay-btn" data-order-id="${order.id}">${t('balance')} (Pay)</button>
          </div>
        </div>
      `;

      card.addEventListener('click', e => {
        if (e.target.closest('.dispute-refund-btn') || e.target.closest('.dispute-pay-btn')) return;
        const details = card.querySelector('.dispute-details');
        const isOpen = details.style.display !== 'none';
        details.style.display = isOpen ? 'none' : 'block';
        if (!isOpen) loadDisputeMessages(order.id, card);
      });

      card.querySelector('.dispute-refund-btn').addEventListener('click', async e => {
        e.stopPropagation();
        if (!confirm('Refund to client?')) return;
        const btn = e.currentTarget;
        btn.disabled = true;
        btn.textContent = t('loading');
        try {
          await API.escrowRefund(order.id);
          await API.updateOrderStatus(order.id, 'cancelled');
          toast(t('success'));
          card.remove();
          if (container.querySelector('#disputes-list').children.length === 0) {
            container.querySelector('#disputes-empty').style.display = 'block';
          }
        } catch (err) { toast(err.message); }
        btn.disabled = false;
        btn.textContent = 'Refund';
      });

      card.querySelector('.dispute-pay-btn').addEventListener('click', async e => {
        e.stopPropagation();
        if (!confirm('Pay to freelancer?')) return;
        const btn = e.currentTarget;
        btn.disabled = true;
        btn.textContent = t('loading');
        try {
          await API.escrowPay(order.id);
          await API.updateOrderStatus(order.id, 'completed');
          toast(t('success'));
          card.remove();
          if (container.querySelector('#disputes-list').children.length === 0) {
            container.querySelector('#disputes-empty').style.display = 'block';
          }
        } catch (err) { toast(err.message); }
        btn.disabled = false;
        btn.textContent = 'Pay';
      });

      list.appendChild(card);
    });
  } catch (e) {
    skel.style.display = 'none';
    empty.style.display = 'block';
    console.error(e);
  }
}

function fromOrderRaw(o) {
  return {
    id: o.id, clientId: o.client_id, freelancerId: o.freelancer_id,
    status: o.status || '', price: Number(o.price || 0), title: o.title || '',
    disputeReason: o.dispute_reason || '',
    updatedAt: o.updated_at ? Date.parse(o.updated_at) : 0,
  };
}

async function loadDisputeMessages(orderId, card) {
  const container = card.querySelector('#dispute-messages-' + orderId);
  if (!container) return;
  try {
    const { data } = await API.sb.from('chats').select('id').or(`order_id.eq.${orderId}`).maybeSingle();
    if (data) {
      const msgs = await API.fetchMessages(data.id);
      if (msgs.length === 0) {
        container.innerHTML = `<div class="muted small">${t('no_messages')}</div>`;
        return;
      }
      container.innerHTML = msgs.map(m => {
        const u = store.user(m.senderId);
        const name = u ? u.name : m.senderId.slice(0, 8);
        return `<div style="margin-bottom:6px;font-size:13px"><b>${esc(name)}:</b> ${esc(m.text || '')}${m.imageUrl ? ' 📷' : ''}</div>`;
      }).join('');
    } else {
      container.innerHTML = `<div class="muted small">${t('no_messages')}</div>`;
    }
  } catch (_) {
    container.innerHTML = `<div class="muted small">${t('error')}</div>`;
  }
}

async function loadComplaints(container) {
  const list = container.querySelector('#complaints-list');
  const skel = container.querySelector('#complaints-skeleton');
  const empty = container.querySelector('#complaints-empty');

  skel.style.display = 'block';
  list.innerHTML = '';
  empty.style.display = 'none';

  try {
    const data = await API.fetchComplaints();
    skel.style.display = 'none';
    if (data.length === 0) {
      empty.style.display = 'block';
      return;
    }

    data.forEach(c => {
      const card = document.createElement('div');
      card.className = 'card';
      card.style.cursor = 'pointer';

      const complainant = store.user(c.complainantId);

      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
          <div style="flex:1;min-width:0">
            <strong>${complainant ? esc(complainant.name) : '---'}</strong>
            <div class="muted small" style="margin-top:2px">
              ${c.targetType}: ${esc(c.targetId)} &middot; ${fmtDate(c.createdAt)}
            </div>
            <div class="small" style="margin-top:4px">${esc(c.reason)}</div>
          </div>
          <span class="status ${c.status === 'resolved' ? 'done' : 'progress'}">${c.status}</span>
        </div>
        <div class="complaint-details" style="display:none;margin-top:12px;padding-top:12px;border-top:1px solid var(--line)">
          <div style="display:flex;gap:8px">
            <button class="btn btn-sm btn-outline complaint-dismiss-btn" data-complaint-id="${c.id}">Dismiss</button>
            <button class="btn btn-sm btn-primary complaint-ban-btn" data-target-type="${c.targetType}" data-target-id="${c.targetId}" data-complaint-id="${c.id}">${t('admin_ban')}</button>
          </div>
        </div>
      `;

      card.addEventListener('click', e => {
        if (e.target.closest('.complaint-dismiss-btn') || e.target.closest('.complaint-ban-btn')) return;
        const details = card.querySelector('.complaint-details');
        details.style.display = details.style.display === 'none' ? 'block' : 'none';
      });

      card.querySelector('.complaint-dismiss-btn').addEventListener('click', async e => {
        e.stopPropagation();
        if (!confirm('Dismiss this complaint?')) return;
        const btn = e.currentTarget;
        btn.disabled = true;
        btn.textContent = t('loading');
        try {
          await API.sb.from('complaints').update({ status: 'resolved' }).eq('id', c.id);
          toast(t('success'));
          card.querySelector('.complaint-details').style.display = 'none';
          card.querySelector('.status').textContent = 'resolved';
          card.querySelector('.status').className = 'status done';
        } catch (err) { toast(err.message); }
        btn.disabled = false;
        btn.textContent = 'Dismiss';
      });

      card.querySelector('.complaint-ban-btn').addEventListener('click', async e => {
        e.stopPropagation();
        if (!confirm(`Ban ${c.targetType}?`)) return;
        const btn = e.currentTarget;
        btn.disabled = true;
        btn.textContent = t('loading');
        try {
          await API.updateProfile(c.targetId, { banned: true });
          await API.sb.from('complaints').update({ status: 'resolved' }).eq('id', c.id);
          toast(t('success'));
          card.querySelector('.complaint-details').style.display = 'none';
          card.querySelector('.status').textContent = 'resolved';
          card.querySelector('.status').className = 'status done';
        } catch (err) { toast(err.message); }
        btn.disabled = false;
        btn.textContent = t('admin_ban');
      });

      list.appendChild(card);
    });
  } catch (e) {
    skel.style.display = 'none';
    empty.style.display = 'block';
    console.error(e);
  }
}

let usersPage = 1;
const USERS_PER_PAGE = 20;

async function loadUsers(container, search) {
  const list = container.querySelector('#users-list');
  const skel = container.querySelector('#users-skeleton');
  const empty = container.querySelector('#users-empty');
  const pagination = container.querySelector('#users-pagination');

  skel.style.display = 'block';
  list.innerHTML = '';
  empty.style.display = 'none';
  pagination.innerHTML = '';
  usersPage = 1;

  try {
    let query = API.sb.from('profiles').select('*', { count: 'exact' }).order('created_at', { ascending: false });
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }
    const { data, count } = await query;
    const users = (data || []).map(u => ({
      id: u.id, name: u.name || '', email: u.email || '', role: u.role || 'client',
      balance: Number(u.balance || 0), connectsRemaining: u.connects_remaining != null ? Number(u.connects_remaining) : 50,
      banned: !!u.banned, isAdmin: !!u.is_admin,
      createdAt: u.created_at ? Date.parse(u.created_at) : 0,
    }));
    users.forEach(u => store.upsert('users', u));

    skel.style.display = 'none';
    if (users.length === 0) {
      empty.style.display = 'block';
      return;
    }

    renderUsersPage(container, users, 1);

    const totalPages = Math.ceil(users.length / USERS_PER_PAGE);
    if (totalPages > 1) {
      for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-sm ' + (i === 1 ? 'btn-primary' : 'btn-ghost');
        btn.textContent = i;
        btn.dataset.page = i;
        btn.addEventListener('click', () => {
          usersPage = i;
          renderUsersPage(container, users, i);
          pagination.querySelectorAll('.btn-primary').forEach(b => b.className = 'btn btn-sm btn-ghost');
          btn.className = 'btn btn-sm btn-primary';
        });
        pagination.appendChild(btn);
      }
    }
  } catch (e) {
    skel.style.display = 'none';
    empty.style.display = 'block';
    console.error(e);
  }
}

function renderUsersPage(container, users, page) {
  const list = container.querySelector('#users-list');
  list.innerHTML = '';
  const start = (page - 1) * USERS_PER_PAGE;
  const pageUsers = users.slice(start, start + USERS_PER_PAGE);

  pageUsers.forEach(u => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        ${aviHTML(u.name, '', 40)}
        <div style="flex:1;min-width:0">
          <strong>${esc(u.name)}</strong>
          <div class="muted small">${esc(u.email)}</div>
        </div>
        <span class="chip ${u.role === 'freelancer' ? 'active' : ''}">${t(u.role)}</span>
        <span class="muted small">${t('balance')}: ${fmtMoney(u.balance)}</span>
        <span class="muted small">${t('connects')}: ${u.connectsRemaining}</span>
        <span class="muted small">${fmtDate(u.createdAt)}</span>
        ${u.isAdmin ? '<span class="chip" style="background:var(--yellow);color:#fff">Admin</span>' : ''}
        <button class="btn btn-sm ${u.banned ? 'btn-primary' : 'btn-outline'} user-ban-btn" data-user-id="${u.id}" data-banned="${u.banned}">
          ${u.banned ? t('admin_unban') : t('admin_ban')}
        </button>
      </div>
    `;

    card.querySelector('.user-ban-btn').addEventListener('click', async e => {
      const btn = e.currentTarget;
      const userId = btn.dataset.userId;
      const banned = btn.dataset.banned === 'true';
      if (!confirm(banned ? 'Unban this user?' : 'Ban this user?')) return;
      btn.disabled = true;
      btn.textContent = t('loading');
      try {
        await API.updateProfile(userId, { banned: !banned });
        btn.dataset.banned = String(!banned);
        btn.textContent = !banned ? t('admin_unban') : t('admin_ban');
        btn.className = 'btn btn-sm ' + (!banned ? 'btn-primary' : 'btn-outline');
        toast(t('success'));
      } catch (err) { toast(err.message); }
      btn.disabled = false;
    });

    list.appendChild(card);
  });
}

async function loadTransactions(container, filter) {
  const list = container.querySelector('#transactions-list');
  const skel = container.querySelector('#transactions-skeleton');
  const empty = container.querySelector('#transactions-empty');

  skel.style.display = 'block';
  list.innerHTML = '';
  empty.style.display = 'none';

  try {
    let query = API.sb.from('transactions').select('*').order('created_at', { ascending: false }).limit(100);
    if (filter && filter !== 'all') {
      query = query.eq('type', filter);
    }
    const { data } = await query;
    const txs = (data || []).map(t => ({
      id: t.id, orderId: t.order_id, fromUserId: t.from_user_id, toUserId: t.to_user_id,
      amount: Number(t.amount || 0), type: t.type || '', status: t.status || 'completed',
      createdAt: t.created_at ? Date.parse(t.created_at) : 0,
    }));

    skel.style.display = 'none';
    if (txs.length === 0) {
      empty.style.display = 'block';
      return;
    }

    txs.forEach(tx => {
      const fromUser = store.user(tx.fromUserId);
      const toUser = store.user(tx.toUserId);
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <span class="chip">${esc(tx.type)}</span>
          <div style="flex:1;min-width:0">
            <span class="muted small">${tx.fromUserId ? (fromUser ? esc(fromUser.name) : tx.fromUserId.slice(0, 8)) : '---'}</span>
            &rarr;
            <span class="muted small">${tx.toUserId ? (toUser ? esc(toUser.name) : tx.toUserId.slice(0, 8)) : '---'}</span>
          </div>
          <span style="font-weight:600;color:var(--green)">${fmtMoney(tx.amount)}</span>
          <span class="status ${tx.status === 'completed' ? 'done' : tx.status === 'pending' ? 'progress' : 'cancelled'}">${tx.status}</span>
          <span class="muted small">${fmtDate(tx.createdAt)}</span>
        </div>
      `;
      list.appendChild(card);
    });
  } catch (e) {
    skel.style.display = 'none';
    empty.style.display = 'block';
    console.error(e);
  }
}
