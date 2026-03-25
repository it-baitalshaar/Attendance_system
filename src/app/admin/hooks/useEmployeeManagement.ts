import { useEffect, useState, useCallback } from 'react';
import {
  addEmployeeService,
  fetchEmployeesService,
  updateEmployeeService,
} from '../services/employeeService';
import {
  fetchEmployeeHistoryService,
  addEmployeeHistoryService,
} from '../services/employeeHistoryService';
import { fetchDepartmentsService } from '../services/departmentService';
import { Employee, EmployeeHistoryRecord, EmployeeUpdatePayload } from '../types/admin';

interface NewEmployeeState {
  name: string;
  position: string;
  department: string;
  employee_id: string;
  salary: string;
}

export function useEmployeeManagement() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [newEmployee, setNewEmployee] = useState<NewEmployeeState>({
    name: '',
    position: '',
    department: '',
    employee_id: '',
    salary: '',
  });
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [manageEmployeeId, setManageEmployeeId] = useState<string | null>(null);
  const [employeeHistory, setEmployeeHistory] = useState<EmployeeHistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');
  const [updateLoading, setUpdateLoading] = useState(false);

  const loadEmployees = useCallback(async () => {
    const startedAt = Date.now();
    const MIN_LOADING_MS = 400;
    setLoading(true);
    setMessage('');
    try {
      const [employeesRes, deptList] = await Promise.all([
        fetchEmployeesService(),
        fetchDepartmentsService(),
      ]);
      setEmployees(employeesRes.employees);
      setDepartments(deptList.map((d) => d.name));
    } catch (error) {
      console.error('Error fetching employees:', error);
      setMessage('Failed to load employees');
    } finally {
      const elapsed = Date.now() - startedAt;
      const wait = Math.max(0, MIN_LOADING_MS - elapsed);
      if (wait) await new Promise((r) => setTimeout(r, wait));
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const loadEmployeeHistory = useCallback(async (employeeId: string) => {
    setHistoryLoading(true);
    try {
      const list = await fetchEmployeeHistoryService(employeeId);
      setEmployeeHistory(list);
    } catch (error) {
      setEmployeeHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (manageEmployeeId) {
      loadEmployeeHistory(manageEmployeeId);
    } else {
      setEmployeeHistory([]);
    }
  }, [manageEmployeeId, loadEmployeeHistory]);

  const selectedEmployee = manageEmployeeId
    ? employees.find(
        (e) => e.id === manageEmployeeId || e.employee_id === manageEmployeeId
      )
    : undefined;

  const handleUpdateEmployee = useCallback(
    async (id: string, payload: EmployeeUpdatePayload) => {
      setUpdateLoading(true);
      setUpdateMessage('');
      try {
        const details: string[] = [];
        if (payload.name != null) details.push(`Name: ${payload.name}`);
        if (payload.position != null) details.push(`Position: ${payload.position}`);
        if (payload.department != null) details.push(`Department: ${payload.department}`);
        if (payload.status != null) details.push(`Status: ${payload.status}`);
        if (payload.salary != null) details.push(`Salary: ${payload.salary}`);
        if (payload.overtime_enabled != null) {
          details.push(`Overtime: ${payload.overtime_enabled ? 'enabled' : 'disabled'}`);
        }
        await updateEmployeeService(id, payload);
        setUpdateMessage('Employee updated successfully.');
        await loadEmployees();
        // Add history only if table exists; don't fail the update when it doesn't
        try {
          await addEmployeeHistoryService(
            id,
            'updated',
            details.length ? details.join('; ') : 'Profile updated'
          );
          if (manageEmployeeId === id) {
            await loadEmployeeHistory(id);
          }
        } catch {
          if (manageEmployeeId === id) {
            await loadEmployeeHistory(id);
          }
        }
      } catch (error) {
        console.error('Error updating employee:', error);
        setUpdateMessage('Failed to update employee.');
      } finally {
        setUpdateLoading(false);
      }
    },
    [manageEmployeeId, loadEmployees, loadEmployeeHistory]
  );

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setNewEmployee((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const payload = {
        ...newEmployee,
        salary: newEmployee.salary.trim() === '' ? undefined : Number(newEmployee.salary),
      };
      await addEmployeeService(payload);
      setMessage('Employee added successfully!');
      setNewEmployee({
        name: '',
        position: '',
        department: '',
        employee_id: '',
        salary: '',
      });
      await loadEmployees();
    } catch (error) {
      console.error('Error adding employee:', error);
      setMessage('Failed to add employee');
    } finally {
      setLoading(false);
    }
  };

  return {
    employees,
    newEmployee,
    departments,
    loading,
    message,
    handleInputChange,
    handleSubmit,
    manageEmployeeId,
    setManageEmployeeId,
    selectedEmployee,
    employeeHistory,
    historyLoading,
    updateMessage,
    setUpdateMessage,
    updateLoading,
    handleUpdateEmployee,
    loadEmployees,
    loadEmployeeHistory,
  };
}

