// // // /app/api/submitAttendance/route.ts

// import { NextResponse } from 'next/server';
// import { createSupabaseServerComponentClient } from '@/lib/supabaseAppRouterClient';
// import { RootState } from '@/redux/store';
// import { useSelector } from 'react-redux';
// import { overtime_hours } from '@/redux/slice';
// import { Cinzel } from 'next/font/google';
// import { deprecate } from 'util';


// async function trackAttendance(attendance_id: string, department: string)
// {
//   const supabase = createSupabaseServerComponentClient();

//   const { data: userData, error: userError } = await supabase.auth.getUser()
//   if (attendance_id)
//   {
//     console.log("this is from the function and the email ", userData.user?.email)
//     let { data: attendance, error: attendanceError } = await supabase
//     .from('Track_Attendance')
//     .insert([
//       {
//         id: attendance_id,
//         email: userData.user?.email,
//         department: department,
//         date: new Date(),
//       },
//     ]) 

//     if (attendanceError)
//       console.log("this is the error ", attendanceError)  
//     // console.log("from the function ", attendance)
//   }
// }

// interface AttendanceProject {
//     attendance_id: string;
//     project_id: string;
//     working_hours: number;
//     overtime_hours: number;
//     overtime_rate: number;
// }
  

// export async function POST(request: Request) {

//   const { employees,  employees_statis, department} = await request.json(); // Get the employees data from the request body
//   // console.log("this is the employee statis FROM SUMBIT ", employees_statis)
//   console.log("thisn is thdepartment ", department)
//   try {
//     const supabase = createSupabaseServerComponentClient();

//     let attendance_id: string | null;

//     let tracker_attend: number | null = null;
    
//     let skippedEmployees: string[] = [];
//     let submittedEmployees: string[] = [];

//     console.log("this is length ", employees.length)
//     console.log("this is the ", employees[1].projects)
//     if (employees)
//     {
//       for (let i = 0; i < employees.length; i++) {
//          console.log("here position", i);
//         console.log("this is the employee ID", employees[i].employee_id);
        
//         // Check if projects exist for this employee
//         console.log("this is the status ", employees_statis[i].employee_status[0].status_attendance, " adnn ", employees[i].projects)
//         if (employees_statis[i].employee_status[0].status_attendance === 'present' || 
//             employees_statis[i].employee_status[0].status_employee === 'Sick Leave'
//         )
//         {
//           // Check if employee already has attendance for today
//           const today = new Date().toISOString().split('T')[0];
//           const { data: existingAttendance, error: checkError } = await supabase
//             .from('Attendance')
//             .select('id')
//             .eq('employee_id', employees[i].employee_id)
//             .eq('date', today)
//             .single();

//           if (existingAttendance) {
//             console.log(`Employee ${employees[i].employee_id} already has attendance for today`);
//             skippedEmployees.push(employees[i].employee_id);
//             continue; // Skip this employee and continue with the next one
//           }

//           submittedEmployees.push(employees[i].employee_id);
//           console.log("this is first print otu ", employees[i].projects.projectId)
//           if (employees[i].projects && employees[i].projects.projectId) {
//             // Loop over each project the employee has
//             console.log("inside the if")
//             let { data: attendance, error: attendanceError } = await supabase
//             .from('Attendance')
//             .insert([
//               {
//                 employee_id: employees[i].employee_id,
//                 date: new Date(),
//                 status: employees_statis[i].employee_status[0].status_attendance,
//                 status_attendance:employees_statis[i].employee_status[0].status_employee,
//                 notes: employees[i].projects.projectId[0].note
//               },
//             ])
//             .select();

//             console.log("this is my employee ", employees[i].projects.projectId[0].note)
//             for (let projectIdx = 0; projectIdx < employees[i].projects.projectId.length; projectIdx++) {
//               console.log("this is project", employees[i].projects.projectId[projectIdx]);
        
//                   console.log("this is the type of the attendance ", typeof attendance)
//                   if (attendance && tracker_attend === null)
//                   {
//                     await trackAttendance(attendance[0].id, department)
//                     tracker_attend = 1
//                     attendance_id = attendance[0].id
//                   }
//                 if (attendance && employees[i].projects.projectId[projectIdx]) {
//                   console.log("Attendance inserted:", attendance[0]);
        
//                   const { data, error } = await supabase
//                     .from('projects')
//                     .select('project_id')
//                     .eq('project_name', employees[i].projects.projectId[projectIdx].projectName[projectIdx]);
                  
