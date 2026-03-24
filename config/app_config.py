# ═══════════════════════════════════════════════════════
#   config/app_config.py
#   Shared application settings — import in app.py
# ═══════════════════════════════════════════════════════

import os

# ── Server ──────────────────────────────────────────────
HOST = "0.0.0.0"
PORT = 5000
DEBUG = True

# ── CORS ────────────────────────────────────────────────
# List of allowed frontend origins. Add your deployed URL here.
CORS_ORIGINS = [
    "http://localhost",
    "http://127.0.0.1",
    "http://localhost:8080",
    "null",        # file:// origins (opening index.html directly)
]

# ── Firebase ─────────────────────────────────────────────
SERVICE_ACCOUNT_PATH = os.path.join(
    os.path.dirname(__file__), "..", "backend", "serviceAccountKey.json"
)

# Firestore collection names
COL_USERS          = "users"
COL_FACE_ENCODINGS = "face_encodings"
COL_BIOMETRICS     = "biometrics"

# ── Face Recognition ─────────────────────────────────────
# Tolerance: 0.4 = strict, 0.6 = lenient
FACE_TOLERANCE  = 0.50
JPEG_QUALITY    = 80    # 0–100

# ── Camera ───────────────────────────────────────────────
# 0 = built-in webcam, 1/2/… = external USB cameras
CAMERA_INDEX    = 0

# ── WebAuthn ─────────────────────────────────────────────
CHALLENGE_BYTES = 32   # bytes of entropy for each challenge