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
let currentUserRole = 'user';
let bannedUsers = [];

// ——— Load bannedUsers from cookie ———
function loadBans() {
    const cookie = getCookie('bannedUsers');
    try { bannedUsers = cookie ? JSON.parse(cookie) : []; } catch { bannedUsers = []; }
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
    const expires = new Date(); expires.setTime(expires.getTime() + days*864e5);
    document.cookie = name + '=' + encodeURIComponent(value) + ';expires=' + expires.toUTCString() + ';path=/';
}
function getCookie(name) {
    return document.cookie.split('; ').reduce((r,v) => {
        const parts = v.split('='); return parts[0]===name ? decodeURIComponent(parts[1]) : r
    }, '');
}

// Notification
function showNotification(message) {
    const n = document.createElement('div'); n.className='notification'; n.textContent=message;
    document.body.appendChild(n);
    setTimeout(() => n.classList.add('show'), 100);
    setTimeout(() => { n.classList.remove('show'); setTimeout(()=>n.remove(),300); }, 2000);
}

// ——— Role detection ———
function loadUserRole(username) {
    get(ref(database, `roles/${username}`)).then(snap => {
        if (snap.exists()) currentUserRole = snap.val();
        if (currentUserRole==='admin') document.getElementById('admin-controls').style.display='flex';
    });
}

// Message functions
function sendMessage() {
    const user = localStorage.getItem('yoshibook_user') || 'Anonymous';
    if (bannedUsers.includes(user)) { alert('You have been banned!'); return; }

    const input = document.getElementById('message-input');
    const text = input.value.trim(); if (!text) return;
    const filtered = filterBadWords(text);
    push(ref(database,'messages'), {
        displayName: user,
        messageText: filtered,
        timestamp: new Date().toLocaleTimeString(),
        isUser: user!=='Anonymous',
        createdAt: Date.now()
    }).then(()=> input.value='').catch(handleFirebaseError);
}

function deleteMessage(key, el) {
    remove(ref(database, `messages/${key}`)).then(()=>el.remove()).catch(handleFirebaseError);
}

function banUser(username) {
    if (!bannedUsers.includes(username)) {
        bannedUsers.push(username);
        setCookie('bannedUsers', JSON.stringify(bannedUsers), 7);
        alert(username + ' has been banned.');
    }
}

function appointCoordinator() {
    const t = document.getElementById('coord-input').value.trim(); if (!t) return;
    set(ref(database, `roles/${t}`), 'coordinator').then(()=>alert(t+' is now a coordinator')).catch(handleFirebaseError);
}

function loadMessages() {
    if (messagesLoaded) return; messagesLoaded=true;
    const chat = document.getElementById('chat-messages'); chat.innerHTML='';
    onChildAdded(ref(database,'messages'), snap=> displayMessage(snap.val(), snap.key));
}

function displayMessage(msg, key) {
    const me = localStorage.getItem('yoshibook_user');
    const isAdmin = currentUserRole==='admin';
    const isCoord = currentUserRole==='coordinator';
    const canDel = isAdmin || (isCoord && !['admin','coordinator'].includes(msg.displayName));
    const canBan = canDel && msg.displayName!==me;

    const el = document.createElement('div');
    el.className = 'message ' + (msg.displayName===me?'user':'other');
    el.innerHTML = `<span class="username">${escapeHtml(msg.displayName)}:</span><div class="message-text">${escapeHtml(msg.messageText)}</div><span class="timestamp">${msg.timestamp}</span>`;

    if (canDel) {
        const b = document.createElement('button'); b.className='delete-btn'; b.innerText='×';
        b.onclick = () => deleteMessage(key, el);
        el.appendChild(b);
    }
    if (canBan) {
        const bb = document.createElement('button'); bb.innerText='Ban'; bb.style.marginLeft='5px';
        bb.onclick = () => banUser(msg.displayName);
        el.appendChild(bb);
    }
    document.getElementById('chat-messages').appendChild(el);
    el.parentNode.scrollTop = el.parentNode.scrollHeight;
}

// Auth & utilities (unchanged)
function showLoginModal() { document.getElementById('loginModal').style.display='flex'; }
function showSignupModal() { document.getElementById('signupModal').style.display='flex'; }
function handleLogin(e) {
    e.preventDefault();
    const u = document.getElementById('loginUsername').value.trim();
    const p = document.getElementById('loginPassword').value;
    get(ref(database, `usedDisplayNames/${u}`)).then(s=>{
        if (s.exists()&&s.val()===p) {
            setCookie('yoshibook_user',u,7); localStorage.setItem('yoshibook_user',u);
            document.getElementById('loginModal').style.display='none'; updateAuthDisplay(); updateMessagePositions(); loadUserRole(u);
        } else alert('Invalid username or password');
    }).catch(handleFirebaseError);
}
function handleSignup(e) {
    e.preventDefault();
    const u=document.getElementById('signupUsername').value.trim(); const p=document.getElementById('signupPassword').value;
    if (!/^[A-Za-z0-9]+$/.test(u)) { alert('Username can only contain letters and numbers'); return; }
    get(ref(database,'usedDisplayNames')).then(s=>{
        const ex=s.val()||{}; if (Object.keys(ex).map(n=>n.toLowerCase()).includes(u.toLowerCase())) { alert('Username already taken'); return; }
        set(ref(database, `usedDisplayNames/${u}`),p).then(()=>{ localStorage.setItem('yoshibook_user',u);document.getElementById('signupModal').style.display='none'; updateAuthDisplay(); loadUserRole(u);} ).catch(handleFirebaseError);
    }).catch(handleFirebaseError);
}
function logout() { localStorage.removeItem('yoshibook_user'); document.cookie='yoshibook_user=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/'; updateAuthDisplay(); updateMessagePositions(); }
function updateAuthDisplay() {
    const u=localStorage.getItem('yoshibook_user'); const ab=document.querySelector('.auth-buttons');
    if (u) ab.innerHTML=`<span class="user-display">Welcome, ${u}</span><button class="auth-btn login-btn" onclick="logout()">Logout</button>`;
    else ab.innerHTML=`<button class="auth-btn login-btn" onclick="showLoginModal()">Login</button><button class="auth-btn signup-btn" onclick="showSignupModal()">Sign Up</button>`;
    loadMessages();
}
function handleKeyDown(e){ if(e.key==='Enter') sendMessage(); }
function handleFirebaseError(er){ console.error('Firebase error:',er); alert('An error occurred. Please try again later.'); }
function escapeHtml(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
function updateMessagePositions(){ document.querySelectorAll('.message').forEach(m=>{ const n=m.querySelector('.username').textContent.split(':')[0].trim(); m.classList.toggle('user',n===localStorage.getItem('yoshibook_user')); m.classList.toggle('other',n!==localStorage.getItem('yoshibook_user')); }); }

// Expose to window
Object.assign(window, { showLoginModal, showSignupModal, handleLogin, handleSignup, logout, sendMessage, deleteMessage, handleKeyDown, appointCoordinator });

// Init on load
document.addEventListener('DOMContentLoaded',()=>{
    const c=getCookie('yoshibook_user'); if(c) localStorage.setItem('yoshibook_user',c);
    updateAuthDisplay(); loadMessages(); const me=localStorage.getItem('yoshibook_user'); if(me) loadUserRole(me);
    window.onclick = e=> { if (e.target.className==='modal') e.target.style.display='none'; };
});
