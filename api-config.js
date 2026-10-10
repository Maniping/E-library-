const isLocalDevelopment = ['localhost', '127.0.0.1'].includes(window.location.hostname);
window.UV_API_BASE = isLocalDevelopment
  ? 'http://localhost:5000'
  : 'https://elibtoledo-backend.onrender.com';
window.UV_DEMO_LOGIN_ENABLED = isLocalDevelopment;
