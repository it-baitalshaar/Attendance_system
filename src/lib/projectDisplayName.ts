/**
 * Attendance_projects.project_id is sometimes the canonical projects.project_id,
 * sometimes the human project name (legacy). Resolve a display label either way.
 */

export function buildProjectNameLookup(
  projRows: { project_id: string; project_name: string }[] | null | undefined
): Map<string, string> {
  const m = new Map<string, string>();
  for (const p of projRows ?? []) {
    const id = String(p.project_id ?? '').trim();
    const nm = (String(p.project_name ?? '').trim() || id) || 'Unknown';
    if (id) {
      m.set(id, nm);
      m.set(id.toLowerCase(), nm);
    }
    if (nm && nm !== 'Unknown') {
      m.set(nm, nm);
      m.set(nm.toLowerCase(), nm);
    }
  }
  return m;
}

export function resolveProjectDisplayName(
  rawProjectId: string | null | undefined,
  lookup: Map<string, string>
): string {
  const key = String(rawProjectId ?? '').trim();
  if (!key) return 'Unknown';
  return lookup.get(key) ?? lookup.get(key.toLowerCase()) ?? key;
}
