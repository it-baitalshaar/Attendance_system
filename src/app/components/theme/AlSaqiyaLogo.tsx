'use client';

/**
 * Al Saqiya wordmark logo (SVG) – used when no image logo is set or image fails to load.
 * Matches brand: royal blue, serif “AL SAQIYA”, optional diamond motif.
 */
export function AlSaqiyaLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <text
        x="100"
        y="36"
        textAnchor="middle"
        fill="currentColor"
        style={{
          fontFamily: 'var(--font-playfair), Georgia, serif',
          fontSize: '28px',
          fontWeight: 600,
          letterSpacing: '0.12em',
        }}
      >
        AL SAQIYA
      </text>
    </svg>
  );
}
