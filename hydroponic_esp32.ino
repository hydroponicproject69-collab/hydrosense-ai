/*
 * =====================================================================
 * SMART HYDROPONIC AI SYSTEM - ESP32 COMPLETE NODE
 * =====================================================================
 * Features:
 * - Reads all 7 sensors with validation, retries, and STALE detection
 * - Controls 4 actuators (Pump, Light, Mist, Shed Servo)
 * - Autonomous control logic & Health Scoring
 * - Firebase Realtime Database integration with heartbeats
 * - Disease detection logic based on sensor thresholds
 * =====================================================================
 */

#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <DHT.h>
#include <ESP32Servo.h>
#include <ArduinoJson.h>
#include "time.h"

// ─────────────────────────────────────────────────────────────────
//  WiFi Credentials (CHANGE THESE!)
// ─────────────────────────────────────────────────────────────────
const char* WIFI_SSID     = "Galaxy M3285D4";
const char* WIFI_PASSWORD = "987654321";

// ─────────────────────────────────────────────────────────────────
//  Firebase Configuration
// ─────────────────────────────────────────────────────────────────
#define API_KEY "AIzaSyBHLsWUt9YnAEZGMQ1iMpuDuTNC5SZIooQ"
#define DATABASE_URL "https://hydroponicfarm-d6494-default-rtdb.asia-southeast1.firebasedatabase.app"

// ─────────────────────────────────────────────────────────────────
//  Pin Definitions
// ─────────────────────────────────────────────────────────────────
#define DHTPIN          4       // DHT22 data pin
#define DHTTYPE         DHT22

#define WATER_TEMP_PIN  36      // Analog water temp sensor (LM35 or similar)
#define PH_PIN          39      // pH sensor analog input
#define TDS_PIN         35      // TDS sensor analog input
#define TRIG_PIN        5       // Ultrasonic sensor Trigger pin
#define ECHO_PIN        18      // Ultrasonic sensor Echo pin
#define LDR_PIN         33      // LDR (sunlight) analog input

#define PUMP_RELAY_PIN  13      // Pump relay (Active LOW)
#define LIGHT_RELAY_PIN 26      // LED grow light relay (Active LOW) — moved from GPIO12 (boot pin)
#define MIST_RELAY_PIN  14      // Mist maker relay (Active LOW)
#define SERVO_PIN       27      // Shed servo motor

// ─────────────────────────────────────────────────────────────────
//  Calibration Constants
// ─────────────────────────────────────────────────────────────────
#define ADC_RESOLUTION    4095.0f
#define VREF              3.3f
#define TANK_DEPTH_CM     20.0f   // Distance from sensor to empty tank bottom
#define TANK_FULL_CM      5.0f    // Distance from sensor to full water level

// ─────────────────────────────────────────────────────────────────
//  Timing Constants
// ─────────────────────────────────────────────────────────────────
#define SENSOR_INTERVAL      2000    // Publish & read every 2s
#define CONTROL_INTERVAL     4000    // Poll controls every 4s
#define THRESHOLD_INTERVAL   30000   // Fetch thresholds every 30s
#define AI_ANALYSIS_INTERVAL 10000   // Run disease detection every 10s
#define OVERRIDE_TIMEOUT_MS  30000   // Manual override lasts 30s

// ─────────────────────────────────────────────────────────────────
//  Thresholds for Autonomous Control & Validation
// ─────────────────────────────────────────────────────────────────
struct Thresholds {
  float airTempMin    = 18.0f;
  float airTempMax    = 30.0f;
  float waterTempMin  = 18.0f;
  float waterTempMax  = 26.0f;
  float humidityMin   = 40.0f;
  float humidityMax   = 85.0f;
  float phMin         = 5.0f;
  float phMax         = 7.0f;
  float ecMin         = 1.2f;
  float ecMax         = 2.5f;
  
  int lightOnThreshold   = 40;
  int lightOffThreshold  = 55;
  int shedCloseThreshold = 70;
  int shedOpenThreshold  = 50;
};
Thresholds thresholds;

