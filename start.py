import subprocess
import sys
import time
import os
import webbrowser
from pathlib import Path

def is_backend_running(port=5000):
    """Check if backend is already running"""
    try:
        import socket
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        result = sock.connect_ex(('localhost', port))
        sock.close()
        return result == 0
    except:
        return False

def main():
    print("\n" + "="*60)
    print("🌟  LUMINARY — Smart Startup Launcher")
    print("="*60)
    
    # Change to project root
    script_dir = Path(__file__).parent
    os.chdir(script_dir)
    
    # Check if backend is running
    backend_running = is_backend_running(5000)
    frontend_running = is_backend_running(8000)
    
    print(f"\n📊 Status Check:")
    print(f"   Backend (port 5000):  {'✅ Running' if backend_running else '⚠️  Stopped'}")
    print(f"   Frontend (port 8000): {'✅ Running' if frontend_running else '⚠️  Stopped'}")
    
    # Start backend if not running
    if not backend_running:
        print(f"\n🚀 Starting backend...")
        print(f"   Location: {script_dir / 'backend'}")
        
        backend_process = subprocess.Popen(
            [sys.executable, "app.py"],
            cwd=str(script_dir / "backend"),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        print(f"   PID: {backend_process.pid}")
        print(f"   ⏳ Waiting for startup (3 seconds)...\n")
        time.sleep(3)
        
        if backend_process.poll() is not None:
            print("❌ Backend failed to start!")
            print("   Error output:")
            _, err = backend_process.communicate()
            print(err)
            print("\n💡 Troubleshooting:")
            print("   1. Check that Python is installed: python --version")
            print("   2. Install dependencies: cd backend && pip install -r requirements.txt")
            print("   3. Check for missing dlib: pip install dlib")
            sys.exit(1)
    else:
        print("\n✅ Backend is already running!")
    
    # Start frontend if not running
    if not frontend_running:
        print(f"\n🌐 Starting frontend web server...")
        print(f"   Location: {script_dir}")
        
        frontend_process = subprocess.Popen(
            [sys.executable, "-m", "http.server", "8000"],
            cwd=str(script_dir),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        print(f"   PID: {frontend_process.pid}")
        print(f"   ⏳ Waiting for startup (2 seconds)...\n")
        time.sleep(2)
    else:
        print("\n✅ Frontend is already running!")
    
    # Show access info
    print("="*60)
    print("✨ LUMINARY IS READY!")
    print("="*60)
    print(f"\n🌐 Frontend:  http://localhost:8000/frontend/")
    print(f"📡 Backend:   http://localhost:5000/api/")
    print(f"\n💡 Open http://localhost:8000/frontend/ in your browser now!\n")
    
    # Try to open in browser
    try:
        webbrowser.open("http://localhost:8000/frontend/")
        print("Browser opened automatically ✓\n")
    except:
        print("(Could not auto-open browser)\n")
    
    print("="*60)
    print("⚡ Press Ctrl+C to stop\n")
    
    # Keep running
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n\n👋 Shutting down...\n")
        sys.exit(0)

if __name__ == "__main__":
    main()
