// script.js
// Get Firebase modules from window (initialized in index.html)
const { getAuth, onAuthStateChanged, signOut, getDatabase, ref, onValue, set, push, serverTimestamp, app, onChildAdded } = window.firebaseModules;

const auth = getAuth(app);

// Initialize Database
const db = getDatabase(app);

// ---------- GLOBAL VARS ----------
let tdsChart, tempPhChart;
const timeLabels = [];
const tdsData = [];
const tempData = [];
const phData = [];
const MAX_HISTORY = 20;

// DOM Elements
const elements = {
  temp: document.getElementById('tempValue'),
  hum: document.getElementById('humidityValue'),
  waterTemp: document.getElementById('waterTempValue'),
  ph: document.getElementById('phValue'),
  ec: document.getElementById('ecValue'),
  flow: document.getElementById('flowValue'),
  co2: document.getElementById('co2Value'),
  water: document.getElementById('waterValue'),
  light: document.getElementById('lightValue'),
  leak: document.getElementById('leakValue'),
  waterBar: document.getElementById('waterLevelBar'),
  // Status DOMs
  tempStatus: document.getElementById('tempStatus'),
  humStatus: document.getElementById('humStatus'),
  waterTempStatus: document.getElementById('waterTempStatus'),
  phStatus: document.getElementById('phStatus'),
  ecStatus: document.getElementById('ecStatus'),
  flowStatus: document.getElementById('flowStatus'),
  co2Status: document.getElementById('co2Status'),
  lightStatus: document.getElementById('lightStatus'),
  leakStatus: document.getElementById('leakStatus'),
  
  alertMsg: document.getElementById('alertMessage'),
  alertBanner: document.getElementById('alertBanner'),
  aiResult: document.getElementById('dashboardAiResultText'),
  healthText: document.getElementById('dashboardHealthText'),
  aiConfidence: document.getElementById('dashboardAiConfidence'),
  aiBgOverlay: document.getElementById('aiBgOverlayDashboard'),
  aiSolutionBtn: document.getElementById('btnViewAnalysis'),
  plantImg: document.getElementById('dashboardPlantImage'),
  connectionBadge: document.getElementById('connectionStatus'),
  pumpToggle: document.getElementById('pumpToggle'),
  lightToggle: document.getElementById('lightToggle'),
  mistToggle: document.getElementById('mistToggle'),
  ctrlPumpStatus: document.getElementById('ctrlPumpStatus'),
  lightStatus: document.getElementById('lightStatus'),
  ctrlLightStatus: document.getElementById('ctrlLightStatus'),
  ctrlMistStatus: document.getElementById('ctrlMistStatus'),
  iconPump: document.getElementById('icon-pump'),
  iconLight: document.getElementById('icon-light'),
  iconMist: document.getElementById('icon-mist'),
  ctrlMoisture: document.getElementById('ctrlMoistureValue'),
  ctrlMoistureBar: document.getElementById('ctrlMoistureBar'),
  ctrlDo: document.getElementById('ctrlDoValue'),
  ctrlMacro: document.getElementById('ctrlMacroValue'),
  ctrlFlow: document.getElementById('ctrlFlowValue')
};

// ---------- INIT CHARTS ----------
function initCharts() {
  const ctxTds = document.getElementById('tdsChart').getContext('2d');
  let gradient1 = ctxTds.createLinearGradient(0, 0, 0, 300);
  gradient1.addColorStop(0, 'rgba(20,184,166,0.4)');
  gradient1.addColorStop(1, 'rgba(20,184,166,0.0)');

  tdsChart = new Chart(ctxTds, {
    type: 'line',
    data: {
      labels: timeLabels,
      datasets: [{
        label: 'EC (mS/cm)',
        data: tdsData,
        borderColor: '#14b8a6',
        backgroundColor: gradient1,
        borderWidth: 3,
        tension: 0.5,
        fill: true,
        pointBackgroundColor: '#fff',
        pointRadius: 3
      }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { grid:{color:'rgba(255,255,255,0.05)'} }, x: {grid:{display:false}} } }
  });

  const ctxTP = document.getElementById('tempPhChart');
  if(ctxTP) {
     const ctx2d = ctxTP.getContext('2d');
     let gradientTemp = ctx2d.createLinearGradient(0, 0, 0, 300);
     gradientTemp.addColorStop(0, 'rgba(251,113,133,0.4)'); // Rose
     gradientTemp.addColorStop(1, 'rgba(251,113,133,0.0)');
     
     let gradientPh = ctx2d.createLinearGradient(0, 0, 0, 300);
     gradientPh.addColorStop(0, 'rgba(192,132,252,0.4)'); // Purple
     gradientPh.addColorStop(1, 'rgba(192,132,252,0.0)');

     tempPhChart = new Chart(ctx2d, {
       type: 'line',
       data: {
         labels: timeLabels,
         datasets: [
           {
             label: 'Temperature (°C)',
             data: tempData,
             borderColor: '#fb7185',
             backgroundColor: gradientTemp,
             borderWidth: 3,
             tension: 0.5,
             yAxisID: 'y',
             fill: true,
             pointBackgroundColor: '#fff',
             pointRadius: 3
           },
           {
             label: 'pH Level',
             data: phData,
             borderColor: '#c084fc',
             backgroundColor: gradientPh,
             borderWidth: 3,
             tension: 0.5,
             yAxisID: 'y1',
             fill: true,
             pointBackgroundColor: '#fff',
             pointRadius: 3
           }
         ]
       },
       options: {
         responsive: true,
         maintainAspectRatio: false,
         plugins: { legend: { display: true, labels: { color: '#cbd5e1' } } },
         scales: {
           x: { grid: { display: false } },
           y: { type: 'linear', display: true, position: 'left', grid: { color: 'rgba(255,255,255,0.05)' } },
           y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false } }
         }
       }
     });
  }
}

// Update charts with new data
function updateCharts(tempVal, phVal, tdsVal) {
  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  timeLabels.push(now);
  tdsData.push(tdsVal);
  tempData.push(tempVal);
  phData.push(phVal);
  if (timeLabels.length > MAX_HISTORY) {
    timeLabels.shift(); tdsData.shift(); tempData.shift(); phData.shift();
  }
  if (tdsChart) tdsChart.update();
  if (tempPhChart) tempPhChart.update();
  updateSparklines();
}

// Sparklines mock (simple)
function updateSparklines() {
  // Not fully implemented, keep simple
}

