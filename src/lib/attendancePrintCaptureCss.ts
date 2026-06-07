// A4 landscape at 96 dpi = 297mm × (96/25.4) ≈ 1122 px
export const A4_LANDSCAPE_PX = 1122;

/**
 * These are the attendance report print styles applied before html2canvas capture
 * so the PDF matches the browser print layout exactly.
 * Excludes @page, visibility, and page-break rules — those only apply to window.print().
 */
export const ATTENDANCE_CAPTURE_CSS = `
  /* constrain to A4 landscape so tables render at print width */
  #attendance-print-area { width: ${A4_LANDSCAPE_PX}px !important; max-width: ${A4_LANDSCAPE_PX}px !important; overflow: visible !important; margin: 0 !important; }
  .no-print { display: none !important; }
  .emp-hdr, .emp-summary { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
  .emp-card { box-shadow: none !important; border: 1px solid #d1d5db; margin-top: 0 !important; border-radius: 0 !important; }
  .emp-hdr { padding: 5px 12px !important; }
  .emp-hdr .company-name { font-size: 5.5pt !important; letter-spacing: 0.04em !important; margin-bottom: 1px !important; }
  .emp-hdr h2 { font-size: 12pt !important; line-height: 1.2 !important; }
  .emp-hdr .text-sm, .emp-hdr .text-base { font-size: 7.5pt !important; }
  .sum-card { padding: 3px 6px !important; }
  .sum-val { font-size: 11pt !important; line-height: 1.1 !important; }
  .sum-lbl { font-size: 5.5pt !important; letter-spacing: 0 !important; }
  .att-table { font-size: 7.5pt !important; table-layout: fixed !important; width: 100% !important; }
  .att-table th, .att-table td { padding: 3.5px 4px !important; line-height: 1.35 !important; vertical-align: middle !important; }
  .att-table th { font-size: 6.5pt !important; padding: 2px 4px !important; }
  .att-table .status-badge { padding: 0 4px !important; font-size: 6.5pt !important; border-radius: 3px !important; }
  .att-table .badge-dot { display: none !important; }
  .att-table .ot-rate { display: none !important; }
  .att-table .date-day { font-size: 7.5pt !important; }
  .att-table .date-wd { font-size: 6pt !important; }
  .att-table .cell-project { overflow: hidden !important; display: -webkit-box !important; -webkit-line-clamp: 1 !important; -webkit-box-orient: vertical !important; }
  .att-table .cell-notes { overflow: hidden !important; display: -webkit-box !important; -webkit-line-clamp: 1 !important; -webkit-box-orient: vertical !important; }
  .att-table tr.row-absent { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  .missing-banner { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; padding: 2px 8px !important; font-size: 6.5pt !important; }
  .att-table input, .att-table select { -webkit-appearance: none; appearance: none; border: none !important; background: transparent !important; padding: 0 !important; font-size: inherit !important; color: inherit !important; outline: none !important; box-shadow: none !important; width: auto !important; }
  .emp-hdr-sig { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; min-height: 22mm !important; width: 50mm !important; border: 1.5pt solid #94a3b8 !important; }
  .emp-hdr-sig span { color: #e2e8f0 !important; font-size: 14pt !important; }
`;
