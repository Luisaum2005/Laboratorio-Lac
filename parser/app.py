import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import NamedTemporaryFile
from urllib.request import urlopen

from unimed_parser import extract_unimed_guide


MAX_PDF_BYTES = 10 * 1024 * 1024


def download_pdf(source_url: str) -> bytes:
    with urlopen(source_url, timeout=20) as response:
        content = response.read(MAX_PDF_BYTES + 1)
    if len(content) > MAX_PDF_BYTES or not content.startswith(b"%PDF-"):
        raise ValueError("Arquivo de origem inválido.")
    return content


def parse_guide(source_url: str) -> dict:
    content = download_pdf(source_url)
    with NamedTemporaryFile(suffix=".pdf", delete=False) as temporary:
        temporary.write(content)
        temporary.flush()
        path = Path(temporary.name)
    try:
        return extract_unimed_guide(path)
    finally:
        path.unlink(missing_ok=True)


def create_app(shared_secret: str):
    class ParseGuideHandler(BaseHTTPRequestHandler):
        def do_POST(self):
            if self.path != "/parse-guide":
                self.send_error(404)
                return
            if self.headers.get("authorization") != f"Bearer {shared_secret}":
                self.send_error(401)
                return
            try:
                length = int(self.headers.get("content-length", "0"))
                payload = json.loads(self.rfile.read(length))
                source_url = payload["sourceUrl"]
                if not isinstance(payload.get("conferenceId"), str) or not isinstance(source_url, str):
                    raise ValueError("Contrato inválido.")
                result = parse_guide(source_url)
            except (KeyError, ValueError, json.JSONDecodeError):
                self.send_error(400)
                return
            self.send_response(200)
            self.send_header("content-type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())

        def log_message(self, _format, *_args):
            return

    return ParseGuideHandler


if __name__ == "__main__":
    secret = os.environ.get("PDF_PROCESSOR_SHARED_SECRET")
    if not secret:
        raise SystemExit("PDF_PROCESSOR_SHARED_SECRET é obrigatório.")
    ThreadingHTTPServer(("0.0.0.0", 8000), create_app(secret)).serve_forever()