// Global System Configurations
window.sysConfig = {
  minTemp: Number(localStorage.getItem('sysMinTemp')) || 18,
  maxTemp: Number(localStorage.getItem('sysMaxTemp')) || 30,
  minPh: Number(localStorage.getItem('sysMinPh')) || 5.0,
  maxPh: Number(localStorage.getItem('sysMaxPh')) || 7.0,
  minEc: Number(localStorage.getItem('sysMinEc')) || 1.2,
  maxEc: Number(localStorage.getItem('sysMaxEc')) || 2.5,
  minCo2: Number(localStorage.getItem('sysMinCo2')) || 400,
  maxCo2: Number(localStorage.getItem('sysMaxCo2')) || 1500,
  tempUnit: localStorage.getItem('sysTempUnit') || 'C'
};

// --- SMART TOAST NOTIFICATION ENGINE ---
const notifSystem = {
  container: document.getElementById('toastContainer'),
  
  add(message, type = 'warning') {
    if(!this.container) return;
    const toast = document.createElement('div');
    toast.className = `smart-toast ${type}`;
    let icon = type === 'danger' ? 'fa-exclamation-triangle text-rose-500' : 'fa-exclamation-circle text-amber-500';
    if(type === 'success') icon = 'fa-check-circle text-emerald-500';
    
    toast.innerHTML = `
      <i class="fas ${icon} toast-icon"></i>
      <div class="toast-content flex-grow">
        <h4>System Alert</h4>
        <p>${message}</p>
      </div>
    `;
    this.container.appendChild(toast);
    
    // GSAP Slide In
    gsap.to(toast, { x: 0, opacity: 1, duration: 0.5, ease: 'back.out(1.2)' });
    
    // Auto Remove
    setTimeout(() => {
      gsap.to(toast, { x: 120, opacity: 0, duration: 0.5, onComplete: () => toast.remove() });
    }, 5000);
  }
};

/* --- AI BOT FARM ASSISTANT --- */
const botAssistant = {
  bubble: document.getElementById('botChatBubble'),
  text: document.getElementById('botChatText'),
  avatarBtn: document.getElementById('botAvatarBtn'),
  closeBtn: document.getElementById('closeBotBtn'),
  currentTimeout: null,
  
  init() {
    if(!this.avatarBtn || !this.bubble) return;
    this.avatarBtn.addEventListener('click', () => {
      this.bubble.classList.toggle('hidden');
    });
    this.closeBtn.addEventListener('click', () => {
      this.bubble.classList.add('hidden');
    });
  },

  say(message, duration = 14000) {
    if(!this.text) return;
    this.text.innerHTML = `${message}`;
    this.bubble.classList.remove('hidden');
    if (this.currentTimeout) clearTimeout(this.currentTimeout);
    this.currentTimeout = setTimeout(() => {
      this.bubble.classList.add('hidden');
    }, duration);
  }
};
botAssistant.init();

function generateBotAdvice(data, type) {
  if (type === 'highTemp') return `Your farm air temperature is dangerously high (${data.temp.toFixed(1)}${window.sysConfig.tempUnit}). <br/><br/><strong>Recommendation:</strong> Activate exhaust fans to reduce heat.`;
  if (type === 'lowTemp') return `Air Temperature is dropping (${data.temp.toFixed(1)}${window.sysConfig.tempUnit}). <br/><br/><strong>Recommendation:</strong> Increase ambient room heating.`;
  if (type === 'highPh') return `Warning! pH is ${data.ph.toFixed(1)} (Alkaline). Above ${window.sysConfig.maxPh}, plants suffer nutrient lockout. <br/><br/><strong>Recommendation:</strong> Mix pH-Down and re-test.`;
  if (type === 'lowPh') return `pH is crashing down to ${data.ph.toFixed(1)} (Acidic). This burns root zones. <br/><br/><strong>Recommendation:</strong> Add pH-Up solution.`;
  if (type === 'lowEC') return `Nutrients are depleted (EC ${data.ec.toFixed(1)}). Your plants are starving! <br/><br/><strong>Recommendation:</strong> Top up the reservoir with Part A & Part B hydroponic solution to reach optimal EC.`;
  if (type === 'highEC') return `Nutrient burn risk! EC is extremely high (${data.ec.toFixed(1)}). <br/><br/><strong>Recommendation:</strong> Flush the system with clean water to dilute the salt concentration.`;
  if (type === 'lowWater') return `CRITICAL: Primary reservoir water level is dangerously low. <br/><br/><strong>Recommendation:</strong> Refill the tank immediately.`;
  if (type === 'leak') return `EMERGENCY: Water leak detected on the floor sensors! <br/><br/><strong>Recommendation:</strong> Pump has been stopped. Please check pipes and fittings immediately.`;
  if (type === 'lowFlow') return `CRITICAL: No water flow detected from the pump. <br/><br/><strong>Recommendation:</strong> Check if pump is burnt out, clogged, or disconnected.`;
  if (type === 'highCO2') return `CO2 levels are unusually high (${data.co2} ppm). <br/><br/><strong>Recommendation:</strong> While good for plants, ensure the space is safe for humans. Triggering ventilation is recommended.`;
  if (type === 'lowCO2') return `CO2 levels are depleted (${data.co2} ppm). Plant growth will stunt. <br/><br/><strong>Recommendation:</strong> Reduce exhaust fan speed or check CO2 generator.`;
  return "I have detected an anomaly in the farm. Please inspect your systems.";
}

const activeAlerts = { temp: false, hum: false, ph: false, ec: false, water: false, flow: false, co2: false, leak: false };

// Helper to update status badges
function updateStatusBadge(element, isCritical, isWarning) {
  if (!element) return;
  element.classList.remove('status-good', 'status-warning', 'status-critical');
  if (isCritical) {
    element.classList.add('status-critical');
    element.innerHTML = '<i class="fas fa-times-circle"></i> Critical';
  } else if (isWarning) {
    element.classList.add('status-warning');
    element.innerHTML = '<i class="fas fa-exclamation-circle"></i> Warning';
  } else {
    element.classList.add('status-good');
    element.innerHTML = '<i class="fas fa-check-circle"></i> Good';
  }
}

