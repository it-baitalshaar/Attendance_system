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


// /app/api/submitAttendance/route.ts

import { NextResponse } from 'next/server';
import { createSupabaseServerComponentClient } from '@/lib/supabaseAppRouterClient';

type SimpleStatus = 'present' | 'absent' | 'vacation';

interface SimpleEntry {
  employee_id: string;
  status: SimpleStatus;
  notes: string | null;
}

interface AttendancePayload {
  date: string;
  department: string;
  submitted_by: string;
  entries: SimpleEntry[];
}

async function trackAttendance(
  supabase: Awaited<ReturnType<typeof createSupabaseServerComponentClient>>,
  attendance_id: string,
  department: string,
  selectedDate?: string,
  submitted_by?: string,
  isEdit?: boolean,
  last_edited_by?: string
) {
  const { data: userData } = await supabase.auth.getUser();
  const email = userData?.user?.email ?? null;
  const date = selectedDate ? new Date(selectedDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

  if (isEdit && attendance_id) {
    const { error: updateErr } = await supabase
      .from('Track_Attendance')
      .update({
        last_edited_by: last_edited_by ?? submitted_by,
        last_edited_at: new Date().toISOString(),
      })
      .eq('id', attendance_id);
    if (updateErr) console.error('Track_Attendance update error', updateErr);
    return;
  }

  const { error: insertErr } = await supabase.from('Track_Attendance').insert({
    id: attendance_id,
    email,
    department,
    date,
    submitted_by: submitted_by ?? userData?.user?.id,
  });
  if (insertErr) console.error('Track_Attendance insert error', insertErr);
}

interface AttendanceProject {
    attendance_id: string;
    project_id: string;
    working_hours: number;
    overtime_hours: number;
    overtime_rate: number;
}
  

export async function POST(request: Request) {
  const body = await request.json();

  // ----- Simplified attendance flow (one record per date + department) -----
  const payload = body.attendancePayload as AttendancePayload | undefined;
  if (payload?.date && payload?.department && Array.isArray(payload?.entries) && payload?.submitted_by) {
    try {
      const supabase = createSupabaseServerComponentClient();
      const targetDate = payload.date;
      const department = payload.department;

      const { data: existingTrack } = await supabase
        .from('Track_Attendance')
        .select('id')
        .eq('date', targetDate)
        .eq('department', department)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const isEdit = !!existingTrack;
      const trackId = existingTrack?.id ?? crypto.randomUUID();

      if (isEdit) {
        await trackAttendance(
          supabase,
          existingTrack!.id,
          department,
          targetDate,
          payload.submitted_by,
          true,
          payload.submitted_by
        );
      }

      for (const entry of payload.entries) {
        const { data: existingRow } = await supabase
          .from('Attendance')
          .select('id')
          .eq('employee_id', entry.employee_id)
          .eq('date', targetDate)
          .maybeSingle();

        // Parse notes to extract status_attendance (Weekend, Holiday-Work, etc.) and status_employee (Sick Leave, etc.)
        let status_attendance: string = entry.status;
        let status_employee: string | null = null;
        const notes = entry.notes ?? '';
        
        if (notes.startsWith('Attendance type: ')) {
          const rest = notes.slice(18);
          const firstLineEnd = rest.indexOf('\n');
          const attendanceType = firstLineEnd === -1 ? rest.trim() : rest.slice(0, firstLineEnd).trim();
          if (attendanceType) {
            if (attendanceType === 'Weekend' || attendanceType === 'Holiday-Work') {
              status_attendance = attendanceType;
            } else if (attendanceType === 'Half Day') {
              status_attendance = 'half-day';
            }
          }
        }
        
        // Check for status_employee patterns in notes (Sick Leave, Absence with excuse, etc.)
        if (notes.includes('Sick Leave')) {
          status_employee = 'Sick Leave';
        } else if (notes.includes('Absence with excuse')) {
          status_employee = 'Absence with excuse';
        } else if (notes.includes('Absence without excuse')) {
          status_employee = 'Absence without excuse';
        }

        const row = {
          employee_id: entry.employee_id,
          date: targetDate,
          status: entry.status,
          status_attendance,
          status_employee,
          notes: entry.notes,
        };

        if (existingRow) {
          await supabase.from('Attendance').update(row).eq('id', existingRow.id);
        } else {
          await supabase.from('Attendance').insert(row);
        }
      }

      if (!isEdit) {
        await trackAttendance(supabase, trackId, department, targetDate, payload.submitted_by, false);
      }

      const present = payload.entries.filter((e) => e.status === 'present').length;
      const absent = payload.entries.filter((e) => e.status === 'absent').length;
      const vacation = payload.entries.filter((e) => e.status === 'vacation').length;

      return NextResponse.json({
        message: isEdit ? 'Attendance updated successfully.' : 'Attendance submitted successfully.',
        summary: {
          total: payload.entries.length,
          present,
          absent,
          vacation,
        },
        isEdit,
      });
    } catch (err) {
      console.error('Simplified attendance submit error', err);
      return NextResponse.json(
        { error: 'Error submitting attendance', details: String(err) },
        { status: 500 }
      );
    }
  }

  // ----- Legacy flow -----
  const { employees, employees_statis, department, selectedDate } = body;
  try {
    const supabase = createSupabaseServerComponentClient();

    let attendance_id: string | null = null;
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
        const status_attendance = employees_statis[i].employee_status[0].status_attendance;
        const status_employee = employees_statis[i].employee_status[0].status_employee;
        const hasProjects = employees[i].projects && employees[i].projects.projectId && employees[i].projects.projectId.length > 0;
        
        if ((status_attendance === 'present' || status_employee === 'Sick Leave') && hasProjects)
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
            // Determine status_attendance: use status_employee if it's Weekend/Holiday-Work, otherwise use status_attendance
            const final_status_attendance = (status_employee === 'Weekend' || status_employee === 'Holiday-Work') 
              ? status_employee 
              : (status_employee || status_attendance || 'present');
            
            let { data: attendance, error: attendanceError } = await supabase
            .from('Attendance')
            .insert([
              {
                employee_id: employees[i].employee_id,
                date: targetDate,
                status: status_attendance || 'present',
                status_attendance: final_status_attendance,
                status_employee: status_employee,
                notes: employees[i].projects.projectId[0]?.note || employees_statis[i].employee_status[0].note || null
              },
            ])
            .select();

            console.log("this is my employee ", employees[i].projects.projectId[0].note)
            for (let projectIdx = 0; projectIdx < employees[i].projects.projectId.length; projectIdx++) {
              console.log("this is project", employees[i].projects.projectId[projectIdx]);
        
                  console.log("this is the type of the attendance ", typeof attendance)
                  if (attendance && tracker_attend === null)
                  {
                    await trackAttendance(supabase, attendance[0].id, department, targetDate)
                    tracker_attend = 1
                    attendance_id = attendance[0].id
                  }
                if (attendance && employees[i].projects.projectId[projectIdx]) {
                  console.log("Attendance inserted:", attendance[0]);
        
                  // Get project name - projectName is an array, get the name at projectIdx
                  const projectNameArray = employees[i].projects.projectId[projectIdx].projectName;
                  const projectName = projectNameArray && projectNameArray[projectIdx] 
                    ? projectNameArray[projectIdx] 
                    : (projectNameArray && projectNameArray.length > 0 ? projectNameArray[0] : null);
                  
                  if (!projectName) {
                    console.error(`No project name found for project index ${projectIdx} for employee ${employees[i].employee_id}`);
                    continue;
                  }
                  
                  const { data, error } = await supabase
                    .from('projects')
                    .select('project_id')
                    .eq('project_name', projectName);
                  
                  console.log("this is the data ", data, "for project name", projectName)
                  if (data && data.length > 0) {
                    let { data: attendance_projects, error: attendanceError } = await supabase
                      .from('Attendance_projects')
                      .insert([
                        {
                          attendance_id: attendance[0].id,
                          project_id: data[0].project_id,
                          working_hours: employees[i].projects.projectId[projectIdx].hours || 0,
                          overtime_hours: employees[i].projects.projectId[projectIdx].overtime || 0,
                        },
                      ]);
        
                    if (attendanceError) {
                      console.error("Error inserting Attendance_projects:", attendanceError);
                    } else if (attendance_projects) {
                      console.log("Attendance project inserted:", attendance_projects);
                    }
                  } else {
                    console.error(`Project not found in database: ${projectName} for employee ${employees[i].employee_id}`);
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
            // No projects but still Present - save Attendance record without projects
            console.log("No projects found for employee", employees[i].employee_id);
            const { data: existingAttendance } = await supabase
              .from('Attendance')
              .select('id')
              .eq('employee_id', employees[i].employee_id)
              .eq('date', targetDate)
              .maybeSingle();

            if (!existingAttendance) {
              const final_status_attendance = (status_employee === 'Weekend' || status_employee === 'Holiday-Work') 
                ? status_employee 
                : (status_employee || status_attendance || 'present');
              
              let { data: attendance, error: attendanceError } = await supabase
                .from('Attendance')
                .insert([
                  {
                    employee_id: employees[i].employee_id,
                    date: targetDate,
                    status: status_attendance || 'present',
                    status_attendance: final_status_attendance,
                    status_employee: status_employee,
                    notes: employees_statis[i].employee_status[0].note || null,
                  },
                ])
                .select();

              if (attendance && tracker_attend === null) {
                await trackAttendance(supabase, attendance[0].id, department, targetDate);
                tracker_attend = 1;
              }
              submittedEmployees.push(employees[i].employee_id);
            } else {
              skippedEmployees.push(employees[i].employee_id);
            }
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

          // Absent/Vacation or other non-present statuses
          console.log("this is from the second conditions ") 
          const final_status_attendance = (status_employee === 'Weekend' || status_employee === 'Holiday-Work') 
            ? status_employee 
            : (status_employee || status_attendance || 'absent');
          
          let { data: attendance, error: attendanceError } = await supabase
          .from('Attendance')
          .insert([
            {
              employee_id: employees[i].employee_id,
              date: targetDate,
              status: status_attendance || 'absent',
              status_attendance: final_status_attendance,
              status_employee: status_employee,
              notes: employees_statis[i].employee_status[0].note || null
            },
          ])
          .select(); 

          if (attendanceError)
            console.log("this is from the attwdn vacation ", attendanceError)
          if (attendance && tracker_attend === null)
          {
            await trackAttendance(supabase, attendance[0].id, department, targetDate)
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