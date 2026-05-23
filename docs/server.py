from http.server import HTTPServer, SimpleHTTPRequestHandler
import os

class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('Referrer-Policy', 'strict-origin-when-cross-origin')
        SimpleHTTPRequestHandler.end_headers(self)

    def guess_type(self, path):
        base, ext = os.path.splitext(path)
        if ext == '.html':
            return 'text/html; charset=utf-8'
        return SimpleHTTPRequestHandler.guess_type(self, path)

if __name__ == '__main__':
    port = 8766
    server = HTTPServer(('localhost', port), NoCacheHandler)
    print(f'Server running on http://localhost:{port}')
    server.serve_forever()
