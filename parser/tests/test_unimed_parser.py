from pathlib import Path
import unittest

from unimed_parser import extract_unimed_guide, extract_unimed_text_pages


FIXTURE = Path(__file__).parent / "fixtures" / "unimed-guide-anonymized.pdf"


class UnimedParserTest(unittest.TestCase):
    def test_extracts_metadata_and_all_procedures_from_anonymized_unimed_guide(self):
        result = extract_unimed_guide(FIXTURE)

        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["metadata"], {
        "patient_name": "PACIENTE ANONIMIZADO",
        "doctor_name": "MEDICO DE TESTE",
        "guide_number": "12345678",
        "password": "7654321",
        "password_valid_until": "31/12/2026",
        "authorization_date": "08/10/2025",
        "request_date": "08/10/2025",
        })
        self.assertEqual(result["procedures"], [
        {
            "raw_text": "40304361 - HEMOGRAMA COMPLETO 1 1",
            "page": 2,
            "code": "40304361",
            "description": "HEMOGRAMA COMPLETO",
            "requested_quantity": 1,
            "authorized_quantity": 1,
            "is_authorized": True,
        },
        {
            "raw_text": "40301583 - COLESTEROL HDL 1 1",
            "page": 2,
            "code": "40301583",
            "description": "COLESTEROL HDL",
            "requested_quantity": 1,
            "authorized_quantity": 1,
            "is_authorized": True,
        },
        {
            "raw_text": "40301605 - COLESTEROL TOTAL 2 0",
            "page": 2,
            "code": "40301605",
            "description": "COLESTEROL TOTAL",
            "requested_quantity": 2,
            "authorized_quantity": 0,
            "is_authorized": False,
        },
        ])


    def test_returns_reading_unavailable_without_text_layer_or_expected_layout(self):
        result = extract_unimed_text_pages(["", ""])

        self.assertEqual(result, {"status": "reading_unavailable", "reason": "text_unavailable"})

    def test_returns_reading_unavailable_for_an_unexpected_last_page_layout(self):
        result = extract_unimed_text_pages(["10 - Nome: PACIENTE", "Pagina sem procedimentos"])

        self.assertEqual(result, {"status": "reading_unavailable", "reason": "unexpected_layout"})

    def test_normalizes_spacing_accents_and_separators_without_losing_raw_text(self):
        result = extract_unimed_text_pages([
            "10 - Nome: PACIENTE\n15 - Nome do Profissional Solicitante: MEDICO",
            "Procedimentos ou Itens Solicitados\n40304361 — HEMOGRAMA  COMPLETO   1  1",
        ])

        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["procedures"], [{
            "raw_text": "40304361 — HEMOGRAMA  COMPLETO   1  1",
            "page": 2,
            "code": "40304361",
            "description": "HEMOGRAMA COMPLETO",
            "requested_quantity": 1,
            "authorized_quantity": 1,
            "is_authorized": True,
        }])

    def test_normalizes_the_last_page_header_before_validating_layout(self):
        result = extract_unimed_text_pages([
            "10 - Nome: PACIENTE",
            "procedimentos   ou itens   solicitados\n40304361 - HEMOGRAMA COMPLETO 1 1",
        ])

        self.assertEqual(result["status"], "ok")
