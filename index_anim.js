// landing.js

// Initialize plugins
gsap.registerPlugin(TextPlugin);

// Audio setup
const ambientAudio = document.getElementById('ambient-audio');
if(ambientAudio) ambientAudio.volume = 0; // Fade in later

// Web Audio API Synthesizer (Premium AI/Nature UI Sounds)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(type, freq, decay, volOffset = 1.0) {
  if(audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  gain.gain.setValueAtTime(0.2 * volOffset, audioCtx.currentTime); // Increased base volume
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + decay);
  osc.connect(gain); gain.connect(audioCtx.destination);
  osc.start(); osc.stop(audioCtx.currentTime + decay);
}

function playHoverSound() { 
  // Soft air pulse / shimmer: sine wave fading fast.
  playTone('sine', 880, 0.2, 0.8);
  setTimeout(() => playTone('sine', 1200, 0.3, 0.5), 50);
}

function playClickSound() { 
  // Smooth cinematic whoosh: fast sine sweep downward
  if(audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.5);
  gain.gain.setValueAtTime(0.3, audioCtx.currentTime); // Increased whoosh volume
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
  osc.connect(gain); gain.connect(audioCtx.destination);
  osc.start(); osc.stop(audioCtx.currentTime + 0.5);
}

function playTreeGrowthSound() {
  if(audioCtx.state === 'suspended') audioCtx.resume();
  // Rising chime representing organic growth
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(220, audioCtx.currentTime); 
  // Glide up gracefully
  osc.frequency.linearRampToValueAtTime(880, audioCtx.currentTime + 2.5); 
  
  gain.gain.setValueAtTime(0, audioCtx.currentTime);
  gain.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 1.0); // smooth fade in (louder)
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 3.0); // long fade out
  
  osc.connect(gain); gain.connect(audioCtx.destination);
  osc.start(); osc.stop(audioCtx.currentTime + 3.0);
}

// DOM Elements
const startBtn = document.getElementById('start-btn');
const beginOverlay = document.getElementById('begin-overlay');
const particlesDiv = document.getElementById('particles-js');
const bgGradient = document.getElementById('bg-gradient');

// Path logic 
const trunk = document.querySelectorAll('.trunk');
const branches = document.querySelectorAll('.branch');
const leaves = document.querySelectorAll('.tree-leaf');
const treeContainer = document.getElementById('tree-container');

// Orbit Cards
const cards = document.querySelectorAll('.data-card');

// Texts
const titleText = document.getElementById('titleText');
const subtitleText = document.getElementById('subtitleText');
const welcomeText = document.getElementById('welcomeText');
const ctaBtn = document.getElementById('cta-btn');