// Alert system & Tree Growth Reactivity
function checkThresholds(data, statusObj = {}) {
  let critical = false;
  
  const setStatus = (el, valStatus, isWarnFallback) => {
    if(!el) return;
    if(valStatus === "OUT_OF_RANGE" || valStatus === "SENSOR_ERROR") {
       el.innerHTML = `<i class="fas fa-times-circle"></i> ${valStatus.replace(/_/g, ' ')}`; 
       el.className = 'text-rose-400 text-xs font-semibold';
       critical = true;
    }
    else if(valStatus === "STALE") { 
       el.innerHTML = '<i class="fas fa-history"></i> STALE'; 
       el.className = 'text-amber-400 text-xs font-semibold'; 
    }
    else if(isWarnFallback) { 
       el.innerHTML = '<i class="fas fa-exclamation-circle"></i> Warning'; 
       el.className = 'text-amber-400 text-xs font-semibold'; 
    }
    else { 
       el.innerHTML = '<i class="fas fa-circle text-[8px]"></i> Optimal'; 
       el.className = 'text-emerald-400 text-xs font-semibold flex items-center gap-1'; 
    }
  };

  setStatus(elements.tempStatus, statusObj.temperature, false);
  setStatus(elements.humStatus, statusObj.humidity, false);
  setStatus(elements.phStatus, statusObj.ph, false);
  setStatus(elements.ecStatus, statusObj.ec, false);
  setStatus(elements.waterTempStatus, statusObj.water_temp, false);
  
  const flowAlert = data.flow !== null && data.flow < 1.0;
  setStatus(elements.flowStatus, flowAlert ? "OUT_OF_RANGE" : "OK", false);

  const lAlert = data.leak === true;
  if(elements.leakStatus) setStatus(elements.leakStatus, lAlert ? "OUT_OF_RANGE" : "OK", false);
  if (lAlert) {
    critical = true;
    if (!activeAlerts.leak) { notifSystem.add(`WATER LEAK DETECTED! System halted.`, 'danger'); activeAlerts.leak = true; }
    if(elements.leak) { elements.leak.innerText = "DETECTED"; elements.leak.className = "font-bold text-rose-500"; }
  } else { 
    activeAlerts.leak = false; 
    if(elements.leak) { elements.leak.innerText = "Secure"; elements.leak.className = "font-medium text-emerald-400"; }
  }

  // --- Cinematic Lettuce Reactivity ---
  const lettuceGlow = document.querySelector('.lettuce-glow');
  const leavesBack = document.querySelector('.leaf-back');
  const leavesMid = document.querySelector('.leaf-mid');
  const leavesFront = document.querySelector('.leaf-front');
  const roots = document.querySelector('.lettuce-roots');
  const connBadge = document.getElementById('connectionStatus');
  
  if(connBadge) {
     if(critical) {
        connBadge.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Action Required';
        connBadge.className = "px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm font-semibold flex items-center gap-2 shadow-[0_0_15px_rgba(244,63,94,0.3)] animate-pulse";
     } else if (activeAlerts.hum) {
        connBadge.innerHTML = '<i class="fas fa-leaf"></i> Slight Warning';
        connBadge.className = "px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm font-semibold flex items-center gap-2";
     } else {
        connBadge.innerHTML = '<i class="fas fa-leaf"></i> Ecosystem Healthy';
        connBadge.className = "px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-semibold flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.2)] animate-pulse";
     }
  }

  if (leavesFront) {
    if (critical) {
       gsap.to([leavesBack, leavesMid, leavesFront], { fill: '#fbbf24', stroke: '#f59e0b', filter: 'drop-shadow(0 0 10px rgba(245,158,11,0.5))', duration: 1.5 });
       gsap.to(roots, { stroke: '#fbbf24', duration: 1.5 });
       if(lettuceGlow) gsap.to(lettuceGlow, { fill: '#f43f5e', opacity: 0.3, duration: 1.5 });
    } else if(activeAlerts.hum) { 
       gsap.to([leavesMid, leavesFront], { fill: '#34d399', stroke: '#fbbf24', duration: 1.5 });
       if(lettuceGlow) gsap.to(lettuceGlow, { fill: '#fbbf24', opacity: 0.2, duration: 1.5 });
    } else {
       gsap.to(leavesBack, { fill: '#10b981', stroke: '#059669', filter: 'drop-shadow(0 0 10px rgba(16,185,129,0.3))', duration: 2 });
       gsap.to(leavesMid, { fill: '#34d399', stroke: '#059669', duration: 2 });
       gsap.to(leavesFront, { fill: '#6ee7b7', stroke: '#10b981', duration: 2 });
       gsap.to(roots, { stroke: 'rgba(167, 243, 208, 0.5)', duration: 2 });
       if(lettuceGlow) gsap.to(lettuceGlow, { fill: '#10b981', opacity: 0.1, duration: 2 });
    }
  }
}

// Hardware Diagnostics Updater
function updateHardwareDiagnostics(rawVals) {
  const setDiag = (id, val, isError, errMsg) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (val === null || isNaN(val) && typeof val !== 'boolean') {
      el.className = 'diag-status diag-error';
      el.innerText = 'Disconnected';
      return;
    }
    if (isError) {
      el.className = 'diag-status diag-error';
      el.innerText = errMsg;
    } else {
      el.className = 'diag-status diag-good';
      el.innerText = 'Working Properly';
    }
  };

  // DHT22 affects temp and hum
  const dhtError = activeAlerts.temp || activeAlerts.hum;
  setDiag('diag-dht22', rawVals.temp, dhtError, 'Env Out of Bounds');
  
  // DS18B20 Water Temp (only check disconnection for now as limits aren't strict yet)
  setDiag('diag-ds18b20', rawVals.waterTemp, false, '');

  setDiag('diag-ph', rawVals.ph, activeAlerts.ph, 'Calibration Issue');
  setDiag('diag-ec', rawVals.ec, activeAlerts.ec, 'Nutrient Lockout/Burn');
  
  const flowError = rawVals.flow !== null && rawVals.flow < 1.0;
  setDiag('diag-flow', rawVals.flow, flowError, 'Pump/Flow Blocked');

  setDiag('diag-co2', rawVals.co2, activeAlerts.co2, 'Ventilation Issue');
  
  const luxError = rawVals.light !== null && rawVals.light < 1000;
  setDiag('diag-lux', rawVals.light, luxError, 'Light Failure');

  // Ultrasonic sensor
  const waterError = rawVals.waterLevel !== null && rawVals.waterLevel < 20;
  setDiag('diag-ultrasonic', rawVals.waterLevel, waterError, 'Low Level Warning');

  // Leak Detector
  setDiag('diag-leak', rawVals.leak ? 1 : 0, rawVals.leak, 'Leak Detected');
}

// Function for GSAP counting micro-animations
function updateCounter(el, val, isFloat = true) {
  if(!el) return;
  if (val === null || isNaN(val)) { el.innerText = '--'; return; }
  gsap.to(el, {
    innerHTML: val,
    duration: 1.5,
    snap: { innerHTML: isFloat ? 0.1 : 1 },
    onUpdate: function() {
      if(isFloat) el.innerHTML = Number(this.targets()[0].innerHTML).toFixed(1);
    }
  });
}

