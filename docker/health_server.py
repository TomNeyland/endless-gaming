#!/usr/bin/env python3
import http.server
import socketserver
import json
import threading
import subprocess
import os
from datetime import datetime, UTC

class HealthHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health' or self.path == '/':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            
            health_data = {
                "status": "healthy",
                "service": "endless-gaming-json-export",
                "timestamp": datetime.now(UTC).isoformat(),
                "schedule": "Daily at 4 AM UTC",
                "version": "1.0.0"
            }
            
            self.wfile.write(json.dumps(health_data, indent=2).encode())
        else:
            self.send_response(404)
            self.end_headers()

def start_cron_scheduler():
    """Start cron and run initial export"""
    # Run initial export
    print("Running initial export...")
    subprocess.run(['/app/export_and_push.sh'])
    
    # Start cron daemon
    print("Starting cron daemon...")
    subprocess.run(['cron'])
    
    # Keep cron alive
    while True:
        import time
        time.sleep(60)  # Check every minute

if __name__ == '__main__':
    # Start cron scheduler in background thread
    cron_thread = threading.Thread(target=start_cron_scheduler, daemon=True)
    cron_thread.start()
    
    # Start HTTP server for health checks
    PORT = int(os.environ.get('PORT', 8080))
    print(f"Starting health server on port {PORT}")
    
    with socketserver.TCPServer(("", PORT), HealthHandler) as httpd:
        httpd.serve_forever()