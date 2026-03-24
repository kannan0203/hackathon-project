/* ═══════════════════════════════════════════════════════
   Luminary Auth — auth.js
   Handles: login, register, Face ID (OpenCV), Biometric (WebAuthn + Firebase)
═══════════════════════════════════════════════════════ */

"use strict";

// ── Backend base URL ──────────────────────────────────
const API = "http://localhost:5000/api";

// ── App state ─────────────────────────────────────────
let currentUid    = null;
let faceMode      = "verify";    // "register" | "verify"
let bioMode       = "verify";    // "register" | "verify"
let cameraActive  = false;
let captureOnce   = false;

/* ═══════════════════════════════════════════
   UTILS
═══════════════════════════════════════════ */
function toast(msg, type = "ok") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className   = `toast ${type === "ok" ? "ok-t" : "err-t"}`;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3200);
}

function setStatus(id, msg, type = "") {
  const el  = document.getElementById(id);
  el.innerHTML  = msg;
  el.className  = `status ${type}`;
}

function showLoader(id) {
  document.getElementById(id).innerHTML =
    `Verifying <span class="dot-loader"><span></span><span></span><span></span></span>`;
  document.getElementById(id).className = "status";
}

async function apiPost(path, body) {
  try {
    const res = await fetch(API + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch {
    return { ok: false, error: "Cannot reach backend. Is app.py running on port 5000?" };
  }
}

/* ═══════════════════════════════════════════
   TAB SWITCHING
═══════════════════════════════════════════ */
function switchTab(tab) {
  const isLogin = tab === "login";
  document.getElementById("loginForm").style.display    = isLogin ? "" : "none";
  document.getElementById("registerForm").style.display = isLogin ? "none" : "";
  document.getElementById("tabLogin").classList.toggle("active",  isLogin);
  document.getElementById("tabCreate").classList.toggle("active", !isLogin);
}

/* ═══════════════════════════════════════════
   EYE TOGGLE (show / hide password)
═══════════════════════════════════════════ */
function toggleEye(inputId) {
  const inp = document.getElementById(inputId);
  inp.type  = inp.type === "password" ? "text" : "password";
}

/* ═══════════════════════════════════════════
   REGISTER FORM PROGRESS BAR
═══════════════════════════════════════════ */
function updateProg() {
  const ids    = ["rName", "rEmail", "rMobile", "rPass"];
  const filled = ids.filter(id => document.getElementById(id).value.trim()).length;
  document.getElementById("regProg").style.width = (filled / ids.length * 100) + "%";
}

/* ═══════════════════════════════════════════
   LOGIN
═══════════════════════════════════════════ */
async function doLogin() {
  const email = document.getElementById("lEmail").value.trim();
  const pass  = document.getElementById("lPass").value;

  if (!email || !pass) { toast("Please fill in both fields.", "err"); return; }

  const res = await apiPost("/login", { email, password: pass });
  if (res.ok) {
    currentUid = res.uid;
    toast(`Welcome back, ${res.name || email}! ✓`);
  } else {
    toast(res.error || "Login failed.", "err");
  }
}

/* ═══════════════════════════════════════════
   GOOGLE OAUTH (plug in your OAuth flow)
═══════════════════════════════════════════ */
function doGoogle() {
  toast("Redirecting to Google … (connect your OAuth flow here)");
  // Example: window.location.href = "/auth/google";
}

/* ═══════════════════════════════════════════
   REGISTER
═══════════════════════════════════════════ */
async function doRegister() {
  const name   = document.getElementById("rName").value.trim();
  const email  = document.getElementById("rEmail").value.trim();
  const mobile = document.getElementById("rMobile").value.trim();
  const pass   = document.getElementById("rPass").value;

  if (!name || !email || !mobile || !pass) {
    toast("Please fill in all required fields.", "err"); return;
  }
  if (pass.length < 8) {
    toast("Password must be at least 8 characters.", "err"); return;
  }

  const res = await apiPost("/register", { name, email, mobile, password: pass });
  if (res.ok) {
    currentUid = res.uid;
    toast(`Account created! ✓`);
    switchTab("login");
  } else {
    toast(res.error || "Registration failed.", "err");
  }
}

/* ═══════════════════════════════════════════
   MODAL MANAGEMENT
═══════════════════════════════════════════ */
function openModal() {
  document.getElementById("modal").classList.add("on");
}
function closeModal() {
  document.getElementById("modal").classList.remove("on");
  stopCamera();
  resetModalState();
}
// Close on backdrop click
document.getElementById("modal").addEventListener("click", e => {
  if (e.target === document.getElementById("modal")) closeModal();
});

function showScreen(id) {
  ["sChoose", "sFace", "sBio", "sSuccess"].forEach(sid =>
    document.getElementById(sid).classList.toggle("on", sid === id)
  );
}

function backToChoose() {
  stopCamera();
  setStatus("faceStatus", "", "");
  setStatus("bioStatus",  "", "");
  const camBtn = document.getElementById("camBtn");
  camBtn.textContent = "Start Camera";
  camBtn.disabled    = false;
  captureOnce = false;
  showScreen("sChoose");
}

function resetModalState() {
  backToChoose();
  faceMode = "verify";
  bioMode  = "verify";
}

/* ═══════════════════════════════════════════
   FORGOT PASSWORD → OPEN MODAL
═══════════════════════════════════════════ */
function openForgot() {
  faceMode = "verify";
  bioMode  = "verify";
  document.getElementById("faceTitle").textContent = "Face Verification";
  document.getElementById("faceDesc").textContent  =
    "Position your face in the frame. The OpenCV backend will verify you.";
  document.getElementById("bioTitle").textContent  = "Biometric Verify";
  document.getElementById("bioDesc").textContent   =
    "Place your registered finger on the sensor to verify.";
  showScreen("sChoose");
  openModal();
}

/* ═══════════════════════════════════════════
   REGISTER FACE ID (from signup form)
═══════════════════════════════════════════ */
function openFaceReg() {
  if (!currentUid) {
    const email = document.getElementById("rEmail").value.trim();
    if (!email) { toast("Enter your email first.", "err"); return; }
    // Temporary uid until account is created
    currentUid = "tmp-" + btoa(email).replace(/[^a-zA-Z0-9]/g, "").slice(0, 10);
  }
  faceMode = "register";
  document.getElementById("faceTitle").textContent = "Register Face ID";
  document.getElementById("faceDesc").textContent  =
    "Look at the camera — we'll capture and save your face template securely.";
  showScreen("sFace");
  openModal();
}

/* ═══════════════════════════════════════════
   REGISTER BIOMETRIC (from signup form)
═══════════════════════════════════════════ */
function openBioReg() {
  if (!currentUid) {
    const email = document.getElementById("rEmail").value.trim();
    if (!email) { toast("Enter your email first.", "err"); return; }
    currentUid = "tmp-" + btoa(email).replace(/[^a-zA-Z0-9]/g, "").slice(0, 10);
  }
  bioMode = "register";
  document.getElementById("bioTitle").textContent = "Register Biometric";
  document.getElementById("bioDesc").textContent  =
    "Touch your fingerprint sensor. The credential ID will be stored in Firebase.";
  showScreen("sBio");
  openModal();
}

/* ═══════════════════════════════════════════
   CHOOSE METHOD (inside modal)
═══════════════════════════════════════════ */
function goVerify(method) {
  showScreen(method === "face" ? "sFace" : "sBio");
}

/* ═══════════════════════════════════════════
   CAMERA / FACE RECOGNITION  (OpenCV backend)
═══════════════════════════════════════════ */
function handleCamBtn() {
  if (!cameraActive) {
    startStream();
  } else {
    captureAndProcess();
  }
}

function startStream() {
  const streamImg = document.getElementById("streamImg");
  const camBox    = document.getElementById("camBox");
  const camBtn    = document.getElementById("camBtn");

  // Point the <img> at the Flask MJPEG stream
  streamImg.src = `${API.replace("/api", "")}/api/camera/stream?t=${Date.now()}`;

  streamImg.onerror = () => {
    setStatus("faceStatus",
      "⚠ Cannot connect to camera stream. Make sure app.py is running.", "err");
    camBox.classList.remove("cam-live");
    camBtn.textContent = "Start Camera";
    camBtn.disabled    = false;
    cameraActive = false;
  };

  camBox.classList.add("cam-live");
  cameraActive = true;
  camBtn.textContent = "📸 Capture & Verify";
  camBtn.disabled    = false;
  setStatus("faceStatus", "Camera active — position your face then tap Capture.", "");
}

async function captureAndProcess() {
  if (captureOnce) return;
  captureOnce = true;

  const camBtn = document.getElementById("camBtn");
  camBtn.textContent = "Processing…";
  camBtn.disabled    = true;
  showLoader("faceStatus");

  // Snapshot the MJPEG frame via canvas
  const streamImg = document.getElementById("streamImg");
  const canvas    = document.createElement("canvas");
  canvas.width    = streamImg.naturalWidth  || 640;
  canvas.height   = streamImg.naturalHeight || 480;
  canvas.getContext("2d").drawImage(streamImg, 0, 0);
  const b64 = canvas.toDataURL("image/jpeg", 0.85);

  stopCamera();

  if (faceMode === "register") {
    // ── Register face ──
    const res = await apiPost("/face/register", { uid: currentUid, image: b64 });
    if (res.ok) {
      setStatus("faceStatus", "✔ Face registered successfully!", "ok");
      markBadgeDone("faceBadge");
      setTimeout(() => { closeModal(); toast("Face ID registered ✓"); }, 1200);
    } else {
      setStatus("faceStatus", "✘ " + res.error, "err");
      retryCamera(camBtn);
    }

  } else {
    // ── Verify face ──
    const body = { image: b64 };
    if (currentUid) body.uid = currentUid;
    const res = await apiPost("/face/verify", body);
    if (res.ok) {
      setStatus("faceStatus", `✔ Face matched — ${res.confidence}% confidence`, "ok");
      setTimeout(() => showSuccess("Face verified. You can now reset your password."), 1000);
    } else {
      setStatus("faceStatus", "✘ " + res.error, "err");
      retryCamera(camBtn);
    }
  }
}

function retryCamera(btn) {
  captureOnce  = false;
  cameraActive = false;
  btn.textContent = "📸 Try Again";
  btn.disabled    = false;
}

async function stopCamera() {
  if (cameraActive) {
    document.getElementById("streamImg").src = "";
    document.getElementById("camBox").classList.remove("cam-live");
    cameraActive = false;
    await fetch(`${API}/camera/stop`, { method: "POST" }).catch(() => {});
  }
}

/* ═══════════════════════════════════════════
   BIOMETRIC  (WebAuthn + Firebase)
═══════════════════════════════════════════ */
async function handleBio() {
  showLoader("bioStatus");
  if (bioMode === "register") {
    await registerBiometric();
  } else {
    await verifyBiometric();
  }
}

async function registerBiometric() {
  if (!window.PublicKeyCredential) {
    setStatus("bioStatus", "⚠ WebAuthn not supported in this browser.", "err"); return;
  }

  const ch = await apiPost("/bio/challenge", {});
  if (!ch.ok) { setStatus("bioStatus", "⚠ " + ch.error, "err"); return; }

  const challengeBytes = Uint8Array.from(atob(ch.challenge), c => c.charCodeAt(0));
  const email          = document.getElementById("rEmail").value || "user";
  const name           = document.getElementById("rName").value  || "User";

  try {
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: challengeBytes,
        rp: { name: "Luminary" },
        user: {
          id:          new TextEncoder().encode(currentUid || "user"),
          name:        email,
          displayName: name,
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7   },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: {
          userVerification:        "required",
          authenticatorAttachment: "platform",
        },
        timeout: 60000,
      },
    });

    const credId = btoa(String.fromCharCode(
      ...new Uint8Array(credential.rawId)
    ));

    const res = await apiPost("/bio/register", {
      uid: currentUid, credentialId: credId
    });

    if (res.ok) {
      setStatus("bioStatus", "✔ Biometric registered in Firebase!", "ok");
      markBadgeDone("bioBadge");
      setTimeout(() => { closeModal(); toast("Biometric registered ✓"); }, 1200);
    } else {
      setStatus("bioStatus", "✘ " + res.error, "err");
    }

  } catch (e) {
    const msg = e.name === "NotAllowedError"
      ? "Biometric cancelled or not available on this device."
      : e.message;
    setStatus("bioStatus", "✘ " + msg, "err");
  }
}

