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
 * Hash a password string using SHA-256 (browser SubtleCrypto).
 * This is client-side hashing to avoid storing plaintext passwords.
 * Note: client-side hashing is not a replacement for proper server-side authentication.
 */
async function hashPassword(password) {
    const enc = new TextEncoder();
    const data = enc.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

/** Return true if the stored value looks like a SHA-256 hex (64 hex chars) */
function looksLikeSha256Hex(s) {
    return typeof s === 'string' && /^[a-f0-9]{64}$/i.test(s);
}

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
 * For signup we store username => hashedPassword (not plaintext).
 *
 * Login accepts either stored-hash or stored-plaintext. If stored plaintext matches, it
 * will migrate the DB entry to the hashed value for future logins.
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
            // store hashed password (improvement over plaintext)
            const hashed = await hashPassword(password);
            await set(ref(database, `usedDisplayNames/${username}`), hashed);
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

        // If stored looks like a SHA-256 hex, compare hashes
        const hashedInput = await hashPassword(password);

        if (looksLikeSha256Hex(stored)) {
            if (stored.toLowerCase() === hashedInput.toLowerCase()) {
                // success
                localStorage.setItem('yoshibook_user', username);
                alert('Login successful');
                window.location.href = 'chat.html';
                return;
            }
            // mismatch -> fail
            alert('Invalid username or password');
            return;
        }

        // If stored does NOT look like a hash, treat it as plaintext (legacy).
        // First try direct plaintext match; if it matches, migrate the DB entry to the hashed value.
        if (stored === password) {
            // migrate to hash
            const hashed = hashedInput;
            try {
                await set(ref(database, `usedDisplayNames/${username}`), hashed);
                console.log(`Migrated plaintext password for ${username} to SHA-256 hash.`);
            } catch (e) {
                console.warn('Failed to migrate plaintext password to hash (non-fatal):', e);
            }
            localStorage.setItem('yoshibook_user', username);
            alert('Login successful (legacy account migrated to secure storage)');
            window.location.href = 'chat.html';
            return;
        }

        // Last attempt: it's possible stored value is something else (different encoding); fail safely.
        alert('Invalid username or password');
    } catch (err) {
        console.error('Login error', err);
        alert('An error occurred during login. Try again later.');
    }
}

// export function to window so inline HTML handlers can call it
window.handleLogin = handleLogin;
