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

// Update the bad words list and add enhanced filtering
const BAD_WORDS = [
    'fuck', 'shit', 'ass', 'bitch', 'dick', 'pussy', 'cock', 'cunt', 'bastard',
    'damn', 'hell ', 'piss', 'whore', 'slut', 'retard', 'nigger', 'faggot', 'kai', 'nigga'
];

// Add spam prevention variables
const SPAM_LIMIT = 1; // Number of messages
const SPAM_WINDOW = 3000; // Time window in milliseconds (3 seconds)
const MAX_MESSAGE_LENGTH = 100; // Character limit

// Add message tracking for spam prevention
let messageHistory = [];

// Add ban selection state
let isSelectingForBan = false;

// Add coordinator selection state
let isSelectingForCoordinator = false;

// Enhanced bad word filter
function filterBadWords(text) {
    let filteredText = text;
    BAD_WORDS.forEach(word => {
        // Create pattern that matches word with any non-alphanumeric characters between letters
        const pattern = word.split('').join('[^a-zA-Z0-9]*');
        const regex = new RegExp(pattern, 'gi');
        filteredText = filteredText.replace(regex, '*'.repeat(word.length));
    });
    return filteredText;
}

// Add spam check function
function isSpamming() {
    const now = Date.now();
    // Remove messages older than the spam window
    messageHistory = messageHistory.filter(time => now - time < SPAM_WINDOW);
    
    // Check if user has sent too many messages
    if (messageHistory.length >= SPAM_LIMIT) {
        const timeLeft = SPAM_WINDOW - (now - messageHistory[0]);
        // ← wrap the whole string in back-ticks, then close the ) 
        showNotification(`Please wait ${Math.ceil(timeLeft / 1000)} seconds before sending more messages`);
        return true;
    }
    
    // record this message’s timestamp and allow send
    messageHistory.push(now);
    return false;
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
async function getUserRole(username) {
    try {
        const roleRef = ref(database, `roles/${username}`);
        const snapshot = await get(roleRef);
        if (snapshot.exists()) {
            const role = snapshot.val();
            // Update localStorage to keep it in sync
            const roles = JSON.parse(localStorage.getItem('yoshibook_roles') || '{}');
            roles[username] = role;
            localStorage.setItem('yoshibook_roles', JSON.stringify(roles));
            return role;
        }
    } catch (error) {
        console.error('Error getting role:', error);
    }
    // Fallback to localStorage
    const roles = JSON.parse(localStorage.getItem('yoshibook_roles') || '{}');
    return roles[username] || 'user';
}

async function setUserRole(username, role) {
    try {
        // Update Firebase first
        await set(ref(database, `roles/${username}`), role);
        // Then update localStorage
        const roles = JSON.parse(localStorage.getItem('yoshibook_roles') || '{}');
        roles[username] = role;
        localStorage.setItem('yoshibook_roles', JSON.stringify(roles));
    } catch (error) {
        console.error('Error setting role:', error);
        throw error;
    }
}

async function isAdmin(username) {
    if (username === ADMIN_USERNAME) return true;
    const role = await getUserRole(username);
    return role === 'admin';
}

async function isCoordinator(username) {
    const role = await getUserRole(username);
    return role === 'coordinator';
}

async function canModerate(username) {
    return await isAdmin(username) || await isCoordinator(username);
}

// Ban system
async function isBanned(username) {
    try {
        const bannedRef = ref(database, banned/${username});
        const snapshot = await get(bannedRef);
        if (snapshot.exists()) {
            return true;
        }
    } catch (error) {
        console.error('Error checking ban status:', error);
    }
    
    // Fallback to localStorage
    const bannedUsers = JSON.parse(localStorage.getItem('yoshibook_banned') || '[]');
    return bannedUsers.includes(username);
}

async function banUser(username) {
    try {
        // Store in Firebase
        await set(ref(database, `banned/${username}`), true);
        
        // Update localStorage
        const bannedUsers = JSON.parse(localStorage.getItem('yoshibook_banned') || '[]');
        if (!bannedUsers.includes(username)) {
            bannedUsers.push(username);
            localStorage.setItem('yoshibook_banned', JSON.stringify(bannedUsers));
        }
        
        // If the banned user is currently logged in, disable their input
        const currentUser = localStorage.getItem('yoshibook_user');
        if (currentUser === username) {
            const messageInput = document.getElementById('message-input');
            if (messageInput) {
                messageInput.disabled = true;
                showNotification('You have been banned!');
            }
        }
    } catch (error) {
        console.error('Error banning user:', error);
        throw error;
    }
}

async function unbanUser(username) {
    try {
        // Remove from Firebase
        await remove(ref(database, `banned/${username}`));
        
        // Update localStorage
        const bannedUsers = JSON.parse(localStorage.getItem('yoshibook_banned') || '[]');
        const index = bannedUsers.indexOf(username);
        if (index > -1) {
            bannedUsers.splice(index, 1);
            localStorage.setItem('yoshibook_banned', JSON.stringify(bannedUsers));
        }
        
        // If the unbanned user is currently logged in, enable their input
        const currentUser = localStorage.getItem('yoshibook_user');
        if (currentUser === username) {
            const messageInput = document.getElementById('message-input');
            if (messageInput) {
                messageInput.disabled = false;
            }
        }
    } catch (error) {
        console.error('Error unbanning user:', error);
        throw error;
    }
}

// Message functions
async function sendMessage() {
    const messageInput = document.getElementById('message-input');
    const messageText = messageInput.value.trim();
    const user = localStorage.getItem('yoshibook_user') || 'Anonymous';

    if (messageText === '') return;

    // Check if user is banned
    if (await isBanned(user)) {
        showNotification('You have been banned!');
        messageInput.value = ''; // Clear the input
        messageInput.disabled = true; // Disable the input
        return;
    }

    // Check message length
    if (messageText.length > MAX_MESSAGE_LENGTH) {
        showNotification(`Message too long! Maximum ${MAX_MESSAGE_LENGTH} characters allowed`);
        return;
    }

    // Check for spam
    if (isSpamming()) {
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

async function deleteMessage(messageId, messageAuthor) {
    try {
        const currentUser = localStorage.getItem('yoshibook_user');
        const isUserAdmin = await isAdmin(currentUser);
        const isCoord = await isCoordinator(currentUser);
        const isMessageAuthorAdmin = await isAdmin(messageAuthor);
        const isMessageAuthorCoord = await isCoordinator(messageAuthor);
        
        // Allow deletion if:
        // 1. User is admin (can delete anything)
        // 2. User is coordinator and message is from a regular user
        // 3. User is the message author
        if (isUserAdmin || 
            (isCoord && !isMessageAuthorCoord && !isMessageAuthorAdmin) || 
            currentUser === messageAuthor) {
            await remove(ref(database, messages/${messageId}));
        } else {
            showNotification('You cannot delete this message');
        }
    } catch (error) {
        console.error('Error deleting message:', error);
        showNotification('Error deleting message');
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

async function displayMessage(messageData, messageKey) {
    const currentUser = localStorage.getItem('yoshibook_user');
    const isCurrentUser = messageData.displayName === currentUser;
    const messageUser = messageData.displayName;
    
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    messageElement.classList.add(isCurrentUser ? 'user' : 'other');
    
    let roleBadge = '';
    if (await isAdmin(messageUser)) {
        roleBadge = '<span class="role-badge admin">Admin</span>';
    } else if (await isCoordinator(messageUser)) {
        roleBadge = '<span class="role-badge coordinator">Coordinator</span>';
    }
    
    messageElement.innerHTML = `
      <span class="username">${escapeHtml(messageData.displayName)}:${roleBadge}</span>
      <div class="message-text">${escapeHtml(messageData.messageText)}</div>
      <span class="timestamp">${messageData.timestamp}</span>
    `;

    
    messageElement.addEventListener('click', () => handleMessageClick(messageElement));
    
    if (await canModerate(currentUser) || (isCurrentUser && currentUser !== 'Anonymous')) {
        const deleteBtn = document.createElement('button');
        deleteBtn.classList.add('delete-btn');
        deleteBtn.innerText = '×';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteMessage(messageKey, messageUser);
        };
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

    const userRef = ref(database, usedDisplayNames/${username});
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

        set(ref(database, usedDisplayNames/${username}), password)
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

async function updateAuthDisplay() {
    const user = localStorage.getItem('yoshibook_user');
    const authButtons = document.querySelector('.auth-buttons');
    
    if (!authButtons) return;
    
    if (user) {
        let roleBadge = '';
        if (await isAdmin(user)) {
            roleBadge = '<span class="role-badge admin">Admin</span>';
        } else if (await isCoordinator(user)) {
            roleBadge = '<span class="role-badge coordinator">Coordinator</span>';
        }
        
        const canMod = await canModerate(user);
        authButtons.innerHTML = 
            <div id="adminControls" class="admin-controls" style="display: ${canMod ? 'block' : 'none'}">
                <button class="admin-btn" onclick="window.showAdminPanel()">${await isAdmin(user) ? 'Admin Panel' : 'Coordinator Panel'}</button>
            </div>
            <span class="user-display">Welcome, ${user}${roleBadge}</span>
            <button class="auth-btn login-btn" onclick="window.logout()">Logout</button>
        ;
    } else {
        authButtons.innerHTML = 
            <button class="auth-btn login-btn" onclick="showLoginModal()">Login</button>
            <button class="auth-btn signup-btn" onclick="showSignupModal()">Sign Up</button>
        ;
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

// Add function to update coordinators list
function updateCoordinatorsList() {
    const coordinatorsList = document.getElementById('coordinatorsList');
    const roles = JSON.parse(localStorage.getItem('yoshibook_roles') || '{}');
    coordinatorsList.innerHTML = '';

    // Get all coordinators
    const coordinators = Object.entries(roles)
        .filter(([_, role]) => role === 'coordinator')
        .map(([username]) => username);

    if (coordinators.length === 0) {
        coordinatorsList.innerHTML = '<div class="empty-list">No coordinators appointed</div>';
        return;
    }

    coordinators.forEach(username => {
        const userDiv = document.createElement('div');
        userDiv.className = 'coordinator-user';
        userDiv.innerHTML = 
            <span>${escapeHtml(username)}</span>
            <button onclick="window.removeCoordinator('${escapeHtml(username)}')" class="remove-btn">Remove</button>
        ;
        coordinatorsList.appendChild(userDiv);
    });
}

// Add function to remove coordinator
async function removeCoordinator(username) {
    const currentUser = localStorage.getItem('yoshibook_user');
    if (!await isAdmin(currentUser)) {
        showNotification('Only admins can remove coordinators');
        return;
    }

    await setUserRole(username, 'user');
    showNotification(Removed ${username} as coordinator);
    updateCoordinatorsList();
    updateAuthDisplay();
}

// Update the admin panel HTML section in chat.html to replace the input with a button
async function showAdminPanel() {
    const modal = document.getElementById('adminPanel');
    const currentUser = localStorage.getItem('yoshibook_user');
    
    try {
        const isAdminUser = await isAdmin(currentUser);
        
        if (isAdminUser) {
            // Admin panel content
            modal.innerHTML = 
                <div class="modal-content">
                    <span class="close">&times;</span>
                    <h2>Admin Panel</h2>
                    <div class="admin-section">
                        <h3>Ban User</h3>
                        <button onclick="window.startBanSelection()" class="admin-button">Select Message to Ban User</button>
                    </div>
                    <div class="admin-section">
                        <h3>Appoint Coordinator</h3>
                        <button onclick="window.startCoordinatorSelection()" class="admin-button">Select Message to Appoint Coordinator</button>
                    </div>
                    <div class="admin-section">
                        <h3>Banned Users</h3>
                        <div id="banned-users-list"></div>
                    </div>
                    <div class="admin-section">
                        <h3>Coordinators</h3>
                        <div id="coordinators-list"></div>
                    </div>
                </div>
            ;
        } else {
            // Coordinator panel content
            modal.innerHTML = 
                <div class="modal-content">
                    <span class="close">&times;</span>
                    <h2>Coordinator Panel</h2>
                    <div class="admin-section">
                        <h3>Ban User</h3>
                        <button onclick="window.startBanSelection()" class="admin-button">Select Message to Ban User</button>
                    </div>
                    <div class="admin-section">
                        <h3>Banned Users</h3>
                        <div id="banned-users-list"></div>
                    </div>
                </div>
            ;
        }
        
        modal.style.display = 'block';
        await updateBannedUsersList();
        if (isAdminUser) {
            await updateCoordinatorsList();
        }

        // Add close button functionality
        const closeBtn = modal.querySelector('.close');
        if (closeBtn) {
            closeBtn.onclick = () => {
                modal.style.display = 'none';
            };
        }
    } catch (error) {
        console.error('Error showing admin panel:', error);
        showNotification('Error loading admin panel');
    }
}

// Add new function to start coordinator selection
async function startCoordinatorSelection() {
    const currentUser = localStorage.getItem('yoshibook_user');
    if (!await isAdmin(currentUser)) {
        showNotification('Only admins can appoint coordinators');
        return;
    }

    // Close admin panel
    document.getElementById('adminPanel').style.display = 'none';
    
    // Show coordinator selection notification
    showNotification('Select a message to appoint its author as coordinator');
    
    // Enable message selection
    isSelectingForCoordinator = true;
    
    // Add selectable class to all messages
    document.querySelectorAll('.message').forEach(message => {
        message.classList.add('selectable');
    });
}

// Add function to update all messages
async function updateAllMessages() {
    const messages = document.querySelectorAll('.message');
    for (const message of messages) {
        const username = message.querySelector('.username').textContent.split(':')[0].trim();
        let roleBadge = '';
        if (await isAdmin(username)) {
            roleBadge = '<span class="role-badge admin">Admin</span>';
        } else if (await isCoordinator(username)) {
            roleBadge = '<span class="role-badge coordinator">Coordinator</span>';
        }
        
        const usernameElement = message.querySelector('.username');
        usernameElement.innerHTML = `${escapeHtml(username)}:${roleBadge}`;
    }
}

// Update handleMessageClick to properly handle coordinator appointment
async function handleMessageClick(messageElement) {
    if (isSelectingForBan) {
        const username = messageElement.querySelector('.username').textContent.split(':')[0].trim();
        const currentUser = localStorage.getItem('yoshibook_user');

        if (await canModerate(username)) {
            showNotification('Cannot ban moderators');
            stopBanSelection();
            return;
        }

        await banUser(username);
        showNotification(`${username} banned!`);
        stopBanSelection();
    } else if (isSelectingForCoordinator) {
        const username = messageElement.querySelector('.username').textContent.split(':')[0].trim();
        const currentUser = localStorage.getItem('yoshibook_user');

        if (await canModerate(username)) {
            showNotification('User is already a moderator');
            stopCoordinatorSelection();
            return;
        }

        try {
            await setUserRole(username, 'coordinator');
            showNotification(Appointed ${username} as coordinator);
            
            // Update UI elements
            await updateCoordinatorsList();
            await updateAuthDisplay();
            
            // Update all messages to show new coordinator badge
            const messages = document.querySelectorAll('.message');
            for (const message of messages) {
                const messageUsername = message.querySelector('.username').textContent.split(':')[0].trim();
                if (messageUsername === username) {
                    const usernameElement = message.querySelector('.username');
                    usernameElement.innerHTML = ${escapeHtml(username)}:<span class="role-badge coordinator">Coordinator</span>;
                }
            }
            
            stopCoordinatorSelection();
        } catch (error) {
            showNotification('Error appointing coordinator');
            console.error('Error:', error);
        }
    }
}

// Add function to stop coordinator selection
function stopCoordinatorSelection() {
    isSelectingForCoordinator = false;
    document.querySelectorAll('.message').forEach(message => {
        message.classList.remove('selectable', 'selecting');
    });
}

// Add to the exported functions
const exportedFunctions = {
    showLoginModal,
    showSignupModal,
    handleLogin,
    handleSignup,
    logout,
    sendMessage,
    deleteMessage,
    handleKeyDown,
    showAdminPanel,
    startCoordinatorSelection,
    stopCoordinatorSelection,
    banUserFromPanel,
    unbanUserFromPanel,
    startBanSelection,
    stopBanSelection,
    handleMessageClick,
    unbanUser,
    banUser,
    isBanned,
    canModerate,
    updateBannedUsersList,
    updateCoordinatorsList,
    removeCoordinator,
    updateAllMessages,
    isAdmin,
    isCoordinator
};

// Export all functions to window
Object.assign(window, exportedFunctions);

// Also explicitly export these functions
window.startBanSelection = startBanSelection;
window.stopBanSelection = stopBanSelection;
window.handleMessageClick = handleMessageClick;
window.unbanUser = unbanUser;
window.banUser = banUser;
window.isBanned = isBanned;
window.canModerate = canModerate;
window.showAdminPanel = showAdminPanel;
window.updateAllMessages = updateAllMessages;
window.isAdmin = isAdmin;
window.isCoordinator = isCoordinator;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    const cookieUser = getCookie('yoshibook_user');
    if (cookieUser) {
        localStorage.setItem('yoshibook_user', cookieUser);
    }
    await updateAuthDisplay();
    await checkBanStatus();
    loadMessages();
    
    // Close modals when clicking outside
    window.onclick = function(event) {
        if (event.target.className === 'modal') {
            event.target.style.display = 'none';
        }
    };
});

// Add these new functions
async function banUserFromPanel() {
    const username = document.getElementById('banUsername').value.trim();
    if (!username) return;

    const currentUser = localStorage.getItem('yoshibook_user');
    if (!await canModerate(currentUser)) {
        showNotification('You do not have permission to ban users');
        return;
    }

    if (await canModerate(username)) {
        showNotification('Cannot ban moderators');
        return;
    }

    await banUser(username);
    showNotification(`Banned ${username}`);
    document.getElementById('banUsername').value = '';
    updateBannedUsersList();
}

async function unbanUserFromPanel(username) {
    if (!username) return;

    const currentUser = localStorage.getItem('yoshibook_user');
    if (!await canModerate(currentUser)) {
        showNotification('You do not have permission to unban users');
        return;
    }

    await unbanUser(username);
    showNotification(Unbanned ${username});
    updateBannedUsersList();
}

function updateBannedUsersList() {
    const bannedUsers = JSON.parse(localStorage.getItem('yoshibook_banned') || '[]');
    const bannedUsersList = document.getElementById('banned-users-list');
    bannedUsersList.innerHTML = '';

    bannedUsers.forEach(username => {
        const userDiv = document.createElement('div');
        userDiv.className = 'banned-user';
        userDiv.innerHTML = 
            <span>${escapeHtml(username)}</span>
            <button onclick="window.unbanUserFromPanel('${escapeHtml(username)}')">Unban</button>
        ;
        bannedUsersList.appendChild(userDiv);
    });
}

// Add character counter to chat.html input
function updateCharCount() {
    const messageInput = document.getElementById('message-input');
    const charCount = document.getElementById('char-count');
    const remaining = MAX_MESSAGE_LENGTH - messageInput.value.length;
    
    charCount.textContent = ${remaining} characters left;
    
    // Change color when approaching limit
    if (remaining <= 20) {
        charCount.style.color = remaining <= 10 ? '#f44336' : '#ff9800';
    } else {
        charCount.style.color = '#666';
    }
}

async function startBanSelection() {
    const currentUser = localStorage.getItem('yoshibook_user');
    if (!await canModerate(currentUser)) {
        showNotification('You do not have permission to ban users');
        return;
    }

    // Close admin panel
    document.getElementById('adminPanel').style.display = 'none';
    
    // Show ban selection notification
    showNotification('Who would you like to ban?');
    
    // Enable message selection
    isSelectingForBan = true;
    
    // Add selectable class to all messages
    document.querySelectorAll('.message').forEach(message => {
        message.classList.add('selectable');
    });
}

function stopBanSelection() {
    isSelectingForBan = false;
    document.querySelectorAll('.message').forEach(message => {
        message.classList.remove('selectable', 'selecting');
    });
}

// Add function to check ban status on page load
async function checkBanStatus() {
    const user = localStorage.getItem('yoshibook_user');
    if (user) {
        const isUserBanned = await isBanned(user);
        const messageInput = document.getElementById('message-input');
        if (messageInput) {
            messageInput.disabled = isUserBanned;
            if (isUserBanned) {
                showNotification('You have been banned!');
            }
        }
    }
}
