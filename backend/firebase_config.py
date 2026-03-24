"""
firebase_config.py
──────────────────
Central place for all Firestore collection names and
Firebase project settings used by app.py.

Collections created automatically on first write:
  - users           : user profile documents
  - face_encodings  : 128-dim face vectors (stored as float arrays)
  - biometrics      : WebAuthn credential IDs
"""

# ── Firestore collection names ──────────────────────────────────
COLLECTION_USERS          = "users"
COLLECTION_FACE_ENCODINGS = "face_encodings"
COLLECTION_BIOMETRICS     = "biometrics"

# ── Face recognition tuning ─────────────────────────────────────
# Lower tolerance = stricter matching (0.4 strict, 0.6 lenient)
FACE_TOLERANCE = 0.50

# ── Camera ──────────────────────────────────────────────────────
# 0 = default webcam. Change to 1, 2 … for external cameras.
CAMERA_INDEX   = 0
JPEG_QUALITY   = 80    # 0-100, higher = better quality but more bandwidth

# ── WebAuthn ────────────────────────────────────────────────────
CHALLENGE_BYTES = 32   # bytes of randomness for each WebAuthn challenge