export const SUPER_USER_EMAIL = 'itbaitalshaar@gmail.com';

export function isSuperUserEmail(email: string | null | undefined): boolean {
  return email?.toLowerCase().trim() === SUPER_USER_EMAIL.toLowerCase();
}
