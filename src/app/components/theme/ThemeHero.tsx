'use client';

import type { DepartmentTheme } from '@/app/constants/themes';

interface ThemeHeroProps {
  theme: DepartmentTheme;
  title: string;
  subtitle?: string;
}

/**
 * Hero section using theme primary (Royal Blue for Al Saqiya) and white Serif text.
 * Use on landing or department-specific pages.
 */
export function ThemeHero({ theme, title, subtitle }: ThemeHeroProps) {
  const isSaqiya = theme.id === 'saqiya';
  return (
    <section
      className="w-full py-10 px-4 sm:py-14 rounded-theme-card text-theme-white"
      style={{ backgroundColor: theme.primary }}
    >
      <div className="max-w-4xl mx-auto text-center">
        <h1
          className="font-heading-en text-2xl sm:text-4xl font-semibold"
          style={isSaqiya ? { fontFamily: 'var(--font-heading-en)' } : undefined}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="mt-3 text-theme-white/90 text-base sm:text-lg">{subtitle}</p>
        )}
      </div>
    </section>
  );
}
