from pathlib import Path
import json
import unittest
from http.server import ThreadingHTTPServer
from threading import Thread
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import app


FIXTURE = Path(__file__).parent / "fixtures" / "unimed-guide-anonymized.pdf"


class ParserHttpContractTest(unittest.TestCase):
    def test_internal_http_contract_requires_secret_and_returns_parser_json(self):
        original_download = app.download_pdf
        app.download_pdf = lambda _url: FIXTURE.read_bytes()
        self.addCleanup(setattr, app, "download_pdf", original_download)
        server = ThreadingHTTPServer(("127.0.0.1", 0), app.create_app("internal-test-secret"))
        thread = Thread(target=server.serve_forever)
        thread.start()
        self.addCleanup(thread.join)
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        url = f"http://127.0.0.1:{server.server_port}/parse-guide"
        body = b'{"conferenceId":"conference-1","sourceUrl":"https://signed.example/file.pdf"}'

        with self.assertRaises(HTTPError) as forbidden:
            urlopen(Request(url, data=body, method="POST"))
        self.assertEqual(forbidden.exception.code, 401)

        request = Request(
            url,
            data=body,
            method="POST",
            headers={"authorization": "Bearer internal-test-secret", "content-type": "application/json"},
        )
        with urlopen(request) as response:
            result = json.loads(response.read())
        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["procedures"][0]["code"], "40304361")
