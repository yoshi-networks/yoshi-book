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

// Message functions
function sendMessage() {
    const messageInput = document.getElementById('message-input');
    const messageText = messageInput.value.trim();

    if (messageText === '') return;

    const filteredMessage = filterBadWords(messageText);
    const user = localStorage.getItem('yoshibook_user') || 'Anonymous';
    
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
    const user = localStorage.getItem('yoshibook_user');
    const messageUser = messageElement.querySelector('.username').textContent.split(':')[0].trim();
    
    if (user && messageUser === user) {
        if (confirm('Delete this message?')) {
            const messageRef = ref(database, `messages/${messageKey}`);
            remove(messageRef)
                .then(() => {
                    messageElement.remove();
                })
                .catch(handleFirebaseError);
        }
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
    
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    messageElement.classList.add(isCurrentUser ? 'user' : 'other');
    
    messageElement.innerHTML = `
        <span class="username">${escapeHtml(messageData.displayName)}:</span>
        <div class="message-text">${escapeHtml(messageData.messageText)}</div>
        <span class="timestamp">${messageData.timestamp}</span>
    `;
    
    if (isCurrentUser && currentUser !== 'Anonymous') {
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
            localStorage.setItem('yoshibook_user', username);
            document.getElementById('loginModal').style.display = 'none';
            updateAuthDisplay();
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
    updateAuthDisplay();
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

Object.assign(window, exportedFunctions);

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    updateAuthDisplay();
    loadMessages();
    
    // Close modals when clicking outside
    window.onclick = function(event) {
        if (event.target.className === 'modal') {
            event.target.style.display = 'none';
        }
    };
});
