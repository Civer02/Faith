#!/usr/bin/env python3
"""Open the Daily Bible page on this computer and on a phone on the same Wi-Fi."""

import mimetypes
import socket
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PORT = 8765
ROOT = Path(__file__).parent.resolve()

# Same policy as docs/index.html. upgrade-insecure-requests is omitted because
# this reader is served over plain HTTP on the local network.
CONTENT_SECURITY_POLICY = "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self'; connect-src https://bible-api.com; object-src 'none'; base-uri 'self'; form-action 'none'; frame-src 'none'; worker-src 'none'"

mimetypes.add_type("font/woff2", ".woff2")
mimetypes.add_type("text/javascript", ".js")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Content-Security-Policy", CONTENT_SECURITY_POLICY)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "DENY")
        super().end_headers()

    def list_directory(self, path):
        self.send_error(404)
        return None

    def do_POST(self):
        self.send_error(405)

    def do_PUT(self):
        self.send_error(405)

    def do_DELETE(self):
        self.send_error(405)


def lan_addresses():
    addresses = set()
    try:
        probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        probe.connect(("8.8.8.8", 80))
        addresses.add(probe.getsockname()[0])
        probe.close()
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            addresses.add(info[4][0])
    except OSError:
        pass
    return sorted(ip for ip in addresses if not ip.startswith("127."))


def main():
    # The phone reader has to be reachable on the local network.
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)  # nosec B104
    print(f"On this computer: http://127.0.0.1:{PORT}")
    for ip in lan_addresses():
        print(f"On a phone or iPad: http://{ip}:{PORT}")
    print("Leave this window open while you read.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
