// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, onChildAdded, push, remove, get, set } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";

// Firebase config (unchanged)
const firebaseConfig = {
    apiKey: "...",
    authDomain: "yoshibook-ba4ca.firebaseapp.com",
    projectId: "yoshibook-ba4ca",
    storageBucket: "yoshibook-ba4ca.appspot.com",
    messagingSenderId: "1092240192169",
    appId: "1:1092240192169:web:570ca3528a74bd87506fb8",
    measurementId: "G-JTZ62CESK4",
    databaseURL: "https://yoshibook-ba4ca-default-rtdb.firebaseio.com/"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

let messagesLoaded = false;
let currentUserRole = 'user';    // 'user' | 'coordinator' | 'admin'
let bannedUsers = [];            // in‑memory ban list

// ◀◀ NEW: ensure each visitor (even anonymous) has a unique anonId
let anonId = getCookie('anonId');
if (!anonId) {
  anonId = crypto.randomUUID();
  setCookie('anonId', anonId, 30);
}

// ——— Load bannedUsers from cookie ———
function loadBans() {
    const cookie = getCookie('bannedUsers');
    try { bannedUsers = cookie ? JSON.parse(cookie) : []; }
    catch { bannedUsers = []; }
}
loadBans();

// ——— Advanced bad‑word filtering (unchanged) ———
const BAD_WORDS = [ /* ... */ ];
function escapeRegex(str) { /* ... */ }
const BAD_WORD_REGEXPS = BAD_WORDS.map(word => { /* ... */ });
function filterBadWords(text) { /* ... */ }

// Cookie utilities (unchanged)
function setCookie(name, value, days) { /* ... */ }
function getCookie(name) { /* ... */ }

// Notification (unchanged)
function showNotification(message) { /* ... */ }

// ——— Role detection & Admin‑UI injection ◀◀ NEW ———
function loadUserRole(username) {
    get(ref(database, `roles/${username}`)).then(snap => {
        if (snap.exists()) currentUserRole = snap.val();
        if (currentUserRole === 'admin') {
            // inject Admin controls if not already present
            if (!document.getElementById('admin-controls')) {
                const ctrl = document.createElement('div');
                ctrl.id = 'admin-controls';
                ctrl.style.display = 'flex';
                ctrl.style.alignItems = 'center';
                ctrl.style.marginLeft = '20px';
                ctrl.innerHTML = `
                  <input id="coord-input" placeholder="Username to coord" 
                         style="padding:4px;border:1px solid #ccc;border-radius:4px;margin-right:4px;">
                  <button class="auth-btn signup-btn" onclick="appointCoordinator()">Make Coordinator</button>
                `;
                document.querySelector('.chat-header').appendChild(ctrl);
            }
        }
    });
}

// Message functions
function sendMessage() {
    const user = localStorage.getItem('yoshibook_user') || null;
    const id    = user || anonId;                           // ◀◀ NEW: use anonId if no user
    if (bannedUsers.includes(id)) {
        alert('You have been banned!');
        return;
    }

    const messageInput = document.getElementById('message-input');
    const messageText = messageInput.value.trim();
    if (!messageText) return;

    const filteredMessage = filterBadWords(messageText);
    const messageData = {
        senderId:    id,                                    // ◀◀ NEW
        displayName: user || 'Anonymous',
        messageText: filteredMessage,
        timestamp:   new Date().toLocaleTimeString(),
        createdAt:   Date.now()
    };

    push(ref(database, 'messages'), messageData)
      .then(() => { messageInput.value = ''; })
      .catch(handleFirebaseError);
}

function deleteMessage(messageKey, messageElement) {
    remove(ref(database, `messages/${messageKey}`))
      .then(() => messageElement.remove())
      .catch(handleFirebaseError);
}

function banUser(id) {
    if (!bannedUsers.includes(id)) {
        bannedUsers.push(id);
        setCookie('bannedUsers', JSON.stringify(bannedUsers), 7);
        alert('That user has been banned.');
    }
}

function appointCoordinator() {
    const target = document.getElementById('coord-input').value.trim();
    if (!target) return;
    set(ref(database, `roles/${target}`), 'coordinator')
      .then(() => alert(`${target} is now a coordinator.`))
      .catch(handleFirebaseError);
}

function loadMessages() {
    if (messagesLoaded) return;
    messagesLoaded = true;
    const chat = document.getElementById('chat-messages');
    chat.innerHTML = '';
    onChildAdded(ref(database, 'messages'), snap => displayMessage(snap.val(), snap.key));
}

function displayMessage(msg, key) {
    const me      = localStorage.getItem('yoshibook_user') || null;
    const idMe    = me || anonId;
    const isAdmin = currentUserRole === 'admin';
    const isCoord = currentUserRole === 'coordinator';
    const canDelete = isAdmin 
                   || (isCoord && ![ 'admin','coordinator' ].includes(msg.displayName));
    const canBan    = (isAdmin || isCoord) && msg.senderId !== idMe;

    const el = document.createElement('div');
    const mine = msg.senderId === idMe;
    el.classList.add('message', mine ? 'user' : 'other');
    el.innerHTML = `
      <span class="username">${escapeHtml(msg.displayName)}:</span>
      <div class="message-text">${escapeHtml(msg.messageText)}</div>
      <span class="timestamp">${msg.timestamp}</span>`;

    if (canDelete) {
        const b = document.createElement('button');
        b.className = 'delete-btn'; b.innerText = '×';
        b.onclick = () => deleteMessage(key, el);
        el.appendChild(b);
    }
    if (canBan) {
        const b2 = document.createElement('button');
        b2.innerText = 'Ban'; b2.style.marginLeft = '5px';
        b2.onclick = () => banUser(msg.senderId);
        el.appendChild(b2);
    }

    document.getElementById('chat-messages').appendChild(el);
    el.parentNode.scrollTop = el.parentNode.scrollHeight;
}

// Auth functions (unchanged, with loadUserRole on login)
function showLoginModal() { /* ... */ }
function showSignupModal() { /* ... */ }
function handleLogin(e) {
    e.preventDefault();
    const u = document.getElementById('loginUsername').value.trim();
    const p = document.getElementById('loginPassword').value;
    get(ref(database, `usedDisplayNames/${u}`)).then(snap => {
        if (snap.exists() && snap.val()===p) {
            setCookie('yoshibook_user', u, 7);
            localStorage.setItem('yoshibook_user', u);
            document.getElementById('loginModal').style.display='none';
            updateAuthDisplay(); updateMessagePositions();
            loadUserRole(u);                           // ◀◀ NEW: load role immediately
        } else alert('Invalid username or password');
    }).catch(handleFirebaseError);
}
function handleSignup(e) { /* ... */ }
function logout() { /* ... */ }
function updateAuthDisplay() { /* ... */ }
function handleKeyDown(e) { if(e.key==='Enter') sendMessage(); }
function handleFirebaseError(err) { /* ... */ }
function escapeHtml(u) { /* ... */ }
function updateMessagePositions() { /* ... */ }

// Export to window
Object.assign(window, {
  showLoginModal, showSignupModal,
  handleLogin, handleSignup, logout,
  sendMessage, deleteMessage, handleKeyDown,
  appointCoordinator
});

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    const c = getCookie('yoshibook_user');
    if (c) localStorage.setItem('yoshibook_user', c);
    updateAuthDisplay();
    loadMessages();
    const me = localStorage.getItem('yoshibook_user');
    if (me) loadUserRole(me);
    window.onclick = e => { if (e.target.className==='modal') e.target.style.display='none'; };
});
