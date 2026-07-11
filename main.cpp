#include <Arduino.h>

#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include "HX711.h"
#include <WiFi.h>
#include <Firebase_ESP_Client.h>

#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

// =====================================================
// DEKLARASI FUNGSI (FUNCTION PROTOTYPES)
// =====================================================
void beepShort();
void beepLong();
void beepDouble();
void printLine(byte row, String text);
bool buttonPressed(int pin, bool &lastState);
float readScaleKg(HX711 &scale);
void sendRealtimeDataToFirebase();
void openingScreen();
void showHome();
void showMenu();
void tareAll();
void countdownTest(String title);
void testKiri();
void testKanan();
void testDual();
void showLastData();
void showInfo();
void executeMenu();

// =====================================================
// KONFIGURASI WIFI & FIREBASE
// =====================================================
#define WIFI_SSID "TECNO CAMON 40 2"
#define WIFI_PASSWORD "414c766532b1"

#define API_KEY "AIzaSyCAmyi5TyVleJstofDk1uDTk5__s4UzJNw"
// PERHATIAN: URL Firebase tidak boleh menggunakan https:// di library Mobizt terbaru
#define DATABASE_URL "gripmonitoring-default-rtdb.firebaseio.com"

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

String currentPatientId = "patient_001"; 

// =====================================================
// PIN KONFIGURASI
// =====================================================
#define LCD_SDA 21
#define LCD_SCL 22
#define DT_KIRI   18
#define SCK_KIRI  19
#define DT_KANAN  16
#define SCK_KANAN 17
#define BTN_UP    32
#define BTN_DOWN  33
#define BTN_OK    25
#define BTN_BACK  26
#define BUZZER_PIN 5

// =====================================================
// OBJEK LCD DAN HX711
// =====================================================
LiquidCrystal_I2C lcd(0x27, 20, 4);
HX711 scaleKiri;
HX711 scaleKanan;

float calKiri  = 12080.0;
float calKanan = 12080.0;

float kgKiri = 0;
float kgKanan = 0;
float lastKiri = 0;
float lastKanan = 0;

unsigned long lastFirebaseSend = 0;
// Interval diturunkan menjadi 150ms agar pergerakan grafik/jarum di Web lebih mulus
const unsigned long firebaseInterval = 150; 

int menuIndex = 0;
const int jumlahMenu = 6;
String menuList[jumlahMenu] = {
  "Tes Tangan Kiri",
  "Tes Tangan Kanan",
  "Tes Dual Sensor",
  "Zero / Tare",
  "Data Terakhir",
  "Info Sistem"
};

enum ScreenState {
  SCREEN_HOME, SCREEN_MENU, SCREEN_TEST_KIRI, 
  SCREEN_TEST_KANAN, SCREEN_TEST_DUAL, SCREEN_LAST_DATA, SCREEN_INFO
};

ScreenState currentScreen = SCREEN_HOME;

bool lastUp = HIGH, lastDown = HIGH, lastOk = HIGH, lastBack = HIGH;
unsigned long lastDebounceTime = 0;
const unsigned long debounceDelay = 180;

// =====================================================
// SETUP
// =====================================================
void setup() {
  Serial.begin(115200);

  pinMode(BTN_UP, INPUT_PULLUP);
  pinMode(BTN_DOWN, INPUT_PULLUP);
  pinMode(BTN_OK, INPUT_PULLUP);
  pinMode(BTN_BACK, INPUT_PULLUP);

  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  Wire.begin(LCD_SDA, LCD_SCL);
  lcd.init();
  lcd.backlight();

  openingScreen();

  lcd.clear();
  printLine(0, "Init HX711...");
  scaleKiri.begin(DT_KIRI, SCK_KIRI);
  scaleKanan.begin(DT_KANAN, SCK_KANAN);
  delay(1000);

  scaleKiri.set_scale(calKiri);
  scaleKanan.set_scale(calKanan);

  printLine(1, "Tare sensor...");
  scaleKiri.tare();
  scaleKanan.tare();

  printLine(2, "System Ready");
  beepDouble();
  delay(1200);
  lcd.clear();
}

