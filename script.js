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

// ——— Load bannedUsers from cookie ———
function loadBans() {
    const cookie = getCookie('bannedUsers');
    try {
        bannedUsers = cookie ? JSON.parse(cookie) : [];
    } catch {
        bannedUsers = [];
    }
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
    document.cookie = ${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;
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

// ——— Role detection ———
function loadUserRole(username) {
    get(ref(database, roles/${username})).then(snap => {
        if (snap.exists()) {
            currentUserRole = snap.val();
        }
        if (currentUserRole === 'admin') {
            const adminControls = document.getElementById('admin-controls');
            if (adminControls) adminControls.style.display = 'flex';
        }
    });
}

// Message functions
function sendMessage() {
    const user = localStorage.getItem('yoshibook_user') || 'Anonymous';
    if (bannedUsers.includes(user)) {
        alert('You have been banned!');
        return;
    }

    const messageInput = document.getElementById('message-input');
    const messageText = messageInput.value.trim();
    if (messageText === '') return;

    const filteredMessage = filterBadWords(messageText);
    const messageData = {
        displayName: user,
        messageText: filteredMessage,
        timestamp: new Date().toLocaleTimeString(),
        isUser: user !== 'Anonymous',
        createdAt: Date.now()
    };

    push(ref(database, 'messages'), messageData)
        .then(() => { messageInput.value = ''; })
        .catch(handleFirebaseError);
}

function deleteMessage(messageKey, messageElement) {
    // Admin & coordinator can delete any allowed message
    remove(ref(database, messages/${messageKey}))
      .then(() => messageElement.remove())
      .catch(handleFirebaseError);
}

function banUser(username) {
    if (!bannedUsers.includes(username)) {
        bannedUsers.push(username);
        setCookie('bannedUsers', JSON.stringify(bannedUsers), 7);
        alert(username + ' has been banned.');
    }
}

function appointCoordinator() {
    const target = document.getElementById('coord-input').value.trim();
    if (!target) return;
    set(ref(database, roles/${target}), 'coordinator')
      .then(() => alert(target + ' is now a coordinator.'))
      .catch(handleFirebaseError);
}

function loadMessages() {
    if (messagesLoaded) return;
    messagesLoaded = true;

    const chatMessages = document.getElementById('chat-messages');
    chatMessages.innerHTML = '';

    onChildAdded(ref(database, 'messages'), snapshot => {
        displayMessage(snapshot.val(), snapshot.key);
    });
}

function displayMessage(messageData, messageKey) {
    const currentUser = localStorage.getItem('yoshibook_user');
    const isCurrentUser = messageData.displayName === currentUser;
    const isAdmin = currentUserRole === 'admin';
    const isCoord = currentUserRole === 'coordinator';
    const authorRoleSnap = null; // roles of author not needed here
    // Determine permissions
    const canDelete = isAdmin || (isCoord && !['admin','coordinator'].includes(messageData.displayName));
    const canBan    = (isAdmin || isCoord) && messageData.displayName !== currentUser;

    const messageElement = document.createElement('div');
    messageElement.classList.add('message', isCurrentUser ? 'user' : 'other');
    messageElement.innerHTML = 
        <span class="username">${escapeHtml(messageData.displayName)}:</span>
        <div class="message-text">${escapeHtml(messageData.messageText)}</div>
        <span class="timestamp">${messageData.timestamp}</span>
    ;

    if (canDelete) {
        const delBtn = document.createElement('button');
        delBtn.classList.add('delete-btn');
        delBtn.innerText = '×';
        delBtn.onclick = () => deleteMessage(messageKey, messageElement);
        messageElement.appendChild(delBtn);
    }
    if (canBan) {
        const banBtn = document.createElement('button');
        banBtn.innerText = 'Ban';
        banBtn.style.marginLeft = '5px';
        banBtn.onclick = () => banUser(messageData.displayName);
        messageElement.appendChild(banBtn);
    }

    const chatMessages = document.getElementById('chat-messages');
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Auth functions
function showLoginModal() {
    document.getElementById('loginModal').style.display = 'flex';
}
function showSignupModal() {
    document.getElementById('signupModal').style.display = 'flex';
}

function handleLogin(event) {
    event.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    get(ref(database, usedDisplayNames/${username})).then(snapshot => {
        if (snapshot.exists() && snapshot.val() === password) {
            setCookie('yoshibook_user', username, 7);
            localStorage.setItem('yoshibook_user', username);
            document.getElementById('loginModal').style.display = 'none';
            updateAuthDisplay();
            updateMessagePositions();
            loadUserRole(username);
        } else {
            alert('Invalid username or password');
        }
    }).catch(handleFirebaseError);
}

function handleSignup(event) {
    event.preventDefault();
    const username = document.getElementById('signupUsername').value.trim();
    const password = document.getElementById('signupPassword').value;
    if (!/^[a-zA-Z0-9]+$/.test(username)) {
        alert('Username can only contain letters and numbers');
        return;
    }

    get(ref(database, 'usedDisplayNames')).then(snapshot => {
        const existing = snapshot.val() || {};
        const lowercased = Object.keys(existing).map(n => n.toLowerCase());
        if (lowercased.includes(username.toLowerCase())) {
            alert('Username already taken');
            return;
        }
        set(ref(database, usedDisplayNames/${username}), password)
          .then(() => {
              localStorage.setItem('yoshibook_user', username);
              document.getElementById('signupModal').style.display = 'none';
              updateAuthDisplay();
              loadUserRole(username);
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
        authButtons.innerHTML = 
            <span class="user-display">Welcome, ${user}</span>
            <button class="auth-btn login-btn" onclick="logout()">Logout</button>
        ;
    } else {
        authButtons.innerHTML = 
            <button class="auth-btn login-btn" onclick="showLoginModal()">Login</button>
            <button class="auth-btn signup-btn" onclick="showSignupModal()">Sign Up</button>
        ;
    }
    loadMessages();
}

function handleKeyDown(event) {
    if (event.key === 'Enter') sendMessage();
}
function handleFirebaseError(error) {
    console.error('Firebase error:', error);
    alert('An error occurred. Please try again later.');
}
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
function updateMessagePositions() {
    const currentUser = localStorage.getItem('yoshibook_user');
    document.querySelectorAll('.message').forEach(message => {
        const username = message.querySelector('.username').textContent.split(':')[0].trim();
        message.classList.toggle('user', username === currentUser);
        message.classList.toggle('other', username !== currentUser);
    });
}

// Export all functions to window
Object.assign(window, {
    showLoginModal,
    showSignupModal,
    handleLogin,
    handleSignup,
    logout,
    sendMessage,
    deleteMessage,
    handleKeyDown,
    appointCoordinator
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    const cookieUser = getCookie('yoshibook_user');
    if (cookieUser) localStorage.setItem('yoshibook_user', cookieUser);
    updateAuthDisplay();
    loadMessages();
    const me = localStorage.getItem('yoshibook_user');
    if (me) loadUserRole(me);
    window.onclick = function(event) {
        if (event.target.className === 'modal') {
            event.target.style.display = 'none';
        }
    };
});
