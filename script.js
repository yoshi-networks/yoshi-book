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

// Auth functions
function showLoginModal() {
    document.getElementById('loginModal').style.display = 'flex';
}

function showSignupModal() {
    document.getElementById('signupModal').style.display = 'flex';
}

function handleLogin(event) {
    event.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    const userRef = ref(database, `usedDisplayNames/${username}`);
    get(userRef).then((snapshot) => {
        if (snapshot.exists() && snapshot.val() === password) {
            localStorage.setItem('yoshibook_user', username);
            document.getElementById('loginModal').style.display = 'none';
            updateAuthDisplay();
            enableChat(); // Enable chat functionality after login
        } else {
            alert('Invalid username or password');
        }
    }).catch(handleFirebaseError);
}

function handleSignup(event) {
    event.preventDefault();
    const username = document.getElementById('signupUsername').value;
    const password = document.getElementById('signupPassword').value;

    const userRef = ref(database, `usedDisplayNames/${username}`);
    get(userRef).then((snapshot) => {
        if (snapshot.exists()) {
            alert('Username already taken');
        } else {
            set(userRef, password).then(() => {
                localStorage.setItem('yoshibook_user', username);
                document.getElementById('signupModal').style.display = 'none';
                updateAuthDisplay();
                enableChat(); // Enable chat functionality after signup
            }).catch(handleFirebaseError);
        }
    }).catch(handleFirebaseError);
}

function enableChat() {
    loadMessages(); // Just load messages, don't modify chat input visibility
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

// Make functions available globally
window.showLoginModal = showLoginModal;
window.showSignupModal = showSignupModal;
window.handleLogin = handleLogin;
window.handleSignup = handleSignup;
window.logout = logout;
window.sendMessage = sendMessage;
window.deleteMessage = deleteMessage;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    updateAuthDisplay();
    
    // Close modals when clicking outside
    window.onclick = function(event) {
        if (event.target.className === 'modal') {
            event.target.style.display = 'none';
        }
    };
});

// Rest of your existing chat functionality...

// Add these functions after the existing ones

function logout() {
    localStorage.removeItem('yoshibook_user');
    updateAuthDisplay();
}

function loadMessages() {
    const messagesRef = ref(database, 'messages');
    onChildAdded(messagesRef, (snapshot) => {
        const messageData = snapshot.val();
        displayMessage(messageData, snapshot.key);
    });
}

function sendMessage() {
    const messageInput = document.getElementById('message-input');
    const messageText = messageInput.value.trim();

    if (messageText === '') return;

    const user = localStorage.getItem('yoshibook_user') || 'Anonymous';
    
    const messageData = {
        displayName: user,
        messageText: messageText,
        timestamp: new Date().toLocaleTimeString(),
        isUser: true,
        createdAt: Date.now()
    };
    
    const messagesRef = ref(database, 'messages');
    push(messagesRef, messageData)
        .then(() => {
            messageInput.value = '';
        })
        .catch(handleFirebaseError);
}

function displayMessage(messageData, messageKey) {
    const currentUser = localStorage.getItem('yoshibook_user');
    const isCurrentUser = messageData.displayName === currentUser;
    
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    messageElement.classList.add(isCurrentUser ? 'user' : 'other');
    
    const sanitizedMessage = document.createElement('div');
    sanitizedMessage.textContent = messageData.messageText;
    
    messageElement.innerHTML = `
        <span class="username">${escapeHtml(messageData.displayName)}</span>
        ${sanitizedMessage.innerHTML}
        <span class="timestamp">${messageData.timestamp}</span>
    `;
    
    if (isCurrentUser) {
        const deleteBtn = document.createElement('button');
        deleteBtn.classList.add('delete-btn');
        deleteBtn.innerText = '×';
        deleteBtn.onclick = () => deleteMessage(messageKey, messageElement);
        messageElement.appendChild(deleteBtn);
    }
    
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

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

// Add these to window exports
window.handleKeyDown = handleKeyDown;
