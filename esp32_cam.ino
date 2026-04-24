/*
 * ESP32-CAM Photo Upload to Firebase Storage
 * Captures a photo every 30 seconds, uploads to Firebase Storage,
 * and saves the public URL to the Realtime Database.
 */
#include "esp_camera.h"
#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include "FS.h"
#include "SPIFFS.h"

// ===================== CONFIGURATION =====================
// 1. WiFi Credentials
const char* WIFI_SSID = "Galaxy M3285D4";
const char* WIFI_PASSWORD = "987654321";

// 2. Firebase Project Settings
#define API_KEY "AIzaSyBHLsWUt9YnAEZGMQ1iMpuDuTNC5SZIooQ"
#define DATABASE_URL "https://hydroponicfarm-d6494-default-rtdb.asia-southeast1.firebasedatabase.app"
#define USER_EMAIL "farm@hydroponic.com"       // Replace with your auth email
#define USER_PASSWORD "farm123456"             // Replace with your auth password
#define STORAGE_BUCKET_ID "hydroponicfarm-d6494.firebasestorage.app"

// 3. Timing
#define CAPTURE_INTERVAL 30000  // 30 seconds

// ===================== CAMERA PINS (AI-THINKER) =====================
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

// ===================== GLOBAL OBJECTS =====================
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;
unsigned long lastCapture = 0;
int photoCounter = 1;

// ===================== SETUP =====================
void setup() {
  Serial.begin(115200);
  Serial.println("\n[ESP32-CAM] Booting...");

  // Init SPIFFS for temporary file storage
  if (!SPIFFS.begin(true)) {
    Serial.println("SPIFFS Mount Failed. Restarting...");
    ESP.restart();
  }
  Serial.println("SPIFFS Mounted.");

  connectWiFi();
  initCamera();
  setupFirebase();
}

// ===================== MAIN LOOP =====================
void loop() {
  if (millis() - lastCapture > CAPTURE_INTERVAL) {
    lastCapture = millis();
    captureAndUpload();
  }
}

// ===================== WIFI CONNECTION =====================
void connectWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected.");
}

// ===================== CAMERA INITIALIZATION =====================
void initCamera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size = FRAMESIZE_VGA;    // 640x480
  config.jpeg_quality = 12;             // 0-63 (lower = higher quality)
  config.fb_count = 1;

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed: 0x%x\n", err);
    ESP.restart();
  }
  Serial.println("Camera Initialized.");
}

// ===================== FIREBASE SETUP =====================
void setupFirebase() {
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  auth.user.email = USER_EMAIL;
  auth.user.password = USER_PASSWORD;
  Firebase.reconnectWiFi(true);
  fbdo.setResponseSize(4096);
  
  Firebase.begin(&config, &auth);
  Serial.println("Firebase Configured.");
}

// ===================== CAPTURE & UPLOAD =====================
void captureAndUpload() {
  // 1. Take Photo
  camera_fb_t * fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("Camera capture failed.");
    return;
  }

  // 2. Save to SPIFFS
  String filename = "/photo_" + String(photoCounter++) + ".jpg";
  File file = SPIFFS.open(filename, FILE_WRITE);
  if (!file) {
    Serial.println("Failed to open file.");
    esp_camera_fb_return(fb);
    return;
  }
  file.write(fb->buf, fb->len);
  file.close();
  esp_camera_fb_return(fb);
  Serial.printf("Photo saved: %s (%u bytes)\n", filename.c_str(), fb->len);

  // 3. Upload to Firebase Storage
  if (Firebase.ready()) {
    String remotePath = "/plant_images/" + String(millis()) + ".jpg";
    
    if (Firebase.Storage.upload(&fbdo, 
                                STORAGE_BUCKET_ID, 
                                filename.c_str(), 
                                mem_storage_type_flash, 
                                remotePath.c_str(), 
                                "image/jpeg")) {
      
      String downloadUrl = fbdo.downloadURL();
      Serial.printf("Upload successful! URL: %s\n", downloadUrl.c_str());

      // 4. Save URL to Realtime Database for your website to use
      Firebase.RTDB.setString(&fbdo, "/ai/plantImage", downloadUrl);
      Firebase.RTDB.setTimestamp(&fbdo, "/ai/lastImageUpdate");
      
    } else {
      Serial.printf("Upload failed: %s\n", fbdo.errorReason().c_str());
    }
  }
  
  // 5. Cleanup: Remove local file to save space
  SPIFFS.remove(filename);
}
