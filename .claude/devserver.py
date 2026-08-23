import functools
import http.server

ROOT = "/Users/simonfrye/Documents/PortfolioWebsite"

Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 8000), Handler)
print(f"Serving {ROOT} on http://127.0.0.1:8000")
httpd.serve_forever()
