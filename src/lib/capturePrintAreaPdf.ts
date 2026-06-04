'use client';

import { jsPDF } from 'jspdf';

/** Same visual as Print / Save as PDF — captures the on-screen report area. */
export async function capturePrintAreaAsPdf(
  elementId: string,
  filename: string,
  options?: { landscape?: boolean }
): Promise<{ blob: Blob; base64: string; filename: string }> {
  const el = document.getElementById(elementId);
  if (!el) {
    throw new Error('Report not found. Generate the report first.');
  }

  const html2canvas = (await import('html2canvas')).default;
  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    width: el.scrollWidth,
    height: el.scrollHeight,
    windowWidth: el.scrollWidth,
    windowHeight: el.scrollHeight,
    scrollX: 0,
    scrollY: -window.scrollY,
  });

  const orientation = options?.landscape ? 'landscape' : 'portrait';
  const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const contentWidth = pageWidth - margin * 2;
  const contentHeight = pageHeight - margin * 2;

  const imgWidth = contentWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  const imgData = canvas.toDataURL('image/jpeg', 0.92);

  let heightLeft = imgHeight;
  let position = margin;

  pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
  heightLeft -= contentHeight;

  while (heightLeft > 0) {
    pdf.addPage();
    position = margin + heightLeft - imgHeight;
    pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
    heightLeft -= contentHeight;
  }

  const blob = pdf.output('blob');
  const base64 = await blobToBase64(blob);
  return { blob, base64, filename };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1]! : dataUrl;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read PDF'));
    reader.readAsDataURL(blob);
  });
}

export function printAreaPdfFilename(
  kind: 'salary' | 'attendance',
  from: string,
  to: string,
  company?: string | null,
  department?: string | null,
): string {
  const sanitize = (s: string) => s.trim().replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const parts: string[] = [];
  if (company) parts.push(sanitize(company));
  if (department) parts.push(sanitize(department));
  parts.push(from, to);
  return `${parts.join('_')}.pdf`;
}
