import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type Exam = { examId?: string; name: string; mnemonic: string };

export type LacFormPdfInput = {
  patientName: string | null;
  doctorName: string;
  guideNumber: string | null;
  password: string | null;
  passwordValidUntil: string | null;
  authorizationDate: string | null;
  requestDate: string | null;
  released: Array<Exam & { origin: "medical_request" | "authorized_extra" }>;
  authorizedExtras: Exam[];
  divergences: Exam[];
};

function formatDate(value: string | null) {
  if (!value) return "Não informado";
  const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return isoDate ? `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}` : value;
}

function examLine(exam: Exam) {
  return `${exam.name} (${exam.mnemonic})`;
}

export async function createLacFormPdf(input: LacFormPdfInput) {
  const document = await PDFDocument.create();
  document.setTitle("Ficha LAC");
  document.setAuthor("Laboratório LAC");
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const pages = [document.addPage([595.28, 841.89])];
  let page = pages[0];
  const margin = 48;
  const lineHeight = 16;
  let y = 790;

  const line = (text: string, options?: { bold?: boolean; size?: number; color?: ReturnType<typeof rgb> }) => {
    const size = options?.size ?? 10;
    const font = options?.bold ? bold : regular;
    const words = text.split(" ");
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > page.getWidth() - margin * 2 && current) {
        lines.push(current);
        current = word;
      } else current = candidate;
    }
    if (current) lines.push(current);
    for (const wrapped of lines) {
      if (y < margin + lineHeight) {
        page = document.addPage([595.28, 841.89]);
        pages.push(page);
        y = 790;
      }
      page.drawText(wrapped, { x: margin, y, size, font, color: options?.color ?? rgb(0.08, 0.2, 0.18) });
      y -= lineHeight;
    }
  };
  const section = (title: string, exams: Exam[]) => {
    y -= 8;
    line(title, { bold: true, size: 12, color: rgb(0.0, 0.42, 0.31) });
    if (exams.length === 0) line("Nenhum exame nesta seção.");
    for (const exam of exams) line(`- ${examLine(exam)}`);
  };

  line("LABORATÓRIO LAC", { bold: true, size: 18, color: rgb(0.0, 0.42, 0.31) });
  line("Ficha de conferência laboratorial", { bold: true, size: 13 });
  y -= 8;
  line(`Paciente: ${input.patientName ?? "Não informado"}`);
  line("Convênio: Unimed");
  line(`Médico solicitante: ${input.doctorName}`);
  line(`Solicitação: ${formatDate(input.requestDate)}`);
  line(`Guia: ${input.guideNumber ?? "Não informado"}`);
  line(`Senha: ${input.password ?? "Não informado"}`);
  line(`Validade da senha: ${formatDate(input.passwordValidUntil)}`);
  line(`Data da autorização: ${formatDate(input.authorizationDate)}`);
  section("Exames liberados", input.released);
  section("Extras autorizados selecionados", input.authorizedExtras);
  section("Divergências ou não autorizados", input.divergences);
  y -= 12;
  line(`Gerado em: ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date())}`);
  line("Confirmação operacional registrada no sistema.", { size: 9 });
  pages.forEach((pdfPage, index) => {
    pdfPage.drawText(`Página ${index + 1} de ${pages.length}`, { x: margin, y: 26, size: 8, font: regular, color: rgb(0.25, 0.32, 0.31) });
  });
  return document.save();
}
