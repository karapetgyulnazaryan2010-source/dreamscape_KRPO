document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    console.log('Attempting login for:', email);
    try {
        const response = await fetch(`${window.API_BASE_URL}/api/signin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
            credentials: 'include'
        });
        const data = await response.json();
        console.log('Server response:', data);
        if (response.ok) {
            alert('Login Successful! Redirecting...');
            localStorage.setItem('user', JSON.stringify(data.user));
            window.location.href = 'index.html';
        } else {
            alert('LOGIN ERROR: ' + (data.error || 'Unknown error occurred'));
        }
    } catch (error) {
        console.error('Connection Error:', error);
        alert('CONNECTION ERROR: Could not connect to server. Check if terminal is running node index.js');
    }
});