// Start Timeline Function
function startCinematic() {
  // Act 1: Bypassing autoplay & Dark Screen Init (0s - 2s)
  beginOverlay.style.pointerEvents = 'none';
  gsap.to(beginOverlay, { opacity: 0, duration: 1, onComplete: () => beginOverlay.remove() });
  
  // Start ambient audio (fade in over 5s to 35% volume)
  ambientAudio.play().catch(e => console.log("Audio autoplay blocked", e));
  gsap.to(ambientAudio, { volume: 0.35, duration: 5 });

  // Initialize Particles (tsParticles)
  tsParticles.load("particles-js", {
    particles: {
      number: { value: 60 },
      color: { value: "#00C896" },
      shape: { type: "circle" },
      opacity: { value: 0.2, random: true },
      size: { value: 3, random: true },
      move: { enable: true, speed: 0.8, direction: "top", outModes: "out" }
    },
    background: { color: "transparent" }
  });

  const tl = gsap.timeline();

  // Act 1: Fade in particles & zoom camera effect
  tl.to(particlesDiv, { opacity: 1, duration: 2, ease: "power2.inOut" }, "0")
    .fromTo('.scene-container', { scale: 1.5 }, { scale: 1, duration: 2.5, ease: "power1.out" }, "0");

  // Act 2 (2s - 5s): Orbit Cards appear and orbit
  // Pre-position cards in a circle around center
  gsap.set("#card-ph", { x: 0, y: -120 });
  gsap.set("#card-tds", { x: 120, y: 0 });
  gsap.set("#card-temp", { x: 0, y: 120 });
  gsap.set("#card-hum", { x: -120, y: 0 });

  tl.to(cards, { opacity: 1, scale: 1, duration: 1, stagger: 0.2, ease: "back.out(1.7)" }, "2")
    // Orbit rotation continuous around container
    .to(".data-orbit-container", { rotation: 360, duration: 20, repeat: -1, ease: "none" }, "2")
    // Counter-rotate individual cards so text stays upright
    .to(cards, { rotation: -360, duration: 20, repeat: -1, ease: "none" }, "2");

  // End of Act 2: Collapse cards into the center bottom (where the tree will start)
  tl.to(cards, { x: 0, y: 150, opacity: 0, scale: 0, duration: 1, ease: "power2.in" }, "4")
    .to(".data-orbit-container", { autoAlpha: 0, duration: 0.1 }, "5");

  // Act 3 (5s - 8s): Tree Morph/Growth Action
  // Setup SVG stroke length for draw animation
  const allPaths = [...trunk, ...branches];
  allPaths.forEach(p => {
    const l = p.getTotalLength();
    gsap.set(p, { strokeDasharray: l, strokeDashoffset: l });
  });

  // Background gradient shift to nature theme
  tl.to(bgGradient, { opacity: 1, duration: 3, ease: "none" }, "4.5");

  // Draw trunk, then branches, then fade in leaves
  tl.call(playTreeGrowthSound, null, "5")
    .to(trunk, { strokeDashoffset: 0, duration: 1.5, ease: "power2.out" }, "5")
    .to(branches, { strokeDashoffset: 0, duration: 1.5, stagger: 0.1, ease: "power2.out" }, "5.8")
    .to(leaves, { opacity: 1, scale: 1.2, duration: 0.5, stagger: 0.05, ease: "back.out(2)" }, "6.5")
    .to(leaves, { scale: 1, duration: 0.2, stagger: 0.05 }, "7")
    // Subtle pulse on leaves representing life/flow
    .to(leaves, { opacity: 0.6, duration: 2, repeat: -1, yoyo: true, ease: "sine.inOut" }, "7.5");

  // Act 4 (8s - 10s): Brand Typography Reveal
  tl.fromTo(titleText, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 1.5, ease: "power3.out" }, "8")
    .fromTo(subtitleText, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 1.5, ease: "power3.out" }, "8.5")
    // Dim tree slightly and push to background 
    .to(treeContainer, { opacity: 0.2, filter: "blur(3px)", duration: 2 }, "8.5");

  // Act 5 (10s - 12s): Welcome Msg Typewriter
  gsap.set(welcomeText, { opacity: 1 });
  tl.to(welcomeText, { text: "Welcome to the Future of Farming", duration: 2, ease: "none" }, "10");

  // Act 6 (12s - 15s): CTA Get Started
  tl.fromTo(ctaBtn, { y: 20, opacity: 0, scale: 0.9 }, { y: 0, opacity: 1, scale: 1, duration: 1, ease: "back.out(1.5)" }, "12.5");
}

startBtn.addEventListener('mouseenter', playHoverSound);
startBtn.addEventListener('click', () => { 
  playClickSound(); 
  startCinematic(); 
});

const getStartedBtnNode = document.querySelector('.btn-get-started');
if(getStartedBtnNode) {
   getStartedBtnNode.addEventListener('mouseenter', playHoverSound);
   getStartedBtnNode.addEventListener('click', playClickSound);
}

// Transition out logic
function transitionToAuth() {
  const tl = gsap.timeline();
  // Fade out audio
  gsap.to(ambientAudio, { volume: 0, duration: 1 });
  // Zoom into hyperspace out
  tl.to('.scene-container', { scale: 3, opacity: 0, duration: 1, ease: "power2.in" }, "0")
    .to(particlesDiv, { opacity: 0, duration: 0.5 }, "0")
    .to(bgGradient, { opacity: 0, duration: 0.5 }, "0");
    
  setTimeout(() => {
    window.location.href = 'auth.html';
  }, 1000);
}