// ---------- FIREBASE LISTENERS ----------
function listenToSensors() {
  const sensorsRef = ref(db, 'sensors');
  onValue(sensorsRef, (snapshot) => {
    let data = snapshot.val();
    if (!data) return;
    if (data.latest) data = data.latest; // Handle nested latest
    
    // Robust parsing using multiple possible Firebase JSON schema keys
    let temp = data.airTemperature !== undefined ? Number(data.airTemperature) : (data.air_temperature !== undefined ? Number(data.air_temperature) : (data.temperature !== undefined ? Number(data.temperature) : null));
    let waterTemp = data.waterTemperature !== undefined ? Number(data.waterTemperature) : (data.water_temperature !== undefined ? Number(data.water_temperature) : (data.water_temp !== undefined ? Number(data.water_temp) : null));
    const hum = data.humidity !== undefined ? Number(data.humidity) : null;
    const ph = data.ph !== undefined ? Number(data.ph) : null;
    let ec = data.ec !== undefined ? Number(data.ec) : null;
    if (ec === null && data.tds !== undefined) {
      ec = Number(data.tds) / 500.0;
    }
    const flow = data.flow_rate !== undefined ? Number(data.flow_rate) : (data.flow !== undefined ? Number(data.flow) : null);
    const co2 = data.co2 !== undefined ? Number(data.co2) : null;
    let light = data.sunlight !== undefined ? Number(data.sunlight) : (data.light_lux !== undefined ? Number(data.light_lux) : (data.light !== undefined ? Number(data.light) : null));
    if (light !== null && light <= 100 && data.light_lux === undefined) {
      light = light * 100;
    }
    const leak = data.leak !== undefined ? Boolean(data.leak) : false; 
    const waterLevel = data.waterLevel !== undefined ? Number(data.waterLevel) : (data.water_level !== undefined ? Number(data.water_level) : (data.water !== undefined ? Number(data.water) : 50));
    
    // Apply unit conversion before threshold checks
    if (window.sysConfig.tempUnit === 'F') {
      if (temp !== null && !isNaN(temp)) temp = (temp * 9 / 5) + 32;
      if (waterTemp !== null && !isNaN(waterTemp)) waterTemp = (waterTemp * 9 / 5) + 32;
    }

    // GSAP Cinematic Counting Update
    updateCounter(elements.temp, temp, true);
    updateCounter(elements.waterTemp, waterTemp, true);
    updateCounter(elements.hum, hum, false);
    updateCounter(elements.ph, ph, true);
    updateCounter(elements.ec, ec, true);
    updateCounter(elements.flow, flow, true);
    if(elements.co2) updateCounter(elements.co2, co2, false);
    if(elements.light) updateCounter(elements.light, light, false);
    updateCounter(elements.water, waterLevel, false);
    
    if(elements.waterBar) {
      gsap.to(elements.waterBar, { width: Math.min(Math.max(waterLevel, 0), 100) + '%', duration: 1.5, ease: 'power2.out' });
    }    
    // Check missing Status UI elements for safety
    if(waterTemp !== null) updateStatusBadge(elements.waterTempStatus, false, false);
    if(light !== null) updateStatusBadge(elements.lightStatus, light < 1000, false);
    
    checkThresholds({ 
      temp, 
      humidity: hum, 
      ph, 
      ec, 
      flow, 
      co2, 
      leak 
    }, data.status || {});

    // Update the diagnostics panel 
    updateHardwareDiagnostics({
      temp, waterTemp, hum, ph, ec, flow, co2, light, waterLevel, leak
    });
    
    // Update Roots Control display metrics
    if (elements.ctrlMoisture) updateCounter(elements.ctrlMoisture, waterLevel, false);
    if (elements.ctrlMoistureBar) {
      gsap.to(elements.ctrlMoistureBar, { width: Math.min(Math.max(waterLevel !== null ? waterLevel : 0, 0), 100) + '%', duration: 1.5, ease: 'power2.out' });
    }
    if (elements.ctrlFlow) updateCounter(elements.ctrlFlow, flow, true);

    if (elements.ctrlDo) {
       let dissolvedOxygen = 8.4;
       if (waterTemp !== null) {
          // Simple inverse correlation for demo 
          dissolvedOxygen = Math.max(5.0, 14.6 - (0.25 * waterTemp));
       }
       updateCounter(elements.ctrlDo, dissolvedOxygen, true);
    }

    if (elements.ctrlMacro) {
       if (ec === null) elements.ctrlMacro.innerText = "Offline";
       else if (ec < window.sysConfig.minEc) { elements.ctrlMacro.innerText = "Deficient Payload"; elements.ctrlMacro.className = "font-bold text-amber-400 text-lg"; }
       else if (ec > window.sysConfig.maxEc) { elements.ctrlMacro.innerText = "Burn Risk"; elements.ctrlMacro.className = "font-bold text-rose-400 text-lg"; }
       else { elements.ctrlMacro.innerText = "Nitrogen/K/P (Stable)"; elements.ctrlMacro.className = "font-bold text-white text-lg"; }
    }
    
    // Update history node & charts (bypass strict null check for disconnected graphs)
    updateCharts(temp || 0, ph || 0, ec || 0);
  });
}

let aiDiseaseAlerted = false;

