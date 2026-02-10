'use client';

import { useState, useEffect } from 'react';
import { createSupabbaseFrontendClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface Employee {
  id: string;
  name: string;
  employee_id: string;
  position: string;
  department: string;
  status: string;
}

interface AttendanceRecord {
  id: string;
  employee_id: string;
  date: string;
  status: string;
  status_attendance: string;
  notes: string;
  Employee: Employee;
  employee_name?: string;
  department?: string;
}

interface AttendanceRecordWithDetails extends Omit<AttendanceRecord, 'Employee'> {
  employee_name: string;
  department: string;
}

interface DepartmentAttendance {
  department: string;
  hasAttendance: boolean;
}

interface StatusSummary {
  status: string;
  count: number;
}

interface SummaryRecord {
  status_attendance: string;
  Employee: {
    department: string;
  }[];
}

// Helper function to format date for input fields
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// Helper function to format date for display
const formatDisplayDate = (date: string): string => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

export default function AdminPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    position: '',
    department: '',
    employee_id: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  // Attendance tracking states
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecordWithDetails[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)), // Last 30 days
    endDate: formatDate(new Date())
  });
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'employees' | 'attendance' | 'profile' | 'reports'>('employees');
  const [departments, setDepartments] = useState<string[]>([]);
  const [departmentWarnings, setDepartmentWarnings] = useState<DepartmentAttendance[]>([]);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Add profile state variables
  const [userProfile, setUserProfile] = useState({
    email: '',
    id: '',
    role: ''
  });
  
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const recordsPerPage = 50;

  const [statusSummary, setStatusSummary] = useState<StatusSummary[]>([]);

  // Add report state variables
  const [leaveReport, setLeaveReport] = useState<{
    employee_id: string;
    employee_name: string;
    department: string;
    sick_leave: number;
    personal_leave: number;
    absence_without_excuse: number;
    total: number;
  }[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportDateRange, setReportDateRange] = useState({
    startDate: formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)), // Last 30 days
    endDate: formatDate(new Date())
  });

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createSupabbaseFrontendClient();
      const { data, error } = await supabase.auth.getSession();
      
      if (!data.session) {
        // No valid session, redirect to login
        router.replace('/login');
        return;
      }
      
      // Check if user is admin
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userData.user.id)
          .single();
          
        if (!profile || profile.role !== 'admin') {
          // Not an admin, redirect to unauthorized
          router.replace('/app/not-authorized');
          return;
        }
      }
      
      setCheckingAuth(false);
    };
    
    checkAuth();
    
    // Also add event listener for when the page becomes visible again (e.g., after navigation)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkAuth();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [router]);

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (activeTab === 'attendance') {
      fetchAttendanceRecords();
    }
  }, [activeTab, dateRange.startDate, dateRange.endDate, selectedEmployeeId, selectedDepartment, selectedStatus]);

  useEffect(() => {
    if (activeTab === 'reports') {
      fetchLeaveReport();
    }
  }, [activeTab, reportDateRange.startDate, reportDateRange.endDate]);

  // Add useEffect to fetch user profile data
  useEffect(() => {
    if (activeTab === 'profile' && !checkingAuth) {
      fetchUserProfile();
    }
  }, [activeTab, checkingAuth]);

  const fetchEmployees = async () => {
    setLoading(true);
    const supabase = createSupabbaseFrontendClient();
    
    try {
      const { data, error } = await supabase
        .from('Employee')
        .select('*')
        .order('name');
        
      if (error) throw error;
      if (data) {
        setEmployees(data);
        
        // Extract unique departments
        const uniqueDepartments = Array.from(new Set(data.map(emp => emp.department)))
          .filter(Boolean) // Remove null/undefined values
          .sort();
        
        setDepartments(uniqueDepartments);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      setMessage('Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendanceRecords = async () => {
    setAttendanceLoading(true);
    const supabase = createSupabbaseFrontendClient();
    
    try {
      // Get status summary with filters
      let summaryQuery = supabase
        .from('Attendance')
        .select(`
          status_attendance,
          Employee:Employee (
            department
          )
        `)
        .gte('date', dateRange.startDate)
        .lte('date', dateRange.endDate);

      // Apply employee filter
      if (selectedEmployeeId !== 'all') {
        summaryQuery = summaryQuery.eq('employee_id', selectedEmployeeId);
      }

      // Apply status filter
      if (selectedStatus !== 'all') {
        summaryQuery = summaryQuery.eq('status_attendance', selectedStatus);
      }

      const { data: summaryData, error: summaryError } = await summaryQuery;

      if (summaryData) {
        // Filter by department if selected
        const filteredSummaryData = selectedDepartment === 'all' 
          ? summaryData 
          : summaryData.filter((record: SummaryRecord) => record.Employee?.[0]?.department === selectedDepartment);

        const summary = filteredSummaryData.reduce((acc: { [key: string]: number }, curr: SummaryRecord) => {
          // Only count records that have a valid status_attendance
          if (curr.status_attendance) {
            acc[curr.status_attendance] = (acc[curr.status_attendance] || 0) + 1;
          }
          return acc;
        }, {});

        const summaryArray = Object.entries(summary).map(([status, count]) => ({
          status,
          count
        }));

        setStatusSummary(summaryArray);
      }

      // First get total count for pagination
      let countQuery = supabase
        .from('Attendance')
        .select('id', { count: 'exact' })
        .gte('date', dateRange.startDate)
        .lte('date', dateRange.endDate);

      if (selectedEmployeeId !== 'all') {
        countQuery = countQuery.eq('employee_id', selectedEmployeeId);
      }

      if (selectedStatus !== 'all') {
        countQuery = countQuery.eq('status_attendance', selectedStatus);
      }

      const { count } = await countQuery;
      setTotalRecords(count || 0);

      // Main query with join to get employee details in a single query
      let query = supabase
        .from('Attendance')
        .select(`
          id,
          employee_id,
          date,
          status,
          status_attendance,
          notes,
          Employee:Employee (
            name,
            department
          )
        `)
        .gte('date', dateRange.startDate)
        .lte('date', dateRange.endDate)
        .order('date', { ascending: false })
        .range((currentPage - 1) * recordsPerPage, currentPage * recordsPerPage - 1);
      
      if (selectedEmployeeId !== 'all') {
        query = query.eq('employee_id', selectedEmployeeId);
      }

      if (selectedStatus !== 'all') {
        query = query.eq('status_attendance', selectedStatus);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      if (data) {
        // Transform the data to match the expected format
        const recordsWithDetails: AttendanceRecordWithDetails[] = data.map(record => {
          const employee = Array.isArray(record.Employee) ? record.Employee[0] : record.Employee;
          return {
            id: record.id,
            employee_id: record.employee_id,
            date: record.date,
            status: record.status,
            status_attendance: record.status_attendance,
            notes: record.notes,
            employee_name: employee?.name || 'Unknown',
            department: employee?.department || 'Unknown'
          };
        });

        // Filter by department if selected
        const filteredRecords: AttendanceRecordWithDetails[] = selectedDepartment === 'all' 
          ? recordsWithDetails 
          : recordsWithDetails.filter(record => record.department === selectedDepartment);
        
        setAttendanceRecords(filteredRecords);
      }
    } catch (error) {
      console.error('Error fetching attendance records:', error);
    } finally {
      setAttendanceLoading(false);
    }
  };

  const checkDepartmentAttendance = (records: AttendanceRecord[]) => {
    // Create a map of departments and whether they have attendance
    const deptAttendance = departments.map(dept => {
      return {
        department: dept,
        hasAttendance: records.some(record => record.department === dept)
      };
    });
    
    setDepartmentWarnings(deptAttendance);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewEmployee(prev => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setDateRange(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    
    const supabase = createSupabbaseFrontendClient();
    
    try {
      const { data, error } = await supabase
        .from('Employee')
        .insert([
          { 
            name: newEmployee.name, 
            position: newEmployee.position,
            department: newEmployee.department,
            employee_id: newEmployee.employee_id,
            status: 'active'
          }
        ]);
        
      if (error) throw error;
      
      setMessage('Employee added successfully!');
      setNewEmployee({ name: '', position: '', department: '', employee_id: '' });
      fetchEmployees();
    } catch (error) {
      console.error('Error adding employee:', error);
      setMessage('Failed to add employee');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    const supabase = createSupabbaseFrontendClient();
    
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // Use replace instead of push to prevent going back with browser history
      router.replace('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  // Add function to fetch user profile
  const fetchUserProfile = async () => {
    const supabase = createSupabbaseFrontendClient();
    
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      if (userError || !userData.user) {
        console.error('Error fetching user data:', userError);
        return;
      }
      
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userData.user.id)
        .single();
      
      if (profileError) {
        console.error('Error fetching profile data:', profileError);
        return;
      }
      
      setUserProfile({
        email: userData.user.email || '',
        id: userData.user.id,
        role: profileData?.role || ''
      });
      
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
    }
  };
  
  // Add function to handle password change
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordLoading(true);
    setPasswordMessage('');
    
    // Validate password
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordMessage('New passwords do not match');
      setPasswordLoading(false);
      return;
    }
    
    if (passwordData.newPassword.length < 6) {
      setPasswordMessage('Password must be at least 6 characters');
      setPasswordLoading(false);
      return;
    }
    
    const supabase = createSupabbaseFrontendClient();
    
    try {
      // First verify the current password by trying to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userProfile.email,
        password: passwordData.currentPassword,
      });
      
      if (signInError) {
        setPasswordMessage('Current password is incorrect');
        setPasswordLoading(false);
        return;
      }
      
      // Update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });
      
      if (updateError) {
        setPasswordMessage(`Error updating password: ${updateError.message}`);
      } else {
        setPasswordMessage('Password updated successfully');
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      }
    } catch (error) {
      console.error('Error updating password:', error);
      setPasswordMessage('An unexpected error occurred');
    } finally {
      setPasswordLoading(false);
    }
  };
  
  const handlePasswordInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
  };

  // Helper function to get status color
  function getStatusColor(status: string, status_attendance: string): string {
    if (status === 'present') {
      return 'bg-green-100 text-green-800';
    } else if (status === 'absent') {
      return 'bg-red-100 text-red-800';
    } else if (status_attendance === 'Sick Leave') {
      return 'bg-purple-100 text-purple-800';
    } else if (status_attendance === 'Holiday-Work') {
      return 'bg-blue-100 text-blue-800';
    } else if (status_attendance === 'Vacation') {
      return 'bg-yellow-100 text-yellow-800';
    } else {
      return 'bg-gray-100 text-gray-800';
    }
  }

  // Helper function to get status label
  function getStatusLabel(status: string, status_attendance: string): string {
    if (status_attendance && status_attendance !== 'Present') {
      return status_attendance;
    }
    return status;
  }

  // Add pagination controls
  const totalPages = Math.ceil(totalRecords / recordsPerPage);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const fetchLeaveReport = async () => {
    setReportLoading(true);
    const supabase = createSupabbaseFrontendClient();
    
    try {
      const { data, error } = await supabase
        .from('Attendance')
        .select(`
          employee_id,
          status_attendance,
          Employee:Employee (
            name,
            department,
            status
          )
        `)
        .gte('date', reportDateRange.startDate)
        .lte('date', reportDateRange.endDate)
        // Here the Personal Leave was change to Absence without excuse from first september 2025
        .in('status_attendance', ['Sick Leave', 'Absence with excuse', 'Absence without excuse']);
      
      if (error) throw error;
      
      if (data) {
        // Group by employee and count each leave type
        const employeeLeaveCounts: { [key: string]: {
          employee_id: string;
          employee_name: string;
          department: string;
          sick_leave: number;
          personal_leave: number;
          absence_without_excuse: number;
        }} = {};
        
        data.forEach(record => {
          const employee = Array.isArray(record.Employee) ? record.Employee[0] : record.Employee;
          const employeeId = record.employee_id;
          
          // Skip non-active employees
          if (employee?.status !== 'active') {
            return;
          }
          
          if (!employeeLeaveCounts[employeeId]) {
            employeeLeaveCounts[employeeId] = {
              employee_id: employeeId,
              employee_name: employee?.name || 'Unknown',
              department: employee?.department || 'Unknown',
              sick_leave: 0,
              personal_leave: 0,
              absence_without_excuse: 0
            };
          }
          
          switch (record.status_attendance) {
            case 'Sick Leave':
              employeeLeaveCounts[employeeId].sick_leave++;
              break;
            case 'Absence with excuse':
              employeeLeaveCounts[employeeId].personal_leave++;
              break;
            case 'Absence without excuse':
              employeeLeaveCounts[employeeId].absence_without_excuse++;
              break;
          }
        });
        
        // Convert to array and add totals
        const reportData = Object.values(employeeLeaveCounts).map(employee => ({
          ...employee,
          total: employee.sick_leave + employee.personal_leave + employee.absence_without_excuse
        }));
        
        setLeaveReport(reportData);
      }
    } catch (error) {
      console.error('Error fetching leave report:', error);
    } finally {
      setReportLoading(false);
    }
  };

  const handleReportDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setReportDateRange(prev => ({ ...prev, [name]: value }));
  };

  // If still checking auth, show loading
  if (checkingAuth) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent border-solid rounded-full animate-spin mx-auto"></div>
          <p className="mt-4">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <button 
          onClick={handleLogout}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          Logout
        </button>
      </div>
      
      {/* Tab Navigation */}
      <div className="flex border-b mb-6 flex-wrap gap-1">
        <button 
          className={`px-4 py-2 mr-2 ${activeTab === 'employees' ? 'border-b-2 border-blue-500 font-medium' : 'text-gray-500'}`}
          onClick={() => setActiveTab('employees')}
        >
          Manage Employees
        </button>
        <button 
          className={`px-4 py-2 mr-2 ${activeTab === 'attendance' ? 'border-b-2 border-blue-500 font-medium' : 'text-gray-500'}`}
          onClick={() => setActiveTab('attendance')}
        >
          Attendance Records
        </button>
        <button 
          className={`px-4 py-2 mr-2 ${activeTab === 'reports' ? 'border-b-2 border-blue-500 font-medium' : 'text-gray-500'}`}
          onClick={() => setActiveTab('reports')}
        >
          Reports
        </button>
        <a
          href="/admin/attendance-reminders"
          className="px-4 py-2 mr-2 text-blue-600 hover:underline"
        >
          Attendance Reminders
        </a>
        <button 
          className={`px-4 py-2 ${activeTab === 'profile' ? 'border-b-2 border-blue-500 font-medium' : 'text-gray-500'}`}
          onClick={() => setActiveTab('profile')}
        >
          My Profile
        </button>
      </div>
      
      {activeTab === 'employees' && (
        <>
          <div className="mb-8 p-4 bg-white rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Add New Employee</h2>
            
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input
                    type="text"
                    name="name"
                    value={newEmployee.name}
                    onChange={handleInputChange}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Employee ID</label>
                  <input
                    type="text"
                    name="employee_id"
                    value={newEmployee.employee_id}
                    onChange={handleInputChange}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Position</label>
                  <input
                    type="text"
                    name="position"
                    value={newEmployee.position}
                    onChange={handleInputChange}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Department</label>
                  <select
                    name="department"
                    value={newEmployee.department}
                    onChange={handleInputChange}
                    className="w-full p-2 border rounded"
                    required
                  >
                    <option value="">Select Department</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="constructions">Construction</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
              </div>
              
              <button
                type="submit"
                className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                disabled={loading}
              >
                {loading ? 'Adding...' : 'Add Employee'}
              </button>
              
              {message && (
                <p className={`mt-2 ${message.includes('Failed') ? 'text-red-500' : 'text-green-500'}`}>
                  {message}
                </p>
              )}
            </form>
          </div>
          
          <div className="bg-white rounded-lg shadow">
            <h2 className="text-xl font-semibold p-4 border-b">Employee List</h2>
            
            {loading && <p className="p-4 text-center">Loading employees...</p>}
            
            {employees.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {employees.map((employee) => (
                      <tr key={employee.id}>
                        <td className="px-6 py-4 whitespace-nowrap">{employee.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{employee.employee_id}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{employee.position}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{employee.department}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            employee.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {employee.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="p-4 text-center">No employees found</p>
            )}
          </div>
        </>
      )}
      
      {activeTab === 'attendance' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="text-xl font-semibold mb-4">Attendance Records</h2>
            
            {/* Status Summary Section */}
            {statusSummary.length > 0 && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-medium mb-3">Status Summary</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {statusSummary.map((item) => (
                    <div 
                      key={item.status} 
                      className={`p-3 rounded-lg text-center ${getStatusColor(item.status, item.status)}`}
                    >
                      <div className="text-sm font-medium">{item.status}</div>
                      <div className="text-2xl font-bold">{item.count}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Start Date</label>
                <input
                  type="date"
                  name="startDate"
                  value={dateRange.startDate}
                  onChange={handleDateChange}
                  className="w-full p-2 border rounded"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">End Date</label>
                <input
                  type="date"
                  name="endDate"
                  value={dateRange.endDate}
                  onChange={handleDateChange}
                  className="w-full p-2 border rounded"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Employee</label>
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  <option value="all">All Employees</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.employee_id}>
                      {employee.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Department</label>
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  <option value="all">All Departments</option>
                  {departments.map((dept, index) => (
                    <option key={index} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  <option value="all">All Status</option>
                  <option value="Present">Present</option>
                  <option value="Sick Leave">Sick Leave</option>
                  <option value="Absence with excuse">Absence with excuse</option>
                  <option value="Absence without excuse">Absence without excuse</option>
                  <option value="Holiday-Work">Holiday Work</option>
                  <option value="Weekend">Weekend</option>
                </select>
              </div>
            </div>
            
            <button
              onClick={fetchAttendanceRecords}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Apply Filters
            </button>
          </div>
          
          {/* Department Warnings */}
          {departmentWarnings.filter(dept => !dept.hasAttendance).length > 0 && (
            <div className="p-4 mb-4 bg-yellow-50 border-l-4 border-yellow-400">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">Attendance Warning</h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>The following departments have no attendance records in the selected date range:</p>
                    <ul className="list-disc pl-5 mt-1 space-y-1">
                      {departmentWarnings
                        .filter(dept => !dept.hasAttendance)
                        .map((dept, index) => (
                          <li key={index}>{dept.department}</li>
                        ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {attendanceLoading ? (
            <p className="p-4 text-center">Loading attendance records...</p>
          ) : attendanceRecords.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {attendanceRecords.map((record) => (
                    <tr key={record.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {formatDisplayDate(record.date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {record.employee_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {record.department}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(record.status, record.status_attendance)}`}>
                          {getStatusLabel(record.status, record.status_attendance)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {record.notes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="p-4 text-center">No attendance records found for the selected filters</p>
          )}
          
          {/* Add pagination controls in the attendance records section */}
          {attendanceRecords.length > 0 && (
            <div className="mt-4 flex justify-center items-center space-x-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Previous
              </button>
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
      
      {/* New Reports Tab */}
      {activeTab === 'reports' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="text-xl font-semibold mb-4">Leave Report</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Start Date</label>
                <input
                  type="date"
                  name="startDate"
                  value={reportDateRange.startDate}
                  onChange={handleReportDateChange}
                  className="w-full p-2 border rounded"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">End Date</label>
                <input
                  type="date"
                  name="endDate"
                  value={reportDateRange.endDate}
                  onChange={handleReportDateChange}
                  className="w-full p-2 border rounded"
                />
              </div>
            </div>
            
            <button
              onClick={fetchLeaveReport}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Generate Report
            </button>
          </div>
          
          {reportLoading ? (
            <p className="p-4 text-center">Generating report...</p>
          ) : leaveReport.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sick Leave</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Absence with excuse</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Absence without excuse</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {leaveReport.map((employee) => (
                    <tr key={employee.employee_id}>
                      <td className="px-6 py-4 whitespace-nowrap font-medium">{employee.employee_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{employee.department}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          employee.sick_leave > 0 ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {employee.sick_leave}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          employee.personal_leave > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {employee.personal_leave}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          employee.absence_without_excuse > 0 ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {employee.absence_without_excuse}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center font-bold">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          employee.total > 0 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {employee.total}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {/* Summary Row */}
                  <tr className="bg-gray-50 font-bold">
                    <td className="px-6 py-4 whitespace-nowrap">TOTAL</td>
                    <td className="px-6 py-4 whitespace-nowrap">-</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                        {leaveReport.reduce((sum, emp) => sum + emp.sick_leave, 0)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                        {leaveReport.reduce((sum, emp) => sum + emp.personal_leave, 0)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                        {leaveReport.reduce((sum, emp) => sum + emp.absence_without_excuse, 0)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {leaveReport.reduce((sum, emp) => sum + emp.total, 0)}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <p className="p-4 text-center">No leave data found for the selected date range</p>
          )}
        </div>
      )}
      
      {/* New Profile Tab */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="text-xl font-semibold mb-4">My Profile</h2>
            
            <div className="mb-8">
              <div className="mb-4">
                <h3 className="text-lg font-medium">Account Information</h3>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="block text-sm font-medium text-gray-700">Email:</span>
                    <span className="block mt-1">{userProfile.email}</span>
                  </div>
                  <div>
                    <span className="block text-sm font-medium text-gray-700">Role:</span>
                    <span className="block mt-1 capitalize">{userProfile.role}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-medium mb-4">Change Password</h3>
              <form onSubmit={handlePasswordChange} className="max-w-md">
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">Current Password</label>
                  <input
                    type="password"
                    name="currentPassword"
                    value={passwordData.currentPassword}
                    onChange={handlePasswordInputChange}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">New Password</label>
                  <input
                    type="password"
                    name="newPassword"
                    value={passwordData.newPassword}
                    onChange={handlePasswordInputChange}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>
                
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={passwordData.confirmPassword}
                    onChange={handlePasswordInputChange}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>
                
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                  disabled={passwordLoading}
                >
                  {passwordLoading ? 'Updating...' : 'Update Password'}
                </button>
                
                {passwordMessage && (
                  <p className={`mt-2 ${passwordMessage.includes('successfully') ? 'text-green-500' : 'text-red-500'}`}>
                    {passwordMessage}
                  </p>
                )}
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
  