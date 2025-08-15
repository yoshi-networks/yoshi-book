// script.js (module)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import {
    getDatabase,
    ref,
    onChildAdded,
    push,
    remove,
    get,
    set,
    serverTimestamp,
    query,
    limitToLast,
    orderByChild
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";

// Firebase config (same as other files)
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

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

let messagesLoaded = false;

/* ---------------------------
   Moderation / filtering
   --------------------------- */

const BAD_WORDS = [
    'fuck', 'shit', 'ass', 'bitch', 'dick', 'pussy', 'cock', 'cunt', 'bastard',
    'damn', 'hell', 'piss', 'whore', 'slut', 'retard', 'nigger', 'faggot'
];

function filterBadWords(text) {
    if (text === null || text === undefined) return '';
    let filtered = text;
    BAD_WORDS.forEach(word => {
        const safeWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${safeWord}\\b`, 'gi');
        filtered = filtered.replace(regex, (match) => '*'.repeat(match.length));
    });
    return filtered;
}

function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* ---------------------------
   Cookies + notifications
   --------------------------- */
function setCookie(name, value, days) {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    let cookieStr = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
    if (location.protocol === 'https:') cookieStr += ';Secure';
    document.cookie = cookieStr;
}
function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i=0;i<ca.length;i++){
        let c = ca[i].trim();
        if (c.indexOf(nameEQ)===0) return c.substring(nameEQ.length,c.length);
    }
    return null;
}
function showNotification(message, duration = 2200) {
    const container = document.getElementById('globalNotification');
    if (!container) return;
    container.textContent = message;
    container.classList.add('show');
    container.style.display = 'block';
    setTimeout(() => {
        container.classList.remove('show');
        setTimeout(() => container.style.display = 'none', 220);
    }, duration);
}

/* ---------------------------
   Message send / display
   --------------------------- */
function sendMessage() {
    const messageInput = document.getElementById('message-input');
    if (!messageInput) return;
    const raw = messageInput.value.trim();
    if (!raw) return;

    const filteredMessage = filterBadWords(raw);
    const user = localStorage.getItem('yoshibook_user') || 'Anonymous';

    const messageData = {
        displayName: user,
        messageText: filteredMessage,
        timestamp: new Date().toLocaleTimeString(),
        isUser: user !== 'Anonymous',
        createdAt: serverTimestamp()
    };

    const messagesRef = ref(database, 'messages');
    push(messagesRef, messageData)
        .then(() => { messageInput.value = ''; })
        .catch(handleFirebaseError);
}

async function deleteMessage(messageKey, messageElement) {
    const user = localStorage.getItem('yoshibook_user') || null;
    if (!user) { showNotification('Log in to delete messages'); return; }
    const usernameEl = messageElement.querySelector('.username');
    const messageUser = usernameEl ? usernameEl.textContent.split(':')[0].trim() : null;
    if (messageUser === user) {
        const messageRef = ref(database, `messages/${messageKey}`);
        try {
            await remove(messageRef);
            messageElement.remove();
            showNotification('Message deleted');
        } catch (err) {
            handleFirebaseError(err);
        }
    } else {
        showNotification('You can only delete your own messages');
    }
}

function displayMessage(messageData = {}, messageKey) {
    const displayName = messageData.displayName || 'Anonymous';
    const messageText = messageData.messageText || '';
    const timestamp = messageData.timestamp || '';

    const currentUser = localStorage.getItem('yoshibook_user');
    const isCurrentUser = displayName === currentUser;

    const messageElement = document.createElement('div');
    messageElement.classList.add('message', isCurrentUser ? 'user' : 'other');

    const usernameSpan = document.createElement('span');
    usernameSpan.className = 'username';
    usernameSpan.textContent = `${escapeHtml(displayName)}:`;

    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';
    textDiv.innerHTML = escapeHtml(messageText);

    const timeSpan = document.createElement('span');
    timeSpan.className = 'timestamp';
    timeSpan.textContent = timestamp;

    messageElement.appendChild(usernameSpan);
    messageElement.appendChild(textDiv);
    messageElement.appendChild(timeSpan);

    if (isCurrentUser && currentUser !== 'Anonymous') {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerText = '×';
        deleteBtn.title = 'Delete message';
        deleteBtn.onclick = () => deleteMessage(messageKey, messageElement);
        messageElement.appendChild(deleteBtn);
    }

    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

/* ---------------------------
   Load messages (limited)
   --------------------------- */
function loadMessages() {
    if (messagesLoaded) return;
    messagesLoaded = true;

    const messagesRefQuery = query(ref(database, 'messages'), limitToLast(100));
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) chatMessages.innerHTML = '';

    onChildAdded(messagesRefQuery, (snapshot) => {
        const messageData = snapshot.val();
        displayMessage(messageData, snapshot.key);
    });
}

/* ---------------------------
   Auth / UI helpers
   --------------------------- */
function showLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) { modal.style.display = 'flex'; modal.setAttribute('aria-hidden', 'false'); document.getElementById('loginUsername')?.focus(); }
}
function showSignupModal() {
    const modal = document.getElementById('signupModal');
    if (modal) { modal.style.display = 'flex'; modal.setAttribute('aria-hidden', 'false'); document.getElementById('signupUsername')?.focus(); }
}

async function hashPassword(password) {
    const enc = new TextEncoder();
    const data = enc.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2,'0')).join('');
}

async function handleLogin(event) {
    if (event && event.preventDefault) event.preventDefault();
    const username = (document.getElementById('loginUsername')?.value || '').trim();
    const password = (document.getElementById('loginPassword')?.value || '');
    if (!username || !password) { alert('Please enter username and password'); return; }
    try {
        const userRef = ref(database, 'usedDisplayNames');
        const snap = await get(userRef);
        const userMap = snap.exists() ? snap.val() : {};
        if (!userMap[username]) { alert('Invalid username or password'); return; }
        const hashed = await hashPassword(password);
        if (userMap[username] === hashed) {
            setCookie('yoshibook_user', username, 7);
            localStorage.setItem('yoshibook_user', username);
            const modal = document.getElementById('loginModal'); if (modal){ modal.style.display='none'; modal.setAttribute('aria-hidden','true'); }
            updateAuthDisplay(); updateMessagePositions(); showNotification('Logged in');
        } else alert('Invalid username or password');
    } catch (err) { handleFirebaseError(err); }
}

async function handleSignup(event) {
    if (event && event.preventDefault) event.preventDefault();
    const username = (document.getElementById('signupUsername')?.value || '').trim();
    const password = (document.getElementById('signupPassword')?.value || '');
    if (!username || !password) { alert('Please enter a username and password'); return; }
    if (!/^[a-zA-Z0-9]+$/.test(username)) { alert('Username can only contain letters and numbers'); return; }
    try {
        const userRef = ref(database, 'usedDisplayNames');
        const snap = await get(userRef);
        const existing = snap.exists() ? snap.val() : {};
        const normalizedRequested = username.toLowerCase();
        const existingNormalized = Object.keys(existing).map(k => k.toLowerCase());
        if (existingNormalized.includes(normalizedRequested)) { alert('Username already taken'); return; }
        const hashed = await hashPassword(password);
        await set(ref(database, `usedDisplayNames/${username}`), hashed);
        localStorage.setItem('yoshibook_user', username);
        const modal = document.getElementById('signupModal'); if (modal){ modal.style.display='none'; modal.setAttribute('aria-hidden','true'); }
        updateAuthDisplay(); showNotification('Account created and logged in');
    } catch (err) { handleFirebaseError(err); }
}

function logout() {
    localStorage.removeItem('yoshibook_user');
    document.cookie = 'yoshibook_user=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    updateAuthDisplay(); updateMessagePositions(); showNotification('Logged out');
}

function updateAuthDisplay() {
    const user = localStorage.getItem('yoshibook_user');
    const authButtons = document.querySelector('.auth-buttons');
    if (!authButtons) return;
    if (user) {
        authButtons.innerHTML = `<span class="user-display" style="color:white;margin-right:10px;font-weight:500;">Welcome, ${escapeHtml(user)}</span>
            <button class="auth-btn login-btn" id="logoutBtn">Logout</button>`;
        document.getElementById('logoutBtn')?.addEventListener('click', logout);
    } else {
        authButtons.innerHTML = `<button class="auth-btn login-btn" id="loginBtnHeader">Login</button>
            <button class="auth-btn signup-btn" id="signupBtnHeader">Sign Up</button>`;
        document.getElementById('loginBtnHeader')?.addEventListener('click', showLoginModal);
        document.getElementById('signupBtnHeader')?.addEventListener('click', showSignupModal);
    }
    loadMessages();
}

function updateMessagePositions() {
    const currentUser = localStorage.getItem('yoshibook_user');
    const messages = document.querySelectorAll('.message');
    messages.forEach(message => {
        const username = message.querySelector('.username')?.textContent.split(':')[0].trim() || '';
        message.classList.remove('user','other');
        if (username === currentUser) message.classList.add('user'); else message.classList.add('other');
    });
}

function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

function handleFirebaseError(error) {
    console.error('Firebase error:', error);
    alert('A network or server error occurred. Please try again later.');
}

/* ---------------------------
   GLOBAL DUPLICATE PRUNING
   Runs a full scan and deletes every message beyond the first 3
   for each normalized message text. This operation reads the
   entire "messages" node, which can be costly for large datasets.
   Use with caution; ideally move to server-side Cloud Function.
   --------------------------- */

async function pruneAllDuplicates() {
    try {
        const messagesRef = ref(database, 'messages');
        const snap = await get(messagesRef);
        if (!snap.exists()) return;

        const all = snap.val();
        // Group by normalized text (trim & lowercase). Use exact normalized text equality to detect duplicates.
        const groups = {}; // { normalizedText: [{ key, createdAt }] }
        Object.entries(all).forEach(([key, msg]) => {
            const rawText = (msg && msg.messageText) ? String(msg.messageText).trim() : '';
            const normalized = rawText.toLowerCase();
            if (!groups[normalized]) groups[normalized] = [];
            // prefer createdAt numeric; fallback to Date.now()
            const createdAt = (msg && msg.createdAt && typeof msg.createdAt === 'number') ? msg.createdAt : (msg && msg.createdAt && msg.createdAt['.sv'] ? Date.now() : (msg && msg.createdAt) || Date.now());
            groups[normalized].push({ key, createdAt });
        });

        // For each group, if > 3 messages, delete everything after the third oldest
        const deletions = [];
        Object.values(groups).forEach(arr => {
            if (arr.length > 3) {
                arr.sort((a,b) => a.createdAt - b.createdAt);
                const extras = arr.slice(3);
                extras.forEach(item => {
                    deletions.push(item.key);
                });
            }
        });

        // Execute removals
        if (deletions.length > 0) {
            console.log('Pruning duplicate messages, total deletes:', deletions.length);
            // Remove sequentially to avoid flooding
            for (const key of deletions) {
                try {
                    await remove(ref(database, `messages/${key}`));
                } catch (err) {
                    console.error('Error deleting message', key, err);
                }
            }
            showNotification(`Cleaned ${deletions.length} duplicate messages.`);
        }
    } catch (err) {
        console.error('Error pruning duplicates:', err);
    }
}

/* Run pruning immediately on load and then every minute.
   WARNING: full DB read — for large apps move this server-side. */
const PRUNE_INTERVAL_MS = 60 * 1000; // 60 seconds
pruneAllDuplicates();
setInterval(pruneAllDuplicates, PRUNE_INTERVAL_MS);

/* ---------------------------
   Expose functions to window and initialize
   --------------------------- */

const exported = {
    showLoginModal,
    showSignupModal,
    handleLogin,
    handleSignup,
    logout,
    sendMessage,
    deleteMessage,
    handleKeyDown
};
Object.assign(window, exported);

document.addEventListener('DOMContentLoaded', () => {
    const cookieUser = getCookie('yoshibook_user');
    if (cookieUser) localStorage.setItem('yoshibook_user', cookieUser);
    updateAuthDisplay();
    loadMessages();

    const messageInput = document.getElementById('message-input');
    if (messageInput) messageInput.addEventListener('keydown', handleKeyDown);
});
