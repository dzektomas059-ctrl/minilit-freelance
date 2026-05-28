import { store } from '../store.js';
import { API } from '../api.js';
import { t } from '../i18n.js';

export function viewMessages(params) {
  return `
<div class="messages-page" data-view="messages" data-chat-id="${esc(params.chat || '')}">
  <div class="container">
    <div class="chat-layout">
      <div class="chat-list" id="chat-list-panel">
        <div class="chat-list-head">${t('messages_title')}</div>
        <div class="chat-items" id="chat-items">
          <div style="padding:16px;text-align:center;color:var(--gray)" id="chats-skeleton">
            <div class="skel skel-block" style="height:50px;margin-bottom:8px"></div>
            <div class="skel skel-block" style="height:50px;margin-bottom:8px"></div>
            <div class="skel skel-block" style="height:50px;margin-bottom:8px"></div>
          </div>
          <div class="chat-empty" id="no-chats" style="display:none">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.2L4 17.2V4h16v12z"/></svg>
            <p>${t('no_chats')}</p>
          </div>
        </div>
      </div>
      <div class="chat-pane" id="chat-pane">
        <div class="chat-empty" id="no-chat-selected">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.2L4 17.2V4h16v12z"/></svg>
          <p>${t('start_chat')}</p>
        </div>
        <div id="active-chat" style="display:none;flex-direction:column;height:100%">
          <div class="chat-head">
            <button class="chat-back" id="chat-back-btn" aria-label="${t('back')}">&larr;</button>
            <div class="avi" id="chat-partner-avi"></div>
            <div style="flex:1;min-width:0">
              <div class="name" id="chat-partner-name"></div>
              <span class="muted small" id="chat-partner-status"></span>
            </div>
            <span class="online-dot" id="chat-partner-online" style="display:none"></span>
          </div>
          <div class="chat-body" id="messages-container">
            <div class="chat-empty" id="no-messages" style="display:none">
              <p>${t('no_messages')}</p>
            </div>
            <div style="text-align:center;padding:20px;color:var(--gray)" id="messages-skeleton">
              <div class="skel skel-block" style="width:40%;height:14px;margin-bottom:6px"></div>
              <div class="skel skel-block" style="width:60%;height:14px;margin-bottom:6px"></div>
              <div class="skel skel-block" style="width:30%;height:14px"></div>
            </div>
          </div>
          <form class="chat-form" id="chat-form">
            <div id="image-preview-area" style="display:none;padding:4px 0">
              <div class="chat-preview" id="chat-image-preview">
                <img id="preview-img" src="" alt="">
                <button type="button" class="chat-preview-clear" id="preview-clear">&times;</button>
              </div>
            </div>
            <div class="chat-form-row">
              <textarea class="input" id="chat-input" placeholder="${t('chat_placeholder')}" rows="1" style="resize:none;height:42px;padding:10px 12px"></textarea>
              <button type="button" class="chat-attach-btn" id="attach-image-btn" title="${t('attach_file')}">📷</button>
              <button type="button" class="chat-attach-btn" id="voice-record-btn" title="${t('voice_record')}">🎤</button>
              <button type="submit" class="btn btn-primary" id="send-btn" style="flex:0 0 auto;min-width:44px;height:42px;display:flex;align-items:center;justify-content:center">${t('send')}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</div>`;
}

let chats = [];
let messages = [];
let activeChatId = null;
let pollInterval = null;
let selectedFile = null;
let chatContainer = null;

let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

export async function bindMessages(container, params) {
  chatContainer = container;
  const chatIdFromUrl = params.chat || null;

  if (!store.isLoggedIn()) {
    container.querySelector('#chats-skeleton').style.display = 'none';
    container.querySelector('#no-chats').style.display = 'block';
    container.querySelector('#no-chat-selected').style.display = 'flex';
    return;
  }

  await loadChats(container);

  if (chatIdFromUrl) {
    selectChat(container, chatIdFromUrl);
  }

  bindChatEvents(container);
  startPolling(container);
}

async function loadChats(container) {
  const list = container.querySelector('#chat-items');
  const skel = container.querySelector('#chats-skeleton');
  const noChats = container.querySelector('#no-chats');

  try {
    const data = await API.fetchChats(store.userId());
    data.forEach(c => store.upsert('chats', c));
    chats = data.sort((a, b) => b.lastAt - a.lastAt);

    skel.style.display = 'none';
    if (chats.length === 0) {
      noChats.style.display = 'block';
      return;
    }
    noChats.style.display = 'none';
    renderChatList(list, container);
  } catch (e) {
    skel.style.display = 'none';
    noChats.style.display = 'block';
    console.error(e);
  }
}

