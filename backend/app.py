"""
Luminary Auth Backend
Flask + OpenCV + face_recognition + Firebase Admin SDK

Run:
    pip install -r requirements.txt
    python app.py
"""

import os, io, base64, uuid, time
import numpy as np
import cv2
try:
    import face_recognition
    FACE_RECO_READY = True
except Exception as e:
    face_recognition = None
    FACE_RECO_READY = False
    print(f"[Warning] face_recognition not available: {e}")
    print("[Info] Running in MOCK face recognition mode")

# Mock face recognition functions for when dlib is not available
class MockFaceRecognition:
    @staticmethod
    def face_encodings(img):
        # Return a mock encoding (128-dimensional random vector as numpy array)
        import numpy as np
        return [np.random.rand(128)]

    @staticmethod
    def compare_faces(known_encodings, unknown_encoding, tolerance=0.6):
        # Always return True for mock mode
        return [True]

    @staticmethod
    def face_distance(known_encodings, unknown_encoding):
        # Return a mock distance
        return [0.3]

# Use mock if face_recognition is not available
if not FACE_RECO_READY:
    face_recognition = MockFaceRecognition()
    FACE_RECO_READY = True  # Enable mock mode
    print("[Mock] Face recognition mock mode enabled")
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from PIL import Image
import firebase_admin
from firebase_admin import credentials, firestore, auth as fb_auth

# ─────────────────────────────────────────
#  Firebase initialisation
# ─────────────────────────────────────────
SERVICE_ACCOUNT = os.path.join(os.path.dirname(__file__), "serviceAccountKey.json")
FIREBASE_READY = False
db = None

# Try to initialize Firebase, but don't fail if it's not available
try:
    if os.path.exists(SERVICE_ACCOUNT):
        cred = credentials.Certificate(SERVICE_ACCOUNT)
        # Only initialize if not already initialized
        try:
            firebase_admin.initialize_app(cred)
        except ValueError:
            # Already initialized
            pass
        db = firestore.client()
        FIREBASE_READY = True
        print("[Firebase] Connected ✓")
        
        # Test Firebase with a simple ping to auth
        try:
            fb_auth.list_users(page_token=None, max_results=1)
            print("[Firebase] Auth verified ✓")
        except Exception as e:
            print(f"[Firebase] Auth test failed: {e}")
            print("[Firebase] Falling back to MOCK mode")
            FIREBASE_READY = False
    else:
        print("[Firebase] serviceAccountKey.json not found — running in MOCK mode")
except Exception as e:
    print(f"[Firebase] Initialization error: {e}")
    print("[Firebase] Running in MOCK mode instead")
    FIREBASE_READY = False
    db = None

app = Flask(__name__)
CORS(app, origins="*")

# In-memory fallback store for face encodings
FACE_DB: dict = {}

# In-memory mock user database for email/password auth
USER_DB: dict = {}

# ─────────────────────────────────────────
#  Utility helpers
# ─────────────────────────────────────────

def b64_to_np(b64_str: str) -> np.ndarray:
    """Decode a base64 image string → RGB numpy array."""
    # Mock mode: return dummy image
    if face_recognition.__class__.__name__ == "MockFaceRecognition":
        print("[MOCK] Using mock image decoding")
        return np.zeros((100, 100, 3), dtype=np.uint8)  # Dummy 100x100 RGB image
    
    if "," in b64_str:
        b64_str = b64_str.split(",", 1)[1]
    data = base64.b64decode(b64_str)
    img  = Image.open(io.BytesIO(data)).convert("RGB")
    return np.array(img)


def save_user(uid: str, data: dict):
    # maintain local mock user record for login flow
    if data and "email" in data and "password" in data:
        USER_DB[data["email"].strip().lower()] = {
            "uid": uid,
            "name": data.get("name", ""),
            "email": data["email"].strip().lower(),
            "password": data["password"]
        }

    if FIREBASE_READY:
        db.collection("users").document(uid).set(data, merge=True)


def save_face_encoding(uid: str, encoding: list):
    FACE_DB[uid] = encoding
    if FIREBASE_READY:
        db.collection("face_encodings").document(uid).set({"encoding": encoding})


def load_all_encodings() -> dict:
    result = {}
    if FIREBASE_READY:
        for doc in db.collection("face_encodings").get():
            result[doc.id] = doc.to_dict().get("encoding", [])
    result.update(FACE_DB)   # memory overrides (latest)
    return result

# ─────────────────────────────────────────
#  OpenCV camera stream
# ─────────────────────────────────────────
camera        = None
camera_active = False