// =====================================================
// LOOP UTAMA
// =====================================================
void loop() {
  bool upPressed = buttonPressed(BTN_UP, lastUp);
  bool downPressed = buttonPressed(BTN_DOWN, lastDown);
  bool okPressed = buttonPressed(BTN_OK, lastOk);
  bool backPressed = buttonPressed(BTN_BACK, lastBack);

  if (currentScreen == SCREEN_HOME) {
    showHome();
    if (okPressed) { currentScreen = SCREEN_MENU; lcd.clear(); }
    if (backPressed) { tareAll(); currentScreen = SCREEN_HOME; lcd.clear(); }
    if (upPressed || downPressed) { currentScreen = SCREEN_MENU; lcd.clear(); }
  }
  else if (currentScreen == SCREEN_MENU) {
    showMenu();
    if (upPressed) { menuIndex--; if (menuIndex < 0) menuIndex = jumlahMenu - 1; lcd.clear(); }
    if (downPressed) { menuIndex++; if (menuIndex >= jumlahMenu) menuIndex = 0; lcd.clear(); }
    if (okPressed) { executeMenu(); }
    if (backPressed) { currentScreen = SCREEN_HOME; lcd.clear(); }
  }
  else if (currentScreen == SCREEN_LAST_DATA || currentScreen == SCREEN_INFO) {
    if (currentScreen == SCREEN_LAST_DATA) showLastData();
    else showInfo();

    if (backPressed) { currentScreen = SCREEN_MENU; lcd.clear(); }
    if (okPressed) { currentScreen = SCREEN_HOME; lcd.clear(); }
  }

  // Jika tidak di home screen pengiriman data live, tetap pantau sensor di background
  if (currentScreen != SCREEN_HOME) {
      kgKiri = readScaleKg(scaleKiri);
      kgKanan = readScaleKg(scaleKanan);
  }

  delay(50);
}

// =====================================================
// IMPLEMENTASI FUNGSI HELPER & LOGIKA
// =====================================================

void beepShort() { digitalWrite(BUZZER_PIN, HIGH); delay(60); digitalWrite(BUZZER_PIN, LOW); }
void beepLong()  { digitalWrite(BUZZER_PIN, HIGH); delay(180); digitalWrite(BUZZER_PIN, LOW); }
void beepDouble(){ beepShort(); delay(80); beepShort(); }

void printLine(byte row, String text) {
  lcd.setCursor(0, row);
  if (text.length() > 20) text = text.substring(0, 20);
  while (text.length() < 20) text += " ";
  lcd.print(text);
}

bool buttonPressed(int pin, bool &lastState) {
  bool reading = digitalRead(pin);
  if (reading != lastState) {
    if (millis() - lastDebounceTime > debounceDelay) {
      lastDebounceTime = millis();
      lastState = reading;
      if (reading == LOW) { beepShort(); return true; }
    }
  }
  return false;
}

float readScaleKg(HX711 &scale) {
  if (scale.is_ready()) {
    float nilai = scale.get_units(5);
    return (nilai < 0) ? 0 : nilai;
  }
  return 0;
}

// =====================================================
// FUNGSI PENGIRIMAN DATA FIREBASE (ASYNC MODE - CEPAT)
// =====================================================
void sendRealtimeDataToFirebase() {
  if (Firebase.ready() && (millis() - lastFirebaseSend > firebaseInterval)) {
    lastFirebaseSend = millis();
    
    FirebaseJson json;
    json.set("left_grip_kg", kgKiri);
    json.set("right_grip_kg", kgKanan);
    json.set("device_status", WiFi.status() == WL_CONNECTED ? "connected" : "disconnected");
    json.set("last_updated/.sv", "timestamp"); // Format timestamp valid

    String path = "/monitoring/realtime/";
    path += currentPatientId;
    
    // MENGGUNAKAN setJSONAsync 
    // Data dikirim di background sehingga ESP32 tidak "lag" membaca tombol
    Firebase.RTDB.setJSONAsync(&fbdo, path.c_str(), &json);
  }
}

void openingScreen() {
  lcd.clear();
  printLine(0, "   GRIP ASIMETRI    ");
  printLine(1, "        METER       ");
  printLine(2, "    BERBASIS IOT    ");
  printLine(3, "    Initializing    ");
  beepShort();
  delay(2000);

  lcd.clear();
  printLine(0, "Connecting WiFi...");
  
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempt = 0;
  lcd.setCursor(0, 1);
  while (WiFi.status() != WL_CONNECTED && attempt < 20) {
    delay(500); lcd.print("."); attempt++;
  }

  lcd.clear();
  if (WiFi.status() == WL_CONNECTED) {
    printLine(0, "WiFi Connected!");
    printLine(1, WiFi.localIP().toString());
  } else {
    printLine(0, "WiFi Failed!");
    printLine(1, "Running Offline");
  }

  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  
  // Memaksa mode pengujian agar tidak diblokir oleh otentikasi
  config.signer.test_mode = true;
  fbdo.setResponseSize(1024);
  
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
  printLine(2, "Firebase Ready");
  
  String statusPath = "/monitoring/realtime/";
  statusPath += currentPatientId;
  statusPath += "/device_status";
  
  Firebase.RTDB.setString(&fbdo, statusPath.c_str(), "connected");

  lcd.setCursor(0, 3);
  for (int i = 0; i < 20; i++) { lcd.print((char)255); delay(40); }
  beepDouble(); delay(500); lcd.clear();
}

