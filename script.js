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

// Add this bad words list near the top of the file
const BAD_WORDS = [
    'fuck', 'shit', 'ass', 'bitch', 'dick', 'pussy', 'cock', 'cunt', 'bastard',
    'damn', 'hell', 'piss', 'whore', 'slut', 'retard', 'nigger', 'faggot'
];

// Add this function for bad word filtering
function filterBadWords(text) {
    let filteredText = text.toLowerCase();
    BAD_WORDS.forEach(word => {
        const regex = new RegExp(word, 'gi');
        filteredText = filteredText.replace(regex, '*'.repeat(word.length));
    });
    return filteredText;
}

// Add this cookie utility functions at the top after Firebase initialization
function setCookie(name, value, days) {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
}

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for(let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

// Add notification function
function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

// Add after Firebase initialization
const ADMIN_USERNAME = 'YoshiNetworks';

// Role management
function getUserRole(username) {
    const roles = JSON.parse(localStorage.getItem('yoshibook_roles') || '{}');
    return roles[username] || 'user';
}

function setUserRole(username, role) {
    const roles = JSON.parse(localStorage.getItem('yoshibook_roles') || '{}');
    roles[username] = role;
    localStorage.setItem('yoshibook_roles', JSON.stringify(roles));
    // Also store in Firebase for persistence
    set(ref(database, `roles/${username}`), role);
}

function isAdmin(username) {
    return username === ADMIN_USERNAME || getUserRole(username) === 'admin';
}

function isCoordinator(username) {
    return getUserRole(username) === 'coordinator';
}

function canModerate(username) {
    return isAdmin(username) || isCoordinator(username);
}

// Ban system
function banUser(username) {
    const bannedUsers = JSON.parse(localStorage.getItem('yoshibook_banned') || '[]');
    if (!bannedUsers.includes(username)) {
        bannedUsers.push(username);
        localStorage.setItem('yoshibook_banned', JSON.stringify(bannedUsers));
        // Store in Firebase
        set(ref(database, `banned/${username}`), true);
    }
}

function unbanUser(username) {
    const bannedUsers = JSON.parse(localStorage.getItem('yoshibook_banned') || '[]');
    const index = bannedUsers.indexOf(username);
    if (index > -1) {
        bannedUsers.splice(index, 1);
        localStorage.setItem('yoshibook_banned', JSON.stringify(bannedUsers));
        // Remove from Firebase
        remove(ref(database, `banned/${username}`));
    }
}

function isBanned(username) {
    const bannedUsers = JSON.parse(localStorage.getItem('yoshibook_banned') || '[]');
    return bannedUsers.includes(username);
}

// Message functions
function sendMessage() {
    const messageInput = document.getElementById('message-input');
    const messageText = messageInput.value.trim();
    const user = localStorage.getItem('yoshibook_user') || 'Anonymous';

    if (messageText === '') return;

    if (isBanned(user)) {
        showNotification('You have been banned!');
        return;
    }

    const filteredMessage = filterBadWords(messageText);
    
    const messageData = {
        displayName: user,
        messageText: filteredMessage,
        timestamp: new Date().toLocaleTimeString(),
        isUser: user !== 'Anonymous',
        createdAt: Date.now()
    };
    
    const messagesRef = ref(database, 'messages');
    push(messagesRef, messageData)
        .then(() => {
            messageInput.value = '';
        })
        .catch(handleFirebaseError);
}

function deleteMessage(messageKey, messageElement) {
    const currentUser = localStorage.getItem('yoshibook_user');
    const messageUser = messageElement.querySelector('.username').textContent.split(':')[0].trim();
    
    if (!currentUser) return;

    const canDelete = isAdmin(currentUser) || 
                     (isCoordinator(currentUser) && !canModerate(messageUser)) ||
                     (currentUser === messageUser);

    if (canDelete) {
        showNotification('Delete this message?');
        const notification = document.querySelector('.notification');
        
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'notification-buttons';
        
        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = 'Delete';
        confirmBtn.onclick = () => {
            const messageRef = ref(database, `messages/${messageKey}`);
            remove(messageRef)
                .then(() => {
                    messageElement.remove();
                    notification.remove();
                })
                .catch(handleFirebaseError);
        };
        
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = () => notification.remove();
        
        buttonContainer.appendChild(confirmBtn);
        buttonContainer.appendChild(cancelBtn);
        notification.appendChild(buttonContainer);
    }
}

function loadMessages() {
    if (messagesLoaded) return;
    messagesLoaded = true;

    const messagesRef = ref(database, 'messages');
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.innerHTML = '';
    
    onChildAdded(messagesRef, (snapshot) => {
        const messageData = snapshot.val();
        displayMessage(messageData, snapshot.key);
    });
}

function displayMessage(messageData, messageKey) {
    const currentUser = localStorage.getItem('yoshibook_user');
    const isCurrentUser = messageData.displayName === currentUser;
    const messageUser = messageData.displayName;
    
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    messageElement.classList.add(isCurrentUser ? 'user' : 'other');
    
    let roleBadge = '';
    if (isAdmin(messageUser)) {
        roleBadge = '<span class="role-badge admin">Admin</span>';
    } else if (isCoordinator(messageUser)) {
        roleBadge = '<span class="role-badge coordinator">Coordinator</span>';
    }
    
    messageElement.innerHTML = `
        <span class="username">${escapeHtml(messageData.displayName)}:${roleBadge}</span>
        <div class="message-text">${escapeHtml(messageData.messageText)}</div>
        <span class="timestamp">${messageData.timestamp}</span>
    `;
    
    if (canModerate(currentUser) || (isCurrentUser && currentUser !== 'Anonymous')) {
        const deleteBtn = document.createElement('button');
        deleteBtn.classList.add('delete-btn');
        deleteBtn.innerText = '×';
        deleteBtn.onclick = () => window.deleteMessage(messageKey, messageElement);
        messageElement.appendChild(deleteBtn);
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

    const userRef = ref(database, `usedDisplayNames/${username}`);
    get(userRef).then((snapshot) => {
        if (snapshot.exists() && snapshot.val() === password) {
            setCookie('yoshibook_user', username, 7); // Store for 7 days
            localStorage.setItem('yoshibook_user', username);
            document.getElementById('loginModal').style.display = 'none';
            updateAuthDisplay();
            updateMessagePositions();
        } else {
            alert('Invalid username or password');
        }
    }).catch(handleFirebaseError);
}

function handleSignup(event) {
    event.preventDefault();
    const username = document.getElementById('signupUsername').value.trim();
    const password = document.getElementById('signupPassword').value;

    // Check for spaces and special characters
    if (!/^[a-zA-Z0-9]+$/.test(username)) {
        alert('Username can only contain letters and numbers');
        return;
    }

    const normalizedUsername = username.toLowerCase(); // Convert to lowercase for comparison
    const userRef = ref(database, 'usedDisplayNames');
    
    get(userRef).then((snapshot) => {
        const existingUsernames = snapshot.val() || {};
        const existingNormalizedUsernames = Object.keys(existingUsernames).map(name => name.toLowerCase());
        
        if (existingNormalizedUsernames.includes(normalizedUsername)) {
            alert('Username already taken');
            return;
        }

        set(ref(database, `usedDisplayNames/${username}`), password)
            .then(() => {
                localStorage.setItem('yoshibook_user', username);
                document.getElementById('signupModal').style.display = 'none';
                updateAuthDisplay();
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
        let roleBadge = '';
        if (isAdmin(user)) {
            roleBadge = '<span class="role-badge admin">Admin</span>';
        } else if (isCoordinator(user)) {
            roleBadge = '<span class="role-badge coordinator">Coordinator</span>';
        }
        
        authButtons.innerHTML = `
            <span class="user-display">Welcome, ${user}${roleBadge}</span>
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

// Utility functions
function handleKeyDown(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
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
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Add function to update message positions
function updateMessagePositions() {
    const currentUser = localStorage.getItem('yoshibook_user');
    const messages = document.querySelectorAll('.message');
    
    messages.forEach(message => {
        const username = message.querySelector('.username').textContent.split(':')[0].trim();
        message.classList.remove('user', 'other');
        message.classList.add(username === currentUser ? 'user' : 'other');
    });
}

// Make sure to export all functions to window
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

Object.assign(window, {
    ...exportedFunctions,
    banUser,
    unbanUser,
    setUserRole
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    const cookieUser = getCookie('yoshibook_user');
    if (cookieUser) {
        localStorage.setItem('yoshibook_user', cookieUser);
    }
    updateAuthDisplay();
    loadMessages();
    
    // Close modals when clicking outside
    window.onclick = function(event) {
        if (event.target.className === 'modal') {
            event.target.style.display = 'none';
        }
    };
});
