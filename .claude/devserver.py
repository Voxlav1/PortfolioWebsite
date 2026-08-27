import functools
import http.server
import os

ROOT = "/Users/simonfrye/Documents/PortfolioWebsite"
PORT = int(os.environ.get("PORT", 8000))

Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
httpd = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
print(f"Serving {ROOT} on http://127.0.0.1:{PORT}")
httpd.serve_forever()