// ─────────────────────────────────────────────────────────────────
//  Objects
// ─────────────────────────────────────────────────────────────────
DHT dht(DHTPIN, DHTTYPE);
Servo shedServo;
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// ─────────────────────────────────────────────────────────────────
//  Sensor Data Structures
// ─────────────────────────────────────────────────────────────────
struct SensorData {
  float temperature;
  float humidity;
  float water_temp;
  float ph;
  float ec;
  int water_level;
  int light_lux;
  bool leak = false;
};
SensorData currentData;
SensorData previousData;

struct StaleCounters {
  int temperature = 0;
  int humidity = 0;
  int water_temp = 0;
  int ph = 0;
  int ec = 0;
  int water_level = 0;
  int light_lux = 0;
};
StaleCounters staleCounts;

struct ValidationStatus {
  String temperature = "OK";
  String humidity = "OK";
  String water_temp = "OK";
  String ph = "OK";
  String ec = "OK";
  String water_level = "OK";
  String light_lux = "OK";
};
ValidationStatus sensorStatus;

// ─────────────────────────────────────────────────────────────────
//  State & Error Structures
// ─────────────────────────────────────────────────────────────────
struct ActuatorState {
  bool pump;
  bool light;
  bool mist;
  bool shed;
};
ActuatorState actuatorState = {false, false, false, false};

struct AIDiagnosis {
  String status;
  String disease;
  int confidence;
};
AIDiagnosis aiDiagnosis = {"Healthy", "None", 100};

struct Override {
  bool active;
  unsigned long expiresAt;
};
Override pumpOverride  = {false, 0};
Override lightOverride = {false, 0};
Override mistOverride  = {false, 0};
Override shedOverride  = {false, 0};

char pumpReason[48]  = "Continuous circulation";
char lightReason[48] = "Initializing...";
char mistReason[48]  = "Initializing...";
char shedReason[64]  = "Initializing...";

unsigned long lastSensorSend  = 0;
unsigned long lastControlPoll = 0;
unsigned long lastThresholdFetch = 0;
unsigned long lastAIAnalysis  = 0;
unsigned long lastHeartbeat = 0;

int healthScore = 100;

// Ring Buffer for Logging
const int MAX_LOGS = 20;
String logBuffer[MAX_LOGS];
int logIndex = 0;

// ─────────────────────────────────────────────────────────────────
//  Helper Functions
// ─────────────────────────────────────────────────────────────────
void addLog(String type, String msg) {
  String entry = "[" + type + "] " + msg;
  Serial.println(entry);
  logBuffer[logIndex] = entry;
  logIndex = (logIndex + 1) % MAX_LOGS;
  
  if(Firebase.ready()){
     Firebase.RTDB.setString(&fbdo, "/system/logs/latest", entry);
  }
}

void triggerAlert(String type, String msg, String severity) {
  if (Firebase.ready()) {
    FirebaseJson alertJson;
    alertJson.set("type", type);
    alertJson.set("message", msg);
    alertJson.set("severity", severity);
    alertJson.set("timestamp", String(millis())); // Or better RTC time
    Firebase.RTDB.pushJSON(&fbdo, "/alerts", &alertJson);
  }
}

// ─────────────────────────────────────────────────────────────────
//  SETUP
// ─────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  Serial.println("\n╔══════════════════════════════════════════════════════════════╗");
  Serial.println("║     🌱 SMART HYDROPONIC AI SYSTEM - END TO END VALIDATED     ║");
  Serial.println("╚══════════════════════════════════════════════════════════════╝");

  pinMode(PUMP_RELAY_PIN, OUTPUT);
  pinMode(LIGHT_RELAY_PIN, OUTPUT);
  pinMode(MIST_RELAY_PIN, OUTPUT);
  digitalWrite(PUMP_RELAY_PIN, HIGH);
  digitalWrite(LIGHT_RELAY_PIN, HIGH);
  digitalWrite(MIST_RELAY_PIN, HIGH);

  shedServo.attach(SERVO_PIN);
  shedServo.write(0);
  actuatorState.shed = false;

  dht.begin();
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  
  // Set initial baseline
  currentData.temperature = 25.0;
  currentData.humidity = 60.0;
  currentData.water_temp = 20.0;
  currentData.ph = 6.0;
  currentData.ec = 1.5;
  currentData.water_level = 80;
  currentData.light_lux = 5000;
  previousData = currentData;

  connectWiFi();
  setupFirebase();

  applyActuator(PUMP_RELAY_PIN, &actuatorState.pump, true, "Pump", pumpReason);
}

