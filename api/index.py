"""Vercel Serverless Function - Health Check"""
from http.server import BaseHTTPRequestHandler
import json


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        
        response = {
            "status": "ok",
            "service": "Business Card Cloner API",
            "version": "1.0.0",
            "message": "Backend serverless function is running"
        }
        
        self.wfile.write(json.dumps(response).encode())
        return