//                   console.log("this is the data ", data)
//                   if (data) {
//                     let { data: attendance_projects, error: attendanceError } = await supabase
//                       .from('Attendance_projects')
//                       .insert([
//                         {
//                           attendance_id: attendance[0].id,
//                           project_id: data[0].project_id,
//                           working_hours: employees[i].projects.projectId[projectIdx].hours,
//                           overtime_hours: employees[i].projects.projectId[projectIdx].overtime,
//                         },
//                       ]);
        
//                     if (attendance_projects) {
//                       console.log("Attendance project inserted:", attendance_projects);
//                     }
//                   }
//                 }
        
//                 if (attendanceError) {
//                   console.error("this is the attend error", attendanceError);
//                   throw attendanceError;
//                 }
//               // } else {
//               //   console.log("Error: attendance status is undefined");
//               // }
//             }
//           } else {
//             console.log("No projects found for employee", employees[i].employee_id);
//           }
//         }
//         else {
//           // Check if employee already has attendance for today
//           const today = new Date().toISOString().split('T')[0];
//           const { data: existingAttendance, error: checkError } = await supabase
//             .from('Attendance')
//             .select('id')
//             .eq('employee_id', employees[i].employee_id)
//             .eq('date', today)
//             .single();

//           if (existingAttendance) {
//             console.log(`Employee ${employees[i].employee_id} already has attendance for today`);
//             skippedEmployees.push(employees[i].employee_id);
//             continue; // Skip this employee and continue with the next one
//           }

//           submittedEmployees.push(employees[i].employee_id);
//           // console.log("this is ther noooo0te : ", employees[i])
//           console.log("this is from the second conditions ") 
//           let { data: attendance, error: attendanceError } = await supabase
//           .from('Attendance')
//           .insert([
//             {
//               employee_id: employees[i].employee_id,
//               date: new Date(),
//               status: employees_statis[i].employee_status[0].status_attendance,
//               status_attendance:employees_statis[i].employee_status[0].status_employee,
//               notes:employees_statis[i].employee_status[0].note
//             },
//           ])
//           .select(); 

//           if (attendanceError)
//             console.log("this is from the attwdn vacation ", attendanceError)
//           if (attendance && tracker_attend === null)
//           {
//             await trackAttendance(attendance[0].id, department)
//             tracker_attend = 1
//           }
//         }

//       }
      
//     }
//     else {
//       console.log("error")
//     }

//     return NextResponse.json({ 
//       message: 'Attendance submitted successfully',
//       submitted: submittedEmployees,
//       skipped: skippedEmployees,
//       summary: {
//         total: employees.length,
//         submitted: submittedEmployees.length,
//         skipped: skippedEmployees.length
//       }
//     });
//   } catch (error) {
//     return NextResponse.json({ error: 'Error submitting attendance', details: error }, { status: 500 });
//   }
// }


// // /app/api/submitAttendance/route.ts

import { NextResponse } from 'next/server';
import { createSupabaseServerComponentClient } from '@/lib/supabaseAppRouterClient';
import { RootState } from '@/redux/store';
import { useSelector } from 'react-redux';
import { overtime_hours } from '@/redux/slice';
import { Cinzel } from 'next/font/google';
import { deprecate } from 'util';


async function trackAttendance(attendance_id: string, department: string, selectedDate?: string)
{
  const supabase = createSupabaseServerComponentClient();

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (attendance_id)
  {
    console.log("this is from the function and the email ", userData.user?.email)
    let { data: attendance, error: attendanceError } = await supabase
    .from('Track_Attendance')
    .insert([
      {
        id: attendance_id,
        email: userData.user?.email,
        department: department,
        date: selectedDate ? new Date(selectedDate) : new Date(),
      },
    ]) 

    if (attendanceError)
      console.log("this is the error ", attendanceError)  
    // console.log("from the function ", attendance)
  }
}

interface AttendanceProject {
    attendance_id: string;
    project_id: string;
    working_hours: number;
    overtime_hours: number;
    overtime_rate: number;
}
  

