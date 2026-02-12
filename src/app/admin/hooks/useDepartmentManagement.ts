import { useEffect, useState, useCallback } from 'react';
import {
  fetchDepartmentsService,
  createDepartmentService,
  updateDepartmentService,
  deleteDepartmentService,
} from '../services/departmentService';
import type { Department } from '../services/departmentService';

export function useDepartmentManagement() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  const loadDepartments = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const list = await fetchDepartmentsService();
      setDepartments(list);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to load departments');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  const addDepartment = async (name: string) => {
    setMessage('');
    try {
      await createDepartmentService(name);
      setMessage('Department created successfully');
      setMessageType('success');
      await loadDepartments();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to create department');
      setMessageType('error');
    }
  };

  const updateDepartment = async (id: string, oldName: string, newName: string) => {
    setMessage('');
    try {
      await updateDepartmentService(id, oldName, newName);
      setMessage('Department updated successfully');
      setMessageType('success');
      await loadDepartments();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to update department');
      setMessageType('error');
    }
  };

  const deleteDepartment = async (
    id: string,
    name: string,
    confirmName: string
  ) => {
    setMessage('');
    try {
      await deleteDepartmentService(id, name, confirmName);
      setMessage('Department deleted successfully');
      setMessageType('success');
      await loadDepartments();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to delete department');
      setMessageType('error');
    }
  };

  return {
    departments,
    loading,
    message,
    messageType,
    loadDepartments,
    addDepartment,
    updateDepartment,
    deleteDepartment,
    setMessage,
  };
}
