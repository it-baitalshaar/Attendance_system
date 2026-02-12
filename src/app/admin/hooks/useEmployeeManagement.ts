import { useEffect, useState, useCallback } from 'react';
import {
  addEmployeeService,
  fetchEmployeesService,
} from '../services/employeeService';
import { fetchDepartmentsService } from '../services/departmentService';
import { Employee } from '../types/admin';

interface NewEmployeeState {
  name: string;
  position: string;
  department: string;
  employee_id: string;
}

export function useEmployeeManagement() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [newEmployee, setNewEmployee] = useState<NewEmployeeState>({
    name: '',
    position: '',
    department: '',
    employee_id: '',
  });
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const loadEmployees = useCallback(async () => {
    setLoading(true);
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
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

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
      await addEmployeeService(newEmployee);
      setMessage('Employee added successfully!');
      setNewEmployee({
        name: '',
        position: '',
        department: '',
        employee_id: '',
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
  };
}

