// script.js (module) - updated with robust delete handling & debug UI (fixed & complete)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import {
    getDatabase,
    ref,
    onChildAdded,
    onChildRemoved,
    push,
    remove,
    get,
    set,
    serverTimestamp,
    query,
    limitToLast
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";

// Firebase config (same as your project)
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

/* ---------------------------
   Small debug banner (visible)
   --------------------------- */
(function createDebugBanner() {
    if (document.getElementById('yoshibookDebugBanner')) return;
    const b = document.createElement('div');
    b.id = 'yoshibookDebugBanner';
    b.style.position = 'fixed';
    b.style.top = '16px';
    b.style.right = '16px';
    b.style.zIndex = '99999';
    b.style.maxWidth = '320px';
    b.style.padding = '8px 12px';
    b.style.borderRadius = '8px';
    b.style.background = 'rgba(0,0,0,0.75)';
    b.style.color = 'white';
    b.style.fontSize = '13px';
    b.style.display = 'none';
    b.style.boxShadow = '0 6px 18px rgba(0,0,0,0.2)';
    document.body.appendChild(b);
})();
function showDebugBanner(msg, timeout = 8000) {
    const b = document.getElementById('yoshibookDebugBanner');
    if (!b) return;
    b.textContent = msg;
    b.style.display = 'block';
    clearTimeout(b._hideTimeout);
    b._hideTimeout = setTimeout(() => { b.style.display = 'none'; }, timeout);
}
/* ---------------------------
   END debug banner
   --------------------------- */

/* BAD WORDS LIST (unchanged) */
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
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i].trim();
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

function showNotification(message, duration = 2200) {
    // if an element with id 'globalNotification' exists use it, otherwise fallback to alert + debug banner
    const container = document.getElementById('globalNotification');
    if (container) {
        container.textContent = message;
        container.classList.add('show');
        container.style.display = 'block';
        setTimeout(() => {
            container.classList.remove('show');
            setTimeout(() => container.style.display = 'none', 220);
        }, duration);
    } else {
        // small non-blocking fallback
        showDebugBanner(message, duration);
        console.info('Notification:', message);
    }
}

/* Confirm UI */
function showConfirm(message, onConfirm, onCancel) {
    const confirmBox = document.createElement('div');
    confirmBox.className = 'notification';
    confirmBox.setAttribute('role', 'alertdialog');
    confirmBox.setAttribute('aria-modal', 'true');
    confirmBox.style.zIndex = '99998';
    confirmBox.style.position = 'fixed';
    confirmBox.style.left = '50%';
    confirmBox.style.top = '50%';
    confirmBox.style.transform = 'translate(-50%, -50%)';
    confirmBox.style.background = '#fff';
    confirmBox.style.color = '#000';
    confirmBox.style.padding = '16px';
    confirmBox.style.borderRadius = '8px';
    confirmBox.style.boxShadow = '0 8px 30px rgba(0,0,0,0.2)';
    confirmBox.style.minWidth = '260px';
    confirmBox.style.maxWidth = '90%';

    const text = document.createElement('div');
    text.id = 'confirmText';
    text.textContent = message;

    const buttons = document.createElement('div');
    buttons.style.display = 'flex';
    buttons.style.gap = '8px';
    buttons.style.marginTop = '12px';
    buttons.style.justifyContent = 'flex-end';

    const ok = document.createElement('button');
    ok.textContent = 'Delete';
    ok.style.backgroundColor = '#f44336';
    ok.style.color = '#fff';
    ok.style.border = 'none';
    ok.style.padding = '8px 12px';
    ok.style.borderRadius = '6px';
    ok.style.cursor = 'pointer';
    ok.onclick = () => {
        onConfirm && onConfirm();
        confirmBox.remove();
    };

    const cancel = document.createElement('button');
    cancel.textContent = 'Cancel';
    cancel.style.background = '#e0e0e0';
    cancel.style.border = 'none';
    cancel.style.padding = '8px 12px';
    cancel.style.borderRadius = '6px';
    cancel.style.cursor = 'pointer';
    cancel.onclick = () => {
        onCancel && onCancel();
        confirmBox.remove();
    };

    buttons.appendChild(cancel);
    buttons.appendChild(ok);
    confirmBox.appendChild(text);
    confirmBox.appendChild(buttons);
    document.body.appendChild(confirmBox);
    ok.focus();
}

