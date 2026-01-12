import { createSupabaseServerComponentClient } from "@/lib/supabaseAppRouterClient";
import { Employee } from '@/redux/slice';

interface AttendanceProject {
  attendance_id: string;
  project_id: string;
  working_hours: number;
  overtime_hours: number;
  overtime_rate: number;
}

export async function submitAttendance(employees: Employee[]) { 
  for (const employee of employees) { 
    if (employee.projects) {
      try {
        const supbase = createSupabaseServerComponentClient();

        // 1. Insert attendance record
        const { data: attendance, error: attendanceError } = await supbase
          .from('attendance')
          .insert([
            {
              employee_id: employee.employee_id,
              date: new Date().toISOString().split('T')[0], // Use current date for attendance
              clock_in_time: '08:00', // Static time for now, update based on your needs
              clock_out_time: '17:00',
            },
          ])
          .select();

        if (attendanceError) {
          throw attendanceError;
        }

        const attendance_id = attendance[0].id; // Get the inserted attendance_id

        // 2. Insert each project associated with the attendance
        const projectEntries: AttendanceProject[] = employee.projects.projectId.map((proj) => ({
          attendance_id: attendance_id,
          project_id: proj.projectName[0], // Assuming projectName contains the actual ID
          working_hours: proj.hours,
          overtime_hours: proj.overtime,
          overtime_rate: 1.5, // Adjust as needed based on your logic
        }));

        const { error: projectsError } = await supbase
          .from('attendance_projects')
          .insert(projectEntries);

        if (projectsError) {
          throw projectsError;
        }
        
        console.log(`Attendance for employee ${employee.name} submitted successfully`);
      } catch (error) {
        console.error(`Error submitting attendance for employee ${employee.name}:`, error);
        throw error; // Re-throw the error for the component to handle
      }
    }
  } 
}

// export default submitAttendance;