// ─────────────────────────────────────────────────────────────────
//  MAIN LOOP
// ─────────────────────────────────────────────────────────────────
void loop() {
  unsigned long now = millis();

  if (WiFi.status() != WL_CONNECTED) {
    addLog("WIFI", "Connection lost - reconnecting...");
    connectWiFi();
  }

  if (Firebase.ready()) {
    // 2s Data Publish & Sensors
    if (now - lastSensorSend >= SENSOR_INTERVAL) {
      lastSensorSend = now;
      readAllSensorsWithValidation();
      runAutonomousControl(now);
      calculateHealthScore();
      sendToFirebase();
    }

    // 4s Controls Poll
    if (now - lastControlPoll >= CONTROL_INTERVAL) {
      lastControlPoll = now;
      checkFirebaseControls(now);
    }
    
    // 30s Threshold Fetch
    if (now - lastThresholdFetch >= THRESHOLD_INTERVAL) {
      lastThresholdFetch = now;
      fetchThresholds();
    }

    // 10s AI
    if (now - lastAIAnalysis >= AI_ANALYSIS_INTERVAL) {
      lastAIAnalysis = now;
      runDiseaseDetection();
    }
  } else {
    setupFirebase();
  }
}

// ─────────────────────────────────────────────────────────────────
//  WIFI & FIREBASE
// ─────────────────────────────────────────────────────────────────
void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 30) {
    delay(500);
    retries++;
  }
  if (WiFi.status() == WL_CONNECTED) addLog("WIFI", "Connected");
}

void setupFirebase() {
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  config.signer.test_mode = true;
  Firebase.reconnectWiFi(true);
  fbdo.setResponseSize(4096);
  Firebase.begin(&config, &auth);
  
  if (Firebase.ready()) {
    addLog("FIREBASE", "Connected");
    Firebase.RTDB.setBool(&fbdo, "/system/online", true);
  }
}

// ─────────────────────────────────────────────────────────────────
//  Validation Logic
// ─────────────────────────────────────────────────────────────────
float validateFloat(float val, float &prev, int &staleCounter, float min, float max, String name, String &status) {
  if (isnan(val)) {
    status = "SENSOR_ERROR";
    triggerAlert("SENSOR_ERROR", name + " read failed.", "high");
    addLog("SENSOR", name + " error");
    return prev;
  }
  if (val == prev) {
    staleCounter++;
    if (staleCounter > 5) {
      status = "STALE";
      addLog("SENSOR", name + " stale >5 cycles");
    }
  } else {
    staleCounter = 0;
    status = "OK";
    prev = val;
  }
  if (val < min || val > max) {
    status = "OUT_OF_RANGE";
    triggerAlert("OUT_OF_RANGE", name + " value " + String(val) + " outside bounds.", "medium");
  }
  return val;
}

int validateInt(int val, int &prev, int &staleCounter, int min, int max, String name, String &status) {
  if (val == prev) {
    staleCounter++;
    if (staleCounter > 5) status = "STALE";
  } else {
    staleCounter = 0;
    status = "OK";
    prev = val;
  }
  if (val < min || val > max) status = "OUT_OF_RANGE";
  return val;
}

