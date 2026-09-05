const API_BASE_URL = 'http://localhost:5000';

const studentBtn = document.getElementById('studentBtn');
const ownerBtn = document.getElementById('ownerBtn');
const indicator = document.querySelector('.indicator');
const formTitle = document.getElementById('formTitle');
const studentBg = document.querySelector('.student-bg');
const ownerBg = document.querySelector('.owner-bg');
const loginForm = document.getElementById('loginForm');
const formContainer = document.querySelector('.login-container');

// Track the selected role.
let selectedRole = 'student';

// Slider click events
studentBtn.addEventListener('click', () => {
  selectedRole = 'student';

  studentBtn.classList.add('active');
  ownerBtn.classList.remove('active');

  indicator.style.transform = 'translateX(0%)';

  if (formTitle) {
    formTitle.textContent = 'Student Login';
  }

  studentBg.style.transform = 'translateX(0%)';
  ownerBg.style.transform = 'translateX(100%)';
});

ownerBtn.addEventListener('click', () => {
  selectedRole = 'owner';

  ownerBtn.classList.add('active');
  studentBtn.classList.remove('active');

  indicator.style.transform = 'translateX(100%)';

  if (formTitle) {
    formTitle.textContent = 'Owner Login';
  }

  studentBg.style.transform = 'translateX(-100%)';
  ownerBg.style.transform = 'translateX(0%)';
});

// Real login
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const emailInput = loginForm.querySelector('input[type="email"]');
  const passwordInput = loginForm.querySelector('input[type="password"]');

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    alert('Please enter your email and password.');
    return;
  }

  try {
    // Ask the backend to authenticate the user.
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        password,
        role: selectedRole
      })
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.message || 'Invalid email or password.');
      return;
    }

    /*
      Login succeeded.

      The backend gives us a JWT token.
      We store it locally so future protected API requests
      can prove that this browser is authenticated.
    */
    localStorage.setItem('pgBuddieToken', data.token);

    // Store safe user information for the frontend.
    localStorage.setItem('pgBuddieUser', JSON.stringify(data.user));

    // Wet AF animation — preserved from your original code.
    document.body.style.transition =
      'filter 0.8s ease, transform 0.8s ease';

    document.body.style.filter = 'blur(4px) brightness(0.9)';
    document.body.style.transform = 'scale(0.96)';

    formContainer.style.transition =
      'transform 0.8s ease, opacity 0.8s ease';

    formContainer.style.transform =
      'translateY(-100px) scale(1.1)';

    formContainer.style.opacity = '0.9';

    formContainer.style.boxShadow =
      '0 20px 50px rgba(0,0,0,0.35)';

    // Wait for animation before redirecting.
    setTimeout(() => {
      if (selectedRole === 'student') {
        window.location.href = 'studenthome.html';
      } else if (selectedRole === 'owner') {
        window.location.href = 'ownerdashboard.html';
      }
    }, 800);

  } catch (error) {
    console.error('Login error:', error);

    alert(
      'Unable to connect to PG Buddie. Please make sure the backend is running.'
    );
  }
});

// Wet animation for Sign Up link with soft glow
const signupLink = document.querySelector('.signup-link a');

signupLink.addEventListener('click', function(e) {
  e.preventDefault();

  // Glow overlay behind form
  const overlay = document.createElement('div');

  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.background = 'rgba(137,247,254,0.2)';
  overlay.style.backdropFilter = 'blur(10px) brightness(1.1)';
  overlay.style.zIndex = '9998';
  overlay.style.opacity = '0';
  overlay.style.transition = 'opacity 0.8s ease';

  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    overlay.style.opacity = '1';
  });

  // Soft blur + pull-back for form
  document.body.style.transition =
    'filter 0.8s ease, transform 0.8s ease';

  document.body.style.filter = 'blur(4px) brightness(0.9)';
  document.body.style.transform = 'scale(0.96)';

  formContainer.style.transition =
    'transform 0.8s ease, opacity 0.8s ease';

  formContainer.style.transform =
    'translateY(-100px) scale(1.1)';

  formContainer.style.opacity = '0.9';

  formContainer.style.boxShadow =
    '0 20px 50px rgba(0,0,0,0.35)';

  // Redirect after animation
  const targetURL = this.getAttribute('href');

  setTimeout(() => {
    window.location.href = targetURL;
  }, 800);
});