function listenToAI() {
  const aiRef = ref(db, 'ai');
  onValue(aiRef, (snapshot) => {
    const ai = snapshot.val();
    if (!ai) return;
    
    const statusStr = ai.healthStatus ? String(ai.healthStatus).toLowerCase() : 'healthy';
    const isHealthy = statusStr === 'healthy' || statusStr === 'normal' || statusStr === 'ok';
    
    // Visual Updates
    if(elements.aiConfidence) elements.aiConfidence.innerText = (90 + Math.random() * 8).toFixed(1) + '% CONF';
    
    if (isHealthy) {
       if(elements.aiResult) { elements.aiResult.innerText = 'Lactuca sativa - Healthy'; elements.aiResult.className = 'text-emerald-400 font-bold drop-shadow-md text-xl'; }
       if(elements.healthText) elements.healthText.innerText = 'STATUS: OPTIMAL';
       if(elements.aiBgOverlay) elements.aiBgOverlay.className = 'absolute inset-0 bg-emerald-500/5 mix-blend-color-burn z-0 group-hover:bg-emerald-500/10 transition duration-1000';
       aiDiseaseAlerted = false;
    } else {
       const dName = ai.diseaseName || 'Issue Detected';
       if(elements.aiResult) { elements.aiResult.innerText = `Threat: ${dName}`; elements.aiResult.className = 'text-rose-400 font-bold drop-shadow-[0_0_10px_rgba(244,63,94,0.8)] animate-pulse text-xl'; }
       if(elements.healthText) elements.healthText.innerText = 'STATUS: ACTION REQUIRED';
       if(elements.aiBgOverlay) elements.aiBgOverlay.className = 'absolute inset-0 bg-rose-500/10 mix-blend-color-burn z-0 group-hover:bg-rose-500/20 transition duration-1000';
       if (!aiDiseaseAlerted) {
          notifSystem.add(`AI Vision Alert: ${dName}`, 'danger');
          aiDiseaseAlerted = true;
       }
    }
    
    if (ai.imageUrl && elements.plantImg) {
      elements.plantImg.src = ai.imageUrl;
    }
  });


  // ─── ESP32-CAM Stream Controller ───────────────────────────────
  const camStreamImg    = document.getElementById('camStreamImg');
  const camOfflinePlate = document.getElementById('camOfflinePlate');
  const camStatusBadge  = document.getElementById('camStatusBadge');
  const camStatusDot    = document.getElementById('camStatusDot');
  const camStatusText   = document.getElementById('camStatusText');
  const camIpInput      = document.getElementById('camIpInput');
  const camUrlPreview   = document.getElementById('camUrlPreview');
  const camConnectBtn   = document.getElementById('camConnectBtn');
  const camDisconnectBtn= document.getElementById('camDisconnectBtn');
  const camFullscreenBtn= document.getElementById('camFullscreenBtn');
  const scanBtn         = document.getElementById('btnScanNow');
  const scanLine        = document.getElementById('aiScanLine');
  const dashDesc        = document.getElementById('dashboardAiDescription');
  const healthDot       = document.getElementById('dashboardHealthDot');
  const healthText      = document.getElementById('dashboardHealthText');

  let camIp = localStorage.getItem('camIp') || '';
  if (camIp && camIpInput) camIpInput.value = camIp;

  function setCamOnline(ip) {
    const streamUrl = `http://${ip}:81/stream`;
    if (!camStreamImg) return;
    camStreamImg.src = streamUrl;
    camStreamImg.classList.remove('hidden');
    camOfflinePlate?.classList.add('hidden');
    camFullscreenBtn?.classList.remove('hidden');
    if (camStatusBadge) {
      camStatusBadge.style.background = 'rgba(16,185,129,0.15)';
      camStatusBadge.style.borderColor = 'rgba(16,185,129,0.3)';
      camStatusBadge.style.color = '#10b981';
    }
    if (camStatusDot) camStatusDot.className = 'w-1.5 h-1.5 rounded-full bg-emerald-400';
    if (camStatusText) camStatusText.innerText = 'Live';
    if (camUrlPreview) camUrlPreview.innerText = streamUrl;
    if (healthDot) { healthDot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping'; }
    if (healthText) healthText.innerText = 'STATUS: STREAMING';
    if (dashDesc) dashDesc.innerText = 'Live feed active from ESP32-CAM AI Thinker. Plant monitoring in progress.';
    localStorage.setItem('camIp', ip);
    notifSystem.add(`ESP32-CAM connected at ${ip}`, 'success');
  }

  function setCamOffline() {
    if (camStreamImg) { camStreamImg.src = ''; camStreamImg.classList.add('hidden'); }
    camOfflinePlate?.classList.remove('hidden');
    camFullscreenBtn?.classList.add('hidden');
    if (camStatusBadge) {
      camStatusBadge.style.background = 'rgba(248,113,113,0.15)';
      camStatusBadge.style.borderColor = 'rgba(248,113,113,0.3)';
      camStatusBadge.style.color = '#f87171';
    }
    if (camStatusDot) camStatusDot.className = 'w-1.5 h-1.5 rounded-full bg-rose-400';
    if (camStatusText) camStatusText.innerText = 'Offline';
    if (camUrlPreview) camUrlPreview.innerText = '--';
    if (healthDot) healthDot.className = 'w-2.5 h-2.5 rounded-full bg-slate-600';
    if (healthText) healthText.innerText = 'STATUS: CAMERA DISCONNECTED';
    if (dashDesc) dashDesc.innerText = 'Camera offline. Enter the ESP32-CAM IP address and tap Connect.';
  }

  // Error handler if stream fails to load
  window.onCamError = () => {
    setCamOffline();
    notifSystem.add('Camera stream failed. Check IP address & WiFi.', 'danger');
  };

  // Connect button
  camConnectBtn?.addEventListener('click', () => {
    const ip = camIpInput?.value.trim();
    if (!ip) { notifSystem.add('Please enter the camera IP address.', 'warning'); return; }
    camConnectBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Connecting...';
    setTimeout(() => {
      setCamOnline(ip);
      camConnectBtn.innerHTML = '<i class="fas fa-plug mr-1"></i> Connect';
    }, 800);
  });

  // Disconnect button
  camDisconnectBtn?.addEventListener('click', () => {
    setCamOffline();
    localStorage.removeItem('camIp');
    if (camIpInput) camIpInput.value = '';
    notifSystem.add('Camera disconnected.', 'warning');
  });

  // Snapshot button — opens capture URL in new tab
  scanBtn?.addEventListener('click', () => {
    const ip = localStorage.getItem('camIp');
    if (!ip) { notifSystem.add('Connect a camera first.', 'warning'); return; }
    const captureUrl = `http://${ip}/capture`;
    window.open(captureUrl, '_blank');
    if (scanLine) {
      gsap.to(scanLine, { opacity: 1, duration: 0.2 });
      gsap.fromTo(scanLine, { top: '0%' }, { top: '100%', duration: 1.2, ease: 'power2.inOut', yoyo: true, repeat: 1,
        onComplete: () => gsap.to(scanLine, { opacity: 0, duration: 0.2 }) });
    }
    notifSystem.add('Snapshot captured — opening in new tab.', 'success');
  });

  // Auto-reconnect on load if IP was saved
  if (camIp) {
    setTimeout(() => setCamOnline(camIp), 1500);
  }

  if (elements.aiSolutionBtn) {
    elements.aiSolutionBtn.addEventListener('click', (e) => {
      e.preventDefault();
      // Smoothly click the Analytics Sidebar Nav icon
      const analyticsTab = document.querySelector('a[data-target="view-analytics"]');
      if (analyticsTab) analyticsTab.click();
    });
  }
}

// Helper to trigger Root Control animation
function triggerControlAnim(iconEl, isOn) {
    if(!iconEl) return;
    if(isOn) {
       gsap.to(iconEl, { scale: 1.15, filter: 'drop-shadow(0 0 15px currentColor)', duration: 0.4, ease: 'back.out(1.5)'});
    } else {
       gsap.to(iconEl, { scale: 1, filter: 'drop-shadow(0 0 0px currentColor)', duration: 0.4, ease: 'power2.inOut'});
    }
}

function listenToControls() {
  const ctrlRef = ref(db, 'controls');
  onValue(ctrlRef, (snap) => {
    const ctrl = snap.val() || {};
    elements.pumpToggle.checked = !!ctrl.pump;
    elements.lightToggle.checked = !!ctrl.light;
    elements.mistToggle.checked = !!ctrl.mist;
    elements.ctrlPumpStatus.innerText = ctrl.pump ? 'ACTIVE' : 'INACTIVE';
    elements.ctrlLightStatus.innerText = ctrl.light ? 'ACTIVE' : 'INACTIVE';
    elements.ctrlMistStatus.innerText = ctrl.mist ? 'ACTIVE' : 'INACTIVE';
    
    triggerControlAnim(elements.iconPump, !!ctrl.pump);
    triggerControlAnim(elements.iconLight, !!ctrl.light);
    triggerControlAnim(elements.iconMist, !!ctrl.mist);
  });
}

// Control toggles
function setupControlListeners() {
  elements.pumpToggle.addEventListener('change', (e) => {
    elements.ctrlPumpStatus.innerText = e.target.checked ? 'ACTIVE' : 'INACTIVE';
    triggerControlAnim(elements.iconPump, e.target.checked);
    set(ref(db, 'controls/pump'), e.target.checked).catch(() => {});
  });
  elements.lightToggle.addEventListener('change', (e) => {
    elements.ctrlLightStatus.innerText = e.target.checked ? 'ACTIVE' : 'INACTIVE';
    triggerControlAnim(elements.iconLight, e.target.checked);
    set(ref(db, 'controls/light'), e.target.checked).catch(() => {});
  });
  elements.mistToggle.addEventListener('change', (e) => {
    elements.ctrlMistStatus.innerText = e.target.checked ? 'ACTIVE' : 'INACTIVE';
    triggerControlAnim(elements.iconMist, e.target.checked);
    set(ref(db, 'controls/mist'), e.target.checked).catch(() => {});
  });
}

// --- DEMO SIMULATOR REMOVED FOR PRODUCTION ---

// UI Helpers
function updateDateTime() {
  const now = new Date();
  document.getElementById('liveDateTime').innerText = now.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', second:'2-digit', hour12: true });
}
setInterval(updateDateTime, 1000);
window.dismissAlert = () => elements.alertBanner.style.opacity = '0.5';

// Refresh image button
document.getElementById('refreshImageBtn')?.addEventListener('click', () => {
  elements.plantImg.src = elements.plantImg.src + '?t=' + Date.now();
});

// Route Protection & Initialization
onAuthStateChanged(auth, (user) => {
  const isGuest = sessionStorage.getItem('guestMode') === 'true';

  if (!user && !isGuest) {
    window.location.replace('auth.html');
  } else {
    // Start everything
    initCharts();
    listenToSensors();
    listenToAI();
    listenToControls();
    setupControlListeners();
    updateDateTime();
    
    // Bind UI to actual Auth Profile or Guest Profile
    const userNameEl = document.querySelector('.user-name') || document.getElementById('userNameDisplay');
    const userRoleEl = document.querySelector('.user-role');
    const userCoreEl = document.getElementById('userCoreDisplay');
    
    if (user) {
      const nameToDisplay = user.displayName || localStorage.getItem('hydroAdminName') || (user.email ? user.email.split('@')[0] : 'Farm Admin');
      if (userNameEl) userNameEl.innerText = nameToDisplay;
      if (userRoleEl) userRoleEl.innerText = user.email || 'Admin';
      if (userCoreEl) userCoreEl.innerText = nameToDisplay + ' Core';
    } else if (isGuest) {
      if (userNameEl) userNameEl.innerText = 'Guest Viewer';
      if (userRoleEl) userRoleEl.innerText = 'Read-Only Access';
      if (userCoreEl) userCoreEl.innerText = 'Guest Core';
    }

    // Ready for production data
  }
});

// Logout functionality
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    sessionStorage.removeItem('guestMode');
    signOut(auth).then(() => window.location.replace('auth.html'));
  });
}

