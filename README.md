# 🌟 Luminary — Face Recognition Auth System

A secure authentication system using **Flask + OpenCV + Face Recognition + Firebase + WebAuthn**.

Features:
- 🧿 **Face ID Login** — OpenCV-based face recognition
- 👆 **Biometric Auth** — WebAuthn fingerprint/device authenticator  
- 🔐 **Firebase Integration** — Secure user & session management
- ✨ **Modern UI** — Dark luxury design with smooth interactions

---

## ⚡ Quick Start

### **Option 1: Super Easy (Just Double-Click!)** ⭐ RECOMMENDED

1. **Double-click:** `START.bat`
2. That's it! Backend + frontend start automatically
3. Browser opens to http://localhost:8000/frontend/ automatically

### **Option 2: Double-click Separate Scripts**

1. **Backend**: Double-click `RUN_BACKEND.bat`
2. **Frontend**: Double-click `RUN_FRONTEND.bat` (in another window)
3. **Open**: http://localhost:8000/frontend/

### **Option 3: Manual Setup (Windows)**

#### Backend Setup
```bash
cd backend
pip install -r requirements.txt
python app.py
```

**Expected output:**
```
==================================================
🚀  LUMINARY BACKEND STARTED
==================================================
🌐  API:       http://localhost:5000
📡  CORS:      Enabled (all origins)
🔥  Firebase:  MOCK (no serviceAccountKey.json)
🧿  Face ID:   Ready ✓
==================================================
```

#### Frontend Setup (in another terminal)
```bash
python -m http.server 8000
```

Then open: **http://localhost:8000/frontend/**

---

## 🔧 Troubleshooting

### ❌ "Backend not running" Banner on Startup

**Solution (Easiest):**
```
Double-click: START.bat
```

This automatically starts both backend and frontend!

**Or manually:**
```bash
python start.py
```

### ❌ "Cannot reach backend" During Use

**Solution:**
1. Make sure `START.bat` is running (or `python start.py`)
2. Wait for the "✨ LUMINARY IS READY!" message
3. Refresh the frontend page

### ❌ "No camera detected"

**Solution:**
1. Check that your camera is connected and not in use by another app
2. Grant camera permissions to Python/VS Code
3. Try restarting the backend

### ❌ "No face detected" during Face ID

**Solution:**
- Ensure good lighting (face front-lit, not backlit)
- Keep face clearly visible in the camera frame
- Stay 12-20 inches from the camera
- Remove sunglasses

### ❌ Missing dlib error

**Solution:**
```bash
pip install dlib
pip install face-recognition
```

Or run the install batch file:
```bash
install_dlib.bat
```

---

## 📁 Project Structure

```
Hackathon/
├── START.bat                ⭐ Smart startup (auto-starts everything)
├── start.py                 Python startup helper
├── RUN_BACKEND.bat          Backend launcher (Windows)
├── RUN_FRONTEND.bat         Frontend launcher (Windows)
├── install_dlib.bat         (Optional) Install dlib
├── README.md                (this file)
│
├── backend/
│   ├── app.py               Main Flask server
│   ├── requirements.txt      Python dependencies
│   ├── firebase_config.py    Firebase setup
│   └── serviceAccountKey.json (not included — add your own)
│
├── frontend/
│   ├── index.html           Main UI
│   ├── auth.js              Authentication logic
│   └── style.css            Styles
│
└── config/
    ├── app_config.py        App configuration
    └── firebase_client_config.js
```

---

## 🔑 Firebase Setup (Optional)

To use real Firebase instead of mock mode:

1. Create a Firebase project at https://console.firebase.google.com/
2. Download your `serviceAccountKey.json` from Firebase Admin SDK settings
3. Place it in the `backend/` folder
4. Restart the backend — it will show `Firebase: LIVE ✓`

---

## 🚀 Features

### Face ID (Login & Registration)
- Registers or verifies faces using OpenCV + face_recognition library
- Real-time face detection with overlay rectangles
- ~0.5 second response time

### Biometric (WebAuthn)
- Platform-level fingerprint/face recognition
- Works with Windows Hello, Touch ID, etc.
- Credential IDs stored securely in Firebase

### User Management
- Email/password registration
- Account profile storage
- Face & biometric status tracking

---

## 📦 Dependencies

### Backend
- Flask (web server)
- OpenCV (computer vision)
- face_recognition (face encoding/comparison)  
- Firebase Admin SDK (database & auth)
- dlib (face detection)

### Frontend
- HTML5
- CSS3
- Vanilla JavaScript (no frameworks)
- WebAuthn API (browser native)

---

## 🛠️ API Endpoints

**Base:** `http://localhost:5000/api`

### Auth
- `POST /register` — Create new account
- `POST /login` — Login with email
- `GET /ping` — Health check

### Face Recognition
- `POST /camera/start` — Initialize camera
- `GET /camera/frame` — Get single frame with face detection
- `POST /camera/stop` — Stop camera stream
- `POST /face/register` — Register face for user
- `POST /face/verify` — Verify face against registered faces

### Biometric
- `POST /bio/challenge` — Get challenge for WebAuthn
- `POST /bio/register` — Register biometric credential
- `POST /bio/verify` — Verify with biometric

---

## 📄 License

Hackathon project. All rights reserved.

---

**Having issues?** Check the Troubleshooting section above or restart both the backend and frontend.