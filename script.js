// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, onChildAdded, push, remove, get, set } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";

// Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyCdnPP1xNfe13SuDNuaP2rOL6_WcbPN8cI",
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
let currentUserRole = 'user';    // track role: 'user' | 'coordinator' | 'admin'
let bannedUsers = [];            // in-memory ban list

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

// ——— Advanced bad‑word filtering ———
const BAD_WORDS = [
  'fuck', 'shit', 'ass', 'bitch', 'dick', 'pussy', 'cock', 'cunt', 'bastard',
  'damn', 'hell', 'piss', 'whore', 'slut', 'retard', 'nigger', 'faggot', 'kai'
];
function escapeRegex(str) {
  return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}
const BAD_WORD_REGEXPS = BAD_WORDS.map(word => {
  const chars = Array.from(word).map(ch => escapeRegex(ch));
  const pattern = chars.join('[^A-Za-z0-9]*');
  return new RegExp(pattern, 'gi');
});
function filterBadWords(text) {
  return BAD_WORD_REGEXPS.reduce((txt, re) => {
    return txt.replace(re, match => match.replace(/[A-Za-z0-9]/g, '*'));
  }, text);
}

// Cookie utilities
function setCookie(name, value, days) {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 864e5);
    document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/`;
}
function getCookie(name) {
    const v = document.cookie.split('; ').find(row => row.startsWith(name + '='));
    return v ? decodeURIComponent(v.split('=')[1]) : null;
}

// Notification
function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 100);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

// ——— Role detection & Admin‑UI injection ———
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
    const id    = user || anonId;  
    if (bannedUsers.includes(id)) {
        alert('You have been banned!');
        return;
    }

    const messageInput = document.getElementById('message-input');
    const messageText = messageInput.value.trim();
    if (!messageText) return;

    const filteredMessage = filterBadWords(messageText);
    const messageData = {
        senderId:    id,
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
                   || (isCoord && !['admin','coordinator'].includes(msg.displayName));
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

// Auth functions
function showLoginModal() { document.getElementById('loginModal').style.display = 'flex'; }
function showSignupModal() { document.getElementById('signupModal').style.display = 'flex'; }

function handleLogin(event) {
    event.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    get(ref(database, `usedDisplayNames/${username}`)).then(snapshot => {
        if (snapshot.exists() && snapshot.val() === password) {
            setCookie('yoshibook_user', username, 7);
            localStorage.setItem('yoshibook_user', username);
            document.getElementById('loginModal').style.display = 'none';
            updateAuthDisplay();
            updateMessagePositions();
            loadUserRole(username);               // ◀◀ NEW: now load and inject Admin UI
        } else alert('Invalid username or password');
    }).catch(handleFirebaseError);
}

function handleSignup(event) {
    event.preventDefault();
    const username = document.getElementById('signupUsername').value.trim();
    const password = document.getElementById('signupPassword').value;
    if (!/^[a-zA-Z0-9]+$/.test(username)) {
        alert('Username can only contain letters and numbers'); return;
    }
    get(ref(database, 'usedDisplayNames')).then(snapshot => {
        const existing = snapshot.val() || {};
        if (Object.keys(existing).map(n=>n.toLowerCase()).includes(username.toLowerCase())) {
            alert('Username already taken'); return;
        }
        set(ref(database, `usedDisplayNames/${username}`), password)
          .then(() => {
              localStorage.setItem('yoshibook_user', username);
              document.getElementById('signupModal').style.display = 'none';
              updateAuthDisplay();
              loadUserRole(username);           // ◀◀ NEW here too
          })
          .catch(handleFirebaseError);
    }).catch(handleFirebaseError);
}

function logout() {
    localStorage.removeItem('yoshibook_user');
    document.cookie = 'yoshibook_user=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    updateAuthDisplay();
    updateMessagePositions();
}

function updateAuthDisplay() {
    const user = localStorage.getItem('yoshibook_user');
    const authButtons = document.querySelector('.auth-buttons');
    if (user) {
        authButtons.innerHTML = `
            <span class="user-display">Welcome, ${user}</span>
            <button class="auth-btn login-btn" onclick="logout()">Logout</button>
        `;
    } else {
        authButtons.innerHTML = `
            <button class="auth-btn login-btn" onclick="showLoginModal()">Login</button>
            <button class="auth-btn signup-btn" onclick="showSignupModal()">Sign Up</button>
        `;
    }
    loadMessages();
}

function handleKeyDown(event) { if (event.key === 'Enter') sendMessage(); }
function handleFirebaseError(error) { console.error('Firebase error:', error); alert('An error occurred. Please try again later.'); }
function escapeHtml(unsafe) {
    return unsafe.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");
}
function updateMessagePositions() {
    const currentUser = localStorage.getItem('yoshibook_user');
    document.querySelectorAll('.message').forEach(m => {
        const u = m.querySelector('.username').textContent.split(':')[0].trim();
        m.classList.toggle('user',   u === currentUser);
        m.classList.toggle('other',  u !== currentUser);
    });
}

// Expose to window
Object.assign(window, {
  showLoginModal, showSignupModal,
  handleLogin, handleSignup, logout,
  sendMessage, deleteMessage, handleKeyDown,
  appointCoordinator
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    const c = getCookie('yoshibook_user');
    if (c) localStorage.setItem('yoshibook_user', c);
    updateAuthDisplay();
    loadMessages();
    const me = localStorage.getItem('yoshibook_user');
    if (me) loadUserRole(me);
    window.onclick = e => { if (e.target.className === 'modal') e.target.style.display = 'none'; };
});