/* ---------------------------
   Main message functions
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
        .then(() => messageInput.value = '')
        .catch(handleFirebaseError);
}

/* Robust deleteMessage with detailed debug & permission guidance */
async function deleteMessage(messageKey, messageElement) {
    const loggedInUser = (localStorage.getItem('yoshibook_user') || getCookie('yoshibook_user') || null);
    if (!loggedInUser) {
        showNotification('You must be logged in to delete messages.');
        console.warn('Delete attempt blocked: no logged-in user found (localStorage/cookie empty).');
        return;
    }

    const eqCI = (a, b) => {
        if (a === null || a === undefined || b === null || b === undefined) return false;
        return String(a).toLowerCase() === String(b).toLowerCase();
    };

    // pick key if present
    let key = messageKey || (messageElement && messageElement.dataset && messageElement.dataset.key) || null;

    console.debug('Attempting delete', { providedKey: messageKey, domKey: messageElement?.dataset?.key, chosenKey: key, loggedInUser });

    // helper to display permission guidance
    function showPermissionHelp(err) {
        const short = 'Delete failed: permission denied. Check your Realtime Database rules (permission-denied).';
        const rulesSnippet = JSON.stringify({
            rules: {
                messages: { ".read": true, ".write": true },
                usedDisplayNames: { ".read": true, ".write": true }
            }
        }, null, 2);
        showDebugBanner(short + ' Click console for details.', 15000);
        console.error('Permission denied when attempting to delete. Example rules to allow deletes (debugging only):\n', rulesSnippet);
        console.error('Original error:', err);
    }

    // Try direct delete by key
    if (key) {
        try {
            const msgRef = ref(database, `messages/${key}`);
            const snap = await get(msgRef);

            if (!snap.exists()) {
                console.warn('Provided key not found in DB:', key);
                // fallback to scanning
            } else {
                const msg = snap.val();
                const owner = msg && msg.displayName ? String(msg.displayName) : '';
                console.debug('Message owner from DB:', owner, 'loggedInUser:', loggedInUser);

                if (!eqCI(owner, loggedInUser)) {
                    showNotification('You can only delete your own messages.');
                    console.warn('Delete blocked: owner mismatch', { owner, loggedInUser });
                    return;
                }

                // Confirm then remove
                showConfirm('Delete this message?', async () => {
                    try {
                        await remove(msgRef);
                        // immediate UI removal for snappy feedback
                        if (messageElement && messageElement.remove) messageElement.remove();
                        showNotification('Message deleted');
                        console.info('Deleted message key:', key);
                    } catch (err) {
                        console.error('Error removing message by key:', key, err);
                        if (err && (err.code === 'PERMISSION_DENIED' || /permission/i.test(err.message || ''))) {
                            showPermissionHelp(err);
                        } else {
                            showDebugBanner('Failed to delete message: ' + (err.message || err), 8000);
                        }
                    }
                }, () => {});
                return;
            }
        } catch (err) {
            console.warn('Error reading message by key; will fallback to scanning', err);
            // fallthrough to fallback scan
        }
    }

    // Fallback scan: match user's own messages that look like the DOM element
    try {
        const elementText = (messageElement?.querySelector('.message-text')?.textContent || '').trim();
        const elementTimestamp = (messageElement?.querySelector('.timestamp')?.textContent || '').trim();
        const elementUsername = (messageElement?.querySelector('.username')?.textContent || '').replace(/:$/, '').trim();

        console.debug('Fallback scan using element content', { elementText, elementTimestamp, elementUsername });

        const allSnap = await get(ref(database, 'messages'));
        if (!allSnap.exists()) {
            showDebugBanner('Message not found on server.', 6000);
            if (messageElement && messageElement.remove) messageElement.remove();
            return;
        }
        const all = allSnap.val();

        const candidates = [];
        Object.entries(all).forEach(([k, msg]) => {
            if (!msg) return;
            const owner = msg.displayName || '';
            const text = (msg.messageText || '').toString();
            const ts = (msg.timestamp || '').toString();

            if (!eqCI(owner, loggedInUser)) return;
            const textMatch = String(text).trim() === String(elementText).trim();
            const tsMatch = elementTimestamp ? String(ts).trim() === String(elementTimestamp).trim() : true;

            if (textMatch && tsMatch) {
                let createdAt = msg && msg.createdAt;
                if (typeof createdAt === 'object' && createdAt !== null) createdAt = Date.now();
                if (typeof createdAt !== 'number') createdAt = Date.now();
                candidates.push({ key: k, createdAt, msg });
            } else if (textMatch) {
                let createdAt = msg && msg.createdAt;
                if (typeof createdAt === 'object' && createdAt !== null) createdAt = Date.now();
                if (typeof createdAt !== 'number') createdAt = Date.now();
                // looser match (no ts)
                candidates.push({ key: k, createdAt, msg, loose: true });
            }
        });

        if (candidates.length === 0) {
            showDebugBanner('Could not identify the message to delete.', 6000);
            console.warn('Fallback scan found no candidates for delete', { loggedInUser, elementText, elementTimestamp });
            return;
        }

        // prefer exact matches and newest ones
        candidates.sort((a, b) => a.createdAt - b.createdAt);
        const chosen = candidates[candidates.length - 1];
        const confirmKey = chosen.key;
        const msgRef2 = ref(database, `messages/${confirmKey}`);

        console.debug('Fallback chosen candidate for delete:', chosen);

        showConfirm('Delete this message?', async () => {
            try {
                await remove(msgRef2);
                if (messageElement && messageElement.remove) messageElement.remove();
                showNotification('Message deleted');
                console.info('Deleted message key (fallback):', confirmKey);
            } catch (err) {
                console.error('Fallback remove failed for key', confirmKey, err);
                if (err && (err.code === 'PERMISSION_DENIED' || /permission/i.test(err.message || ''))) {
                    showPermissionHelp(err);
                } else {
                    showDebugBanner('Failed to delete message: ' + (err.message || err), 8000);
                }
            }
        }, () => {});
    } catch (err) {
        console.error('Fallback scan error while attempting delete:', err);
        showDebugBanner('Unable to delete message right now. See console for details.', 8000);
    }
}