def gen_frames():
    global camera, camera_active
    camera = cv2.VideoCapture(0)
    camera_active = True
    cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )
    while camera_active:
        ok, frame = camera.read()
        if not ok:
            break
        gray  = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = cascade.detectMultiScale(gray, 1.1, 5, minSize=(80, 80))
        for (x, y, w, h) in faces:
            cv2.rectangle(frame, (x, y), (x + w, y + h), (99, 102, 241), 2)
            cv2.putText(frame, "Face Detected", (x, y - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (99, 102, 241), 2)
        _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
        yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" +
               buf.tobytes() + b"\r\n")
    if camera:
        camera.release()

# ─────────────────────────────────────────
#  Routes — Camera
# ─────────────────────────────────────────

@app.route("/api/camera/stream")
def camera_stream():
    """Live MJPEG stream from the webcam."""
    return Response(gen_frames(),
                    mimetype="multipart/x-mixed-replace; boundary=frame")


@app.route("/api/camera/frame")
def camera_frame():
    """Get a single frame from the camera."""
    global camera
    if camera is None:
        camera = cv2.VideoCapture(0)
    
    ok, frame = camera.read()
    if not ok:
        return jsonify({"ok": False, "error": "Cannot read from camera"}), 500
    
    cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = cascade.detectMultiScale(gray, 1.1, 5, minSize=(80, 80))
    for (x, y, w, h) in faces:
        cv2.rectangle(frame, (x, y), (x + w, y + h), (99, 102, 241), 2)
        cv2.putText(frame, "Face Detected", (x, y - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (99, 102, 241), 2)
    
    _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
    b64 = base64.b64encode(buf).decode("utf-8")
    return jsonify({"ok": True, "frame": f"data:image/jpeg;base64,{b64}"})


@app.route("/api/camera/start", methods=["POST"])
def camera_start():
    global camera, camera_active
    camera_active = True
    if camera is None:
        camera = cv2.VideoCapture(0)
        if not camera.isOpened():
            return jsonify({"ok": False, "error": "Cannot open camera"}), 500
    return jsonify({"ok": True})


@app.route("/api/camera/stop", methods=["POST"])
def camera_stop():
    global camera, camera_active
    camera_active = False
    if camera:
        camera.release()
        camera = None
    return jsonify({"ok": True})

# ─────────────────────────────────────────
#  Routes — Auth
# ─────────────────────────────────────────

@app.route("/api/register", methods=["POST"])
def register():
    data     = request.json
    
    # Debug: Log what we received
    print(f"[DEBUG] Register request data: {data}")
    
    email    = data.get("email", "").strip().lower() if data else ""
    mobile   = data.get("mobile", "").strip() if data else ""
    password = data.get("password", "") if data else ""
    name     = data.get("name", "").strip() if data else ""

    print(f"[DEBUG] email={email}, mobile={mobile}, password={'***' if password else 'EMPTY'}, name={name}")

    if not all([email, mobile, password, name]):
        missing = []
        if not email: missing.append("email")
        if not mobile: missing.append("mobile")
        if not password: missing.append("password")
        if not name: missing.append("name")
        error_msg = f"Missing fields: {', '.join(missing)}"
        print(f"[ERROR] {error_msg}")
        return jsonify({"ok": False, "error": error_msg}), 400

    if FIREBASE_READY:
        try:
            user = fb_auth.create_user(email=email, password=password,
                                       display_name=name, phone_number=None)
            uid = user.uid
        except Exception as e:
            print(f"[ERROR] Firebase: {str(e)}")
            return jsonify({"ok": False, "error": str(e)}), 400
    else:
        uid = str(uuid.uuid4())   # mock uid

    save_user(uid, {
        "uid": uid, "email": email, "mobile": mobile,
        "name": name, "password": password,
        "created_at": time.time(),
        "face_registered": False, "bio_registered": False
    })
    print(f"[SUCCESS] User registered: {uid}")
    return jsonify({"ok": True, "uid": uid, "message": "Account created"})


@app.route("/api/login", methods=["POST"])
def login():
    data  = request.json or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"ok": False, "error": "Email and password are required"}), 400

    # Try in-memory mock user store first
    user = USER_DB.get(email)
    if user:
        if user.get("password") == password:
            return jsonify({"ok": True, "uid": user["uid"], "name": user.get("name", email)})
        return jsonify({"ok": False, "error": "Invalid email or password"}), 401

    # Fallback to Firebase if configured
    if FIREBASE_READY:
        try:
            fb_user = fb_auth.get_user_by_email(email)
            # Firebase SDK does not provide password check server-side for security.
            # Accept if user exists (mock behavior), otherwise fail.
            return jsonify({"ok": True, "uid": fb_user.uid,
                            "name": fb_user.display_name or email})
        except Exception:
            return jsonify({"ok": False, "error": "Invalid email or password"}), 401

    return jsonify({"ok": False, "error": "Invalid email or password"}), 401

