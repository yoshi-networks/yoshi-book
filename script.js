// Firebase CDN imports for browser compatibility
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-analytics.js";
import { getDatabase, ref, onChildAdded, push, remove, get, set } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID",
    measurementId: "YOUR_MEASUREMENT_ID",
    databaseURL: "YOUR_DATABASE_URL"
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
    displayMessage(messageData, snapshot.key);
});

// Function to display messages
function displayMessage(messageData, messageKey) {
    const chatMessages = document.getElementById('chat-messages');
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    messageElement.classList.add(messageData.isUser ? 'user' : 'other');

    messageElement.innerHTML = `
        <span class="username">${messageData.displayName}:</span>
        ${messageData.messageText}
        <span class="timestamp">${messageData.timestamp}</span>
    `;
    
    if (messageData.isUser) {
        const deleteBtn = document.createElement('button');
        deleteBtn.classList.add('delete-btn');
        deleteBtn.innerText = 'X';
        deleteBtn.onclick = () => deleteMessage(messageKey, messageElement);
        messageElement.appendChild(deleteBtn);
    }

    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Function to send message to database
function sendMessage() {
    const messageInput = document.getElementById('message-input');
    const displayNameInput = document.getElementById('display-name');
    const messageText = messageInput.value.trim();
    const displayName = displayNameInput.value.trim() || 'Anonymous';
    const timestamp = new Date().toLocaleTimeString();

    if (messageText === '') return; // Do not send empty messages

    if (authenticatedUsers.has(displayName)) {
        sendMessageToDatabase(displayName, messageText, timestamp);
        return;
    }

    const passwordPrompt = usedDisplayNames.has(displayName) ? 
        `Enter password for the permanent display name "${displayName}":` : 
        `Would you like to set "${displayName}" as a permanent display name? Enter a password to confirm:`;

    const password = prompt(passwordPrompt);
    if (password === null) return;

    if (usedDisplayNames.has(displayName)) {
        if (usedDisplayNames.get(displayName) !== password) {
            alert('Incorrect password for the display name.');
            return;
        } else {
            authenticatedUsers.add(displayName);
        }
    } else {
        usedDisplayNames.set(displayName, password);
        set(ref(database, `usedDisplayNames/${displayName}`), password).catch((error) => {
            console.error('Error saving display name:', error);
        });
        authenticatedUsers.add(displayName);
    }

    sendMessageToDatabase(displayName, messageText, timestamp);
}

// Helper function to push message to Firebase
function sendMessageToDatabase(displayName, messageText, timestamp) {
    const messageData = {
        displayName,
        messageText,
        timestamp,
        isUser: true
    };
    push(messagesRef, messageData);
    document.getElementById('message-input').value = ''; // Clear the message input
}

// Function to delete a message
function deleteMessage(messageKey, messageElement) {
    remove(ref(database, `messages/${messageKey}`)).then(() => {
        messageElement.remove();
    }).catch((error) => {
        console.error('Error deleting message:', error);
    });
}
