// auth.js
const { 
  app, 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  onAuthStateChanged,
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  serverTimestamp 
} = window.firebaseAuthModules;

const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const showSignupBtn = document.getElementById('showSignup');
const showLoginBtn = document.getElementById('showLogin');
const errorMsg = document.getElementById('errorMsg');
const googleBtn = document.getElementById('googleBtn');
const authSubtitle = document.getElementById('authSubtitle');
const skipAuthBtn = document.getElementById('skipAuthBtn');

const welcomeScreen = document.getElementById('welcomeScreen');
const authForms = document.getElementById('authForms');
const getStartedBtn = document.getElementById('getStartedBtn');
const authBox = document.getElementById('authBox');

if (getStartedBtn) {
  getStartedBtn.addEventListener('click', () => {
    if(welcomeScreen) welcomeScreen.classList.add('hidden');
    if(authForms) authForms.classList.remove('hidden');
    if(authBox) authBox.classList.remove('expanded');
  });
}

// Route Protection: If already logged in, bounce to dashboard
onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = 'dashboard.html';
  }
});

// Skip Authentication Handler
if (skipAuthBtn) {
  skipAuthBtn.addEventListener('click', () => {
    sessionStorage.setItem('guestMode', 'true');
    window.location.href = 'dashboard.html';
  });
}

// Helper: Show Error
function showError(message) {
  errorMsg.innerText = message;
  setTimeout(() => errorMsg.innerText = '', 5000);
}

// Toggle Forms
showSignupBtn.addEventListener('click', () => {
  loginForm.classList.add('hidden');
  signupForm.classList.remove('hidden');
  authSubtitle.innerText = 'Create a new farm account.';
  errorMsg.innerText = '';
});

showLoginBtn.addEventListener('click', () => {
  signupForm.classList.add('hidden');
  loginForm.classList.remove('hidden');
  authSubtitle.innerText = 'Sign in to manage your farm.';
  errorMsg.innerText = '';
});

// Helper: Sync User to Firestore
async function syncUserToFirestore(user, name = null) {
  try {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      // New user, create document
      await setDoc(userRef, {
        uid: user.uid,
        name: name || user.displayName || 'Hydro Farmer',
        email: user.email,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp()
      });
    } else {
      // Existing user, update last login
      await setDoc(userRef, {
        lastLogin: serverTimestamp()
      }, { merge: true });
    }
  } catch (error) {
    console.error("Firestore sync error: ", error);
  }
}

// 1. Google Sign-In
googleBtn.addEventListener('click', async () => {
  const provider = new GoogleAuthProvider();
  googleBtn.disabled = true;
  const originalHtml = googleBtn.innerHTML;
  googleBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
  
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    await syncUserToFirestore(user);
    // onAuthStateChanged handles the redirect
  } catch (error) {
    console.error("Google Auth Error:", error);
    let msg = 'Authentication failed.';
    if(error.code === 'auth/popup-closed-by-user') msg = 'Sign-in popup was closed.';
    if(error.code === 'auth/unauthorized-domain') msg = 'This domain is not authorized in Firebase Console.';
    if(error.code === 'auth/network-request-failed') msg = 'Network error. Check connection.';
    showError(msg);
    googleBtn.innerHTML = originalHtml;
    googleBtn.disabled = false;
  }
});

// 2. Email/Password Signup
signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nameInput = document.getElementById('signupName');
  const emailInput = document.getElementById('signupEmail');
  const passwordInput = document.getElementById('signupPassword');
  
  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  const btn = document.getElementById('signupSubmitBtn');
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
  btn.disabled = true;
  nameInput.disabled = true;
  emailInput.disabled = true;
  passwordInput.disabled = true;

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    await syncUserToFirestore(user, name);
    // onAuthStateChanged handles the redirect
  } catch (error) {
    console.error("Signup Error:", error);
    let msg = 'Failed to create account.';
    if(error.code === 'auth/email-already-in-use') msg = 'Email is already registered.';
    if(error.code === 'auth/weak-password') msg = 'Password must be at least 6 characters.';
    if(error.code === 'auth/invalid-email') msg = 'Invalid email address format.';
    if(error.code === 'auth/network-request-failed') msg = 'Network error. Please try again.';
    showError(msg);
    
    btn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account';
    btn.disabled = false;
    nameInput.disabled = false;
    emailInput.disabled = false;
    passwordInput.disabled = false;
  }
});

// 3. Email/Password Login
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const emailInput = document.getElementById('loginEmail');
  const passwordInput = document.getElementById('loginPassword');
  
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  const btn = document.getElementById('loginSubmitBtn');
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
  btn.disabled = true;
  emailInput.disabled = true;
  passwordInput.disabled = true;

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    await syncUserToFirestore(userCredential.user);
    // onAuthStateChanged handles the redirect
  } catch (error) {
    console.error("Login Error:", error);
    let msg = 'Invalid email or password.';
    if(error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
      msg = 'Invalid email or password.'; // Generic message for security
    }
    if(error.code === 'auth/too-many-requests') msg = 'Too many attempts. Try again later.';
    if(error.code === 'auth/network-request-failed') msg = 'Network error. Please try again.';
    
    showError(msg);
    btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
    btn.disabled = false;
    emailInput.disabled = false;
    passwordInput.disabled = false;
  }
});

// Card is fixed in layout — no dragging
if (authBox) {
  authBox.style.cursor = 'default';
}
