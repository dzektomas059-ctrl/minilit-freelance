import {
  fromProfile, fromJob, fromService, fromOrder, fromChat, fromMessage,
  fromNotification, fromBookmark, fromApplication, fromProposal,
  fromPortfolio, fromReview, fromTransaction, upsertById, removeById,
} from './store.js';

export class API {
  static get sb() { return globalThis.sb; }

  static async getSession() {
    const { data } = await this.sb.auth.getSession();
    return data.session;
  }

  static async signUp(email, password, name) {
    const { data, error } = await this.sb.auth.signUp({
      email, password,
      options: { data: { name } },
    });
    if (error) throw error;
    if (data?.user) {
      await this.sb.from('profiles').upsert({
        id: data.user.id, email, name, role: 'client',
      }, { onConflict: 'id' });
    }
    return data;
  }

  static async signIn(email, password) {
    const { data, error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  static async signInWithGoogle() {
    const { data, error } = await this.sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
    if (error) throw error;
    return data;
  }

  static async signOut() {
    const { error } = await this.sb.auth.signOut({ scope: 'local' });
    if (error) throw error;
  }

  static async resetPassword(email) {
    const { error } = await this.sb.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname,
    });
    if (error) throw error;
  }

  static async updatePassword(password) {
    const { error } = await this.sb.auth.updateUser({ password });
    if (error) throw error;
  }

  static async fetchProfiles() {
    const { data, error } = await this.sb.from('profiles').select('*');
    if (error) throw error;
    return (data || []).map(fromProfile);
  }

  static async fetchTasks() {
    const { data, error } = await this.sb.from('jobs')
      .select('*')
      .eq('moderation_status', 'approved');
    if (error) throw error;
    return (data || []).map(fromJob);
  }

  static async fetchServices() {
    const { data, error } = await this.sb.from('services')
      .select('*')
      .eq('moderation_status', 'approved');
    if (error) throw error;
    return (data || []).map(fromService);
  }

  static async fetchOrders() {
    const { data, error } = await this.sb.from('orders').select('*');
    if (error) throw error;
    return (data || []).map(fromOrder);
  }

  static async fetchChats(userId) {
    const { data, error } = await this.sb.from('chats')
      .select('*')
      .or(`client_id.eq.${userId},freelancer_id.eq.${userId}`);
    if (error) throw error;
    return (data || []).map(fromChat);
  }

