export const fromProfile = p => p && ({
  id: p.id,
  email: p.email || '',
  name: p.name || '',
  role: p.role || 'client',
  bio: p.bio || '',
  specialization: p.specialization || '',
  avatar: p.avatar_url || '',
  cover_url: p.cover_url || '',
  paymentDetails: p.payment_details || '',
  rating: Number(p.rating || 0),
  reviews_count: p.reviews_count || 0,
  orders_done: p.orders_done || 0,
  orders_total: p.orders_total || 0,
  balance: Number(p.balance || 0),
  connectsRemaining: p.connects_remaining != null ? Number(p.connects_remaining) : 50,
  isAdmin: !!p.is_admin,
  banned: !!p.banned,
  lastSeen: p.last_seen ? Date.parse(p.last_seen) : 0,
  notifPrefs: p.notif_prefs || { order: true, proposal: true, message: true, review: true, system: true },
  createdAt: p.created_at ? Date.parse(p.created_at) : 0,
});

export const fromJob = j => j && ({
  id: j.id,
  title: j.title || '',
  description: j.description || '',
  category: j.category || '',
  budget: Number(j.budget || 0),
  clientId: j.client_id,
  status: j.status || 'open',
  moderationStatus: j.moderation_status || 'approved',
  createdAt: j.created_at ? Date.parse(j.created_at) : 0,
});

export const fromService = s => s && ({
  id: s.id,
  title: s.title || '',
  description: s.description || '',
  category: s.category || '',
  price: Number(s.price || 0),
  freelancerId: s.freelancer_id,
  moderationStatus: s.moderation_status || 'approved',
  createdAt: s.created_at ? Date.parse(s.created_at) : 0,
});

export const fromOrder = o => o && ({
  id: o.id,
  serviceId: o.service_id,
  clientId: o.client_id,
  freelancerId: o.freelancer_id,
  status: o.status || 'pending_payment',
  price: Number(o.price || 0),
  title: o.title || '',
  paymentProof: o.payment_proof || '',
  escrowAmount: Number(o.escrow_amount || 0),
  disputeReason: o.dispute_reason || '',
  createdAt: o.created_at ? Date.parse(o.created_at) : 0,
  updatedAt: o.updated_at ? Date.parse(o.updated_at) : 0,
});

export const fromChat = c => c && ({
  id: c.id,
  participants: [c.client_id, c.freelancer_id],
  clientId: c.client_id,
  freelancerId: c.freelancer_id,
  taskId: c.job_id,
  orderId: c.order_id,
  lastText: c.last_text || '',
  lastAt: c.last_at ? Date.parse(c.last_at) : (c.created_at ? Date.parse(c.created_at) : 0),
  createdAt: c.created_at ? Date.parse(c.created_at) : 0,
});

export const fromMessage = m => m && ({
  id: m.id,
  chatId: m.chat_id,
  senderId: m.sender_id,
  text: m.text || '',
  imageUrl: m.image_url || '',
  fileName: m.file_name || '',
  fileType: m.file_type || '',
  read: !!m.read,
  deliveredAt: m.delivered_at ? Date.parse(m.delivered_at) : null,
  readAt: m.read_at ? Date.parse(m.read_at) : null,
  createdAt: m.created_at ? Date.parse(m.created_at) : Date.now(),
});

export const fromNotification = n => n && ({
  id: n.id,
  userId: n.user_id,
  type: n.type || 'system',
  title: n.title || '',
  body: n.body || '',
  data: (() => { try { return typeof n.data === 'string' ? JSON.parse(n.data) : n.data; } catch { return n.data; } })() || null,
  link: n.link || '',
  read: !!n.is_read,
  createdAt: n.created_at ? Date.parse(n.created_at) : Date.now(),
});

export const fromBookmark = b => b && ({
  id: b.id,
  userId: b.user_id,
  targetType: b.target_type,
  targetId: b.target_id,
  createdAt: b.created_at ? Date.parse(b.created_at) : 0,
});

export const fromApplication = a => a && ({
  id: a.id,
  taskId: a.job_id,
  freelancerId: a.freelancer_id,
  message: a.message || '',
  status: a.status || 'pending',
  createdAt: a.created_at ? Date.parse(a.created_at) : 0,
});

