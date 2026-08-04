import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addPdfBrandHeader } from '../../../utils/pdf-branding';
import { formatValorBRL } from './parse-nf-tabela.util';
import type { DemonstrativoLinhaTrabalho } from './parse-demonstrativo-tabela.util';
import {
  competenciaArquivoSlug,
  formatCompetenciaLabel,
  type CompetenciaDemonstrativo,
} from './email-demonstrativo-template.util';

function textoSeguroPdf(s: string): string {
  return String(s ?? '')
    .replace(/\u00a0/g, ' ')
    .normalize('NFC');
}

/**
 * PDF do demonstrativo colado no Painel de E-mail:
 * colunas Nome | Onde trabalhou | Valor | Total.
 */
export async function buildDemonstrativoPainelPdfBase64(opts: {
  competencia: CompetenciaDemonstrativo;
  nome: string;
  linhas: DemonstrativoLinhaTrabalho[];
  total: number;
}): Promise<{ base64: string; filename: string }> {
  const cel = (s: string) => textoSeguroPdf(s);
  const periodo = formatCompetenciaLabel(opts.competencia);
  const totalFmt = formatValorBRL(opts.total).replace(/\u00a0/g, ' ');

  const head = [[cel('Nome'), cel('Onde trabalhou'), cel('Valor'), cel('Total')]];
  // Total aparece uma vez só (última linha), igual à soma dos valores.
  const body = opts.linhas.map((l, idx) => [
    cel(idx === 0 ? opts.nome : ''),
    cel(l.local),
    cel(l.valor.replace(/\u00a0/g, ' ')),
    cel(idx === opts.linhas.length - 1 ? totalFmt : ''),
  ]);

  if (opts.linhas.length === 0) {
    body.push([cel(opts.nome), cel('—'), cel('—'), cel(totalFmt)]);
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const y0 = await addPdfBrandHeader(doc, { marginLeft: 14, maxWidthMm: 48 });
  doc.setFontSize(13);
  doc.text(cel('Demonstrativo'), 14, y0);
  doc.setFontSize(10);
  doc.text(cel(`Competência: ${periodo}`), 14, y0 + 7);
  doc.text(cel(`Profissional: ${opts.nome}`), 14, y0 + 13);

  autoTable(doc, {
    startY: y0 + 18,
    head,
    body,
    styles: { fontSize: 9, cellPadding: 2.5, overflow: 'linebreak' },
    headStyles: { fillColor: [26, 64, 17], textColor: 255 },
    columnStyles: {
      2: { halign: 'right' },
      3: { halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14 },
  });

  const slug = opts.nome.replace(/[^\w.-]+/g, '_').slice(0, 40);
  const ref = competenciaArquivoSlug(opts.competencia);
  const filename = `demonstrativo_${ref}_${slug}.pdf`;
  const dataUri = doc.output('datauristring') as string;
  const base64 = dataUri.includes(',') ? dataUri.split(',')[1]! : dataUri;
  return { base64, filename };
}
