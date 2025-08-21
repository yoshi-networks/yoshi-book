// login.js
// This is a module (login.html loads it with type="module").

// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, get, set } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";

// Same config as the chat page (keep consistent)
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

/**
 * Basic defensive escape (if you ended up rendering anything from the DB on this page).
 */
function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * handleLogin handles both login and signup in the same form by toggling dataset.mode.
 * NOTE: This implementation stores and compares plaintext passwords (per your request).
 */
async function handleLogin(event) {
    event.preventDefault();
    const form = document.getElementById('loginForm');
    const mode = form.dataset.mode === 'signup' ? 'signup' : 'login';

    const usernameEl = document.getElementById('username');
    const passwordEl = document.getElementById('password');

    const username = usernameEl.value.trim();
    const password = passwordEl.value;

    if (!username || !password) {
        alert('Please enter a username and password.');
        return;
    }

    // Validate username: alphanumeric only (same rule as chat page)
    if (!/^[a-zA-Z0-9]+$/.test(username)) {
        alert('Username can only contain letters and numbers');
        return;
    }

    try {
        const usersRef = ref(database, 'usedDisplayNames');
        const snap = await get(usersRef);
        const existing = snap.exists() ? snap.val() : {};

        // Normalize comparison for uniqueness when signing up
        const normalizedRequested = username.toLowerCase();
        const existingNormalized = Object.keys(existing).map(k => k.toLowerCase());

        if (mode === 'signup') {
            if (existingNormalized.includes(normalizedRequested)) {
                alert('Username already taken');
                return;
            }
            // store plaintext password (user requested behavior)
            await set(ref(database, `usedDisplayNames/${username}`), password);
            localStorage.setItem('yoshibook_user', username);
            alert('Account created — you are now logged in.');
            window.location.href = 'chat.html';
            return;
        }

        // LOGIN mode:
        if (!existing.hasOwnProperty(username)) {
            alert('Invalid username or password');
            return;
        }

        const stored = existing[username];

        // Direct plaintext comparison
        if (stored === password) {
            localStorage.setItem('yoshibook_user', username);
            alert('Login successful');
            window.location.href = 'chat.html';
            return;
        }

        // If mismatch
        alert('Invalid username or password');
    } catch (err) {
        console.error('Login error', err);
        alert('An error occurred during login. Try again later.');
    }
}

// export function to window so inline HTML handlers can call it
window.handleLogin = handleLogin;