export const fromProposal = p => p && ({
  id: p.id,
  projectId: p.task_id,
  freelancerId: p.freelancer_id,
  title: p.title || '',
  description: p.description || '',
  price: Number(p.price || 0),
  deadline: p.deadline || '',
  videoUrl: p.video_url || '',
  status: p.status || 'pending',
  createdAt: p.created_at ? Date.parse(p.created_at) : 0,
});

export const fromPortfolio = p => p && ({
  id: p.id,
  userId: p.user_id,
  title: p.title || '',
  description: p.description || '',
  imageUrl: p.image_url || '',
  projectUrl: p.project_url || '',
  createdAt: p.created_at ? Date.parse(p.created_at) : 0,
});

export const fromReview = r => r && ({
  id: r.id,
  orderId: r.order_id,
  serviceId: r.service_id,
  reviewerId: r.reviewer_id,
  targetId: r.freelancer_id,
  targetRole: r.target_role || 'freelancer',
  rating: Number(r.stars || 0),
  text: r.text || '',
  createdAt: r.created_at ? Date.parse(r.created_at) : 0,
});

export const fromTransaction = t => t && ({
  id: t.id,
  orderId: t.order_id,
  fromUserId: t.from_user_id,
  toUserId: t.to_user_id,
  amount: Number(t.amount || 0),
  type: t.type || '',
  status: t.status || 'completed',
  createdAt: t.created_at ? Date.parse(t.created_at) : 0,
});

export const upsertById = (arr, item) => {
  const i = arr.findIndex(x => x.id === item.id);
  if (i >= 0) arr[i] = item;
  else arr.unshift(item);
};

export const removeById = (arr, id) => {
  const i = arr.findIndex(x => x.id === id);
  if (i >= 0) arr.splice(i, 1);
};

const _state = {
  users: [], tasks: [], responses: [], services: [], orders: [],
  chats: [], messages: [], reviews: [], proposals: [], portfolio: [],
  session: null, ready: false, unread: 0, notifUnread: 0,
  notifications: [], bookmarks: [], complaints: [], transactions: [],
};

const _listeners = new Map();
let _id = 0;

function _notify(prop, val, old) {
  const fns = _listeners.get(prop);
  if (fns) fns.forEach(fn => { try { fn(val, old); } catch (e) { console.error(e); } });
}

const storeMethods = {
  get(prop) { return _state[prop]; },
  set(prop, val) { const old = _state[prop]; _state[prop] = val; _notify(prop, val, old); },
  on(prop, fn) {
    if (!_listeners.has(prop)) _listeners.set(prop, new Map());
    const sid = ++_id;
    _listeners.get(prop).set(sid, fn);
    return () => { const m = _listeners.get(prop); if (m) m.delete(sid); };
  },
  once(prop, fn) {
    const unsub = this.on(prop, (...a) => { unsub(); fn(...a); });
  },
  _notify,
  reinit(data) {
    Object.keys(_state).forEach(k => { if (data[k] !== undefined) this.set(k, data[k]); });
    this.set('ready', true);
  },
  me() { return _state.users.find(u => u.id === _state.session) || null; },
  userId() { return _state.session; },
  isLoggedIn() { return !!_state.session; },
  isAdmin() { const u = this.me(); return u && u.isAdmin; },
  user(id) { return _state.users.find(u => u.id === id) || null; },
  task(id) { return _state.tasks.find(t => t && t.id === id) || null; },
  service(id) { return _state.services.find(s => s && s.id === id) || null; },
  order(id) { return _state.orders.find(o => o && o.id === id) || null; },
  chat(id) { return _state.chats.find(c => c && c.id === id) || null; },
  message(id) { return _state.messages.find(m => m && m.id === id) || null; },
  notification(id) { return _state.notifications.find(n => n && n.id === id) || null; },
  upsert(prop, item) { const arr = _state[prop]; upsertById(arr, item); _notify(prop, arr); },
  remove(prop, id) { const arr = _state[prop]; removeById(arr, id); _notify(prop, arr); },
  push(prop, item) { _state[prop].unshift(item); _notify(prop, _state[prop]); },
};

export const store = new Proxy(storeMethods, {
  get(target, prop) {
    if (prop in target) return target[prop];
    if (prop in _state) return _state[prop];
    return undefined;
  },
  set(target, prop, val) {
    if (prop in _state) { target.set(prop, val); return true; }
    target[prop] = val;
    return true;
  },
});