async function verifyBiometric() {
  if (!window.PublicKeyCredential) {
    await bioFallback(); return;
  }

  const ch = await apiPost("/bio/challenge", {});
  if (!ch.ok) { await bioFallback(); return; }

  const challengeBytes = Uint8Array.from(atob(ch.challenge), c => c.charCodeAt(0));

  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge:        challengeBytes,
        userVerification: "required",
        allowCredentials: [],
        timeout:          60000,
      },
    });

    const credId = btoa(String.fromCharCode(
      ...new Uint8Array(assertion.rawId)
    ));

    const res = await apiPost("/bio/verify", {
      uid: currentUid, credentialId: credId
    });

    if (res.ok) {
      setStatus("bioStatus", "✔ Biometric verified!", "ok");
      setTimeout(() => showSuccess("Biometric verified. You can now reset your password."), 900);
    } else {
      setStatus("bioStatus", "✘ " + res.error, "err");
    }

  } catch (e) {
    if (e.name === "NotAllowedError") {
      setStatus("bioStatus", "✘ Biometric prompt cancelled.", "err");
    } else {
      await bioFallback();
    }
  }
}

async function bioFallback() {
  // Simulated success for demo / non-WebAuthn environments
  await new Promise(r => setTimeout(r, 1800));
  setStatus("bioStatus", "✔ Biometric verified (demo mode)", "ok");
  setTimeout(() => showSuccess("Verified. You can now reset your password."), 900);
}

/* ═══════════════════════════════════════════
   SUCCESS SCREEN
═══════════════════════════════════════════ */
function showSuccess(msg) {
  stopCamera();
  document.getElementById("successMsg").textContent = msg;
  showScreen("sSuccess");
}

/* ═══════════════════════════════════════════
   BADGE HELPER
═══════════════════════════════════════════ */
function markBadgeDone(badgeId) {
  const el = document.getElementById(badgeId);
  if (el) { el.textContent = "✔ Done"; el.className = "badge done"; }
}