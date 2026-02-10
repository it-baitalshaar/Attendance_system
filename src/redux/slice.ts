'use client'

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type AttendanceStatus = 'present' | 'absent' | 'vacation';

export interface AttendanceEntry {
  status: AttendanceStatus;
  notes: string | null;
}

// Legacy / optional for old flows
interface ProjectAndHours{
  projectName:string[]
  hours: number | 0;
  overtime:number;
  note:string | null
}
interface ProjectData {
  projectId: ProjectAndHours[];
  tthour:number
}
interface Status {
  status_attendance: string | null
  status_employee: string | null
  note:string | null
}

export interface Employee {
  employee_id: string | null;
  name: string;
  position?: string;
  department?: string;
  project?: string;
  projects?: ProjectData;
  employee_status?: Status[]
}

interface EmployeesState {
  employees: Employee[];
  /** Keyed by employee_id. Simplified attendance: status + notes. */
  attendanceEntries: Record<string, AttendanceEntry>;
  totalProjects: number;
  remaining: number;
  total_hours: number;
  leftHours: number;
  department: string | null;
}

const initialState: EmployeesState = {
  employees: [],
  attendanceEntries: {},
  totalProjects: 0,
  remaining: 0,
  total_hours: 0,
  leftHours: 0,
  department: null,
};