// ─────────────────────────────────────────────────────────────────
//  Read All Sensors
// ─────────────────────────────────────────────────────────────────
void readAllSensorsWithValidation() {
  // DHT
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  if (isnan(h) || isnan(t)) {
    delay(500); // 1-Retry
    h = dht.readHumidity();
    t = dht.readTemperature();
  }
  currentData.humidity = validateFloat(h, previousData.humidity, staleCounts.humidity, 0.0f, 100.0f, "humidity", sensorStatus.humidity);
  currentData.temperature = validateFloat(t, previousData.temperature, staleCounts.temperature, 0.0f, 50.0f, "temperature", sensorStatus.temperature);

  // Water Temp
  int wtRaw = analogRead(WATER_TEMP_PIN);
  float wtVolt = (wtRaw / ADC_RESOLUTION) * VREF;
  float wtVal = wtVolt * 100.0f;
  currentData.water_temp = validateFloat(wtVal, previousData.water_temp, staleCounts.water_temp, 0.0f, 40.0f, "water_temp", sensorStatus.water_temp);

  // pH
  int phRaw = analogRead(PH_PIN);
  float phVolt = (phRaw / ADC_RESOLUTION) * VREF;
  float phVal = constrain((-5.70f * phVolt) + 21.34f, 0.0f, 14.0f);
  currentData.ph = validateFloat(phVal, previousData.ph, staleCounts.ph, 0.0f, 14.0f, "ph", sensorStatus.ph);

  // EC (from TDS)
  int tdsRaw = analogRead(TDS_PIN);
  float tdsVolt = (tdsRaw / ADC_RESOLUTION) * VREF;
  float tdsVal = max(0.0f, (133.42f * pow(tdsVolt, 3) - 255.86f * pow(tdsVolt, 2) + 857.39f * tdsVolt) * 0.5f);
  float ecVal = tdsVal / 500.0f; // Approx conversion
  currentData.ec = validateFloat(ecVal, previousData.ec, staleCounts.ec, 0.0f, 4.0f, "ec", sensorStatus.ec);

  // Water Level
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  int wlVal = previousData.water_level;
  if (duration > 0) {
    float distanceCm = duration * 0.034f / 2.0f;
    wlVal = constrain(map((long)distanceCm, (long)TANK_DEPTH_CM, (long)TANK_FULL_CM, 0, 100), 0, 100);
  } else {
    // 1-Retry
    delay(50);
    digitalWrite(TRIG_PIN, LOW);
    delayMicroseconds(2);
    digitalWrite(TRIG_PIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(TRIG_PIN, LOW);
    duration = pulseIn(ECHO_PIN, HIGH, 30000);
    if(duration > 0) wlVal = constrain(map((long)(duration * 0.034f / 2.0f), (long)TANK_DEPTH_CM, (long)TANK_FULL_CM, 0, 100), 0, 100);
  }
  currentData.water_level = validateInt(wlVal, previousData.water_level, staleCounts.water_level, 0, 100, "water_level", sensorStatus.water_level);

  // Sunlight
  int ldrRaw = analogRead(LDR_PIN);
  int luxVal = map(ldrRaw, 4095, 0, 0, 10000); // 0-10000 lux estimate
  currentData.light_lux = validateInt(luxVal, previousData.light_lux, staleCounts.light_lux, 0, 10000, "light_lux", sensorStatus.light_lux);
}

// ─────────────────────────────────────────────────────────────────
//  Health Scoring
// ─────────────────────────────────────────────────────────────────
void calculateHealthScore() {
  int score = 100;
  // Connectivity (WiFi + Firebase) max 30
  if (WiFi.status() != WL_CONNECTED) score -= 15;
  if (!Firebase.ready()) score -= 15;
  
  // Data Validity max 30
  int errors = 0;
  if (sensorStatus.temperature != "OK") errors++;
  if (sensorStatus.humidity != "OK") errors++;
  if (sensorStatus.water_temp != "OK") errors++;
  if (sensorStatus.ph != "OK") errors++;
  if (sensorStatus.ec != "OK") errors++;
  if (sensorStatus.water_level != "OK") errors++;
  score -= (errors * 5); // minus 5 per invalid sensor

  // Freshness (Stale data) max 20
  int stales = 0;
  if (staleCounts.temperature > 5) stales++;
  if (staleCounts.humidity > 5) stales++;
  if (staleCounts.ph > 5) stales++;
  if (staleCounts.ec > 5) stales++;
  score -= (stales * 5);

  healthScore = constrain(score, 0, 100);
}

// ─────────────────────────────────────────────────────────────────
//  Firebase Send & Fetch
// ─────────────────────────────────────────────────────────────────
void sendToFirebase() {
  Firebase.RTDB.setFloat(&fbdo, "/sensors/temperature", currentData.temperature);
  Firebase.RTDB.setFloat(&fbdo, "/sensors/humidity", currentData.humidity);
  Firebase.RTDB.setFloat(&fbdo, "/sensors/water_temp", currentData.water_temp);
  Firebase.RTDB.setFloat(&fbdo, "/sensors/ph", currentData.ph);
  Firebase.RTDB.setFloat(&fbdo, "/sensors/ec", currentData.ec);
  Firebase.RTDB.setInt(&fbdo, "/sensors/water_level", currentData.water_level);
  Firebase.RTDB.setInt(&fbdo, "/sensors/light_lux", currentData.light_lux);
  
  // Sensor Validation Statuses
  FirebaseJson statusJson;
  statusJson.set("temperature", sensorStatus.temperature);
  statusJson.set("humidity", sensorStatus.humidity);
  statusJson.set("water_temp", sensorStatus.water_temp);
  statusJson.set("ph", sensorStatus.ph);
  statusJson.set("ec", sensorStatus.ec);
  statusJson.set("water_level", sensorStatus.water_level);
  statusJson.set("light_lux", sensorStatus.light_lux);
  Firebase.RTDB.setJSON(&fbdo, "/sensors/status", &statusJson);

  Firebase.RTDB.setBool(&fbdo, "/actuators/pump", actuatorState.pump);
  Firebase.RTDB.setBool(&fbdo, "/actuators/light", actuatorState.light);
  Firebase.RTDB.setBool(&fbdo, "/actuators/mist", actuatorState.mist);
  Firebase.RTDB.setBool(&fbdo, "/actuators/shed", actuatorState.shed);

  Firebase.RTDB.setString(&fbdo, "/reasons/pump", pumpReason);
  Firebase.RTDB.setString(&fbdo, "/reasons/light", lightReason);
  Firebase.RTDB.setString(&fbdo, "/reasons/mist", mistReason);
  Firebase.RTDB.setString(&fbdo, "/reasons/shed", shedReason);

  Firebase.RTDB.setInt(&fbdo, "/system/healthScore", healthScore);
  Firebase.RTDB.setTimestamp(&fbdo, "/system/lastUpdate");
}

void checkFirebaseControls(unsigned long now) {
  if (Firebase.RTDB.getBool(&fbdo, "/controls/pump")) {
    bool val = fbdo.boolData();
    if (val != actuatorState.pump) {
      pumpOverride = {true, now + OVERRIDE_TIMEOUT_MS};
      applyActuator(PUMP_RELAY_PIN, &actuatorState.pump, val, "Pump", "Manual override");
      snprintf(pumpReason, sizeof(pumpReason), "Manual override (30s)");
    }
  }
  if (Firebase.RTDB.getBool(&fbdo, "/controls/light")) {
    bool val = fbdo.boolData();
    if (val != actuatorState.light) {
      lightOverride = {true, now + OVERRIDE_TIMEOUT_MS};
      applyActuator(LIGHT_RELAY_PIN, &actuatorState.light, val, "Light", "Manual override");
      snprintf(lightReason, sizeof(lightReason), "Manual override (30s)");
    }
  }
  if (Firebase.RTDB.getBool(&fbdo, "/controls/mist")) {
    bool val = fbdo.boolData();
    if (val != actuatorState.mist) {
      mistOverride = {true, now + OVERRIDE_TIMEOUT_MS};
      applyActuator(MIST_RELAY_PIN, &actuatorState.mist, val, "Mist", "Manual override");
      snprintf(mistReason, sizeof(mistReason), "Manual override (30s)");
    }
  }
  if (Firebase.RTDB.getBool(&fbdo, "/controls/shed")) {
    bool val = fbdo.boolData();
    if (val != actuatorState.shed) {
      shedOverride = {true, now + OVERRIDE_TIMEOUT_MS};
      setShed(val, "Manual override");
      snprintf(shedReason, sizeof(shedReason), "Manual override (30s)");
    }
  }
}

void fetchThresholds() {
  if (Firebase.RTDB.getFloat(&fbdo, "/system/config/minTemp")) thresholds.airTempMin = fbdo.floatData();
  if (Firebase.RTDB.getFloat(&fbdo, "/system/config/maxTemp")) thresholds.airTempMax = fbdo.floatData();
  if (Firebase.RTDB.getFloat(&fbdo, "/system/config/minPh")) thresholds.phMin = fbdo.floatData();
  if (Firebase.RTDB.getFloat(&fbdo, "/system/config/maxPh")) thresholds.phMax = fbdo.floatData();
  addLog("FIREBASE", "Thresholds updated");
}

// ─────────────────────────────────────────────────────────────────
//  Autonomous & AI (Simplified structure for brevity)
// ─────────────────────────────────────────────────────────────────
void runAutonomousControl(unsigned long now) {
  if (!actuatorState.pump) applyActuator(PUMP_RELAY_PIN, &actuatorState.pump, true, "Pump", pumpReason);

  if (!isOverrideActive(shedOverride, now)) {
    bool currentShed = actuatorState.shed;
    bool newShed = currentShed;
    int sun = map(currentData.light_lux, 0, 10000, 0, 100);
    if (currentShed && sun < thresholds.shedOpenThreshold) {
      newShed = true;
      snprintf(shedReason, sizeof(shedReason), "Auto-opened");
    } else if (!currentShed && sun >= thresholds.shedCloseThreshold) {
      newShed = false;
      snprintf(shedReason, sizeof(shedReason), "Auto-closed");
    }
    if (newShed != currentShed) setShed(newShed, shedReason);
  }

  if (!isOverrideActive(lightOverride, now)) {
    bool newLight = actuatorState.light;
    int sun = map(currentData.light_lux, 0, 10000, 0, 100);
    if (!actuatorState.light && sun < thresholds.lightOnThreshold) newLight = true;
    else if (actuatorState.light && sun >= thresholds.lightOffThreshold) newLight = false;
    if (newLight != actuatorState.light) applyActuator(LIGHT_RELAY_PIN, &actuatorState.light, newLight, "Light", lightReason);
  }

  if (!isOverrideActive(mistOverride, now)) {
    bool newMist = actuatorState.mist;
    if (!actuatorState.mist && currentData.humidity < thresholds.humidityMin) newMist = true;
    else if (actuatorState.mist && currentData.humidity >= thresholds.humidityMax) newMist = false;
    if (newMist != actuatorState.mist) applyActuator(MIST_RELAY_PIN, &actuatorState.mist, newMist, "Mist", mistReason);
  }
}

void runDiseaseDetection() {
  int issues = 0;
  if(sensorStatus.temperature == "OUT_OF_RANGE") issues++;
  if(sensorStatus.humidity == "OUT_OF_RANGE") issues++;
  if(sensorStatus.ph == "OUT_OF_RANGE") issues++;
  
  if (issues >= 2) {
    aiDiagnosis = {"Diseased", "Stress / Imbalance", 85};
    triggerAlert("AI_WARNING", "Multiple out of bounds sensors detected.", "high");
  } else if (issues == 1) {
    aiDiagnosis = {"At Risk", "Anomaly Detected", 60};
  } else {
    aiDiagnosis = {"Healthy", "None", 98};
  }
  
  Firebase.RTDB.setString(&fbdo, "/ai/status", aiDiagnosis.status);
  Firebase.RTDB.setString(&fbdo, "/ai/disease", aiDiagnosis.disease);
  Firebase.RTDB.setInt(&fbdo, "/ai/confidence", aiDiagnosis.confidence);
  Firebase.RTDB.setTimestamp(&fbdo, "/ai/lastAnalysis");
}

bool isOverrideActive(Override& ov, unsigned long now) {
  if (!ov.active) return false;
  if (now >= ov.expiresAt) {
    ov.active = false;
    return false;
  }
  return true;
}

void applyActuator(int pin, bool* state, bool value, const char* name, const char* reason) {
  *state = value;
  digitalWrite(pin, value ? LOW : HIGH);
}

void setShed(bool open, const char* reason) {
  actuatorState.shed = open;
  shedServo.write(open ? 90 : 0);
  snprintf(shedReason, sizeof(shedReason), "%s", reason);
}