/* Display message and attach delete button when appropriate */
function displayMessage(messageData = {}, messageKey) {
    const displayName = messageData.displayName || 'Anonymous';
    const messageText = messageData.messageText || '';
    const timestamp = messageData.timestamp || (messageData.createdAt ? (typeof messageData.createdAt === 'number' ? new Date(messageData.createdAt).toLocaleTimeString() : '') : '');

    const currentUser = localStorage.getItem('yoshibook_user') || getCookie('yoshibook_user') || '';
    const isCurrentUser = (String(displayName).toLowerCase() === String(currentUser).toLowerCase());

    const messageElement = document.createElement('div');
    messageElement.classList.add('message', isCurrentUser ? 'user' : 'other');

    // attach DB key
    if (messageKey) messageElement.dataset.key = messageKey;

    // ensure container can position delete button
    messageElement.style.position = 'relative';

    const usernameSpan = document.createElement('span');
    usernameSpan.className = 'username';
    usernameSpan.textContent = `${displayName}:`;

    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';
    textDiv.textContent = messageText;

    const timeSpan = document.createElement('span');
    timeSpan.className = 'timestamp';
    timeSpan.textContent = timestamp;

    messageElement.appendChild(usernameSpan);
    messageElement.appendChild(textDiv);
    messageElement.appendChild(timeSpan);

    // add delete button only for owner
    if (isCurrentUser && currentUser !== 'Anonymous') {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerText = '×';
        deleteBtn.title = 'Delete message';
        if (messageKey) deleteBtn.dataset.key = messageKey;

        // style delete button to top-right
        deleteBtn.style.position = 'absolute';
        deleteBtn.style.top = '6px';
        deleteBtn.style.right = '6px';
        deleteBtn.style.border = 'none';
        deleteBtn.style.background = 'transparent';
        deleteBtn.style.fontSize = '18px';
        deleteBtn.style.cursor = 'pointer';
        deleteBtn.style.lineHeight = '1';
        deleteBtn.style.padding = '2px 6px';

        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const kb = deleteBtn.dataset.key || messageKey || messageElement.dataset.key;
            deleteMessage(kb, messageElement);
        });
        messageElement.appendChild(deleteBtn);
    }

    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

/* Remove DOM element when DB child removed */
function handleChildRemoved(snapshot) {
    const key = snapshot.key;
    if (!key) return;
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    const el = chatMessages.querySelector(`[data-key="${key}"]`);
    if (el) el.remove();
}

/* Load messages (limitToLast to avoid huge load) */
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

    // Attach removal listener to the same query so removals correspond to displayed subset
    onChildRemoved(messagesRefQuery, handleChildRemoved);
}

/* Prune duplicates (keeps first 3) - unchanged approach */
const PRUNE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

