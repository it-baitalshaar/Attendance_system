'use client';

import type { DepartmentTheme } from '@/app/constants/themes';

interface ThemeServicesCardProps {
  theme: DepartmentTheme;
  title: string;
  description?: string;
  children?: React.ReactNode;
}

/**
 * Card with thin accent border and minimal radius (theme-structured feel).
 * Optional geometric motif; use for services or feature blocks.
 */
export function ThemeServicesCard({ theme, title, description, children }: ThemeServicesCardProps) {
  return (
    <article
      className="border-2 rounded-theme-card p-4 sm:p-5 bg-theme-subtle border-theme-accent"
      style={{ borderColor: theme.accent }}
    >
      <h3
        className="font-heading-en text-theme-accent text-lg font-semibold"
        style={theme.id === 'saqiya' ? { fontFamily: 'var(--font-heading-en)' } : undefined}
      >
        {title}
      </h3>
      {description && <p className="mt-2 text-gray-700 text-sm sm:text-base">{description}</p>}
      {children && <div className="mt-3">{children}</div>}
    </article>
  );
}
