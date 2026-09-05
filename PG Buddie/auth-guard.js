const API_BASE_URL = 'http://localhost:5000';

async function requireAuthentication(requiredRole = null) {
  const token = localStorage.getItem('pgBuddieToken');

  // No token → definitely not logged in.
  if (!token) {
    window.location.href = 'login.html';
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      localStorage.removeItem('pgBuddieToken');
      localStorage.removeItem('pgBuddieUser');

      window.location.href = 'login.html';
      return null;
    }

    const data = await response.json();

    // Make sure a student cannot use an owner dashboard, and vice versa.
    if (requiredRole && data.user.role !== requiredRole) {
      window.location.href =
        data.user.role === 'student'
          ? 'studenthome.html'
          : 'ownerdashboard.html';

      return null;
    }

    // Keep the frontend's user information synchronized with the backend.
    localStorage.setItem(
      'pgBuddieUser',
      JSON.stringify(data.user)
    );

    return data.user;

  } catch (error) {
    console.error('Authentication check failed:', error);

    window.location.href = 'login.html';
    return null;
  }
}