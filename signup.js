document.getElementById('signupForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    console.log('Attempting signup for:', email);
    try {
        const response = await fetch(`${window.API_BASE_URL}/api/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password }),
            credentials: 'include'
        });
        const data = await response.json();
        console.log('Server response:', data);
        if (response.ok) {
            alert('Account Created Successfully! Redirecting...');
            localStorage.setItem('user', JSON.stringify(data.user));
            window.location.href = 'index.html';
        } else {
            alert('SIGNUP ERROR: ' + (data.error || 'Unknown error occurred'));
        }
    } catch (error) {
        console.error('Connection Error:', error);
        alert('CONNECTION ERROR: Could not connect to server. Check if terminal is running node index.js');
    }
});
