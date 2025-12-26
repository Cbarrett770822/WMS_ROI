// Authentication utility functions

function checkAuth() {
    const token = localStorage.getItem('authToken');
    if (!token) {
        window.location.href = 'login.html';
        return null;
    }
    try {
        return JSON.parse(localStorage.getItem('user'));
    } catch (error) {
        logout();
        return null;
    }
}

function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}

function getAuthToken() {
    return localStorage.getItem('authToken');
}

function getUser() {
    try {
        return JSON.parse(localStorage.getItem('user'));
    } catch (error) {
        return null;
    }
}
