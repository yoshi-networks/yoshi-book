// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, onChildAdded, push, remove, get, set } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-storage.js";

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
const storage = getStorage(app);

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
  'damn', 'hell', 'piss', 'whore', 'slut', 'retard', 'nigger', 'faggot'
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
    const fileInput = document.getElementById('image-upload');
    const file = fileInput.files[0];

    if (!messageText && !file) return;

    const filteredMessage = filterBadWords(messageText);
    const messageData = {
        senderId:    id,
        displayName: user || 'Anonymous',
        messageText: filteredMessage,
        timestamp:   new Date().toLocaleTimeString(),
        createdAt:   Date.now()
    };

    if (file) {
        const fileName = `${Date.now()}-${file.name}`;
        const fileRef = storageRef(storage, 'messages/' + fileName);
        const uploadTask = uploadBytesResumable(fileRef, file);

        uploadTask.on('state_changed', 
          null, 
          error => console.error('Error uploading file:', error), 
          () => {
            getDownloadURL(uploadTask.snapshot.ref).then(downloadURL => {
                messageData.imageUrl = downloadURL;
                sendToFirebase(messageData);
            });
        });
    } else {
        sendToFirebase(messageData);
    }

    function sendToFirebase(messageData) {
        push(ref(database, 'messages'), messageData)
          .then(() => {
              messageInput.value = '';
              fileInput.value = ''; // Reset file input
          })
          .catch(handleFirebaseError);
    }
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
      <span class="timestamp">${msg.timestamp}</span>
    `;

    if (msg.imageUrl) {
        const img = document.createElement('img');
        img.src = msg.imageUrl;
        img.classList.add('message-image');
        el.appendChild(img);
    }

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

function handleLogin(event) { ... }
function handleSignup(event) { ... }
function logout() { ... }
function updateAuthDisplay() { ... }
function handleKeyDown(event) { if (event.key === 'Enter') sendMessage(); }
function handleFirebaseError(error) { console.error('Firebase error:', error); alert('An error occurred. Please try again later.'); }
function escapeHtml(unsafe) { ... }
function updateMessagePositions() { ... }

// Expose to window
Object.assign(window, {
  showLoginModal, showSignupModal, sendMessage, handleKeyDown
});
