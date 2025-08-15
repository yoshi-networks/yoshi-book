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

// Firebase config (same as login.js)
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

// Initialize
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

let messagesLoaded = false;

// BAD WORDS LIST (kept as requested). Note: storing slurs in code can be sensitive.
const BAD_WORDS = [
    'fuck', 'shit', 'ass', 'bitch', 'dick', 'pussy', 'cock', 'cunt', 'bastard',
    'damn', 'hell', 'piss', 'whore', 'slut', 'retard', 'nigger', 'faggot'
];

// filterBadWords: preserve case and match whole words only
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

// escapeHtml defensive
function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Cookies utilities (kept but improved)
function setCookie(name, value, days) {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    // add SameSite and Secure where appropriate
    let cookieStr = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
    if (location.protocol === 'https:') cookieStr += ';Secure';
    document.cookie = cookieStr;
}

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i].trim();
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

// Show small ephemeral notification (top-right)
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

// Confirmation dialog for destructive actions (delete)
function showConfirm(message, onConfirm, onCancel) {
    // create confirm node
    const confirmBox = document.createElement('div');
    confirmBox.className = 'notification';
    confirmBox.setAttribute('role', 'alertdialog');
    confirmBox.setAttribute('aria-modal', 'true');

    const text = document.createElement('div');
    text.textContent = message;

    const buttons = document.createElement('div');
    buttons.style.display = 'flex';
    buttons.style.gap = '8px';
    buttons.style.marginTop = '12px';
    const ok = document.createElement('button');
    ok.textContent = 'Delete';
    ok.style.backgroundColor = '#f44336';
    ok.style.color = '#fff';
    ok.onclick = () => {
        onConfirm && onConfirm();
        confirmBox.remove();
    };
    const cancel = document.createElement('button');
    cancel.textContent = 'Cancel';
    cancel.onclick = () => {
        onCancel && onCancel();
        confirmBox.remove();
    };
    buttons.appendChild(ok);
    buttons.appendChild(cancel);
    confirmBox.appendChild(text);
    confirmBox.appendChild(buttons);

    document.body.appendChild(confirmBox);
}

// Send message
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
        .then(() => {
            messageInput.value = '';
        })
        .catch(handleFirebaseError);
}

// delete message with confirmation and permission check
function deleteMessage(messageKey, messageElement) {
    const user = localStorage.getItem('yoshibook_user') || null;
    if (!user) {
        showNotification('You must be logged in to delete messages.');
        return;
    }

    const usernameEl = messageElement.querySelector('.username');
    const messageUser = usernameEl ? usernameEl.textContent.split(':')[0].trim() : null;

    if (messageUser === user) {
        showConfirm('Delete this message?', () => {
            // confirm
            const messageRef = ref(database, `messages/${messageKey}`);
            remove(messageRef)
                .then(() => {
                    messageElement.remove();
                    showNotification('Message deleted');
                })
                .catch(handleFirebaseError);
        }, () => {
            // canceled
        });
    } else {
        showNotification('You can only delete your own messages');
    }
}

// Display message
function displayMessage(messageData = {}, messageKey) {
    // Defensive defaults
    const displayName = messageData.displayName || 'Anonymous';
    const messageText = messageData.messageText || '';
    const timestamp = messageData.timestamp || (messageData.createdAt ? new Date(messageData.createdAt).toLocaleTimeString() : '');

    const currentUser = localStorage.getItem('yoshibook_user');
    const isCurrentUser = displayName === currentUser;

    const messageElement = document.createElement('div');
    messageElement.classList.add('message', isCurrentUser ? 'user' : 'other');

    // Add username and text
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

// load messages (use query limitToLast to avoid loading entire DB)
function loadMessages() {
    if (messagesLoaded) return;
    messagesLoaded = true;

    // load the most recent 100 messages by default
    const messagesRefQuery = query(ref(database, 'messages'), limitToLast(100));
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) chatMessages.innerHTML = '';

    onChildAdded(messagesRefQuery, (snapshot) => {
        const messageData = snapshot.val();
        displayMessage(messageData, snapshot.key);
    });
}

// Authentication UI helpers
function showLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');
        const input = document.getElementById('loginUsername');
        if (input) input.focus();
    }
}

function showSignupModal() {
    const modal = document.getElementById('signupModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');
        const input = document.getElementById('signupUsername');
        if (input) input.focus();
    }
}

