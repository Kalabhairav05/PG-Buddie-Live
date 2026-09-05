const studentBtn = document.getElementById('studentBtn');
const ownerBtn = document.getElementById('ownerBtn');
const indicator = document.querySelector('.indicator');
const formTitle = document.getElementById('formTitle');
const studentFields = document.getElementById('studentFields');
const ownerFields = document.getElementById('ownerFields');
const formContainer = document.querySelector('.login-container'); // matches your HTML

let selectedRole = 'student';

// Slider click events
studentBtn.addEventListener('click', () => {
  indicator.style.transform = 'translateX(0%)';
  studentBtn.classList.add('active');
  ownerBtn.classList.remove('active');
  formTitle.textContent = 'Student Sign Up';
  studentFields.style.display = 'block';
  ownerFields.style.display = 'none';

  const college = document.getElementById('college');
  college.required = true;
  selectedRole = 'student';
});

ownerBtn.addEventListener('click', () => {
  indicator.style.transform = 'translateX(100%)';
  ownerBtn.classList.add('active');
  studentBtn.classList.remove('active');
  formTitle.textContent = 'Owner Sign Up';
  studentFields.style.display = 'none';
  ownerFields.style.display = 'none';

  const college = document.getElementById('college');
  college.required = false;
  selectedRole = 'owner';
});

// Real signup API — this will be handled by the backend we build next.
const signupForm = document.getElementById('signupForm');

signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const payload = {
    name: document.getElementById('fullName').value.trim(),
    email: document.getElementById('email').value.trim(),
    password: document.getElementById('password').value,
    phone: document.getElementById('phone').value.trim(),
    role: selectedRole
  };

  if (selectedRole === 'student') {
    payload.college = document.getElementById('college').value.trim();
  }

  if (!payload.name || !payload.email || !payload.password || !payload.phone) {
    alert('Please fill in all required fields.');
    return;
  }

  if (payload.password.length < 8) {
    alert('Password must be at least 8 characters.');
    return;
  }

  if (selectedRole === 'student' && !payload.college) {
    alert('Please enter your university / college.');
    return;
  }

  try {
    const response = await fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Unable to create account.');
    }

    alert('Account created successfully! You can now log in.');
    signupForm.reset();

    // Return the UI to the original default Student state.
    selectedRole = 'student';
    indicator.style.transform = 'translateX(0%)';
    studentBtn.classList.add('active');
    ownerBtn.classList.remove('active');
    formTitle.textContent = 'Student Sign Up';
    studentFields.style.display = 'block';
    ownerFields.style.display = 'none';
    document.getElementById('college').required = true;

  } catch (error) {
    console.error('Signup error:', error);
    alert(error.message || 'Could not connect to PG Buddie backend.');
  }
});

// Wet animation for "Already have an account? Login" link
const loginLink = document.querySelector('.signup-link a');

loginLink.addEventListener('click', function(e){
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

  requestAnimationFrame(() => { overlay.style.opacity = '1'; });

  // Soft blur + pull-back for form
  document.body.style.transition = 'filter 0.8s ease, transform 0.8s ease';
  document.body.style.filter = 'blur(4px) brightness(0.9)';
  document.body.style.transform = 'scale(0.96)';

  formContainer.style.transition = 'transform 0.8s ease, opacity 0.8s ease';
  formContainer.style.transform = 'translateY(-100px) scale(1.1)';
  formContainer.style.opacity = '0.9';
  formContainer.style.boxShadow = '0 20px 50px rgba(0,0,0,0.35)';

  // Redirect after animation
  const targetURL = this.getAttribute('href');
  setTimeout(() => {
    window.location.href = targetURL;
  }, 800);
});
