function handleLogin(event) {
    event.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    // Check credentials against Firebase
    const userRef = ref(database, `usedDisplayNames/${username}`);
    get(userRef).then((snapshot) => {
        if (snapshot.exists() && snapshot.val() === password) {
            // Store login state
            localStorage.setItem('yoshibook_user', username);
            window.location.href = 'chat.html';
        } else {
            alert('Invalid username or password');
        }
    }).catch(handleFirebaseError);
}

function toggleForm() {
    const form = document.getElementById('loginForm');
    const title = document.querySelector('h1');
    if (form.dataset.mode === 'signup') {
        form.dataset.mode = 'login';
        title.textContent = 'Login to Yoshibook';
    } else {
        form.dataset.mode = 'signup';
        title.textContent = 'Sign up for Yoshibook';
    }
} 