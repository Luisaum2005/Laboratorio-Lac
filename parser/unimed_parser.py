from pathlib import Path
import re
import unicodedata

import pdfplumber
from pdfminer.pdfparser import PDFSyntaxError


PROCEDURE_PATTERN = re.compile(
    r"(?P<code>\d{8})\s*-\s*(?P<description>.+?)\s+(?P<requested>\d+)\s+(?P<authorized>\d+)\s*$"
)


def _value(pattern: str, text: str) -> str | None:
    match = re.search(pattern, text, flags=re.IGNORECASE | re.MULTILINE)
    return match.group(1).strip() if match else None


def _normalize_for_matching(text: str) -> str:
    without_accents = "".join(
        character for character in unicodedata.normalize("NFKD", text)
        if not unicodedata.combining(character)
    )
    normalized_separators = re.sub(r"[‐‑‒–—―]", "-", without_accents)
    return re.sub(r"[ \t]+", " ", normalized_separators).strip()


def _metadata(text: str) -> dict[str, str | None]:
    return {
        "patient_name": _value(r"10\s*-\s*Nome\s*:\s*([^\n]+)", text),
        "doctor_name": _value(r"15\s*-\s*Nome do Profissional Solicitante\s*:\s*([^\n]+)", text),
        "guide_number": _value(r"7\s*-\s*(?:Numero|Número) da Guia Atribuido pela Operadora\s*:\s*([^\n]+)", text),
        "password": _value(r"5\s*-\s*Senha\s*:\s*([^\n]+)", text),
        "password_valid_until": _value(r"6\s*-\s*Data de Validade da Senha\s*:\s*([^\n]+)", text),
        "authorization_date": _value(r"4\s*-\s*Data da Autoriza(?:cao|ção)\s*:\s*([^\n]+)", text),
        "request_date": _value(r"22\s*-\s*Data da Solicita(?:cao|ção)\s*:\s*([^\n]+)", text),
    }


def extract_unimed_text_pages(text_pages: list[str]) -> dict:
    if not any(page.strip() for page in text_pages):
        return {"status": "reading_unavailable", "reason": "text_unavailable"}

    last_page = text_pages[-1]
    if "Procedimentos ou Itens Solicitados" not in last_page:
        return {"status": "reading_unavailable", "reason": "unexpected_layout"}

    procedures = []
    for line in last_page.splitlines():
        raw_text = line.strip()
        match = PROCEDURE_PATTERN.search(_normalize_for_matching(raw_text))
        if not match:
            continue
        procedure_raw_text = raw_text[raw_text.find(match.group("code")):]
        authorized_quantity = int(match.group("authorized"))
        if authorized_quantity <= 0:
            continue
        procedures.append({
            "raw_text": procedure_raw_text,
            "page": len(text_pages),
            "code": match.group("code"),
            "description": match.group("description").strip(),
            "requested_quantity": int(match.group("requested")),
            "authorized_quantity": authorized_quantity,
        })

    if not procedures:
        return {"status": "reading_unavailable", "reason": "unexpected_layout"}

    return {
        "status": "ok",
        "metadata": _metadata(_normalize_for_matching("\n".join(text_pages[:-1]))),
        "procedures": procedures,
    }


def extract_unimed_guide(path: Path) -> dict:
    try:
        with pdfplumber.open(path) as pdf:
            return extract_unimed_text_pages([page.extract_text() or "" for page in pdf.pages])
    except (OSError, ValueError, PDFSyntaxError):
        return {"status": "reading_unavailable", "reason": "text_unavailable"}
