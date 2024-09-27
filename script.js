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

// Function to send message
function sendMessage() {
    const messageInput = document.getElementById('message-input');
    const displayNameInput = document.getElementById('display-name');
    const messageText = messageInput.value.trim();
    const displayName = displayNameInput.value.trim() || 'Anonymous';
    const timestamp = new Date().toLocaleTimeString();

    console.log('Sending message:', messageText);

    if (messageText === '') return; // Do not send empty messages

    // If the user is already authenticated for this session, no need to prompt for a password again
    if (authenticatedUsers.has(displayName)) {
        sendMessageToDatabase(displayName, messageText, timestamp);
        return;
    }

    const passwordPrompt = usedDisplayNames.has(displayName) ? 
        `Enter password for the permanent display name "${displayName}":` : 
        `Would you like to set "${displayName}" as a permanent display name? Enter a password to confirm:`;

    const password = prompt(passwordPrompt);
    
    if (password === null) return; // User canceled

    if (usedDisplayNames.has(displayName)) {
        // Check password for existing permanent name
        if (usedDisplayNames.get(displayName) !== password) {
            alert('Incorrect password for the display name.');
            return;
        } else {
            // User successfully authenticated for this session
            authenticatedUsers.add(displayName);
        }
    } else {
        // Set new permanent name
        usedDisplayNames.set(displayName, password);
        set(ref(database, `usedDisplayNames/${displayName}`), password).catch((error) => {
            console.error('Error saving display name:', error);
        });
        authenticatedUsers.add(displayName); // Authenticated immediately after setting
    }

    sendMessageToDatabase(displayName, messageText, timestamp);
}

// Function to send message to the database
function sendMessageToDatabase(displayName, messageText, timestamp) {
    const messageData = {
        displayName: displayName,
        messageText: messageText,
        timestamp: timestamp,
        isUser: true
    };
    
    push(messagesRef, messageData).then(() => {
        console.log('Message sent successfully');
    }).catch((error) => {
        console.error('Error sending message:', error);
    });

    document.getElementById('message-input').value = ''; // Clear message input after sending
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
