from pathlib import Path
import unittest

from unimed_parser import extract_unimed_guide, extract_unimed_text_pages


FIXTURE = Path(__file__).parent / "fixtures" / "unimed-guide-anonymized.pdf"


class UnimedParserTest(unittest.TestCase):
    def test_extracts_real_sp_sadt_metadata_when_labels_are_split_and_accents_are_corrupted(self):
        result = extract_unimed_text_pages([
            """GUIA DE SERVIÇO PROFISSIONAL / SERVIÇO AUXILIAR DE DIAGNÓSTICO E TERAPIA - SP/SADT 17484905
4 - Data da Autoriza��o 5 - Senha 6 - Data de Validade da Senha 7 - N�mero da Guia Atribu�do pela Operadora
08/10/2025 1322752 08/10/2026 17484905
10 - Nome
JULIA PEREIRA DOS SANTOS
13 - C�digo na Operadora 14 - Nome do Contratado
451491 PATRICIA ARANTES ROSA
15 - Nome do Profissional Solicitante 16 - Conselho Profissional 17 - N�mero no Conselho 18 - UF
06 121296 SP
21 - Car�ter do Atendimento 22 - Data da Solicita��o 23 - Indica��o Cl�nica
1 08/10/2025 ACOMPANHAMENTO CARDIOLOGICO
Dados da Solicita��o / Procedimentos ou Itens Assistenciais Solicitados
1 - 22 40304361 HEMOGRAMA COM CONTAGEM DE PLAQUETAS OU FRACOES (E 1 1
Dados do Contratado Executante""",
        ])

        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["metadata"], {
            "patient_name": "JULIA PEREIRA DOS SANTOS",
            "doctor_name": "PATRICIA ARANTES ROSA",
            "doctor_name_source": "contracted_provider",
            "guide_number": "17484905",
            "password": "1322752",
            "password_valid_until": "08/10/2026",
            "authorization_date": "08/10/2025",
            "request_date": "08/10/2025",
            "clinical_indication": "ACOMPANHAMENTO CARDIOLOGICO",
            "beneficiary_card_number": None,
            "beneficiary_card_valid_until": None,
            "professional_council": "06",
            "professional_council_number": "121296",
            "professional_council_state": "SP",
        })

    def test_extracts_metadata_and_all_procedures_from_anonymized_unimed_guide(self):
        result = extract_unimed_guide(FIXTURE)

        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["metadata"], {
        "patient_name": "PACIENTE ANONIMIZADO",
        "doctor_name": "MEDICO DE TESTE",
        "doctor_name_source": "professional",
        "guide_number": "12345678",
        "password": "7654321",
        "password_valid_until": "31/12/2026",
        "authorization_date": "08/10/2025",
        "request_date": "08/10/2025",
        "clinical_indication": None,
        "beneficiary_card_number": None,
        "beneficiary_card_valid_until": None,
        "professional_council": None,
        "professional_council_number": None,
        "professional_council_state": None,
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

    def test_extracts_procedures_from_every_procedure_page_and_deduplicates_reminders(self):
        result = extract_unimed_text_pages([
            "Dados da Solicitacao / Procedimentos ou Itens Assistenciais Solicitados\n1 - 22 40304361 HEMOGRAMA COMPLETO 1 1\nDados do Contratado Executante",
            "Dados da Solicitacao / Procedimentos ou Itens Assistenciais Solicitados\n2 - 22 40301583 COLESTEROL HDL 2 0\nDados do Contratado Executante",
            "LEMBRETE DE SOLICITACAO\n40304361 - HEMOGRAMA COMPLETO 1 1\n40301583 - COLESTEROL HDL 2 0",
        ])

        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["procedures"], [
            {
                "raw_text": "40304361 HEMOGRAMA COMPLETO 1 1",
                "page": 1,
                "code": "40304361",
                "description": "HEMOGRAMA COMPLETO",
                "requested_quantity": 1,
                "authorized_quantity": 1,
                "is_authorized": True,
            },
            {
                "raw_text": "40301583 COLESTEROL HDL 2 0",
                "page": 2,
                "code": "40301583",
                "description": "COLESTEROL HDL",
                "requested_quantity": 2,
                "authorized_quantity": 0,
                "is_authorized": False,
            },
        ])
