#!/usr/bin/env python3
"""Open the Daily Bible page on this computer and on a phone on the same Wi-Fi."""

import socket
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

PORT = 8765
ROOT = Path(__file__).parent.resolve()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)


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
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
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
