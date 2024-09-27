// Firebase CDN imports for browser compatibility
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, onChildAdded, push, remove, get, set } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCdnPP1xNfe13SuDNuaP2rOL6_WcbPN8cI",
    authDomain: "yoshibook-ba4ca.firebaseapp.com",
    projectId: "yoshibook-ba4ca",
    storageBucket: "yoshibook-ba4ca.appspot.com",
    messagingSenderId: "1092240192169",
    appId: "1:1092240192169:web:570ca3528a74bd87506fb8",
    databaseURL: "https://yoshibook-ba4ca-default-rtdb.firebaseio.com/"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
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
        deleteBtn.setAttribute('aria-label', 'Delete this message');
        deleteBtn.innerText = 'X';
        deleteBtn.onclick = () => deleteMessage(messageKey, messageElement);
        messageElement.appendChild(deleteBtn);
    }

    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Function to send a message
function sendMessage() {
    const messageInput = document.getElementById('message-input');
    const displayNameInput = document.getElementById('display-name');
    const passwordInput = document.getElementById('password');
    const messageText = messageInput.value.trim();
    const displayName = displayNameInput.value.trim() || 'Anonymous';
    const password = passwordInput.value.trim();
    const timestamp = new Date().toLocaleTimeString();

    if (messageText === '') {
        alert('Message cannot be empty.');
        return;
    }

    // Check if the user is already authenticated
    if (authenticatedUsers.has(displayName)) {
        sendMessageToDatabase(displayName, messageText, timestamp);
        return;
    }

    // If the display name is a used one, validate the password
    if (usedDisplayNames.has(displayName)) {
        if (usedDisplayNames.get(displayName) !== password) {
            alert('Incorrect password.');
            return;
        } else {
            authenticatedUsers.add(displayName); // User is authenticated for this session
        }
    } else if (password !== '') {
        // If it's a new display name, store the password
        usedDisplayNames.set(displayName, password);
        set(ref(database, `usedDisplayNames/${displayName}`), password)
            .catch(error => console.error('Error saving display name:', error));
        authenticatedUsers.add(displayName);
    }

    sendMessageToDatabase(displayName, messageText, timestamp);
    passwordInput.style.display = 'none'; // Hide password input after sending the message
    passwordInput.value = ''; // Clear password input
}

// Function to send message to the database
function sendMessageToDatabase(displayName, messageText, timestamp) {
    const messageData = {
        displayName: displayName,
        messageText: messageText,
        timestamp: timestamp,
        isUser: true
    };

    push(messagesRef, messageData)
        .then(() => {
            console.log('Message sent successfully.');
            document.getElementById('message-input').value = ''; // Clear the message input
        })
        .catch((error) => {
            console.error('Error sending message:', error);
            alert('Message could not be sent. Please try again.');
        });
}

// Function to handle Enter key press
function handleKeyDown(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

// Function to check if display name needs a password
function checkDisplayName() {
    const displayName = document.getElementById('display-name').value.trim();
    const passwordInput = document.getElementById('password');

    if (usedDisplayNames.has(displayName)) {
        // If the display name exists, show password input to verify identity
        passwordInput.style.display = 'block';
        passwordInput.placeholder = `Enter password for "${displayName}"`;
    } else {
        // If it's a new name, prompt the user to create a password
        passwordInput.style.display = 'block';
        passwordInput.placeholder = `Create a password to secure "${displayName}"`;
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
        alert('Incorrect password.');
    }
}

// Expose functions to global scope
window.sendMessage = sendMessage;
window.handleKeyDown = handleKeyDown;
window.checkDisplayName = checkDisplayName;
