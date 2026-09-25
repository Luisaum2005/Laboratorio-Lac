from pathlib import Path
import re
import unicodedata

import pdfplumber
from pdfminer.pdfparser import PDFSyntaxError


PROCEDURE_PATTERN = re.compile(
    r"(?P<code>\d{8})(?:\s*-\s*|\s+(?=[A-Z]))(?P<description>.+?)\s+(?P<requested>\d+)\s+(?P<authorized>\d+)\s*$"
)

PROCEDURE_SECTION_START = re.compile(
    r"dados\s+da\s+solicita|procedimentos\s+ou\s+itens(?:\s+assistenciais)?\s+solicitados|lembrete\s+de\s+solicit",
    flags=re.IGNORECASE,
)

PROCEDURE_SECTION_END = re.compile(
    r"dados\s+do\s+contratado\s+executante|dados\s+do\s+atendimento|dados\s+da\s+execu",
    flags=re.IGNORECASE,
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


def _lines(text: str) -> list[str]:
    return [line.strip() for line in text.splitlines()]


def _next_nonempty(lines: list[str], index: int) -> str | None:
    for candidate in lines[index + 1:]:
        if candidate:
            return candidate
    return None


def _header_metadata(text: str) -> dict[str, str | None]:
    lines = _lines(text)
    for index, line in enumerate(lines):
        if not re.search(r"\b4\s*-\s*", line) or not re.search(r"\b7\s*-\s*", line):
            continue
        values = _next_nonempty(lines, index)
        if not values:
            continue
        match = re.search(
            r"(?P<authorization>\d{2}/\d{2}/\d{4})\s+"
            r"(?P<password>\d+)\s+"
            r"(?P<password_valid_until>\d{2}/\d{2}/\d{4})\s+"
            r"(?P<guide_number>\d+)",
            values,
        )
        if match:
            return {
                "guide_number": match.group("guide_number"),
                "password": match.group("password"),
                "password_valid_until": match.group("password_valid_until"),
                "authorization_date": match.group("authorization"),
            }
    return {
        "guide_number": None,
        "password": None,
        "password_valid_until": None,
        "authorization_date": None,
    }


def _patient_metadata(text: str) -> str | None:
    return _value(r"^\s*10\s*-\s*Nome\s*:?\s*(?:\n\s*)?([^\n]+)$", text)


def _doctor_metadata(text: str) -> str | None:
    return _doctor_metadata_details(text)[0]


def _doctor_metadata_details(text: str) -> tuple[str | None, str | None]:
    explicit = _value(r"\b15\s*-\s*Nome do Profissional Solicitante\s*:\s*([^\n]+)", text)
    if explicit:
        return explicit, "professional"

    lines = _lines(text)
    for index, line in enumerate(lines):
        if not re.search(r"\b14\s*-\s*Nome do Contratado\b", line, flags=re.IGNORECASE):
            continue
        candidate = _next_nonempty(lines, index)
        if not candidate:
            continue
        match = re.match(r"^\d+\s+(.+?)\s*$", candidate)
        if match and not re.fullmatch(r"[\d .-]+", match.group(1)):
            return match.group(1).strip(), "contracted_provider"
    return None, None


def _request_metadata(text: str) -> dict[str, str | None]:
    lines = _lines(text)
    for index, line in enumerate(lines):
        if not re.search(r"\b22\s*-\s*Data da Solicita", line, flags=re.IGNORECASE):
            continue
        candidate = _next_nonempty(lines, index)
        if not candidate:
            continue
        date = re.search(r"\d{2}/\d{2}/\d{4}", candidate)
        if not date:
            continue
        return {
            "request_date": date.group(0),
            "clinical_indication": candidate[date.end():].strip() or None,
        }
    return {"request_date": None, "clinical_indication": None}


def _beneficiary_metadata(text: str) -> dict[str, str | None]:
    lines = _lines(text)
    for index, line in enumerate(lines):
        if not re.search(r"\b8\s*-\s*", line) or not re.search(r"\b9\s*-\s*", line):
            continue
        candidate = _next_nonempty(lines, index)
        if not candidate:
            continue
        match = re.match(r"(?P<card>\S+)\s+(?P<valid_until>\d{2}/\d{2}/\d{4})", candidate)
        if match:
            return {
                "beneficiary_card_number": match.group("card"),
                "beneficiary_card_valid_until": match.group("valid_until"),
            }
    return {"beneficiary_card_number": None, "beneficiary_card_valid_until": None}


def _professional_metadata(text: str) -> dict[str, str | None]:
    lines = _lines(text)
    for index, line in enumerate(lines):
        if not re.search(r"\b15\s*-\s*", line) or not re.search(r"\b18\s*-\s*", line):
            continue
        candidate = _next_nonempty(lines, index)
        if not candidate:
            continue
        values = candidate.split()
        if len(values) >= 3 and values[0].isdigit():
            return {
                "professional_council": values[0],
                "professional_council_number": values[1],
                "professional_council_state": values[2],
            }
    return {
        "professional_council": None,
        "professional_council_number": None,
        "professional_council_state": None,
    }


def _metadata(text: str) -> dict[str, str | None]:
    metadata = {
        "patient_name": _patient_metadata(text),
        "doctor_name": _doctor_metadata(text),
        "doctor_name_source": _doctor_metadata_details(text)[1],
    }
    metadata.update(_header_metadata(text))
    metadata.update(_request_metadata(text))
    metadata.update(_beneficiary_metadata(text))
    metadata.update(_professional_metadata(text))

    # Some older exports place one value on the same line as its field label.
    # Keep these fallbacks so the parser accepts both SP/SADT layouts.
    legacy_values = {
        "patient_name": _value(r"10\s*-\s*Nome\s*:\s*([^\n]+)", text),
        "doctor_name": _value(r"15\s*-\s*Nome do Profissional Solicitante\s*:\s*([^\n]+)", text),
        "guide_number": _value(r"7\s*-\s*Numero da Guia Atribuido pela Operadora\s*:\s*([^\n]+)", text),
        "password": _value(r"5\s*-\s*Senha\s*:\s*([^\n]+)", text),
        "password_valid_until": _value(r"6\s*-\s*Data de Validade da Senha\s*:\s*([^\n]+)", text),
        "authorization_date": _value(r"4\s*-\s*Data da Autorizacao\s*:\s*([^\n]+)", text),
        "request_date": _value(r"22\s*-\s*Data da Solicitacao\s*:\s*([^\n]+)", text),
    }
    for key, value in legacy_values.items():
        if metadata[key] is None and value is not None:
            metadata[key] = value
            if key == "doctor_name":
                metadata["doctor_name_source"] = "professional"

    if metadata["clinical_indication"] is None:
        request_date = metadata["request_date"]
        if request_date:
            match = re.search(
                rf"22\s*-\s*Data da Solicitacao\s*:\s*{re.escape(request_date)}(?:[ \t]+([^\n]+))?",
                text,
                flags=re.IGNORECASE,
            )
            if match:
                metadata["clinical_indication"] = match.group(1).strip() if match.group(1) else None
    return metadata


def _procedure_lines(page: str) -> list[str]:
    lines: list[str] = []
    in_section = False
    for line in page.splitlines():
        normalized = _normalize_for_matching(line)
        if PROCEDURE_SECTION_START.search(normalized):
            in_section = True
        if in_section and PROCEDURE_SECTION_END.search(normalized):
            break
        if in_section:
            lines.append(line)
    return lines


def _extract_procedures(text_pages: list[str]) -> list[dict]:
    procedures: list[dict] = []
    seen: set[tuple[str, int, int]] = set()
    for page_number, page in enumerate(text_pages, start=1):
        for line in _procedure_lines(page):
            raw_text = line.strip()
            match = PROCEDURE_PATTERN.search(_normalize_for_matching(raw_text))
            if not match:
                continue
            requested_quantity = int(match.group("requested"))
            authorized_quantity = int(match.group("authorized"))
            key = (match.group("code"), requested_quantity, authorized_quantity)
            if key in seen:
                continue
            seen.add(key)
            procedure_raw_text = raw_text[raw_text.find(match.group("code")):]
            procedures.append({
                "raw_text": procedure_raw_text,
                "page": page_number,
                "code": match.group("code"),
                "description": match.group("description").strip(" -"),
                "requested_quantity": requested_quantity,
                "authorized_quantity": authorized_quantity,
                "is_authorized": authorized_quantity > 0,
            })
    return procedures


def extract_unimed_text_pages(text_pages: list[str]) -> dict:
    if not any(page.strip() for page in text_pages):
        return {"status": "reading_unavailable", "reason": "text_unavailable"}

    procedures = _extract_procedures(text_pages)

    if not procedures:
        return {"status": "reading_unavailable", "reason": "unexpected_layout"}

    return {
        "status": "ok",
        "metadata": _metadata(_normalize_for_matching("\n".join(text_pages))),
        "procedures": procedures,
    }


def extract_unimed_guide(path: Path) -> dict:
    try:
        with pdfplumber.open(path) as pdf:
            return extract_unimed_text_pages([page.extract_text() or "" for page in pdf.pages])
    except (OSError, ValueError, PDFSyntaxError):
        return {"status": "reading_unavailable", "reason": "text_unavailable"}