// We use SHA-256 hashing on the client for stored passwords (improvement over plaintext)
// NOTE: client-side hashing is not a replacement for server-side auth. Migrate to Firebase Auth ASAP.
async function hashPassword(password) {
    const enc = new TextEncoder();
    const data = enc.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

// login handler for modal login (works with login.html handler pattern too)
async function handleLogin(event) {
    if (event && event.preventDefault) event.preventDefault();

    const username = (document.getElementById('loginUsername')?.value || '').trim();
    const password = (document.getElementById('loginPassword')?.value || '');

    if (!username || !password) {
        alert('Please enter username and password');
        return;
    }

    try {
        const userRef = ref(database, 'usedDisplayNames');
        const snap = await get(userRef);
        const userMap = snap.exists() ? snap.val() : {};

        // If username doesn't exist
        if (!userMap[username]) {
            alert('Invalid username or password');
            return;
        }

        const hashed = await hashPassword(password);
        if (userMap[username] === hashed) {
            setCookie('yoshibook_user', username, 7);
            localStorage.setItem('yoshibook_user', username);
            const modal = document.getElementById('loginModal');
            if (modal) { modal.style.display = 'none'; modal.setAttribute('aria-hidden', 'true'); }
            updateAuthDisplay();
            updateMessagePositions();
            showNotification('Logged in');
        } else {
            alert('Invalid username or password');
        }
    } catch (err) {
        handleFirebaseError(err);
    }
}

// signup handler (from modal)
async function handleSignup(event) {
    if (event && event.preventDefault) event.preventDefault();

    const username = (document.getElementById('signupUsername')?.value || '').trim();
    const password = (document.getElementById('signupPassword')?.value || '');

    if (!username || !password) {
        alert('Please enter a username and password');
        return;
    }

    if (!/^[a-zA-Z0-9]+$/.test(username)) {
        alert('Username can only contain letters and numbers');
        return;
    }

    try {
        const userRef = ref(database, 'usedDisplayNames');
        const snap = await get(userRef);
        const existing = snap.exists() ? snap.val() : {};

        // case-insensitive unique check
        const normalizedRequested = username.toLowerCase();
        const existingNormalized = Object.keys(existing).map(k => k.toLowerCase());
        if (existingNormalized.includes(normalizedRequested)) {
            alert('Username already taken');
            return;
        }

        const hashed = await hashPassword(password);
        await set(ref(database, `usedDisplayNames/${username}`), hashed);

        localStorage.setItem('yoshibook_user', username);
        const modal = document.getElementById('signupModal');
        if (modal) { modal.style.display = 'none'; modal.setAttribute('aria-hidden', 'true'); }
        updateAuthDisplay();
        showNotification('Account created and logged in');
    } catch (err) {
        handleFirebaseError(err);
    }
}

// logout
function logout() {
    localStorage.removeItem('yoshibook_user');
    // expire cookie
    document.cookie = 'yoshibook_user=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    updateAuthDisplay();
    updateMessagePositions();
    showNotification('Logged out');
}

// update UI auth area
function updateAuthDisplay() {
    const user = localStorage.getItem('yoshibook_user');
    const authButtons = document.querySelector('.auth-buttons');
    if (!authButtons) return;

    if (user) {
        authButtons.innerHTML = `
            <span class="user-display" style="color:white;margin-right:10px;font-weight:500;">Welcome, ${escapeHtml(user)}</span>
            <button class="auth-btn login-btn" id="logoutBtn">Logout</button>
        `;
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) logoutBtn.addEventListener('click', logout);
    } else {
        authButtons.innerHTML = `
            <button class="auth-btn login-btn" id="loginBtnHeader">Login</button>
            <button class="auth-btn signup-btn" id="signupBtnHeader">Sign Up</button>
        `;
        document.getElementById('loginBtnHeader')?.addEventListener('click', showLoginModal);
        document.getElementById('signupBtnHeader')?.addEventListener('click', showSignupModal);
    }

    // Ensure messages are loaded once user info changes
    loadMessages();
}

// update message bubble positions (user vs other)
function updateMessagePositions() {
    const currentUser = localStorage.getItem('yoshibook_user');
    const messages = document.querySelectorAll('.message');
    messages.forEach(message => {
        const username = message.querySelector('.username')?.textContent.split(':')[0].trim() || '';
        message.classList.remove('user', 'other');
        if (username === currentUser) message.classList.add('user'); else message.classList.add('other');
    });
}

// Keydown handler for the message input (Enter handled by form submit)
function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

// basic firebase error handler
function handleFirebaseError(error) {
    console.error('Firebase error:', error);
    alert('A network or server error occurred. Please try again later.');
}

// Export functions to global scope for the HTML to call
const exportedFunctions = {
    showLoginModal,
    showSignupModal,
    handleLogin,
    handleSignup,
    logout,
    sendMessage,
    deleteMessage,
    handleKeyDown
};
Object.assign(window, exportedFunctions);

// Initialization on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    const cookieUser = getCookie('yoshibook_user');
    if (cookieUser) localStorage.setItem('yoshibook_user', cookieUser);
    updateAuthDisplay();
    loadMessages();

    // Attach keyboard shortcut for input if needed
    const messageInput = document.getElementById('message-input');
    if (messageInput) messageInput.addEventListener('keydown', handleKeyDown);

    // Close modals when clicking outside — handled in HTML page script as well
});

// PRUNING logic: runs rarely, only checks recent messages (limit 500) and runs every 5 minutes.
// IMPORTANT: For a production system move pruning and heavy-lifting to server-side/cloud functions.
const PRUNE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

async function pruneRepeatingMessages() {
    try {
        const messagesRefQuery = query(ref(database, 'messages'), orderByChild('createdAt'), limitToLast(500));
        const snap = await get(messagesRefQuery);
        if (!snap.exists()) return;

        const all = snap.val();
        const groups = {};

        Object.entries(all).forEach(([key, msg]) => {
            // Use the message text normalized to reduce near-duplicates; trim extra spaces.
            const text = (msg.messageText || '').trim();
            if (!groups[text]) groups[text] = [];
            const createdAt = msg.createdAt || Date.now();
            groups[text].push({ key, createdAt });
        });

        Object.values(groups).forEach(arr => {
            if (arr.length > 3) {
                arr.sort((a, b) => a.createdAt - b.createdAt);
                arr.slice(3).forEach(({ key }) => {
                    remove(ref(database, `messages/${key}`)).catch(err => console.error('Prune remove error', err));
                });
            }
        });
    } catch (e) {
        console.error('Error pruning repeating messages:', e);
    }
}

// start pruning at interval (safe: doesn't read whole DB)
pruneRepeatingMessages();
setInterval(pruneRepeatingMessages, PRUNE_INTERVAL_MS);