function renderChatList(list, container) {
  const existing = list.querySelectorAll('.chat-item:not(#chats-skeleton):not(#no-chats)');
  existing.forEach(el => el.remove());

  chats.forEach(chat => {
    const partnerId = chat.clientId === store.userId() ? chat.freelancerId : chat.clientId;
    const partner = store.user(partnerId);
    const el = document.createElement('div');
    el.className = 'chat-item' + (chat.id === activeChatId ? ' active' : '');
    el.dataset.chatId = chat.id;
    el.innerHTML = `
      <div class="avi" style="background:${colorFor(partnerId)}">${partner ? initials(partner.name) : '?'}</div>
      <div class="ci-body">
        <div class="ci-top">
          <span class="ci-name">${partner ? esc(partner.name) : '---'}</span>
          <span class="ci-date">${fmtDate(chat.lastAt)}</span>
        </div>
        <div class="ci-prev">${esc(chat.lastText || t('no_messages'))}</div>
      </div>
    `;
    list.appendChild(el);
  });
}

async function loadMessages(container, chatId) {
  const body = container.querySelector('#messages-container');
  const skel = container.querySelector('#messages-skeleton');
  const noMessages = container.querySelector('#no-messages');
  const noSelected = container.querySelector('#no-chat-selected');
  const activeChat = container.querySelector('#active-chat');
  const list = container.querySelector('#chat-items');

  if (!chatId) {
    activeChat.style.display = 'none';
    noSelected.style.display = 'flex';
    return;
  }

  activeChat.style.display = 'flex';
  noSelected.style.display = 'none';
  skel.style.display = 'block';
  noMessages.style.display = 'none';

  const existing = body.querySelectorAll('.bubble');
  existing.forEach(el => el.remove());

  markMessagesRead(chatId);

  try {
    const data = await API.fetchMessages(chatId);
    data.forEach(m => store.upsert('messages', m));
    messages = data;

    skel.style.display = 'none';
    if (messages.length === 0) {
      noMessages.style.display = 'block';
    } else {
      noMessages.style.display = 'none';
      renderMessages(body, chatId);
    }
    scrollToBottom(body);

    const chat = store.chat(chatId);
    if (chat) {
      const partnerId = chat.clientId === store.userId() ? chat.freelancerId : chat.clientId;
      const partner = store.user(partnerId);
      const nameEl = container.querySelector('#chat-partner-name');
      const aviEl = container.querySelector('#chat-partner-avi');
      if (nameEl) nameEl.textContent = partner ? partner.name : '---';
      if (aviEl) {
        aviEl.innerHTML = partner ? aviHTML(partner.name, partner.avatar, 40) : '?';
        aviEl.style.background = colorFor(partnerId);
      }
      const onlineEl = container.querySelector('#chat-partner-online');
      const statusEl = container.querySelector('#chat-partner-status');
      if (partner && partner.lastSeen > Date.now() - 120000) {
        onlineEl.style.display = 'inline-block';
        statusEl.textContent = t('status_free');
      } else {
        onlineEl.style.display = 'none';
        statusEl.textContent = partner ? fmtDateTime(partner.lastSeen) : '';
      }
    }

    list.querySelectorAll('.chat-item').forEach(el => {
      el.classList.toggle('active', el.dataset.chatId === chatId);
    });
  } catch (e) {
    skel.style.display = 'none';
    noMessages.style.display = 'block';
    console.error(e);
  }
}

function renderMessages(body, chatId) {
  messages.forEach(m => {
    const isOut = m.senderId === store.userId();
    const bubble = document.createElement('div');
    bubble.className = 'bubble ' + (isOut ? 'out' : 'in');

    let inner = '';

    if (m.text && m.text.startsWith('[VOICE_MSG]')) {
      const url = m.text.replace('[VOICE_MSG]', '');
      inner += `<div class="voice-message-player"><audio controls src="${esc(url)}"></audio></div>`;
    } else if (m.text) {
      inner += esc(m.text);
    }

    if (m.imageUrl) {
      inner += `<img class="chat-img" src="${esc(m.imageUrl)}" alt="" loading="lazy">`;
    }

    if (m.fileName && !m.fileName.endsWith('.ogg')) {
      inner += `<div class="chat-file"><a class="chat-file-link" href="${esc(m.imageUrl || '#')}" target="_blank" rel="noopener">${esc(m.fileName)}</a></div>`;
    }

    if (m.fileName && m.fileName.endsWith('.ogg') && !inner.includes('audio')) {
      inner += `<div class="voice-message-player"><audio controls src="${esc(m.imageUrl || '')}"></audio></div>`;
    }

    const timeStr = fmtTime(m.createdAt);
    const statusHtml = isOut ? `<span class="msg-status">${m.read ? '<span class="check done read">✓✓</span>' : m.deliveredAt ? '<span class="check done">✓✓</span>' : '<span class="check">✓</span>'}</span>` : '';
    inner += `<span class="time">${timeStr}${statusHtml}</span>`;

    bubble.innerHTML = inner;
    body.appendChild(bubble);
  });
}

function fmtTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function scrollToBottom(el) {
  requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
}

async function markMessagesRead(chatId) {
  try {
    await API.markMessagesRead(chatId, store.userId());
  } catch (_) {}
}

function selectChat(container, chatId) {
  activeChatId = chatId;
  const activeChat = container.querySelector('#active-chat');
  const noSelected = container.querySelector('#no-chat-selected');
  const input = container.querySelector('#chat-input');

  activeChatId = chatId;
  activeChat.style.display = 'flex';
  noSelected.style.display = 'none';
  loadMessages(container, chatId);

  container.classList.add('chat-open');
  container.classList.remove('in-chat');

  if (input) input.focus();
}

function bindChatEvents(container) {
  const list = container.querySelector('#chat-items');
  const form = container.querySelector('#chat-form');
  const input = container.querySelector('#chat-input');
  const sendBtn = container.querySelector('#send-btn');
  const attachBtn = container.querySelector('#attach-image-btn');
  const voiceBtn = container.querySelector('#voice-record-btn');
  const previewClear = container.querySelector('#preview-clear');
  const backBtn = container.querySelector('#chat-back-btn');

  list.addEventListener('click', e => {
    const item = e.target.closest('.chat-item');
    if (item) {
      const chatId = item.dataset.chatId;
      if (chatId) {
        selectChat(container, chatId);
        window.location.hash = `#messages?chat=${chatId}`;
      }
    }
  });

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      container.classList.remove('chat-open');
      container.classList.add('in-chat');
    });
  }

  if (input) {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        form.dispatchEvent(new Event('submit'));
      }
    });
  }

  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const text = input ? input.value.trim() : '';
      if (!text && !selectedFile) return;
      if (!activeChatId) return;

      sendBtn.disabled = true;
      sendBtn.textContent = t('loading');

      try {
        let imageUrl = '';
        let fileName = '';
        let fileType = '';

        if (selectedFile) {
          if (selectedFile.type.startsWith('image/')) {
            imageUrl = await API.uploadChatImage(selectedFile);
          } else {
            imageUrl = await API.uploadChatImage(selectedFile);
            fileName = selectedFile.name;
            fileType = selectedFile.type;
          }
          selectedFile = null;
          container.querySelector('#image-preview-area').style.display = 'none';
          container.querySelector('#preview-img').src = '';
        }

        const msg = await API.sendMessage(activeChatId, store.userId(), text || null, imageUrl || null, fileName || null, fileType || null);
        store.upsert('messages', msg);
        input.value = '';

        const body = container.querySelector('#messages-container');
        const noMsg = container.querySelector('#no-messages');
        noMsg.style.display = 'none';
        const existing = body.querySelectorAll('.bubble');
        existing.forEach(el => el.remove());
        messages.push(msg);
        renderMessages(body, activeChatId);
        scrollToBottom(body);

        const chat = store.chat(activeChatId);
        if (chat) {
          chat.lastText = text || (imageUrl ? '📷' : '');
          chat.lastAt = Date.now();
          renderChatList(container.querySelector('#chat-items'), container);
        }
      } catch (e) {
        toast(e.message);
      }
      sendBtn.disabled = false;
      sendBtn.textContent = t('send');
    });
  }

  if (attachBtn) {
    attachBtn.addEventListener('click', () => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = 'image/*,.pdf,.doc,.docx,.zip,.rar';
      inp.onchange = () => {
        const file = inp.files[0];
        if (!file) return;
        selectedFile = file;
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = e2 => {
            container.querySelector('#preview-img').src = e2.target.result;
            container.querySelector('#image-preview-area').style.display = 'block';
          };
          reader.readAsDataURL(file);
        } else {
          container.querySelector('#image-preview-area').style.display = 'block';
          container.querySelector('#preview-img').src = '';
          container.querySelector('#preview-img').alt = file.name;
        }
      };
      inp.click();
    });
  }

  if (previewClear) {
    previewClear.addEventListener('click', () => {
      selectedFile = null;
      container.querySelector('#image-preview-area').style.display = 'none';
      container.querySelector('#preview-img').src = '';
    });
  }

  if (voiceBtn) {
    voiceBtn.addEventListener('click', () => {
      toggleVoiceRecord(voiceBtn, container);
    });
  }

  setupDragDrop(container);
}

