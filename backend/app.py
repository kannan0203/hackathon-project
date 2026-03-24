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
import face_recognition
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from PIL import Image
import firebase_admin
from firebase_admin import credentials, firestore, auth as fb_auth

# ─────────────────────────────────────────
#  Firebase initialisation
# ─────────────────────────────────────────
SERVICE_ACCOUNT = os.path.join(os.path.dirname(__file__), "serviceAccountKey.json")

if os.path.exists(SERVICE_ACCOUNT):
    cred = credentials.Certificate(SERVICE_ACCOUNT)
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    FIREBASE_READY = True
    print("[Firebase] Connected ✓")
else:
    FIREBASE_READY = False
    print("[Firebase] serviceAccountKey.json not found — running in MOCK mode")

app = Flask(__name__)
CORS(app, origins="*")

# In-memory fallback store for face encodings
FACE_DB: dict = {}

# ─────────────────────────────────────────
#  Utility helpers
# ─────────────────────────────────────────

def b64_to_np(b64_str: str) -> np.ndarray:
    """Decode a base64 image string → RGB numpy array."""
    if "," in b64_str:
        b64_str = b64_str.split(",", 1)[1]
    data = base64.b64decode(b64_str)
    img  = Image.open(io.BytesIO(data)).convert("RGB")
    return np.array(img)


def save_user(uid: str, data: dict):
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


@app.route("/api/camera/stop", methods=["POST"])
def camera_stop():
    global camera_active
    camera_active = False
    return jsonify({"ok": True})

# ─────────────────────────────────────────
#  Routes — Auth
# ─────────────────────────────────────────

@app.route("/api/register", methods=["POST"])
def register():
    data     = request.json
    email    = data.get("email", "").strip().lower()
    mobile   = data.get("mobile", "").strip()
    password = data.get("password", "")
    name     = data.get("name", "").strip()

    if not all([email, mobile, password, name]):
        return jsonify({"ok": False, "error": "All fields are required"}), 400

    if FIREBASE_READY:
        try:
            user = fb_auth.create_user(email=email, password=password,
                                       display_name=name, phone_number=None)
            uid = user.uid
        except Exception as e:
            return jsonify({"ok": False, "error": str(e)}), 400
    else:
        uid = str(uuid.uuid4())   # mock uid

    save_user(uid, {
        "uid": uid, "email": email, "mobile": mobile,
        "name": name, "created_at": time.time(),
        "face_registered": False, "bio_registered": False
    })
    return jsonify({"ok": True, "uid": uid, "message": "Account created"})


@app.route("/api/login", methods=["POST"])
def login():
    data  = request.json
    email = data.get("email", "").strip().lower()
    # NOTE: password validation should happen via Firebase client SDK on the
    # frontend (signInWithEmailAndPassword). The server just confirms the user exists.
    if FIREBASE_READY:
        try:
            user = fb_auth.get_user_by_email(email)
            return jsonify({"ok": True, "uid": user.uid,
                            "name": user.display_name or email})
        except Exception:
            return jsonify({"ok": False, "error": "User not found"}), 401
    return jsonify({"ok": True, "uid": "mock-uid", "name": email})

# ─────────────────────────────────────────
#  Routes — Face Recognition
# ─────────────────────────────────────────

@app.route("/api/face/register", methods=["POST"])
def face_register():
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
    print("🚀  http://localhost:5001")
    print(f"🔥  Firebase: {'LIVE' if FIREBASE_READY else 'MOCK'}")
    app.run(debug=True, host="0.0.0.0", port=5001, threaded=True)