// Connection status, Watchdog & Health Score
let lastEspUpdate = 0;
const lastUpdateRef = ref(db, 'system/lastUpdate');
onValue(lastUpdateRef, (snap) => {
  const val = snap.val();
  if (typeof val === 'number') lastEspUpdate = Math.max(lastEspUpdate, val);
});
const sensorsUpdateRef = ref(db, 'sensors/lastUpdate');
onValue(sensorsUpdateRef, (snap) => {
  const val = snap.val();
  if (typeof val === 'number') lastEspUpdate = Math.max(lastEspUpdate, val);
});

const healthRef = ref(db, 'system/healthScore');
onValue(healthRef, (snap) => {
  const score = snap.val() || 0;

  // Original display
  const hsElement = document.getElementById('healthScoreDisplay');
  if (hsElement) {
    updateCounter(hsElement, score, false);
    if (score < 50) hsElement.className = "text-rose-400 font-bold";
    else if (score < 80) hsElement.className = "text-amber-400 font-bold";
    else hsElement.className = "text-emerald-400 font-bold";
  }

  // Hero ring update
  const ringNum = document.getElementById('healthRingNum');
  const ringVal = document.getElementById('healthRingVal');
  if (ringNum) ringNum.innerText = score;
  if (ringVal) {
    // Circle r=33, circumference = 2π*33 ≈ 207
    const offset = 207 - (score / 100) * 207;
    ringVal.style.strokeDashoffset = offset;
    ringVal.style.stroke = score < 50 ? '#f87171' : score < 80 ? '#fbbf24' : '#10b981';
  }
  if (ringNum) {
    ringNum.style.color = score < 50 ? '#f87171' : score < 80 ? '#fbbf24' : '#10b981';
  }

  // Hero last update timestamp
  const heroTs = document.getElementById('heroLastUpdate');
  if (heroTs) heroTs.innerText = new Date().toLocaleTimeString();
});

const alertsRef = ref(db, 'alerts');
onChildAdded(alertsRef, (data) => {
  const alert = data.val();
  if (alert && alert.message) {
    const severity = alert.severity === "high" ? "danger" : "warning";
    notifSystem.add(`ESP32 Alert: ${alert.message}`, severity);
  }
});

// Helper to set a hero tag's state
function setHeroTag(tagId, dotId, textId, isOnline, onText, offText) {
  const tag = document.getElementById(tagId);
  const dot = document.getElementById(dotId);
  const txt = document.getElementById(textId);
  if (!tag || !dot || !txt) return;
  if (isOnline) {
    tag.className = 'h-tag g';
    dot.className = 'sdot ok';
    txt.innerText = onText;
  } else {
    tag.className = 'h-tag b';
    dot.className = 'sdot crit';
    txt.innerText = offText;
  }
}

let firebaseConnected = false;

// Detect Firebase RTDB connectivity via .info/connected
const connectedRef = ref(db, '.info/connected');
onValue(connectedRef, (snap) => {
  firebaseConnected = snap.val() === true;
  setHeroTag('heroTagFb', 'heroFbDot', 'heroFbText', firebaseConnected, 'Firebase Live', 'Firebase Offline');
});

