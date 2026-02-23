import { useEffect, useState, useCallback } from 'react';
import {
  fetchProjectsService,
  createProjectService,
  updateProjectService,
} from '../services/projectService';
import type {
  Project,
  ProjectDepartment,
  ProjectStatus,
} from '../services/projectService';

export function useProjectManagement() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const list = await fetchProjectsService();
      setProjects(list);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to load projects');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const addProject = async (
    projectName: string,
    department: ProjectDepartment,
    projectStatus: ProjectStatus = 'active'
  ) => {
    setMessage('');
    try {
      await createProjectService(projectName, department, projectStatus);
      setMessage('Project added successfully');
      setMessageType('success');
      await loadProjects();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to add project');
      setMessageType('error');
    }
  };

  const updateProject = async (
    projectId: string,
    updates: {
      project_name?: string;
      department?: ProjectDepartment;
      project_status?: ProjectStatus;
    }
  ) => {
    setMessage('');
    try {
      await updateProjectService(projectId, updates);
      setMessage('Project updated successfully');
      setMessageType('success');
      await loadProjects();
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : 'Failed to update project'
      );
      setMessageType('error');
    }
  };

  return {
    projects,
    loading,
    message,
    messageType,
    loadProjects,
    addProject,
    updateProject,
    setMessage,
  };
}