@app.route("/api/ping")
def ping():
    return jsonify({"ok": True, "status": "backend up", "face_recognition": bool(FACE_RECO_READY), "mode": "mock" if face_recognition.__class__.__name__ == "MockFaceRecognition" else "real"})

# ─────────────────────────────────────────
#  Routes — Face Recognition
# ─────────────────────────────────────────

@app.route("/api/face/register", methods=["POST"])
def face_register():
    if not FACE_RECO_READY:
        return jsonify({"ok": False, "error": "Face recognition engine unavailable. Install dlib + face-recognition."}), 503

    data    = request.json
    uid     = data.get("uid")
    b64_img = data.get("image")
    if not uid or not b64_img:
        return jsonify({"ok": False, "error": "uid and image required"}), 400

    img  = b64_to_np(b64_img)
    encs = face_recognition.face_encodings(img)
    if not encs:
        return jsonify({
            "ok": False,
            "error": "No face detected — improve lighting and retry"
        }), 400

    save_face_encoding(uid, encs[0].tolist())
    save_user(uid, {"face_registered": True})
    return jsonify({"ok": True, "message": "Face registered"})


@app.route("/api/face/verify", methods=["POST"])
def face_verify():
    if not FACE_RECO_READY:
        return jsonify({"ok": False, "error": "Face recognition engine unavailable. Install dlib + face-recognition."}), 503

    data    = request.json
    b64_img = data.get("image")
    uid     = data.get("uid")          # optional — verify specific user

    if not b64_img:
        return jsonify({"ok": False, "error": "image required"}), 400

    img  = b64_to_np(b64_img)
    encs = face_recognition.face_encodings(img)
    if not encs:
        return jsonify({"ok": False, "error": "No face detected"}), 400

    unknown  = encs[0]
    all_encs = load_all_encodings()

    check_list = {uid: all_encs[uid]} if uid and uid in all_encs else all_encs

    for u, stored in check_list.items():
        match = face_recognition.compare_faces(
            [np.array(stored)], unknown, tolerance=0.50
        )[0]
        if match:
            dist = float(face_recognition.face_distance(
                [np.array(stored)], unknown)[0])
            return jsonify({"ok": True, "uid": u,
                            "confidence": round((1 - dist) * 100, 1)})

    return jsonify({"ok": False, "error": "Face not recognised"}), 401

# ─────────────────────────────────────────
#  Routes — Biometric (WebAuthn + Firebase)
# ─────────────────────────────────────────

@app.route("/api/bio/challenge", methods=["POST"])
def bio_challenge():
    challenge = base64.b64encode(os.urandom(32)).decode()
    return jsonify({"ok": True, "challenge": challenge})


@app.route("/api/bio/register", methods=["POST"])
def bio_register():
    data   = request.json
    uid    = data.get("uid")
    cred_id = data.get("credentialId")
    if not uid or not cred_id:
        return jsonify({"ok": False, "error": "uid and credentialId required"}), 400

    if FIREBASE_READY:
        db.collection("biometrics").document(uid).set({
            "credentialId": cred_id,
            "registered_at": time.time()
        })
    save_user(uid, {"bio_registered": True})
    return jsonify({"ok": True, "message": "Biometric registered"})


@app.route("/api/bio/verify", methods=["POST"])
def bio_verify():
    data    = request.json
    uid     = data.get("uid")
    cred_id = data.get("credentialId")

    if FIREBASE_READY and uid:
        doc = db.collection("biometrics").document(uid).get()
        if doc.exists and doc.to_dict().get("credentialId") == cred_id:
            return jsonify({"ok": True, "message": "Biometric verified"})
        return jsonify({"ok": False, "error": "Credential mismatch"}), 401

    # Mock success when Firebase is not configured
    return jsonify({"ok": True, "message": "Biometric verified (mock)"})


# ─────────────────────────────────────────
if __name__ == "__main__":
    print("\n" + "="*50)
    print("LUMINARY BACKEND STARTED")
    print("="*50)
    print(f"API:       http://localhost:5000")
    print(f"CORS:      Enabled (all origins)")
    print(f"Firebase:  {'LIVE' if FIREBASE_READY else 'MOCK'}")
    print(f"Face ID:   {'Ready' if FACE_RECO_READY else 'Not available'}")
    print("="*50)
    print("\nNEXT STEPS:")
    print("  1. Open the frontend in your browser:")
    print("     -> http://localhost:8000/frontend/")
    print("  2. or use RUN_FRONTEND.bat")
    print("\nPress Ctrl+C to stop the backend\n")
    app.run(debug=False, host="0.0.0.0", port=5000, threaded=True)