void showHome() {
  kgKiri = readScaleKg(scaleKiri);
  kgKanan = readScaleKg(scaleKanan);

  printLine(0, "   GRIP METER IOT   ");
  
  char buf[21];
  snprintf(buf, sizeof(buf), "L:%.2fKg R:%.2fKg", kgKiri, kgKanan);
  printLine(1, buf);
  
  printLine(2, "Ok: Menu  Back: Tare");
  printLine(3, "Up/Down: Quick Menu ");
  
  sendRealtimeDataToFirebase();
}

void showMenu() {
  printLine(0, "     MENU UTAMA      ");
  int nextIndex = (menuIndex + 1 >= jumlahMenu) ? 0 : menuIndex + 1;

  String line1 = ">"; 
  line1 += menuList[menuIndex];
  printLine(1, line1);
  
  String line2 = " "; 
  line2 += menuList[nextIndex];
  printLine(2, line2);
  
  printLine(3, "Ok: Pilih Back: Home");
}

void tareAll() {
  lcd.clear();
  printLine(0, "ZERO / TARE");
  printLine(1, "Jangan tekan sensor");
  printLine(2, "Mohon tunggu...");
  beepShort(); delay(500);

  scaleKiri.tare();
  scaleKanan.tare();

  printLine(2, "Tare selesai");
  printLine(3, "Sensor = 0 Kg");
  beepDouble(); delay(1200); lcd.clear();
}

void countdownTest(String title) {
  lcd.clear();
  printLine(0, title);
  printLine(1, "Bersiap genggam...");

  for (int i = 3; i >= 1; i--) {
    char buf[21];
    snprintf(buf, sizeof(buf), "Mulai dalam: %d", i);
    printLine(2, buf);
    beepShort(); delay(1000);
  }

  printLine(2, "MULAI!");
  beepLong(); delay(500);
}

void testKiri() {
  countdownTest("TES TANGAN KIRI");
  float maxKiri = 0;
  unsigned long startTime = millis();
  const unsigned long durasiTes = 5000;
  char buf[21];

  while (millis() - startTime < durasiTes) {
    if (buttonPressed(BTN_BACK, lastBack)) {
      lcd.clear(); printLine(1, "Tes dibatalkan"); delay(1000); lcd.clear(); return;
    }

    kgKiri = readScaleKg(scaleKiri);
    if (kgKiri > maxKiri) maxKiri = kgKiri;
    int sisa = (durasiTes - (millis() - startTime)) / 1000;

    printLine(0, "TES TANGAN KIRI");
    snprintf(buf, sizeof(buf), "Now : %.2f Kg", kgKiri); printLine(1, buf);
    snprintf(buf, sizeof(buf), "Max : %.2f Kg", maxKiri); printLine(2, buf);
    snprintf(buf, sizeof(buf), "Time: %ds BACK:Batal", sisa); printLine(3, buf);

    kgKiri = maxKiri; // Peak Hold
    sendRealtimeDataToFirebase(); 
    delay(50); 
  }

  lastKiri = maxKiri; beepDouble(); lcd.clear();
  printLine(0, "HASIL TES KIRI");
  snprintf(buf, sizeof(buf), "Max: %.2f Kg", lastKiri); printLine(1, buf);
  printLine(2, "Data tersimpan"); printLine(3, "Back kembali");

  while (true) {
    if (buttonPressed(BTN_OK, lastOk) || buttonPressed(BTN_BACK, lastBack)) { 
      lcd.clear();
      printLine(0, "Mereset Sensor...");
      scaleKiri.tare();
      kgKiri = 0;
      return; 
    }
  }
}

