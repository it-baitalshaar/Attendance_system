// 'use client'
// import { RootState } from '@/redux/store';
// import React, { useState } from 'react';
// import { useSelector } from 'react-redux';


// const ButtonComponent = () => {
//     const [loading, setLoading] = useState(false);

//     const employee1 = useSelector((state: RootState) =>
//       state.project.employees
//     );

//     // console.log("this is from button ", employee1)
//     const handleSubmit = async () => {

//       try {
//         // console.log("this is the employess , ", employee1)
  
//         setLoading(true);
//         console.log("from the buttom the employee printing out ", employee1)
//         const response = await fetch('/api/submitAttendance', {
//           method: 'POST',
//           headers: {
//             'Content-Type': 'application/json',
//           },
//           body: JSON.stringify({ employees: employee1 }), 
//         });
  
//         if (response.ok) {
//           alert('Attendance submitted successfully!');
//         } else {
//           throw new Error('Error submitting attendance.');
//         }
//       } catch (error) {
//         console.error('Error submitting attendance:', error);
//         alert('Error submitting attendance.');
//       } finally {
//         setLoading(false);
//       }
//     };
//   return (
//     <>
//         <div className="bg-red-600 my-10 p-5 rounded-lg text-white">
//             <button type="submit" onClick={handleSubmit} disabled={loading}>
//                 {loading ? 'Submitting...' : 'Submit'}
//             </button>
//         </div>
//     </>
//   );
// };

// export default ButtonComponent;
'use client'
import { RootState } from '@/redux/store';
import { stat } from 'fs';
import React, { useState } from 'react';
import { useSelector } from 'react-redux';

interface Project {
  projectName: string;
  hours: number;
  overtime: number;
  attendance_status: string;
}
interface ProjectAndHours{
  projectName:string[]
  hours: number | 0;
  overtime:number;
  // attendance_status: string | null 
}

interface ProjectData {
  projectId: ProjectAndHours[];
  tthour:number
}

interface Employee {
  employee_id: string | null;
  name: string;
  project?:string;
  projects?: ProjectData;
}

interface ValidationError {
  employeeName: string;
  issues: string[];
}

interface ButtonProps {
  selectedDate?: string;
}

const ButtonComponent = ({ selectedDate }: ButtonProps) => {
  const [loading, setLoading] = useState(false);

  const employees = useSelector((state: RootState) => state.project.employees);
  const employees_statis = useSelector((state: RootState) => state.project.employees);
  const department = useSelector((state:RootState) => state.project.department)

  // const employee_state = state.em
  // Validation function to check missing data
  const validateEmployeeData = (employees: Employee[]): ValidationError[] => {
    const errors: ValidationError[] = [];
    
    for (let i = 0; i < employees.length; i++) {
      const employee = employees[i];
      console.log(`this is the employee name ${employee.name} and this is the status ${employees_statis[i].employee_status}`)
      const issues: string[] = [];

      // Check if employee has projects
      if (employees_statis[i].employee_status![0].status_attendance !== 'present')
        continue;
      if (!employee.projects || !employee.projects.projectId || employee.projects.projectId.length === 0) {
        issues.push("Missing project data.");
      } else {
        // Check if each project of the employee has the necessary data
        // console.log("this is the status attendance ", employee.projects?.projectId[i].attendance_status)
        for (let j = 0; j < employee.projects.projectId.length; j++) {
          const project = employee.projects.projectId[j];

          if (!project.projectName || project.projectName.length === 0) {
            issues.push(`Missing project name for project ${j + 1}.`);
          }

          if ((project.hours === undefined || project.hours === 0) && (employees_statis[i].employee_status![0].status_employee === 'Present')) {
            issues.push(`Missing hours for project ${j + 1}.`);
          }

          if (project.overtime === undefined) {
            issues.push(`Missing overtime data for project ${j + 1}.`);
          }

          // if (!project.attendance_status || project.attendance_status === null) {
          //   issues.push(`Missing attendance status for project ${j + 1}.`);
          // }
        }
      }

      // If there are any issues for this employee, add it to the errors array
      if (issues.length > 0) {
        errors.push({
          employeeName: employee.name,
          issues: issues,
        });
      }
    }

    return errors; // Return all validation errors
  };

  const handleSubmit = async () => {
    try {
      // Validate the employees data before submitting
      const validationErrors = validateEmployeeData(employees);

      if (validationErrors.length > 0) {
        // Display validation errors to the user
        const errorMessages = validationErrors
          .map((error) => {
            return `Employee ${error.employeeName} has the following issues:\n${error.issues.join('\n')}`;
          })
          .join('\n\n');

        // Optionally throw an error or show an alert to the user
        throw new Error(`Validation failed:\n${errorMessages}`);
      }

      setLoading(true);

      // Proceed with the submission if no validation errors
      console.log("Submitting the following employee data:", employees);
      const response = await fetch('/api/submitAttendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ employees, employees_statis, department, selectedDate }), 
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message || 'Attendance submitted successfully!');
      } else if (response.status === 409) {
        const result = await response.json();
        alert(result.message || 'Attendance for this date is already submitted.');
      } else {
        const result = await response.json().catch(() => ({}));
        throw new Error(result?.error || 'Error submitting attendance.');
      }
    } catch (error: any) {
      console.error('Error submitting attendance:', error);
      alert(error.message || 'Error submitting attendance.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="bg-red-600 my-10 p-5 rounded-lg text-white">
        <button type="submit" onClick={handleSubmit} disabled={loading}>
          {loading ? 'Submitting...' : 'Submit'}
        </button>
      </div>
    </>
  );
};

export default ButtonComponent;