  static async fetchMessages(chatId) {
    const { data, error } = await this.sb.from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []).map(fromMessage);
  }

  static async fetchNotifications(userId) {
    const { data, error } = await this.sb.from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data || []).map(fromNotification);
  }

  static async fetchBookmarks(userId) {
    const { data, error } = await this.sb.from('bookmarks')
      .select('*')
      .eq('user_id', userId);
    if (error) throw error;
    return (data || []).map(fromBookmark);
  }

  static async fetchApplications() {
    const { data, error } = await this.sb.from('applications').select('*');
    if (error) throw error;
    return (data || []).map(fromApplication);
  }

  static async fetchProposals() {
    const { data, error } = await this.sb.from('proposals').select('*');
    if (error) throw error;
    return (data || []).map(fromProposal);
  }

  static async fetchReviews() {
    const { data, error } = await this.sb.from('reviews').select('*');
    if (error) throw error;
    return (data || []).map(fromReview);
  }

  static async fetchPortfolio() {
    const { data, error } = await this.sb.from('portfolio').select('*');
    if (error) throw error;
    return (data || []).map(fromPortfolio);
  }

  static async fetchTransactions(userId) {
    const { data, error } = await this.sb.from('transactions')
      .select('*')
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data || []).map(fromTransaction);
  }

  static async fetchComplaints() {
    const { data, error } = await this.sb.from('complaints').select('*');
    if (error) throw error;
    return (data || []).map(c => ({
      id: c.id,
      complainantId: c.complainant_id,
      targetType: c.target_type,
      targetId: c.target_id,
      reason: c.reason,
      status: c.status || 'pending',
      createdAt: c.created_at ? Date.parse(c.created_at) : 0,
    }));
  }

  static async fetchPublicProfile(userId) {
    const { data, error } = await this.sb.from('public_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return fromProfile(data);
  }

  static async createTask({ title, description, category, budget }) {
    const me = this.sb.auth.user();
    const { data, error } = await this.sb.from('jobs').insert([{
      title, description, category,
      budget: Number(budget) || 0,
      client_id: me?.id,
      status: 'open',
    }]).select().single();
    if (error) throw error;
    return fromJob(data);
  }

  static async updateTask(id, fields) {
    const { data, error } = await this.sb.from('jobs')
      .update(fields)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return fromJob(data);
  }

  static async deleteTask(id) {
    const { error } = await this.sb.from('jobs')
      .update({ status: 'closed' })
      .eq('id', id);
    if (error) throw error;
  }

  static async createService({ title, description, category, price }) {
    const me = this.sb.auth.user();
    const { data, error } = await this.sb.from('services').insert([{
      title, description, category,
      price: Number(price) || 0,
      freelancer_id: me?.id,
    }]).select().single();
    if (error) throw error;
    return fromService(data);
  }

  static async updateService(id, fields) {
    const { data, error } = await this.sb.from('services')
      .update(fields)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return fromService(data);
  }

  static async deleteService(id) {
    const { error } = await this.sb.from('services')
      .update({ status: 'closed' })
      .eq('id', id);
    if (error) throw error;
  }

  static async createOrder(serviceId, clientId, freelancerId, price, title) {
    const { data, error } = await this.sb.from('orders').insert([{
      service_id: serviceId,
      client_id: clientId,
      freelancer_id: freelancerId,
      price: Number(price) || 0,
      title,
      status: 'pending_payment',
    }]).select().single();
    if (error) throw error;
    return fromOrder(data);
  }

  static async updateOrderStatus(orderId, status) {
    const { data, error } = await this.sb.from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .select()
      .single();
    if (error) throw error;
    return fromOrder(data);
  }

  static async createChat(clientId, freelancerId, taskId, orderId) {
    const { data, error } = await this.sb.from('chats').insert([{
      client_id: clientId,
      freelancer_id: freelancerId,
      job_id: taskId || null,
      order_id: orderId || null,
    }]).select().single();
    if (error) throw error;
    return fromChat(data);
  }

  static async sendMessage(chatId, senderId, text, imageUrl, fileName, fileType) {
    const payload = { chat_id: chatId, sender_id: senderId };
    if (text) payload.text = text;
    if (imageUrl) payload.image_url = imageUrl;
    if (fileName) payload.file_name = fileName;
    if (fileType) payload.file_type = fileType;
    const { data, error } = await this.sb.from('messages').insert([payload]).select().single();
    if (error) throw error;
    return fromMessage(data);
  }

  static async markMessagesRead(chatId, userId) {
    const { error } = await this.sb.from('messages')
      .update({ read: true })
      .eq('chat_id', chatId)
      .neq('sender_id', userId);
    if (error) throw error;
  }

  static async markNotifRead(notifId) {
    const { error } = await this.sb.from('notifications')
      .update({ is_read: true })
      .eq('id', notifId);
    if (error) throw error;
  }

  static async markAllNotifsRead(userId) {
    const { error } = await this.sb.from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId);
    if (error) throw error;
  }

  static async applyForTask(taskId, freelancerId, message) {
    const { data, error } = await this.sb.from('applications').insert([{
      job_id: taskId,
      freelancer_id: freelancerId,
      message,
    }]).select().single();
    if (error) throw error;
    return fromApplication(data);
  }

  static async respondToProject(projectId, freelancerId, coverLetter, price) {
    const { data, error } = await this.sb.from('proposals').insert([{
      task_id: projectId,
      freelancer_id: freelancerId,
      title: coverLetter,
      price: Number(price) || 0,
    }]).select().single();
    if (error) throw error;
    return fromProposal(data);
  }

  static async createReview(orderId, serviceId, reviewerId, targetId, targetRole, stars, text) {
    const { data, error } = await this.sb.from('reviews').insert([{
      order_id: orderId,
      service_id: serviceId,
      reviewer_id: reviewerId,
      freelancer_id: targetId,
      target_role: targetRole,
      stars: Math.round(Number(stars)),
      text,
    }]).select().single();
    if (error) throw error;
    return fromReview(data);
  }

  static async createComplaint(complainantId, targetType, targetId, reason) {
    const { data, error } = await this.sb.from('complaints').insert([{
      complainant_id: complainantId,
      target_type: targetType,
      target_id: targetId,
      reason,
    }]).select().single();
    if (error) throw error;
    return data;
  }

  static async addPortfolio(userId, title, description, imageUrl, projectUrl) {
    const { data, error } = await this.sb.from('portfolio').insert([{
      user_id: userId,
      title,
      description,
      image_url: imageUrl,
      project_url: projectUrl,
    }]).select().single();
    if (error) throw error;
    return fromPortfolio(data);
  }

  static async deletePortfolio(id) {
    const { error } = await this.sb.from('portfolio').delete().eq('id', id);
    if (error) throw error;
  }

  static async updateProfile(userId, fields) {
    const { data, error } = await this.sb.from('profiles')
      .update(fields)
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return fromProfile(data);
  }

  static async updateNotifPrefs(userId, prefs) {
    const { data, error } = await this.sb.from('profiles')
      .update({ notif_prefs: prefs })
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return fromProfile(data);
  }

  static async updateActivityStatus(userId, status) {
    const { error } = await this.sb.from('profiles')
      .update({ activity_status: status })
      .eq('id', userId);
    if (error) throw error;
  }

  static async toggleBookmark(userId, targetType, targetId) {
    const existing = await this.sb.from('bookmarks')
      .select('*')
      .eq('user_id', userId)
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .maybeSingle();
    if (existing.data) {
      await this.sb.from('bookmarks').delete().eq('id', existing.data.id);
      return { bookmarked: false };
    }
    const { data, error } = await this.sb.from('bookmarks').insert([{
      user_id: userId,
      target_type: targetType,
      target_id: targetId,
    }]).select().single();
    if (error) throw error;
    return { bookmarked: true, bookmark: fromBookmark(data) };
  }

  static async uploadFile(bucket, filePath, file) {
    await this.ensureBucket(bucket);
    const { error: upErr } = await this.sb.storage.from(bucket).upload(filePath, file, {
      upsert: true,
      cacheControl: '3600',
      contentType: file.type || undefined,
    });
    if (upErr) throw upErr;
    const { data: { publicUrl } } = this.sb.storage.from(bucket).getPublicUrl(filePath);
    return publicUrl + '?v=' + Date.now();
  }

  static async uploadAvatar(file) {
    const me = await this.sb.auth.getUser();
    const uid = me.data?.user?.id;
    if (!uid) throw new Error('Not authenticated');
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `${uid}/${Date.now()}.${ext}`;
    return this.uploadFile('avatars', path, file);
  }

  static async uploadChatImage(file) {
    const me = await this.sb.auth.getUser();
    const uid = me.data?.user?.id;
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `chat_${uid}_${Date.now()}.${ext}`;
    return this.uploadFile('chat-files', path, file);
  }

  static async uploadChatAudio(blob) {
    const me = await this.sb.auth.getUser();
    const uid = me.data?.user?.id;
    const path = `audio_${uid}_${Date.now()}.ogg`;
    const file = new File([blob], path, { type: 'audio/ogg' });
    return this.uploadFile('chat-files', path, file);
  }

  static async callRPC(fn, params) {
    try {
      const { data, error } = await this.sb.rpc(fn, params);
      return { data, error };
    } catch (e) {
      return { data: null, error: e };
    }
  }

  static async spendConnect(userId, amount) {
    const { data, error } = await this.sb.rpc('spend_connect', {
      p_user_id: userId,
      p_amount: amount || 1,
    });
    if (error) throw error;
    return data;
  }

  static async claimQuestReward(userId, questId) {
    const { data, error } = await this.sb.rpc('claim_quest_reward', {
      p_user_id: userId,
      p_quest_id: questId,
    });
    if (error) throw error;
    return data;
  }

  static async escrowPay(orderId) {
    const { data, error } = await this.sb.rpc('escrow_pay', { p_order_id: orderId });
    if (error) throw error;
    return data;
  }

  static async escrowRefund(orderId) {
    const { data, error } = await this.sb.rpc('escrow_refund', { p_order_id: orderId });
    if (error) throw error;
    return data;
  }

  static async updateOnlineStatus(userId) {
    const { error } = await this.sb.from('profiles')
      .update({ last_seen: new Date().toISOString() })
      .eq('id', userId);
    if (error) throw error;
  }

  static subscribeRealtime(channel, event, table, filter, callback) {
    const ch = this.sb.channel(channel);
    ch.on('postgres_changes', { event, schema: 'public', table, filter }, callback);
    ch.subscribe();
    return ch;
  }

  static async ensureBucket(name) {
    const { data: buckets } = await this.sb.storage.listBuckets();
    if (buckets && buckets.some(b => b.id === name)) return;
    await this.sb.storage.createBucket(name, { public: true }).catch(() => {});
  }

  static async getStorageUrl(bucket, path) {
    const { data: { publicUrl } } = this.sb.storage.from(bucket).getPublicUrl(path);
    return publicUrl;
  }
}
