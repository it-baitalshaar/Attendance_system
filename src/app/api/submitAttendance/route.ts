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
      const targetDate = payload.date.includes('T') ? payload.date.split('T')[0] : payload.date;
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

        // Parse notes to extract status_attendance (Weekend, Holiday-Work, Sick Leave, etc.)
        // Attendance table has: status, status_attendance, notes (no status_employee column)
        let status_attendance: string = entry.status;
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
            } else if (attendanceType === 'Sick Leave' || attendanceType === 'Absence with excuse' || attendanceType === 'Absence without excuse') {
              status_attendance = attendanceType;
            }
          }
        }
        
        if (notes.includes('Sick Leave') && status_attendance === entry.status) status_attendance = 'Sick Leave';
        else if (notes.includes('Absence with excuse') && status_attendance === entry.status) status_attendance = 'Absence with excuse';
        else if (notes.includes('Absence without excuse') && status_attendance === entry.status) status_attendance = 'Absence without excuse';
        else if (entry.status === 'present' && (status_attendance === 'present' || status_attendance === entry.status)) status_attendance = 'Present'; // report expects 'Present' for "P" and overtime

        const row = {
          employee_id: entry.employee_id,
          date: targetDate,
          status: entry.status,
          status_attendance,
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

  // Report expects: P, W, H, AWO, SL, A, V per status + status_attendance combinations
  function normalizeStatusAttendance(
    status_employee: string | null | undefined,
    status_attendance: string | null | undefined,
    isPresent: boolean
  ): string {
    if (status_employee === 'Weekend' || status_employee === 'Holiday-Work') return status_employee;
    if (status_employee === 'Sick Leave' || status_employee === 'Absence with excuse' || status_employee === 'Absence without excuse') return status_employee;
    if (isPresent) return 'Present';
    if (status_attendance === 'vacation') return 'vacation';
    return status_attendance || 'absent';
  }

  // ----- Legacy flow (full project/hours → Attendance + Attendance_projects) -----
  const { employees, employees_statis, department, selectedDate } = body;
  if (!Array.isArray(employees) || !Array.isArray(employees_statis) || employees.length !== employees_statis.length) {
    return NextResponse.json(
      { error: 'Invalid legacy payload: employees and employees_statis arrays required and must match length.' },
      { status: 400 }
    );
  }
  try {
    const supabase = createSupabaseServerComponentClient();

    let attendance_id: string | null = null;
    let tracker_attend: number | null = null;
    const rawDate = selectedDate || new Date().toISOString().split('T')[0];
    const targetDate = rawDate.includes('T') ? rawDate.split('T')[0] : rawDate;
    const submittedEmployees: string[] = [];
    const skippedEmployees: string[] = [];

    const { data: existingTrackRow } = await supabase
      .from('Track_Attendance')
      .select('id')
      .eq('date', targetDate)
      .eq('department', department)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const isEditTrack = !!existingTrackRow;

    console.log("legacy submit: length ", employees.length, " department ", department, " date ", targetDate, " isEditTrack ", isEditTrack)
    if (employees.length > 0)
    {
      for (let i = 0; i < employees.length; i++) {
        const empStat = employees_statis[i]?.employee_status?.[0];
        if (!empStat) {
          console.error("Missing employee_status for index", i, "employee_id", employees[i].employee_id);
          continue;
        }
        
        const status_attendance = empStat.status_attendance;
        const status_employee = empStat.status_employee;
        const hasProjects = employees[i].projects && employees[i].projects.projectId && employees[i].projects.projectId.length > 0;
        
        if ((status_attendance === 'present' || status_employee === 'Sick Leave') && hasProjects)
        {
          const final_status_attendance = normalizeStatusAttendance(status_employee, status_attendance, true);
          const notesVal = employees[i].projects.projectId[0]?.note || empStat.note || null;

          const { data: existingAttendance } = await supabase
            .from('Attendance')
            .select('id')
            .eq('employee_id', employees[i].employee_id)
            .eq('date', targetDate)
            .maybeSingle();

          let attendanceId: string;
          let isUpdate = false;

          if (existingAttendance) {
            attendanceId = existingAttendance.id;
            const { error: delErr } = await supabase
              .from('Attendance_projects')
              .delete()
              .eq('attendance_id', attendanceId);
            if (delErr) console.error('Attendance_projects delete error (edit/replace):', delErr);
            await supabase
              .from('Attendance')
              .update({
                status: status_attendance || 'present',
                status_attendance: final_status_attendance,
                notes: notesVal,
              })
              .eq('id', attendanceId);
          } else {
            const { data: attendance, error: attendanceError } = await supabase
              .from('Attendance')
              .insert([
                {
                  employee_id: employees[i].employee_id,
                  date: targetDate,
                  status: status_attendance || 'present',
                  status_attendance: final_status_attendance,
                  notes: notesVal,
                },
              ])
              .select()
              .single();
            if (attendanceError) {
              console.error("Attendance insert error", attendanceError);
              throw attendanceError;
            }
            attendanceId = attendance.id;
            if (tracker_attend === null) {
              await trackAttendance(supabase, isEditTrack ? existingTrackRow!.id : attendanceId, department, targetDate, undefined, isEditTrack);
              tracker_attend = 1;
            }
          }

          for (let projectIdx = 0; projectIdx < employees[i].projects.projectId.length; projectIdx++) {
            const projectNameArray = employees[i].projects.projectId[projectIdx].projectName;
            const projectName = projectNameArray?.[projectIdx] ?? (projectNameArray?.length > 0 ? projectNameArray[0] : null);
            if (!projectName) continue;
            const { data: projData } = await supabase.from('projects').select('project_id').eq('project_name', projectName).maybeSingle();
            if (projData) {
              await supabase.from('Attendance_projects').insert({
                attendance_id: attendanceId,
                project_id: projData.project_id,
                working_hours: employees[i].projects.projectId[projectIdx].hours || 0,
                overtime_hours: employees[i].projects.projectId[projectIdx].overtime || 0,
              });
            }
          }
          submittedEmployees.push(employees[i].employee_id);
        } else if ((status_attendance === 'present' || status_employee === 'Sick Leave') && !hasProjects) {
            // No projects but still Present - save Attendance record without projects
            console.log("No projects found for employee", employees[i].employee_id);
            const { data: existingPresent } = await supabase
              .from('Attendance')
              .select('id')
              .eq('employee_id', employees[i].employee_id)
              .eq('date', targetDate)
              .maybeSingle();

            const final_status_attendance = normalizeStatusAttendance(status_employee, status_attendance, true);
            const row = { status: status_attendance || 'present', status_attendance: final_status_attendance, notes: empStat.note || null };

            if (existingPresent) {
              await supabase.from('Attendance').update(row).eq('id', existingPresent.id);
              if (tracker_attend === null) {
                await trackAttendance(supabase, isEditTrack ? existingTrackRow!.id : existingPresent.id, department, targetDate, undefined, isEditTrack);
                tracker_attend = 1;
              }
            } else {
              const { data: attendance, error: attendanceError } = await supabase
                .from('Attendance')
                .insert([{ employee_id: employees[i].employee_id, date: targetDate, ...row }])
                .select()
                .single();
              if (attendanceError) throw attendanceError;
              if (tracker_attend === null) {
                await trackAttendance(supabase, isEditTrack ? existingTrackRow!.id : attendance.id, department, targetDate, undefined, isEditTrack);
                tracker_attend = 1;
              }
            }
            submittedEmployees.push(employees[i].employee_id);
        } else {
          const final_status_attendance = normalizeStatusAttendance(status_employee, status_attendance, false);
          const row = { status: status_attendance || 'absent', status_attendance: final_status_attendance, notes: empStat.note || null };

          const { data: existingAbsent } = await supabase
            .from('Attendance')
            .select('id')
            .eq('employee_id', employees[i].employee_id)
            .eq('date', targetDate)
            .maybeSingle();

          if (existingAbsent) {
            const { error: delErr } = await supabase
              .from('Attendance_projects')
              .delete()
              .eq('attendance_id', existingAbsent.id);
            if (delErr) console.error('Attendance_projects delete (absent/vacation):', delErr);
            await supabase.from('Attendance').update(row).eq('id', existingAbsent.id);
            if (tracker_attend === null) {
              await trackAttendance(supabase, isEditTrack ? existingTrackRow!.id : existingAbsent.id, department, targetDate, undefined, isEditTrack);
              tracker_attend = 1;
            }
          } else {
            const { data: attendance, error: attendanceError } = await supabase
              .from('Attendance')
              .insert([{ employee_id: employees[i].employee_id, date: targetDate, ...row }])
              .select()
              .single();
            if (attendanceError) throw attendanceError;
            if (tracker_attend === null) {
              await trackAttendance(supabase, isEditTrack ? existingTrackRow!.id : attendance.id, department, targetDate, undefined, isEditTrack);
              tracker_attend = 1;
            }
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