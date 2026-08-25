/**
 * Injects a temporary @page size for window.print().
 * Required because multiple report sections mount on the Reports tab and each
 * used to emit a global @page rule — Salary's landscape overrode Attendance portrait.
 */

const STYLE_ID = 'baitalshaar-print-page-size';

export type PrintPageOrientation = 'portrait' | 'landscape';

export function setPrintPageOrientation(orientation: PrintPageOrientation): () => void {
  document.getElementById(STYLE_ID)?.remove();
  const el = document.createElement('style');
  el.id = STYLE_ID;
  // Explicit mm size is more reliable in Chrome than "A4 portrait/landscape".
  const size = orientation === 'landscape' ? '297mm 210mm' : '210mm 297mm';
  const margin = '8mm 10mm';
  el.textContent = `@media print { @page { size: ${size}; margin: ${margin}; } }`;
  document.head.appendChild(el);
  return () => {
    el.remove();
  };
}
