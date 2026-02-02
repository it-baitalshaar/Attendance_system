'use client';
import Image from "next/image";
import log from "@/app/assets/logo (1).webp";
import EmployeeManager from "./component/TestCard";
import DatePickerMaxToday from "./component/DatePickerMaxToday";
import { createSupabbaseFrontendClient } from "@/lib/supabase";
import { useSelector } from 'react-redux';
import { RootState } from '@/redux/store';
import { useEffect, useState } from "react";
import DatePickerMinToday from "./component/DatePickerMinToday";
import { useRouter } from "next/navigation";

interface Employee {
  id: string;
  name: string;
  employee_id: string;
  position:string
}

async function fetchEmployees(department: string | null): Promise<Employee[]> {
  const supabase = createSupabbaseFrontendClient();
  
  let { data: Employees, error } = await supabase
    .from('Employee')
    .select('*')
    .eq('department', department)
    // .eq('position', 'foreman')
    .eq('status', 'active');

  if (error) {
    console.error('Error fetching employees:', error);
    return [];
  }

  return Employees || [];
}

export default function Home() {
  const router = useRouter();
  const department = useSelector((state: RootState) => state.project.department); // Get department from Redux
  const [employees, setEmployees] = useState<Employee[]>([]); // State to store employees
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    console.log("this is the department", department)
    async function getEmployees() {
      const fetchedEmployees = await fetchEmployees(department);
      setEmployees(fetchedEmployees); // Set fetched employees in state
    }

    if (department) { // Fetch employees only if department is available
      getEmployees();
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = ''; // This is necessary for modern browsers to show the alert.
      alert('Are you sure you want to refresh the page?'); // Custom alert box
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const handleLogout = async () => {
    const supabase = createSupabbaseFrontendClient();

    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      router.replace('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <main className="relative mt-[2rem] flex flex-col items-center justify-center">
      <button
        onClick={handleLogout}
        className="absolute top-4 right-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
      >
        Logout
      </button>
      <div className="flex flex-col items-center justify-center">
        <div className="flex flex-col justify-center items-center">
          <Image src={log} alt="Next.js Logo" width={120} height={37} priority />
          <h1 className="text-2xl mt-4 mb-8">Bait Alshaar</h1>
          <h1 className="text-2xl text-black mt-4 text-center">Welcome</h1>
        </div>
        <DatePickerMaxToday
          value={selectedDate}
          onChange={setSelectedDate}
          className="mt-6"
        />
        {/* Pass employees to EmployeeManager */}
        <EmployeeManager employees={employees} selectedDate={selectedDate} />
      </div>
    </main>
  );
}