async function toggleVoiceRecord(btn, container) {
  if (isRecording) {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    isRecording = false;
    btn.classList.remove('recording-active');
    btn.textContent = '🎤';
    return;
  }

  if (!activeChatId) { toast(t('start_chat')); return; }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = e => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      const blob = new Blob(audioChunks, { type: 'audio/ogg' });
      btn.disabled = true;
      btn.textContent = '⏳';
      try {
        const url = await API.uploadChatAudio(blob);
        const msg = await API.sendMessage(activeChatId, store.userId(), '[VOICE_MSG]' + url, null, null, null);
        store.upsert('messages', msg);

        const body = container.querySelector('#messages-container');
        const noMsg = container.querySelector('#no-messages');
        noMsg.style.display = 'none';
        messages.push(msg);
        const existing = body.querySelectorAll('.bubble');
        existing.forEach(el => el.remove());
        renderMessages(body, activeChatId);
        scrollToBottom(body);
      } catch (e) {
        toast(e.message);
      }
      btn.disabled = false;
      btn.textContent = '🎤';
      stream.getTracks().forEach(t => t.stop());
    };

    mediaRecorder.onerror = () => {
      toast(t('err_unknown'));
      stream.getTracks().forEach(t => t.stop());
      isRecording = false;
      btn.classList.remove('recording-active');
      btn.textContent = '🎤';
    };

    mediaRecorder.start();
    isRecording = true;
    btn.classList.add('recording-active');
    btn.textContent = '⏹';
  } catch (e) {
    toast('Microphone access denied');
  }
}

function setupDragDrop(container) {
  const form = container.querySelector('#chat-form');
  if (!form) return;

  let dragCounter = 0;

  form.addEventListener('dragenter', e => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter++;
    if (dragCounter === 1) form.classList.add('drag-over');
  });

  form.addEventListener('dragover', e => {
    e.preventDefault();
    e.stopPropagation();
  });

  form.addEventListener('dragleave', e => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter--;
    if (dragCounter === 0) form.classList.remove('drag-over');
  });

  form.addEventListener('drop', e => {
    e.preventDefault();
    e.stopPropagation();
    form.classList.remove('drag-over');
    dragCounter = 0;

    const files = e.dataTransfer.files;
    if (files.length === 0) return;
    const file = files[0];

    selectedFile = file;
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = e2 => {
        container.querySelector('#preview-img').src = e2.target.result;
        container.querySelector('#image-preview-area').style.display = 'block';
      };
      reader.readAsDataURL(file);
    } else {
      container.querySelector('#image-preview-area').style.display = 'block';
      container.querySelector('#preview-img').src = '';
      container.querySelector('#preview-img').alt = file.name;
    }
  });
}

function startPolling(container) {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(async () => {
    if (!activeChatId) return;
    try {
      const data = await API.fetchMessages(activeChatId);
      if (data.length !== messages.length) {
        data.forEach(m => store.upsert('messages', m));
        messages = data;
        const body = container.querySelector('#messages-container');
        const existing = body.querySelectorAll('.bubble');
        existing.forEach(el => el.remove());
        const noMsg = container.querySelector('#no-messages');
        if (messages.length === 0) {
          noMsg.style.display = 'block';
        } else {
          noMsg.style.display = 'none';
          renderMessages(body, activeChatId);
        }
        scrollToBottom(body);
        markMessagesRead(activeChatId);
      }
      const chatList = await API.fetchChats(store.userId());
      chatList.forEach(c => store.upsert('chats', c));
      if (chats.length !== chatList.length || chatList.some(c => !chats.find(x => x.id === c.id) || c.lastAt !== chats.find(x => x.id === c.id).lastAt)) {
        chats = chatList.sort((a, b) => b.lastAt - a.lastAt);
        renderChatList(container.querySelector('#chat-items'), container);
      }
    } catch (_) {}
  }, 3000);
}