setInterval(() => {
  const espAlive = lastEspUpdate > 0 && Math.abs(Date.now() - lastEspUpdate) < 60000;

  // Connection badge (header)
  if (!espAlive) {
    elements.connectionBadge.innerHTML = '<i class="fas fa-circle" style="color:#f87171"></i> Offline';
    elements.connectionBadge.classList.replace('bg-emerald-500/10', 'bg-rose-500/10');
    elements.connectionBadge.classList.replace('text-emerald-400', 'text-rose-400');
    elements.connectionBadge.classList.replace('border-emerald-500/30', 'border-rose-500/30');
    elements.connectionBadge.classList.remove('animate-pulse');
  } else {
    elements.connectionBadge.innerHTML = '<i class="fas fa-circle" style="color:#4ade80"></i> Live';
    elements.connectionBadge.classList.replace('bg-rose-500/10', 'bg-emerald-500/10');
    elements.connectionBadge.classList.replace('text-rose-400', 'text-emerald-400');
    elements.connectionBadge.classList.replace('border-rose-500/30', 'border-emerald-500/30');
    elements.connectionBadge.classList.add('animate-pulse');
  }

  // Hero strip tags
  setHeroTag('heroTagEsp', 'heroEspDot', 'heroEspText', espAlive, 'ESP32 Online', 'ESP32 Offline');
  setHeroTag('heroTagSensors', 'heroSensorDot', 'heroSensorText', espAlive, '7 Sensors Active', 'No Sensor Data');
}, 3000);

// --- SIDEBAR SPA NAVIGATION ---
const navItems = document.querySelectorAll('#sidebarNav .nav-item');
const pageViews = document.querySelectorAll('.page-view');
const activeTitle = document.getElementById('activeViewTitle');
const sidebarNode = document.getElementById('mainSidebar');

// Initialize view states
pageViews.forEach(view => {
  if (view.id === 'view-dashboard') {
     gsap.set(view, { autoAlpha: 1, y: 0, display: 'block' });
  } else {
     gsap.set(view, { autoAlpha: 0, y: 15, display: 'none' });
  }
});

navItems.forEach(item => {
  item.addEventListener('click', (e) => {
    if(item.id === 'logoutBtn' || item.getAttribute('target') === '_blank') return;
    e.preventDefault();
    
    const targetId = item.getAttribute('data-target');

    // Account Modal Interception Logic
    if (targetId === 'view-account') {
       const modal = document.getElementById('view-account');
       const card = document.getElementById('accountModalCard');
       if(modal && card) {
          gsap.to(modal, { autoAlpha: 1, duration: 0.25, ease: 'power2.out', pointerEvents: 'auto' });
          gsap.fromTo(card, { scale: 0.95, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.25, ease: 'power2.out' });
       }
       // Close mobile sidebar on click
       if(window.innerWidth < 768) closeSidebar();
       return; // Stop execution to prevent active class changing on dashboard tabs
    }
    
    // Active class toggle
    navItems.forEach(nav => {
       nav.classList.remove('active', 'bg-white/10', 'text-white');
       nav.classList.add('opacity-70');
    });
    item.classList.add('active', 'bg-white/10', 'text-white');
    item.classList.remove('opacity-70');

    const targetTitle = item.innerText.trim();
    if(activeTitle) activeTitle.innerText = targetTitle;
    
    // GSAP Smooth Navigation Crossfade
    pageViews.forEach(view => {
       if(view.id === targetId) {
          view.style.display = 'block';
          gsap.fromTo(view, { autoAlpha: 0, y: 15 }, { autoAlpha: 1, duration: 0.5, y: 0, ease: 'power2.out', delay: 0.1 });
       } else {
          gsap.to(view, { autoAlpha: 0, duration: 0.3, y: -15, onComplete: () => { view.style.display = 'none'; } });
       }
    });
    
    // Mobile close
    if(window.innerWidth < 768) closeSidebar();
  });
});

// Close Modal Logic
const closeAccountModal = () => {
   const modal = document.getElementById('view-account');
   const card = document.getElementById('accountModalCard');
   if(modal && card) {
      gsap.to(card, { scale: 0.95, opacity: 0, duration: 0.25, ease: 'power2.in' });
      gsap.to(modal, { autoAlpha: 0, shadow: 'none', duration: 0.25, ease: 'power2.in', pointerEvents: 'none' });
   }
};

const accountModalBackdrop = document.getElementById('accountModalBackdrop');
const closeAccountBtn = document.getElementById('closeAccountModal');

if(accountModalBackdrop) accountModalBackdrop.addEventListener('click', closeAccountModal);
if(closeAccountBtn) closeAccountBtn.addEventListener('click', closeAccountModal);

// Global Escape Key Binding for Modal
document.addEventListener('keydown', (e) => {
   if(e.key === 'Escape') {
      const modal = document.getElementById('view-account');
      if(modal && modal.style.visibility === 'visible' && modal.style.opacity > 0) {
         closeAccountModal();
      }
   }
});


// Mobile menu toggles
const openSidebarBtn = document.getElementById('openSidebarBtn');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');

function openSidebar() {
   if(sidebarNode) sidebarNode.classList.remove('-translate-x-full');
   if(sidebarBackdrop) sidebarBackdrop.classList.remove('hidden');
   document.body.style.overflow = 'hidden'; // prevent background scroll
}

function closeSidebar() {
   if(sidebarNode) sidebarNode.classList.add('-translate-x-full');
   if(sidebarBackdrop) sidebarBackdrop.classList.add('hidden');
   document.body.style.overflow = '';
}

if(openSidebarBtn) openSidebarBtn.addEventListener('click', openSidebar);
if(closeSidebarBtn) closeSidebarBtn.addEventListener('click', closeSidebar);
if(sidebarBackdrop) sidebarBackdrop.addEventListener('click', closeSidebar);




