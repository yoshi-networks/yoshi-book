// Initialize Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDBQYp6th2xSy8uT_P0QQqKdyh3FgDC-6c",
    authDomain: "your-project-id.firebaseapp.com",
    databaseURL: "https://your-project-id.firebaseio.com",
    projectId: "your-project-id",
    storageBucket: "your-project-id.appspot.com",
    messagingSenderId: "your-messaging-sender-id",
    appId: "your-app-id"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Reference to the database
const database = firebase.database();

// Function to sanitize and filter profanity
function sanitizeText(text) {
    const profanityList = ["badword1", "badword2", "badword3"]; // Replace with actual bad words
    let sanitizedText = text;

    profanityList.forEach(word => {
        const regex = new RegExp(word, 'gi'); // Matches the word regardless of case
        sanitizedText = sanitizedText.replace(regex, '*'.repeat(word.length));
    });

    return sanitizedText;
}

// Function to send a message
function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value;

    if (message.trim() === '') return;

    const sanitizedMessage = sanitizeText(message);

    database.ref('messages').push({
        text: sanitizedMessage,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });

    messageInput.value = '';
}

// Function to listen for new messages
function listenForMessages() {
    database.ref('messages').on('child_added', (snapshot) => {
        const message = snapshot.val();
        displayMessage(message.text);
    });
}

// Function to display a message
function displayMessage(message) {
    const messagesContainer = document.getElementById('messagesContainer');
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    messagesContainer.appendChild(messageElement);
}

// Event listener for the send button
document.getElementById('sendButton').addEventListener('click', sendMessage);

// Start listening for messages
listenForMessages();
