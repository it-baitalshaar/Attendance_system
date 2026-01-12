// EmployeeManager.tsx - Client Component
'use client';

import { useDispatch, useSelector } from "react-redux";
import { useEffect, useState } from "react";
import { setEmployeeData } from "@/redux/slice";
import EmployeeCard from "./EmployeeCard";
import {submitAttendance} from "../utils/SubmitAttendance";
import { RootState } from "@/redux/store";
import ButtonComponent from "./ButtonComponent";

interface Employee {
  id: string;
  name: string;
  employee_id: string;
  position:string
}

interface EmployeeManagerProps {
  employees: Employee[];
  selectedDate?: string;
}

const EmployeeManager: React.FC<EmployeeManagerProps> = ({ employees, selectedDate }) => {
  const dispatch = useDispatch();

  const [loading, setLoading] = useState(false);

  // const get_info = () =>
  // {
    
  // }
  let employee1: any;
  
  // if (loading  === true)
  // {
     employee1 = useSelector((state: RootState) =>
      state.project.employees
    );
  // }

  const handleSubmit = async () => {

    try {
      

      // console.log("this is the employess , ", employee1)

      setLoading(true);

      const response = await fetch('/api/submitAttendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ employee1, selectedDate }), 
      });

      if (response.ok) {
        const result = await response.json();
        
        let message = 'Attendance submitted successfully!\n\n';
        
        if (result.summary) {
          message += `Summary:\n`;
          message += `- Total employees: ${result.summary.total}\n`;
          message += `- Submitted: ${result.summary.submitted}\n`;
          message += `- Skipped (already attended): ${result.summary.skipped}\n\n`;
        }
        
        if (result.skipped && result.skipped.length > 0) {
          message += `Employees already attended today: ${result.skipped.join(', ')}`;
        }
        
        alert(message);
      } else {
        throw new Error('Error submitting attendance.');
      }
    } catch (error) {
      console.error('Error submitting attendance:', error);
      alert('Error submitting attendance.');
    } finally {
      setLoading(false);
    }
  };
  // Dispatch the employee data to Redux when the component mounts
  useEffect(() => {
    if (employees) {
      dispatch(setEmployeeData(employees));
    }
  }, [dispatch, employees]);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-[3rem]">
        {employees.map((emp, index) => (
          <div key={index}>
            <EmployeeCard employee={emp} />
          </div>
        ))}
      </div>

      <ButtonComponent selectedDate={selectedDate} />
    </>
  );
};

export default EmployeeManager;
