/**
 * Department themes: each department can have its own brand (name, logo, colors).
 * Assign users to departments; the app applies the theme for the selected department.
 */

export type DepartmentThemeId = 'default' | 'saqiya';

export interface DepartmentTheme {
  id: DepartmentThemeId;
  brandName: string;
  /** Logo URL (public path e.g. /logos/al-saqiya.png) or null to hide logo */
  logoPath: string | null;
  /** CSS class applied to root when this theme is active (sets CSS variables) */
  themeClass: string;
  /** Primary hex (e.g. #0E4C82) */
  primary: string;
  /** Accent / ink hex (e.g. #1A1A1A) */
  accent: string;
  /** Serif font for English headings */
  fontHeadingEn: string;
  /** Font for Arabic headings */
  fontHeadingAr: string;
}

/** Default theme: Bait Al Shaar (used when department has no specific theme) */
export const DEFAULT_THEME: DepartmentTheme = {
  id: 'default',
  brandName: 'Bait Alshaar',
  logoPath: null, // use existing logo import in header when default
  themeClass: 'theme-default',
  primary: '#0E4C82',
  accent: '#1A1A1A',
  fontHeadingEn: 'var(--font-heading-en-default)',
  fontHeadingAr: 'var(--font-heading-ar-default)',
};

/** Al Saqiya theme: Modern Heritage (Royal Blue, geometric motif, Serif/Naskh) */
export const SAQIYA_THEME: DepartmentTheme = {
  id: 'saqiya',
  brandName: 'Al Saqiya',
  logoPath: '/al_saqiya_logo_page-0001-removebg-preview.png',
  themeClass: 'theme-saqiya',
  primary: '#0E4C82',
  accent: '#1A1A1A',
  fontHeadingEn: 'var(--font-playfair)',
  fontHeadingAr: 'var(--font-noto-kufi-arabic)',
};

/** Map theme id → theme for lookup (e.g. from DB theme_id). */
export const THEMES_BY_ID: Record<DepartmentThemeId, DepartmentTheme> = {
  default: DEFAULT_THEME,
  saqiya: SAQIYA_THEME,
};

/** Options for theme selector in admin (Manage Department). */
export const THEME_OPTIONS: { value: DepartmentThemeId; label: string }[] = [
  { value: 'default', label: 'Default (Bait Alshaar)' },
  { value: 'saqiya', label: 'Al Saqiya' },
];

/** Map department value (from DB/Redux) to theme. Fallback when DB has no theme_id. */
export const DEPARTMENT_THEME_MAP: Record<string, DepartmentTheme> = {
  Saqiya: SAQIYA_THEME,
  saqiya: SAQIYA_THEME,
  'Al Saqiya': SAQIYA_THEME,
};

/**
 * Get theme by id. Falls back to DEFAULT_THEME for unknown id.
 */
export function getThemeById(themeId: string | null | undefined): DepartmentTheme {
  if (!themeId) return DEFAULT_THEME;
  const id = themeId.trim() as DepartmentThemeId;
  return THEMES_BY_ID[id] ?? DEFAULT_THEME;
}

/** True if the department name should use the Al Saqiya theme (case-insensitive, flexible). */
function isSaqiyaDepartment(name: string): boolean {
  const n = name.trim().toLowerCase();
  return n === 'saqiya' || n === 'al saqiya' || n.includes('saqiya');
}

/**
 * Get theme for the current department. Uses departmentThemeMap (from DB) when provided;
 * otherwise falls back to DEPARTMENT_THEME_MAP by name, then flexible Saqiya match.
 */
export function getThemeForDepartment(
  department: string | null | undefined,
  departmentThemeMap?: Record<string, string> | null
): DepartmentTheme {
  const key = department?.trim();
  if (!key) return DEFAULT_THEME;

  if (departmentThemeMap && departmentThemeMap[key]) {
    return getThemeById(departmentThemeMap[key]);
  }
  if (DEPARTMENT_THEME_MAP[key]) return DEPARTMENT_THEME_MAP[key];
  if (isSaqiyaDepartment(key)) return SAQIYA_THEME;
  return DEFAULT_THEME;
}
