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

// Bad words list
const BAD_WORDS = [
    'fuck', 'shit', 'ass', 'bitch', 'dick', 'pussy', 'cock', 'cunt', 'bastard',
    'damn', 'hell', 'piss', 'whore', 'slut', 'retard', 'nigger', 'faggot'
];

// Filter bad words
function filterBadWords(text) {
    let filteredText = text;
    BAD_WORDS.forEach(word => {
        const regex = new RegExp(word, 'gi');
        filteredText = filteredText.replace(regex, '*'.repeat(word.length));
    });
    return filteredText;
}

// Cookie utilities
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

// Notification function
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

// Send message
function sendMessage() {
    const messageInput = document.getElementById('message-input');
    let messageText = messageInput.value.trim();

    if (messageText === '') return;

    // Apply caps lock (convert to uppercase)
    messageText = messageText.toUpperCase();

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

// Insert emoji into message
function insertEmoji(emoji) {
    const messageInput = document.getElementById('message-input');
    messageInput.value += emoji;
    messageInput.focus();
}

// Delete message
function deleteMessage(messageKey, messageElement) {
    const user = localStorage.getItem('yoshibook_user');
    const messageUser = messageElement.querySelector('.username').textContent.split(':')[0].trim();
    
    if (user && messageUser === user) {
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

// Load messages
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

// Display message
function displayMessage(messageData, messageKey) {
    const currentUser = localStorage.getItem('yoshibook_user');
    const isCurrentUser = messageData.displayName === currentUser;
    
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    messageElement.classList.add(isCurrentUser ? 'user' : 'other');
    
    messageElement.innerHTML = `
        <span class="username">${escapeHtml(messageData.displayName)}:</span>
        <div class="message-text">${escapeHtml(messageData.messageText)}</div>
        ${messageData.messageText.match(/\bhttps?:\/\/\S+\.(?:jpg|jpeg|png|gif)\b/) ? `<img src="${escapeHtml(messageData.messageText)}" alt="Image" class="message-image">` : ''}
        <span class="timestamp">${messageData.timestamp}</span>
    `;
    
    if (isCurrentUser && currentUser !== 'Anonymous') {
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

// Escape HTML characters
function escapeHtml(text) {
    return text.replace(/[&<>"']/g, (char) => {
        return ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        })[char];
    });
}

// Firebase error handling
function handleFirebaseError(error) {
    console.error('Firebase Error:', error);
    showNotification('An error occurred. Please try again.');
}

document.getElementById('loginModal').onclick = () => document.getElementById('loginModal').style.display = 'none';
document.getElementById('signupModal').onclick = () => document.getElementById('signupModal').style.display = 'none';
window.onload = loadMessages;
