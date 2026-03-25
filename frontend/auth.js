/* ═══════════════════════════════════════════════════════
   Luminary Auth — auth.js
   Handles: login, register, Face ID (OpenCV), Biometric (WebAuthn + Firebase)
═══════════════════════════════════════════════════════ */

"use strict";

// ── Backend base URL ──────────────────────────────────
const API = "http://localhost:5000/api";
let backendConnected = false;

// Check backend connectivity on page load
async function checkBackendConnection() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const res = await fetch("http://localhost:5000/api/ping", { 
      signal: controller.signal 
    });
    clearTimeout(timeoutId);
    
    if (res.ok) {
      const data = await res.json();
      backendConnected = data.ok === true;
      return { connected: backendConnected, data };
    }
    backendConnected = false;
    return { connected: false, data: null };
  } catch (e) {
    backendConnected = false;
    return { connected: false, data: null };
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  // Check if running from web server (required for API calls)
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  if (!isLocalhost) {
    const banner = document.createElement("div");
    banner.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
      background: linear-gradient(135deg, #dc2626, #f87171);
      color: white; padding: 16px 20px; text-align: center;
      font-weight: 500; font-size: 15px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    banner.innerHTML = `
      ⚠️ <strong>Frontend must be served from web server.</strong> 
      Run <code style="background:rgba(0,0,0,0.2); padding:4px 8px; border-radius:4px;">START.bat</code> 
      or <code style="background:rgba(0,0,0,0.2); padding:4px 8px; border-radius:4px;">python -m http.server 8000</code> 
      then visit <code style="background:rgba(0,0,0,0.2); padding:4px 8px; border-radius:4px;">http://localhost:8000/frontend/</code>
    `;
    document.body.insertBefore(banner, document.body.firstChild);
    document.body.style.paddingTop = "60px";
    return;
  }
  
  const { connected, data } = await checkBackendConnection();
  
  if (!connected) {
    const banner = document.createElement("div");
    banner.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
      background: linear-gradient(135deg, #f87171, #fb923c);
      color: white; padding: 16px 20px; text-align: center;
      font-weight: 500; font-size: 15px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    banner.innerHTML = `
      ⚠️ <strong>Backend not running.</strong> 
      Double-click <code style="background:rgba(0,0,0,0.2); padding:4px 8px; border-radius:4px;">START.bat</code> 
      or run: <code style="background:rgba(0,0,0,0.2); padding:4px 8px; border-radius:4px;">python start.py</code>
    `;
    document.body.insertBefore(banner, document.body.firstChild);
    document.body.style.paddingTop = "60px";
  } else if (data && !data.face_recognition) {
    // Backend running but face recognition not available (that's OK)
    console.log("✅ Backend running in mock mode (face recognition not available)");
  } else {
    console.log("✅ Backend connected successfully");
  }
});

// ── App state ─────────────────────────────────────────
let currentUid    = null;
let faceMode      = "verify";    // "register" | "verify"
let bioMode       = "verify";    // "register" | "verify"
let cameraActive  = false;
let captureOnce   = false;
let cameraLoop    = null;

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
      signal: AbortSignal.timeout(10000)
    });
    
    if (!res.ok) {
      console.error(`API Error: ${res.status}`, await res.text());
      return { 
        ok: false, 
        error: `Server error (HTTP ${res.status})` 
      };
    }
    
    return await res.json();
  } catch (e) {
    backendConnected = false;
    console.error("Backend connection failed:", e);
    return { 
      ok: false, 
      error: "❌ Backend offline. Refresh page and try again." 
    };
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

  const payload = { email, password: pass };
  const saved = JSON.parse(window.localStorage.getItem("luminary_user") || "null");

  // Prefer local fallback password match for quick demo behavior
  if (saved && saved.email === email && saved.password === pass) {
    currentUid = saved.uid;
    toast(`Welcome back, ${saved.name || email}! ✓`);
    return;
  }

  const res = await apiPost("/login", payload);
  if (res.ok) {
    currentUid = res.uid;
    toast(`Welcome back, ${res.name || email}! ✓`);
  } else {
    toast(res.error || "Login failed.", "err");
    setStatus("faceStatus", "No match. Use Forgot Password via Face ID.", "err");
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
    // Save local credentials for quick login + recovery flow
    window.localStorage.setItem("luminary_user", JSON.stringify({
      uid: currentUid,
      name,
      email,
      password: pass
    }));
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
  const saved = JSON.parse(window.localStorage.getItem("luminary_user") || "null");
  if (saved && !currentUid) {
    currentUid = saved.uid;
  }

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

async function startStream() {
  const camBox    = document.getElementById("camBox");
  const camBtn    = document.getElementById("camBtn");
  const canvas    = document.getElementById("streamCanvas");
  const ctx       = canvas.getContext("2d");

  if (!backendConnected) {
    setStatus("faceStatus",
      "❌ Backend offline. Refresh page after starting backend.", "err");
    camBtn.textContent = "Start Camera";
    camBtn.disabled = false;
    return;
  }

  cameraActive = true;
  camBox.classList.add("cam-live");
  camBtn.textContent = "📸 Capture & Verify";
  camBtn.disabled    = false;
  setStatus("faceStatus", "📹 Camera active — position your face then tap Capture.", "");

  // Set canvas size
  canvas.width  = 640;
  canvas.height = 480;

  // Start polling for frames
  const pollFrame = async () => {
    if (!cameraActive) return;
    
    try {
      const res = await fetch(`${API}/camera/frame`, { 
        signal: AbortSignal.timeout(5000) 
      });
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      
      const data = await res.json();
      if (data.ok && data.frame) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0);
          cameraLoop = setTimeout(pollFrame, 100);
        };
        img.onerror = () => {
          cameraLoop = setTimeout(pollFrame, 100);
        };
        img.src = data.frame;
      } else {
        cameraLoop = setTimeout(pollFrame, 100);
      }
    } catch (e) {
      console.error("Camera frame error:", e);
      setStatus("faceStatus",
        "❌ Camera error. Refresh page and try again.", "err");
      camBox.classList.remove("cam-live");
      camBtn.textContent = "Start Camera";
      camBtn.disabled    = false;
      cameraActive = false;
    }
  };

  // Call backend to start camera
  fetch(`${API}/camera/start`, { 
    method: "POST",
    signal: AbortSignal.timeout(5000)
  })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      if (data.ok) {
        backendConnected = true;
        pollFrame();
      } else {
        setStatus("faceStatus",
          "❌ " + (data.error || "Camera unavailable"), "err");
        cameraActive = false;
      }
    })
    .catch(e => {
      backendConnected = false;
      setStatus("faceStatus",
        "❌ Backend offline. Refresh page and try again.", "err");
      cameraActive = false;
    });
}

async function captureAndProcess() {
  if (captureOnce) return;
  captureOnce = true;

  const camBtn = document.getElementById("camBtn");
  camBtn.textContent = "Processing…";
  camBtn.disabled    = true;
  showLoader("faceStatus");

  // Capture canvas to base64
  const canvas = document.getElementById("streamCanvas");
  const b64 = canvas.toDataURL("image/jpeg", 0.85);

  stopCamera();

  let res;

  if (faceMode === "register") {
    // ── Register face ──
    res = await apiPost("/face/register", { uid: currentUid, image: b64 });
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
    res = await apiPost("/face/verify", body);
    if (res.ok) {
      setStatus("faceStatus", `✔ Face matched — ${res.confidence}% confidence`, "ok");
      toast("Welcome back! Face unlock successful. You can now change your password.");
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
    cameraActive = false;
    if (cameraLoop) {
      clearTimeout(cameraLoop);
      cameraLoop = null;
    }
    document.getElementById("camBox").classList.remove("cam-live");
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