export async function POST(request: Request) {

  const { employees,  employees_statis, department, selectedDate } = await request.json(); // Get the employees data from the request body
  // console.log("this is the employee statis FROM SUMBIT ", employees_statis)
  console.log("thisn is thdepartment ", department)
  try {
    const supabase = createSupabaseServerComponentClient();

    let attendance_id: string | null;

    let tracker_attend: number | null = null;

    const targetDate = selectedDate || new Date().toISOString().split('T')[0];
    const submittedEmployees: string[] = [];
    const skippedEmployees: string[] = [];

    console.log("this is length ", employees.length)
    console.log("this is the ", employees[1].projects)
    if (employees)
    {
      for (let i = 0; i < employees.length; i++) {
         console.log("here position", i);
        console.log("this is the employee ID", employees[i].employee_id);
        
        // Check if projects exist for this employee
        console.log("this is the status ", employees_statis[i].employee_status[0].status_attendance, " adnn ", employees[i].projects)
        if (employees_statis[i].employee_status[0].status_attendance === 'present' || 
            employees_statis[i].employee_status[0].status_employee === 'Sick Leave'
        )
        {
          // duplicate check for selected date
          const { data: existingAttendance } = await supabase
            .from('Attendance')
            .select('id')
            .eq('employee_id', employees[i].employee_id)
            .eq('date', targetDate)
            .maybeSingle();

          if (existingAttendance) {
            skippedEmployees.push(employees[i].employee_id);
            continue;
          }

          console.log("this is first print otu ", employees[i].projects.projectId)
          if (employees[i].projects && employees[i].projects.projectId) {
            // Loop over each project the employee has
            console.log("inside the if")
            let { data: attendance, error: attendanceError } = await supabase
            .from('Attendance')
            .insert([
              {
                employee_id: employees[i].employee_id,
                date: targetDate,
                status: employees_statis[i].employee_status[0].status_attendance,
                status_attendance:employees_statis[i].employee_status[0].status_employee,
                notes: employees[i].projects.projectId[0].note
              },
            ])
            .select();

            console.log("this is my employee ", employees[i].projects.projectId[0].note)
            for (let projectIdx = 0; projectIdx < employees[i].projects.projectId.length; projectIdx++) {
              console.log("this is project", employees[i].projects.projectId[projectIdx]);
        
                  console.log("this is the type of the attendance ", typeof attendance)
                  if (attendance && tracker_attend === null)
                  {
                    await trackAttendance(attendance[0].id, department, targetDate)
                    tracker_attend = 1
                    attendance_id = attendance[0].id
                  }
                if (attendance && employees[i].projects.projectId[projectIdx]) {
                  console.log("Attendance inserted:", attendance[0]);
        
                  const { data, error } = await supabase
                    .from('projects')
                    .select('project_id')
                    .eq('project_name', employees[i].projects.projectId[projectIdx].projectName[projectIdx]);
                  
                  console.log("this is the data ", data)
                  if (data) {
                    let { data: attendance_projects, error: attendanceError } = await supabase
                      .from('Attendance_projects')
                      .insert([
                        {
                          attendance_id: attendance[0].id,
                          project_id: data[0].project_id,
                          working_hours: employees[i].projects.projectId[projectIdx].hours,
                          overtime_hours: employees[i].projects.projectId[projectIdx].overtime,
                        },
                      ]);
        
                    if (attendance_projects) {
                      console.log("Attendance project inserted:", attendance_projects);
                    }
                  }
                }
        
                if (attendanceError) {
                  console.error("this is the attend error", attendanceError);
                  throw attendanceError;
                }
              // } else {
              //   console.log("Error: attendance status is undefined");
              // }
            }
            submittedEmployees.push(employees[i].employee_id);
          } else {
            console.log("No projects found for employee", employees[i].employee_id);
          }
        }
        else {
          // duplicate check for selected date
          const { data: existingAttendance } = await supabase
            .from('Attendance')
            .select('id')
            .eq('employee_id', employees[i].employee_id)
            .eq('date', targetDate)
            .maybeSingle();

          if (existingAttendance) {
            skippedEmployees.push(employees[i].employee_id);
            continue;
          }

          // console.log("this is ther noooo0te : ", employees[i])
          console.log("this is from the second conditions ") 
          let { data: attendance, error: attendanceError } = await supabase
          .from('Attendance')
          .insert([
            {
              employee_id: employees[i].employee_id,
              date: targetDate,
              status: employees_statis[i].employee_status[0].status_attendance,
              status_attendance:employees_statis[i].employee_status[0].status_employee,
              notes:employees_statis[i].employee_status[0].note
            },
          ])
          .select(); 

          if (attendanceError)
            console.log("this is from the attwdn vacation ", attendanceError)
          if (attendance && tracker_attend === null)
          {
            await trackAttendance(attendance[0].id, department, targetDate)
            tracker_attend = 1
          }
          submittedEmployees.push(employees[i].employee_id);
        }

      }
      
    }
    else {
      console.log("error")
    }

    const payload = {
      message: submittedEmployees.length === 0
        ? 'Attendance for this date is already submitted.'
        : 'Attendance submitted successfully',
      submitted: submittedEmployees,
      skipped: skippedEmployees,
      summary: {
        total: employees.length,
        submitted: submittedEmployees.length,
        skipped: skippedEmployees.length
      }
    };

    if (submittedEmployees.length === 0) {
      return NextResponse.json(payload, { status: 409 });
    }

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json({ error: 'Error submitting attendance', details: error }, { status: 500 });
  }
}