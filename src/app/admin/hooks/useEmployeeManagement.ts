import { useEffect, useState, useCallback, useRef } from 'react';
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
import {
  addEmployeeVacationService,
  deleteEmployeeVacationService,
  fetchEmployeeVacationsService,
} from '../services/employeeVacationService';
import {
  EmployeeIdPrefix,
  fetchEmployeeIdPools,
  invalidateEmployeeIdPools,
  prefixForDepartment,
} from '../services/employeeIdService';
import {
  Employee,
  EmployeeHistoryRecord,
  EmployeeUpdatePayload,
  EmployeeVacation,
} from '../types/admin';

interface NewEmployeeState {
  name: string;
  position: string;
  department: string;
  employee_id: string;
  salary: string;
  /** YYYY-MM-DD, empty when unknown. */
  joining_date: string;
}

export function useEmployeeManagement() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [newEmployee, setNewEmployee] = useState<NewEmployeeState>({
    name: '',
    position: '',
    department: '',
    employee_id: '',
    salary: '',
    joining_date: '',
  });
  const [departments, setDepartments] = useState<string[]>([]);
  const [nextEmployeeIds, setNextEmployeeIds] = useState<
    Record<EmployeeIdPrefix, string>
  >({ SA: 'SA0001', BS: 'BS0001' });
  const [existingEmployeeIds, setExistingEmployeeIds] = useState<string[]>([]);
  const [employeeIdEdited, setEmployeeIdEdited] = useState(false);
  const employeeIdEditedRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [manageEmployeeId, setManageEmployeeId] = useState<string | null>(null);
  const [employeeHistory, setEmployeeHistory] = useState<EmployeeHistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');
  const [updateLoading, setUpdateLoading] = useState(false);
  /** Approved vacation periods for the employee open in the Manage panel. */
  const [employeeVacations, setEmployeeVacations] = useState<EmployeeVacation[]>([]);
  const [vacationLoading, setVacationLoading] = useState(false);
  const [vacationMessage, setVacationMessage] = useState('');
  const [vacationSaving, setVacationSaving] = useState(false);

  const loadEmployees = useCallback(async () => {
    const startedAt = Date.now();
    const MIN_LOADING_MS = 400;
    setLoading(true);
    setMessage('');
    try {
      const [employeesRes, deptList, pools] = await Promise.all([
        fetchEmployeesService(),
        fetchDepartmentsService(),
        fetchEmployeeIdPools().catch(() => null),
      ]);
      setEmployees(employeesRes.employees);
      setDepartments(deptList.map((d) => d.name));
      if (pools) {
        setNextEmployeeIds(pools.nextIds);
        setExistingEmployeeIds(pools.existingIds);
        // Fill the ID field automatically while it is still the auto value.
        setNewEmployee((prev) => {
          if (!prev.department) return prev;
          if (employeeIdEditedRef.current) return prev;
          const auto = pools.nextIds[prefixForDepartment(prev.department)];
          return prev.employee_id === auto ? prev : { ...prev, employee_id: auto };
        });
      }
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

  const loadEmployeeVacations = useCallback(async (employeeId: string) => {
    setVacationLoading(true);
    try {
      setEmployeeVacations(await fetchEmployeeVacationsService(employeeId));
    } catch (error) {
      console.error('Error loading vacations:', error);
      setEmployeeVacations([]);
    } finally {
      setVacationLoading(false);
    }
  }, []);

  useEffect(() => {
    if (manageEmployeeId) {
      setVacationMessage('');
      loadEmployeeVacations(manageEmployeeId);
    } else {
      setEmployeeVacations([]);
      setVacationMessage('');
    }
  }, [manageEmployeeId, loadEmployeeVacations]);

  const handleAddVacation = useCallback(
    async (payload: { from_date: string; to_date: string; note?: string }) => {
      if (!manageEmployeeId) return;
      setVacationSaving(true);
      setVacationMessage('');
      try {
        await addEmployeeVacationService({
          employee_id: manageEmployeeId,
          from_date: payload.from_date,
          to_date: payload.to_date,
          note: payload.note ?? null,
        });
        setVacationMessage('Vacation period added.');
        await loadEmployeeVacations(manageEmployeeId);
        try {
          await addEmployeeHistoryService(
            manageEmployeeId,
            'vacation_added',
            `${payload.from_date} -> ${payload.to_date}${payload.note ? ` (${payload.note})` : ''}`
          );
        } catch {
          // History is best-effort; the vacation itself is saved.
        }
      } catch (error) {
        console.error('Error adding vacation:', error);
        setVacationMessage(
          error instanceof Error ? error.message : 'Failed to add vacation period.'
        );
      } finally {
        setVacationSaving(false);
      }
    },
    [manageEmployeeId, loadEmployeeVacations]
  );

  const handleDeleteVacation = useCallback(
    async (id: string) => {
      setVacationSaving(true);
      setVacationMessage('');
      try {
        await deleteEmployeeVacationService(id);
        setVacationMessage('Vacation period removed.');
        if (manageEmployeeId) await loadEmployeeVacations(manageEmployeeId);
      } catch (error) {
        console.error('Error removing vacation:', error);
        setVacationMessage('Failed to remove vacation period.');
      } finally {
        setVacationSaving(false);
      }
    },
    [manageEmployeeId, loadEmployeeVacations]
  );

  const selectedEmployee = manageEmployeeId
    ? employees.find(
        (e) => e.id === manageEmployeeId || e.employee_id === manageEmployeeId
      )
    : undefined;

  const formatSalaryValue = (value?: number | null) =>
    value == null ? 'empty' : String(value);

  const handleUpdateEmployee = useCallback(
    async (id: string, payload: EmployeeUpdatePayload) => {
      setUpdateLoading(true);
      setUpdateMessage('');
      try {
        const previous = employees.find(
          (e) => e.id === id || e.employee_id === id
        );
        const details: string[] = [];

        if (previous) {
          if (payload.name != null && payload.name !== previous.name) {
            details.push(`Name: ${previous.name} -> ${payload.name}`);
          }
          if (payload.position != null && payload.position !== previous.position) {
            details.push(`Position: ${previous.position} -> ${payload.position}`);
          }
          if (payload.department != null && payload.department !== previous.department) {
            details.push(`Department: ${previous.department} -> ${payload.department}`);
          }
          if (payload.status != null && payload.status !== previous.status) {
            details.push(`Status: ${previous.status} -> ${payload.status}`);
          }
          if (payload.salary != null && payload.salary !== previous.salary) {
            details.push(
              `Salary: ${formatSalaryValue(previous.salary)} -> ${formatSalaryValue(payload.salary)}`
            );
          }
          if (
            payload.joining_date !== undefined &&
            (payload.joining_date ?? null) !== (previous.joining_date ?? null)
          ) {
            details.push(
              `Joining date: ${previous.joining_date ?? 'empty'} -> ${payload.joining_date || 'empty'}`
            );
          }
          if (
            payload.overtime_enabled != null &&
            payload.overtime_enabled !== (previous.overtime_enabled !== false)
          ) {
            details.push(
              `Overtime: ${(previous.overtime_enabled !== false) ? 'enabled' : 'disabled'} -> ${payload.overtime_enabled ? 'enabled' : 'disabled'}`
            );
          }
        } else {
          if (payload.name != null) details.push(`Name: ${payload.name}`);
          if (payload.position != null) details.push(`Position: ${payload.position}`);
          if (payload.department != null) details.push(`Department: ${payload.department}`);
          if (payload.status != null) details.push(`Status: ${payload.status}`);
          if (payload.salary != null) details.push(`Salary: ${payload.salary}`);
          if (payload.overtime_enabled != null) {
            details.push(`Overtime: ${payload.overtime_enabled ? 'enabled' : 'disabled'}`);
          }
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
    [employees, manageEmployeeId, loadEmployees, loadEmployeeHistory]
  );

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    if (name === 'department') {
      // Changing department always re-suggests the ID for that series.
      const auto = value ? nextEmployeeIds[prefixForDepartment(value)] : '';
      employeeIdEditedRef.current = false;
      setEmployeeIdEdited(false);
      setNewEmployee((prev) => ({
        ...prev,
        department: value,
        employee_id: auto || prev.employee_id,
      }));
      return;
    }

    if (name === 'employee_id') {
      // Manual edits are allowed (needed to match BioTime) and are kept.
      employeeIdEditedRef.current = true;
      setEmployeeIdEdited(true);
    }

    setNewEmployee((prev) => ({ ...prev, [name]: value }));
  };

  const autoEmployeeId = newEmployee.department
    ? nextEmployeeIds[prefixForDepartment(newEmployee.department)]
    : '';

  const applyAutoEmployeeId = useCallback(() => {
    if (!autoEmployeeId) return;
    employeeIdEditedRef.current = false;
    setEmployeeIdEdited(false);
    setNewEmployee((prev) => ({ ...prev, employee_id: autoEmployeeId }));
  }, [autoEmployeeId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const employeeId = newEmployee.employee_id.trim();
    if (!employeeId) {
      setMessage('Employee ID is required.');
      return;
    }

    const duplicate = existingEmployeeIds.some(
      (id) => id.trim().toUpperCase() === employeeId.toUpperCase()
    );
    if (duplicate) {
      setMessage(
        'Employee ID already exists in the Employee list or BioTime. Please use another ID.'
      );
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const payload = {
        ...newEmployee,
        employee_id: employeeId,
        salary: newEmployee.salary.trim() === '' ? undefined : Number(newEmployee.salary),
        joining_date: newEmployee.joining_date.trim() === '' ? null : newEmployee.joining_date.trim(),
      };
      await addEmployeeService(payload);
      setMessage('Employee added successfully!');
      invalidateEmployeeIdPools();
      employeeIdEditedRef.current = false;
      setEmployeeIdEdited(false);
      setNewEmployee({
        name: '',
        position: '',
        department: '',
        employee_id: '',
        salary: '',
        joining_date: '',
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
    nextEmployeeIds,
    autoEmployeeId,
    employeeIdEdited,
    applyAutoEmployeeId,
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
    employeeVacations,
    vacationLoading,
    vacationMessage,
    vacationSaving,
    handleAddVacation,
    handleDeleteVacation,
  };
}

