/** Project department/type: Construction, Maintenance, or shared (Construction Maintenance) */
export type ProjectDepartment =
  | 'Construction'
  | 'Maintenance'
  | 'Construction Maintenance';

/** Project status: active = shown in attendance; none active = paused/hidden */
export type ProjectStatus = 'active' | 'none active';

export interface Project {
  project_id: string;
  project_name: string;
  department: ProjectDepartment;
  project_status: ProjectStatus;
  created_at?: string;
}

/** Uses /api/admin-projects (server-side, service role) to avoid client token/RLS issues */
export async function fetchProjectsService(): Promise<Project[]> {
  const res = await fetch('/api/admin-projects');
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Failed to load projects');
  }
  const { projects } = await res.json();
  return (projects ?? []) as Project[];
}

export async function createProjectService(
  projectName: string,
  department: ProjectDepartment,
  projectStatus: ProjectStatus = 'active'
): Promise<Project> {
  const trimmed = projectName.trim();
  if (!trimmed) throw new Error('Project name is required');

  const res = await fetch('/api/admin-projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_name: trimmed,
      department,
      project_status: projectStatus,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Failed to add project');
  }
  const { project } = await res.json();
  return project as Project;
}

export async function updateProjectService(
  projectId: string,
  updates: {
    project_name?: string;
    department?: ProjectDepartment;
    project_status?: ProjectStatus;
  }
): Promise<{ project_id: string; renamed: boolean }> {
  const payload: Record<string, string> = { project_id: projectId };

  if (updates.project_name !== undefined) {
    const trimmed = updates.project_name.trim();
    if (!trimmed) throw new Error('Project name cannot be empty');
    payload.project_name = trimmed;
  }
  if (updates.department !== undefined) payload.department = updates.department;
  if (updates.project_status !== undefined)
    payload.project_status = updates.project_status;

  if (Object.keys(payload).length === 1) {
    return { project_id: projectId, renamed: false };
  }

  const res = await fetch('/api/admin-projects', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Failed to update project');
  }

  const data = (await res.json()) as {
    project_id?: string;
    renamed?: boolean;
  };
  return {
    project_id: data.project_id ?? projectId,
    renamed: Boolean(data.renamed),
  };
}