void testKanan() {
  countdownTest("TES TANGAN KANAN");
  float maxKanan = 0;
  unsigned long startTime = millis();
  const unsigned long durasiTes = 5000;
  char buf[21];

  while (millis() - startTime < durasiTes) {
    if (buttonPressed(BTN_BACK, lastBack)) {
      lcd.clear(); printLine(1, "Tes dibatalkan"); delay(1000); lcd.clear(); return;
    }

    kgKanan = readScaleKg(scaleKanan);
    if (kgKanan > maxKanan) maxKanan = kgKanan;
    int sisa = (durasiTes - (millis() - startTime)) / 1000;

    printLine(0, "TES TANGAN KANAN");
    snprintf(buf, sizeof(buf), "Now : %.2f Kg", kgKanan); printLine(1, buf);
    snprintf(buf, sizeof(buf), "Max : %.2f Kg", maxKanan); printLine(2, buf);
    snprintf(buf, sizeof(buf), "Time: %ds BACK:Batal", sisa); printLine(3, buf);

    kgKanan = maxKanan; // Peak Hold
    sendRealtimeDataToFirebase(); 
    delay(50);
  }

  lastKanan = maxKanan; beepDouble(); lcd.clear();
  printLine(0, "HASIL TES KANAN");
  snprintf(buf, sizeof(buf), "Max: %.2f Kg", lastKanan); printLine(1, buf);
  printLine(2, "Data tersimpan"); printLine(3, "Back kembali");

  while (true) {
    if (buttonPressed(BTN_OK, lastOk) || buttonPressed(BTN_BACK, lastBack)) { 
      lcd.clear();
      printLine(0, "Mereset Sensor...");
      scaleKanan.tare();
      kgKanan = 0;
      return; 
    }
  }
}

void testDual() {
  countdownTest("TES DUAL SENSOR");
  float maxKiri = 0, maxKanan = 0;
  unsigned long startTime = millis();
  const unsigned long durasiTes = 5000;
  char buf[21];

  while (millis() - startTime < durasiTes) {
    if (buttonPressed(BTN_BACK, lastBack)) {
      lcd.clear(); printLine(1, "Tes dibatalkan"); delay(1000); lcd.clear(); return;
    }

    kgKiri = readScaleKg(scaleKiri);
    kgKanan = readScaleKg(scaleKanan);
    if (kgKiri > maxKiri) maxKiri = kgKiri;
    if (kgKanan > maxKanan) maxKanan = kgKanan;
    int sisa = (durasiTes - (millis() - startTime)) / 1000;

    printLine(0, "TES DUAL SENSOR");
    snprintf(buf, sizeof(buf), "L:%.1f R:%.1f Kg", kgKiri, kgKanan); printLine(1, buf);
    snprintf(buf, sizeof(buf), "ML:%.1f MR:%.1f", maxKiri, maxKanan); printLine(2, buf);
    snprintf(buf, sizeof(buf), "Time:%ds Back: Batal", sisa); printLine(3, buf);

    kgKiri = maxKiri; // Peak Hold Kiri
    kgKanan = maxKanan; // Peak Hold Kanan
    sendRealtimeDataToFirebase(); 
    delay(50);
  }

  lastKiri = maxKiri; lastKanan = maxKanan; beepDouble(); lcd.clear();
  printLine(0, "HASIL TES DUAL");
  snprintf(buf, sizeof(buf), "Kiri : %.2f Kg", lastKiri); printLine(1, buf);
  snprintf(buf, sizeof(buf), "Kanan: %.2f Kg", lastKanan); printLine(2, buf);
  printLine(3, "BACK kembali");

  while (true) {
    if (buttonPressed(BTN_OK, lastOk) || buttonPressed(BTN_BACK, lastBack)) { 
      lcd.clear();
      printLine(0, "Mereset Sensor...");
      scaleKiri.tare();
      scaleKanan.tare();
      kgKiri = 0;
      kgKanan = 0;
      return; 
    }
  }
}

void showLastData() {
  char buf[21];
  printLine(0, "DATA TERAKHIR");
  snprintf(buf, sizeof(buf), "Kiri : %.2f Kg", lastKiri); printLine(1, buf);
  snprintf(buf, sizeof(buf), "Kanan: %.2f Kg", lastKanan); printLine(2, buf);
  printLine(3, "Back: Menu Ok: Home");
}

void showInfo() {
  printLine(0, "GRIP ASIMETRI METER");
  printLine(1, "    BERBASIS IOT   ");
  printLine(2, " Versi 1.0 - 2026  ");
  printLine(3, "By: Rian Ardiansyah");
}

void executeMenu() {
  lcd.clear();
  if (menuIndex == 0) { testKiri(); currentScreen = SCREEN_MENU; }
  else if (menuIndex == 1) { testKanan(); currentScreen = SCREEN_MENU; }
  else if (menuIndex == 2) { testDual(); currentScreen = SCREEN_MENU; }
  else if (menuIndex == 3) { tareAll(); currentScreen = SCREEN_MENU; }
  else if (menuIndex == 4) { currentScreen = SCREEN_LAST_DATA; }
  else if (menuIndex == 5) { currentScreen = SCREEN_INFO; }
  lcd.clear();
}
