window.UV_API_BASE = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  ? 'http://localhost:5000'
  : 'https://elibtoledo-backend.onrender.com';