async function pruneRepeatingMessages() {
    try {
        const messagesRef = ref(database, 'messages');
        const snap = await get(messagesRef);
        if (!snap.exists()) return;

        const all = snap.val();
        const groups = {};

        Object.entries(all).forEach(([key, msg]) => {
            const rawText = (msg && msg.messageText) ? String(msg.messageText) : '';
            const normalized = rawText.replace(/\s+/g, ' ').trim().toLowerCase();
            if (!normalized) return;
            if (!groups[normalized]) groups[normalized] = [];
            let createdAt = msg && msg.createdAt;
            if (typeof createdAt === 'object' && createdAt !== null) createdAt = Date.now();
            if (typeof createdAt !== 'number') createdAt = Date.now();
            groups[normalized].push({ key, createdAt });
        });

        for (const normalizedText in groups) {
            const arr = groups[normalizedText];
            if (arr.length > 3) {
                arr.sort((a, b) => a.createdAt - b.createdAt);
                const toDelete = arr.slice(3);
                for (const item of toDelete) {
                    try {
                        await remove(ref(database, `messages/${item.key}`));
                    } catch (err) {
                        console.error('Prune: failed to remove', item.key, err);
                    }
                }
            }
        }
    } catch (e) {
        console.error('Error pruning repeating messages:', e);
    }
}

pruneRepeatingMessages();
setInterval(pruneRepeatingMessages, PRUNE_INTERVAL_MS);

/* Auth helpers (login/signup use plaintext as requested) */
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

async function handleLogin(event) {
    if (event && event.preventDefault) event.preventDefault();

    const username = (document.getElementById('loginUsername')?.value || '').trim();
    const password = (document.getElementById('loginPassword')?.value || '');

    if (!username || !password) { alert('Please enter username and password'); return; }

    try {
        const userRef = ref(database, 'usedDisplayNames');
        const snap = await get(userRef);
        const userMap = snap.exists() ? snap.val() : {};

        // case-insensitive lookup — find the exact stored key (preserves original case)
        const storedKey = Object.keys(userMap || {}).find(k => k.toLowerCase() === username.toLowerCase());
        if (!storedKey) { alert('Invalid username or password'); return; }

        const stored = userMap[storedKey];
        if (stored === password) {
            // use the storedKey (original case) for session
            setCookie('yoshibook_user', storedKey, 7);
            localStorage.setItem('yoshibook_user', storedKey);
            const modal = document.getElementById('loginModal');
            if (modal) { modal.style.display = 'none'; modal.setAttribute('aria-hidden', 'true'); }
            updateAuthDisplay();
            updateMessagePositions();
            showNotification('Logged in');
            return;
        }
        alert('Invalid username or password');
    } catch (err) {
        handleFirebaseError(err);
    }
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
        await set(ref(database, `usedDisplayNames/${username}`), password);
        localStorage.setItem('yoshibook_user', username);
        const modal = document.getElementById('signupModal');
        if (modal) { modal.style.display = 'none'; modal.setAttribute('aria-hidden', 'true'); }
        updateAuthDisplay();
        showNotification('Account created and logged in');
    } catch (err) {
        handleFirebaseError(err);
    }
}

function logout() {
    localStorage.removeItem('yoshibook_user');
    document.cookie = 'yoshibook_user=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    updateAuthDisplay();
    updateMessagePositions();
    showNotification('Logged out');
}

function updateAuthDisplay() {
    const user = localStorage.getItem('yoshibook_user');
    const authButtons = document.querySelector('.auth-buttons');
    if (!authButtons) return;
    if (user) {
        authButtons.innerHTML = `
            <span class="user-display" style="color:white;margin-right:10px;font-weight:500;">Welcome, ${escapeHtml(user)}</span>
            <button class="auth-btn login-btn" id="logoutBtn">Logout</button>
        `;
        document.getElementById('logoutBtn')?.addEventListener('click', logout);
    } else {
        authButtons.innerHTML = `
            <button class="auth-btn login-btn" id="loginBtnHeader">Login</button>
            <button class="auth-btn signup-btn" id="signupBtnHeader">Sign Up</button>
        `;
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
        message.classList.remove('user', 'other');
        if (username.toLowerCase() === (currentUser || '').toLowerCase()) message.classList.add('user'); else message.classList.add('other');
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
    if (error && (error.code === 'PERMISSION_DENIED' || /permission/i.test(error.message || ''))) {
        showDebugBanner('Firebase permission error. See console for details and suggested rules.', 12000);
    } else {
        showDebugBanner('A network or server error occurred. Check console for details.', 5000);
    }
    alert('A network or server error occurred. Please try again later.');
}

/* Expose functions to window for inline HTML use */
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

document.addEventListener('DOMContentLoaded', () => {
    const cookieUser = getCookie('yoshibook_user');
    if (cookieUser) localStorage.setItem('yoshibook_user', cookieUser);
    updateAuthDisplay();
    loadMessages();
    const messageInput = document.getElementById('message-input');
    if (messageInput) messageInput.addEventListener('keydown', handleKeyDown);
});