const projectSlice = createSlice({
  name: 'projects',
  initialState,

  reducers: {
  setDepartment: (state, action: PayloadAction<string>) => {
    state.department = action.payload;
  },

  setEmployeeData: (state, action: PayloadAction<Employee[]>) => {
    state.employees = action.payload;
  },

  setAttendanceEntry: (state, action: PayloadAction<{ employee_id: string; status: AttendanceStatus; notes?: string | null }>) => {
    const { employee_id, status, notes } = action.payload;
    if (!state.attendanceEntries[employee_id]) state.attendanceEntries[employee_id] = { status: 'present', notes: null };
    state.attendanceEntries[employee_id].status = status;
    if (notes !== undefined) state.attendanceEntries[employee_id].notes = notes ?? null;
  },

  setAttendanceNotes: (state, action: PayloadAction<{ employee_id: string; notes: string | null }>) => {
    const { employee_id, notes } = action.payload;
    if (!state.attendanceEntries[employee_id]) state.attendanceEntries[employee_id] = { status: 'present', notes: null };
    state.attendanceEntries[employee_id].notes = notes;
  },

  setAllPresent: (state, action: PayloadAction<string[]>) => {
    action.payload.forEach((id) => {
      state.attendanceEntries[id] = { status: 'present', notes: null };
    });
  },

  setAttendanceFromServer: (state, action: PayloadAction<{ employee_id: string; status: AttendanceStatus; notes: string | null }[]>) => {
    action.payload.forEach(({ employee_id, status, notes }) => {
      state.attendanceEntries[employee_id] = { status, notes };
    });
  },

  clearAttendanceEntries: (state) => {
    state.attendanceEntries = {};
  },

  /**
   * Hydrate/replace an employee's project list from server (edit mode / load existing submission).
   * Pass `projects: null` to clear.
   */
  setEmployeeProjectsFromServer: (state, action: PayloadAction<{ employee_id: string; projects: ProjectData | null }>) => {
    const { employee_id, projects } = action.payload;
    const employee = state.employees.find(emp => emp.employee_id === employee_id);
    if (employee) {
      if (!projects) {
        employee.projects = undefined;
      } else {
        employee.projects = projects;
      }
    }
  },

  setEmployeesStatus: (state, action:PayloadAction<{status:string; employee_id: string}>) => {

    const { status, employee_id } = action.payload;

    const employee = state.employees.find(emp => emp.employee_id === employee_id);

    if (employee)
    {
      if (employee.employee_status && employee.employee_status.length > 0) {
        employee.employee_status[0].status_employee = status
      } else {
        // Initialize employee_status if it's undefined or empty
        employee.employee_status = [{ status_attendance: null, status_employee: status, note:null }];
      }
    }
  },

  setAttendanceStatus: (state, action:PayloadAction<{status:string; employee_id: string}>) => {
    // state.employees =
    // state.employees = action.payload;
    // console.log("this is the function setEmployee Status ")
    const { status, employee_id } = action.payload;
    
    const employee = state.employees.find(emp => emp.employee_id === employee_id);
    if (employee )
    {
      console.log("this is from the attendance function")
      // employee.employee_status[0].status_attendance = status
      if (employee.employee_status && employee.employee_status.length > 0) {
        employee.employee_status[0].status_attendance = status;
        console.log("this is from the attendance function", employee.employee_status[0].status_attendance)
      } else {
        // Initialize employee_status if it's undefined or empty
        employee.employee_status = [{ status_attendance: status, status_employee: null, note:null }];
        console.log("this is from the attendance function", employee.employee_status)
      }
    }
  },

  setTotalProject: (state, action: PayloadAction<number>) => {
      state.totalProjects = action.payload;
  },

  setRemainingHours: (state, action: PayloadAction<number>) => {
    state.remaining = action.payload
  },

  setLeftHours: (state, action: PayloadAction<number>) => {
    state.leftHours = action.payload
  },

  addProjectToEmployee: (state, action: PayloadAction<{ employee_id: string; selected_project: string, project_index: number }>) => {
    const { employee_id, selected_project ,project_index } = action.payload;
    const employee = state.employees.find(emp => emp.employee_id === employee_id);
    if (employee) 
      {
        if (!employee.projects) {
          console.log("firrrst condition")
          employee.projects = { projectId: [], tthour:0};
        }
        if ( project_index >= 0)
        {
          if (employee.projects?.projectId[project_index]) 
            employee.projects.projectId[project_index].projectName[project_index] = selected_project;
          else {
            // Otherwise, add the new project to the array
            employee.projects!.projectId[project_index] = {
              projectName: [],  // Create a new project array with the selected project
              hours: 0,  // You can set hours later
              overtime:0,
              note:null,
            };
            employee.projects!.projectId[project_index].projectName[project_index] = selected_project
          }
        }
      }
    },
    
    addHours: (state, action: PayloadAction<{hours: number, employee_id: string, project_index:number }>) => {
      const {hours, employee_id, project_index} = action.payload
      console.log("input index is", project_index)
      const employee = state.employees.find(emp => emp.employee_id === employee_id);
      console.log("after the employee", employee?.projects?.projectId[project_index])
      if (employee && employee.projects?.projectId[project_index] !== undefined)
      {
        // console.log("after addinghours is ", project_index, employee.projects.projectId[project_index].hours)
        console.log("input index is", project_index)
        if (employee.projects.projectId[project_index].hours === -1 && project_index > 0)
        {
          console.log("inside first condition ")
          console.log("input index is", project_index)

          if (project_index+1 === state.totalProjects)
            employee.projects.projectId[project_index].hours =  -1
          else if (employee.projects.projectId[project_index + 1])
            employee.projects.projectId[project_index+1].hours =  -1

          console.log("the output from the second condtion ", employee.projects.projectId[project_index].hours)
        }
        if (employee.projects.projectId[project_index].hours > 0)
        {
          console.log("second the condition ")
          console.log("input index is", project_index)

          employee.projects.tthour -= employee.projects.projectId[project_index].hours
          employee.projects.projectId[project_index].hours = hours
          console.log("this index input is " , project_index)
          if (employee.projects.projectId[project_index + 1])
          {
            console.log("inside the mmmmmmmm ", project_index )
            employee.projects.projectId[project_index + 1].hours = -1
          }
        }
        else
          employee.projects.projectId[project_index].hours = hours
        console.log("finish the function", employee.projects.projectId[project_index].hours)
      }
    },

    sum_hours: (state, action: PayloadAction<{employee_id: string, project_index:number }>) => {

      const { employee_id, project_index } = action.payload

      const employee = state.employees.find(emp => emp.employee_id === employee_id);

      if (employee && employee.projects?.projectId && employee.projects?.projectId[project_index] !== undefined && employee.projects.tthour < 8)
        employee.projects.tthour += employee.projects.projectId[project_index].hours
    },

    overtime_hours: (state, action: PayloadAction<{overtime_Hours: number, employee_id: string, project_index:number }>) => {

      const { employee_id, project_index, overtime_Hours } = action.payload

      const employee = state.employees.find(emp => emp.employee_id === employee_id);

      // console.log("this is the employee ", employee, " and this is the projects ", employee.projects?.projectId[project_index])
      if ((employee && employee.projects?.projectId[project_index] !== undefined))
        employee.projects.projectId[project_index].overtime = overtime_Hours
    },

    add_notes: (state, action: PayloadAction<{employee_id: string, project_index:number,  notes: string}>) => {

      const { employee_id, project_index, notes } = action.payload

      const employee = state.employees.find(emp => emp.employee_id === employee_id);

      // // console.log("this is the employee ", employee, " and this is the projects ", employee.projects?.projectId[project_index])
      if ((employee && employee.projects?.projectId[project_index] !== undefined))
        employee.projects.projectId[project_index].note = notes
    },
    Add_notes_to_cases_without_projects(state, action: PayloadAction<{employee_id: string, notes:string}>)
    {
      const { employee_id, notes } = action.payload;
      const employee = state.employees.find(emp => emp.employee_id === employee_id);
      
      if (employee?.employee_status)
      {
        employee.employee_status[0].note = notes
      }
      // if (!employee!.projects) {
      //   console.log("firrrst condition")
      //   employee!.projects = { projectId: [], tthour:0, note: notes};
      // }
    }
  },
});

export const {
  Add_notes_to_cases_without_projects,
  add_notes,
  setDepartment,
  setAttendanceStatus,
  setEmployeesStatus,
  setEmployeeData,
  setAttendanceEntry,
  setAttendanceNotes,
  setAllPresent,
  setAttendanceFromServer,
  clearAttendanceEntries,
  setEmployeeProjectsFromServer,
  addProjectToEmployee,
  addHours,
  setTotalProject,
  setRemainingHours,
  setLeftHours,
  sum_hours,
  overtime_hours,
} = projectSlice.actions;
export default projectSlice.reducer;
