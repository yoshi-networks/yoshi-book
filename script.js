// Firebase CDN imports for browser compatibility
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-analytics.js";
import { getDatabase, ref, onChildAdded, push, remove, get, set } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";

// Your web app's Firebase configuration
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
const analytics = getAnalytics(app);
const database = getDatabase(app);

const usedDisplayNames = new Map(); // Store display names and their passwords
const authenticatedUsers = new Set(); // Store users who have authenticated with their password

// Retrieve used display names from the database
const usedDisplayNamesRef = ref(database, 'usedDisplayNames');
get(usedDisplayNamesRef).then((snapshot) => {
    if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
            usedDisplayNames.set(childSnapshot.key, childSnapshot.val());
        });
    }
});

// Clear all messages at midnight on the first day of each month
setInterval(() => {
    const now = new Date();
    if (now.getDate() === 1 && now.getHours() === 0 && now.getMinutes() === 0) {
        // Remove all messages
        const messagesRef = ref(database, 'messages');
        remove(messagesRef).then(() => {
            console.log('All messages deleted.');
        }).catch((error) => {
            console.error('Error deleting messages:', error);
        });
    }
}, 60000); // Check every minute

// Function to handle new messages added to the database
const messagesRef = ref(database, 'messages');
onChildAdded(messagesRef, (snapshot) => {
    const messageData = snapshot.val();
    console.log('New message added:', messageData);
    displayMessage(messageData, snapshot.key);
});

// Function to display messages
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
    
    document.getElementById('chat-messages').appendChild(messageElement);
}

// Add this helper function
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Add this at the start of the file
const handleFirebaseError = (error) => {
    console.error('Firebase error:', error);
    alert('An error occurred. Please try again later.');
};

const MESSAGE_MAX_LENGTH = 500;
const MESSAGE_COOLDOWN = 1000; // 1 second
let lastMessageTime = 0;

// Function to send message
function sendMessage() {
    const currentUser = checkAuth();
    if (!currentUser) return;

    const messageInput = document.getElementById('message-input');
    const messageText = messageInput.value.trim();

    if (messageText.length > MESSAGE_MAX_LENGTH) {
        alert(`Message too long. Maximum length is ${MESSAGE_MAX_LENGTH} characters`);
        return;
    }

    console.log('Sending message:', messageText);

    if (messageText === '') return; // Do not send empty messages

    sendMessageToDatabase(currentUser, messageText, new Date().toLocaleTimeString());
}

// Function to send message to the database
function sendMessageToDatabase(displayName, messageText, timestamp) {
    if (!database) {
        handleFirebaseError(new Error('Database not initialized'));
        return;
    }

    const messageData = {
        displayName: displayName,
        messageText: messageText,
        timestamp: timestamp,
        isUser: true,
        createdAt: Date.now() // Add timestamp for message ordering
    };
    
    push(messagesRef, messageData)
        .then(() => {
            console.log('Message sent successfully');
            document.getElementById('message-input').value = '';
        })
        .catch(handleFirebaseError);
}

// Function to handle Enter key press to send message
function handleKeyDown(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

// Function to delete a message
function deleteMessage(messageKey, messageElement) {
    const enteredPassword = prompt('Enter password to delete this message:');
    const displayName = messageElement.querySelector('.username').innerText.slice(0, -1);
    
    if (usedDisplayNames.get(displayName) === enteredPassword) {
        remove(ref(database, `messages/${messageKey}`));
        messageElement.remove();
    } else {
        alert('Incorrect password for deleting this message.');
    }
}

// Make functions accessible in HTML
window.sendMessage = sendMessage;
window.handleKeyDown = handleKeyDown;

// Add at the start of the file
window.addEventListener('online', () => {
    document.body.classList.remove('offline');
});

window.addEventListener('offline', () => {
    document.body.classList.add('offline');
});

// Add at the start of the file
function checkAuth() {
    const user = localStorage.getItem('yoshibook_user');
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    document.getElementById('current-user').textContent = user;
    return user;
}

function logout() {
    localStorage.removeItem('yoshibook_user');
    window.location.href = 'login.html';
}

// Call checkAuth when the chat page loads
document.addEventListener('DOMContentLoaded', checkAuth);