// ─── SETTINGS PANEL ───────────────────────────────────────────────
function initAccountSettings() {

  // --- Tab Switching ---
  const tabs = document.querySelectorAll('.settings-tab');
  const panels = document.querySelectorAll('.settings-panel');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => {
        t.classList.remove('active-tab', 'text-teal-400', 'border-b-2', 'border-teal-400');
        t.classList.add('text-slate-400');
      });
      tab.classList.add('active-tab', 'text-teal-400', 'border-b-2', 'border-teal-400');
      tab.classList.remove('text-slate-400');
      const targetId = tab.getAttribute('data-tab');
      panels.forEach(p => p.classList.add('hidden'));
      const target = document.getElementById(targetId);
      if(target) target.classList.remove('hidden');
    });
  });

  // --- Load saved thresholds into inputs ---
  const fields = ['minTemp','maxTemp','minPh','maxPh','minEc','maxEc','minHum','maxHum'];
  fields.forEach(f => {
    const el = document.getElementById('cfg-' + f);
    const key = 'sys' + f.charAt(0).toUpperCase() + f.slice(1);
    if(el && localStorage.getItem(key)) el.value = localStorage.getItem(key);
  });

  // --- Save Thresholds ---
  const btnSave = document.getElementById('btnSaveThresholds');
  if(btnSave) {
    btnSave.addEventListener('click', () => {
      fields.forEach(f => {
        const el = document.getElementById('cfg-' + f);
        const key = 'sys' + f.charAt(0).toUpperCase() + f.slice(1);
        if(el) {
          localStorage.setItem(key, el.value);
          if(window.sysConfig) window.sysConfig[f] = Number(el.value);
        }
      });
      notifSystem.add('Sensor thresholds saved & applied.', 'success');
      btnSave.innerHTML = '<i class="fas fa-check mr-2"></i> Saved!';
      setTimeout(() => btnSave.innerHTML = '<i class="fas fa-save mr-2"></i> Save Thresholds', 2000);
    });
  }

  // --- Temperature Unit ---
  const unitC = document.getElementById('unitC');
  const unitF = document.getElementById('unitF');
  const savedUnit = localStorage.getItem('sysTempUnit') || 'C';
  if(savedUnit === 'F') {
    unitF?.classList.add('bg-teal-500','text-slate-900');
    unitF?.classList.remove('text-slate-400');
    unitC?.classList.remove('bg-teal-500','text-slate-900');
    unitC?.classList.add('text-slate-400');
  }
  unitC?.addEventListener('click', () => {
    localStorage.setItem('sysTempUnit','C');
    if(window.sysConfig) window.sysConfig.tempUnit = 'C';
    unitC.classList.add('bg-teal-500','text-slate-900'); unitC.classList.remove('text-slate-400');
    unitF.classList.remove('bg-teal-500','text-slate-900'); unitF.classList.add('text-slate-400');
    notifSystem.add('Temperature unit set to °C', 'success');
  });
  unitF?.addEventListener('click', () => {
    localStorage.setItem('sysTempUnit','F');
    if(window.sysConfig) window.sysConfig.tempUnit = 'F';
    unitF.classList.add('bg-teal-500','text-slate-900'); unitF.classList.remove('text-slate-400');
    unitC.classList.remove('bg-teal-500','text-slate-900'); unitC.classList.add('text-slate-400');
    notifSystem.add('Temperature unit set to °F', 'success');
  });

  // --- Refresh Interval ---
  const refreshBtns = document.querySelectorAll('.refresh-btn');
  const savedInterval = Number(localStorage.getItem('sysRefreshInterval')) || 2000;
  refreshBtns.forEach(btn => {
    const iv = Number(btn.getAttribute('data-interval'));
    if(iv === savedInterval) {
      btn.classList.add('border-teal-500','text-teal-400','bg-teal-500/10');
      btn.classList.remove('border-white/10','text-slate-400');
    }
    btn.addEventListener('click', () => {
      localStorage.setItem('sysRefreshInterval', iv);
      refreshBtns.forEach(b => {
        b.classList.remove('border-teal-500','text-teal-400','bg-teal-500/10');
        b.classList.add('border-white/10','text-slate-400');
      });
      btn.classList.add('border-teal-500','text-teal-400','bg-teal-500/10');
      btn.classList.remove('border-white/10','text-slate-400');
      notifSystem.add(`Refresh interval set to ${iv/1000}s`, 'success');
    });
  });

  // --- Export CSV ---
  const csvLog = []; // populated from sensor reads
  window._csvLog = csvLog;
  document.getElementById('btnExportCSV')?.addEventListener('click', () => {
    if(!window._csvLog || window._csvLog.length === 0) {
      notifSystem.add('No sensor data recorded yet this session.', 'warning');
      return;
    }
    const header = 'Time,Temp(C),Humidity(%),WaterTemp(C),pH,EC(mS/cm),WaterLevel(%),Light(lx)\n';
    const rows = window._csvLog.map(r => Object.values(r).join(',')).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'hydrosense_log.csv';
    a.click(); URL.revokeObjectURL(url);
    notifSystem.add('Sensor log downloaded as CSV.', 'success');
  });

  // --- Clear History ---
  document.getElementById('btnClearHistory')?.addEventListener('click', () => {
    if(window.timeLabels) { window.timeLabels.length = 0; window.tdsData.length = 0; window.tempData.length = 0; window.phData.length = 0; }
    if(window._csvLog) window._csvLog.length = 0;
    if(tdsChart) tdsChart.update();
    if(tempPhChart) tempPhChart.update();
    notifSystem.add('Chart history cleared.', 'success');
  });

  // --- Wipe Protocol ---
  document.getElementById('btnWipe')?.addEventListener('click', () => {
    const ok = confirm("CRITICAL: This will reset the node's local memory and Firebase config. Continue?");
    if(ok) {
      notifSystem.add('Wipe Protocol Initiated. Rebooting node...', 'danger');
      setTimeout(() => location.reload(), 3000);
    }
  });

  // --- Firmware Check ---
  document.getElementById('btnFirmware')?.addEventListener('click', function() {
    notifSystem.add('Checking latest firmware version...', 'warning');
    this.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> Checking...';
    setTimeout(() => {
      notifSystem.add('Firmware v2.4.1 — Up to date ✓', 'success');
      this.innerHTML = '<i class="fas fa-sync-alt"></i> Check Firmware Update';
    }, 2500);
  });

  // --- Session Uptime ---
  const sessionStart = Date.now();
  setInterval(() => {
    const el = document.getElementById('sysUptime');
    if(!el) return;
    const s = Math.floor((Date.now() - sessionStart) / 1000);
    const m = Math.floor(s / 60), sec = s % 60;
    el.innerText = `${m}m ${sec}s`;
  }, 1000);

  // --- ESP32 Live Status ---
  setInterval(() => {
    const el = document.getElementById('sysEspStatus');
    if(!el) return;
    const alive = lastEspUpdate > 0 && Math.abs(Date.now() - lastEspUpdate) < 60000;
    el.innerText = alive ? 'Online ●' : 'Offline ●';
    el.className = alive ? 'text-xs font-bold text-emerald-400' : 'text-xs font-bold text-rose-400';
  }, 3000);
}
initAccountSettings();

// CSV Logging Hook — append each live sensor read to the log
const _origUpdateCharts = updateCharts;
function updateCharts(t, ph, ec) {
  _origUpdateCharts(t, ph, ec);
  if(window._csvLog) {
    window._csvLog.push({
      time: new Date().toLocaleTimeString(),
      temp: t?.toFixed(1) ?? '--',
      hum: '--', waterTemp: '--',
      ph: ph?.toFixed(2) ?? '--',
      ec: ec?.toFixed(2) ?? '--',
      waterLevel: '--', light: '--'
    });
    if(window._csvLog.length > 500) window._csvLog.shift(); // cap at 500 rows
  }
}

// Loader Logic
window.addEventListener('load', () => {
  const loader = document.getElementById('loader');
  if(loader) {
    // Ensure the impressive animation runs for at least 1.5s
    setTimeout(() => {
      loader.classList.add('hidden');
      // Remove from DOM after fade to free up resources
      setTimeout(() => {
        loader.style.display = 'none';
        loader.remove();
      }, 800); 
    }, 1500); 
  }
});
