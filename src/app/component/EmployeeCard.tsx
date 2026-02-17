'use client'
import React, { useState, useEffect, useCallback } from 'react';
import Checkbox from './CheckBox';
import ConstrDropdown from './CostrDropdown';
import MaintenanceDropdown from './MaintenanceDropdown';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/redux/store';
import { setTotalProject, setLeftHours, setAttendanceStatus, setEmployeesStatus, add_notes, Add_notes_to_cases_without_projects, setAttendanceEntry, setAttendanceNotes } from '@/redux/slice';
import OthersComponents from './OthersComponent';
import debounce from 'lodash/debounce';

interface Employee {
  id: string;
  name: string;
  employee_id:string
  position:string
}

interface EmployeeCardProps {
  employee: Employee;
  /** When true, hide the Standard/Customize checkboxes (page already has mode selector). */
  hideModeToggle?: boolean;
  /** When true, card behaves in Customize mode (show projects section) when present. */
  isCustomizeFromParent?: boolean;
  /** When true, card is read-only (e.g. after submission). */
  disabled?: boolean;
  /** Initial status from Standard mode so Customize shows the same selection. */
  initialStatus?: 'present' | 'absent' | 'vacation';
  /** Initial notes from Standard mode so Customize shows the same note. */
  initialNotes?: string | null;
  /** When true, show "How many projects" when Present (for Standard mode – same as Customize). */
  showProjectsWhenPresent?: boolean;
  themeId?: 'default' | 'saqiya';
}

interface EmployeeManagerProps {
  employees: Employee[];
}

interface ProjectData {
  project: string;
  hours: string;
}

interface employee_status {
  status_attendance: string | null
  status_employee: string | null
}

interface Project {
  type: string | null;
  hours?: number;
}

const EmployeeCard: React.FC<EmployeeCardProps> = ({ employee, hideModeToggle = false, isCustomizeFromParent = false, disabled = false, initialStatus, initialNotes, showProjectsWhenPresent = false, themeId }) => {
  const [isAttend, setIsAttend] = useState<boolean>(initialStatus === 'present');
  const [isStandar, setIsStandar] = useState<boolean>(true);
  const [isCustomize, setIsCustomize] = useState<boolean>(false);
  const [isAbsent, setIsAbsent] = useState<boolean>(initialStatus === 'absent');
  const [ishold, setIshold] = useState<boolean>(initialStatus === 'vacation');
  const [isConstruction, setIsconstructions] = useState<boolean>(false);
  const [isMaintenance, setIsmaintenance] = useState<boolean>(false);
  const [isBoth, setIsBoth] = useState<boolean>(false);
  const [isCustomer, setIsCustomer] = useState<boolean>(false);
  const [project, setProject] = useState<boolean>(false);
  const [attendance, setAttendance] = useState<string | undefined>(initialStatus === 'present' ? 'Present' : undefined);
  const [weekendSelected, setWeekendSelected] = useState(false);
  const [holidaySelected, setHolidaySelected] = useState(false);
  const [absenceReason, setAbsenceReason] = useState('');
  const [overtimeHours, setOvertimeHours] = useState<number | null>(null);
  let   [inputHours, setInputHours] = useState<number | 0>(0);
  const [workingHours, setworkingHours] = useState<number | null>(null);
  const [notes, setNotes] = useState(initialNotes ?? '');
  const [isHold, setIsHold] = useState(false);
  const [selectedProjects, setSelectedProjects] = useState<ProjectData[]>([]);  // Store selected projects
  const [staus, setStatus] = useState<employee_status>();  // Store selected projects

  const dispatch = useDispatch<AppDispatch>();

  const left_Hours = useSelector((state: RootState) =>
    state.project.leftHours
  );

  
  useEffect(() => {
    if (department === 'Construction') {
      handleStandarChange('standard');
    } else {
      setIsStandar(false);
    }
  }, []);

  // Sync from server/parent: when initialStatus/initialNotes are provided, keep card state and Redux in sync.
  // When absent, do NOT overwrite status_employee here so the "Reason for Absence" dropdown value is preserved.
  useEffect(() => {
    if (initialStatus === undefined) return;
    setIsAttend(initialStatus === 'present');
    setIsAbsent(initialStatus === 'absent');
    setIshold(initialStatus === 'vacation');
    setIsHold(initialStatus === 'vacation');
    setAttendance(initialStatus === 'present' ? 'Present' : undefined);
    setNotes(initialNotes ?? '');
    dispatch(setAttendanceStatus({ status: initialStatus, employee_id: employee.employee_id }));
    if (initialStatus === 'present') dispatch(setEmployeesStatus({ status: 'Present', employee_id: employee.employee_id }));
    else if (initialStatus === 'vacation') dispatch(setEmployeesStatus({ status: 'vacation', employee_id: employee.employee_id }));
    else if (initialStatus === 'absent') { /* leave status_employee unchanged so Reason for Absence dropdown is not overwritten */ }
    if (initialNotes != null && initialNotes !== '') {
      dispatch(Add_notes_to_cases_without_projects({ employee_id: employee.employee_id, notes: initialNotes }));
      dispatch(setAttendanceNotes({ employee_id: employee.employee_id, notes: initialNotes }));
      const n = initialNotes.toLowerCase();
      setWeekendSelected(n.includes('weekend'));
      setHolidaySelected(n.includes('holiday'));
    }
  }, [initialStatus, initialNotes, employee.employee_id, dispatch]);



  const applyAttendanceTypeToRedux = (weekend: boolean, holiday: boolean) => {
    const parts: string[] = [];
    if (weekend) parts.push('Weekend');
    if (holiday) parts.push('Holiday');
    const notesVal = parts.length ? parts.join(', ') : null;
    dispatch(setAttendanceNotes({ employee_id: employee.employee_id, notes: notesVal }));
    if (notesVal) dispatch(Add_notes_to_cases_without_projects({ employee_id: employee.employee_id, notes: notesVal }));
    const statusForApi = weekend ? 'Weekend' : holiday ? 'Holiday-Work' : 'Present';
    dispatch(setEmployeesStatus({ status: statusForApi, employee_id: employee.employee_id }));
    if (weekend || holiday) {
      setProject(weekend);
      if (holiday && !weekend) {
        setArryProjects([]);
        dispatch(setTotalProject(0));
      }
    }
  };

  const handleDropDownAttendance = (select_status: string, fromDropdown = false) => {
    if (fromDropdown) {
      if (select_status === 'Weekend') {
        setWeekendSelected(true);
        setHolidaySelected(false);
        setAttendance('Present');
        applyAttendanceTypeToRedux(true, false);
      } else if (select_status === 'Holiday-Work') {
        setHolidaySelected(true);
        setWeekendSelected(false);
        setAttendance('Present');
        setProject(false);
        setArryProjects([]);
        dispatch(setTotalProject(0));
        applyAttendanceTypeToRedux(false, true);
      } else if (select_status === 'Present') {
        setWeekendSelected(false);
        setHolidaySelected(false);
        setAttendance('Present');
        applyAttendanceTypeToRedux(false, false);
      } else {
        setWeekendSelected(false);
        setHolidaySelected(false);
        setAttendance(undefined);
      }
      return;
    }
    if (select_status === 'Weekend') {
      const next = !weekendSelected;
      setWeekendSelected(next);
      setHolidaySelected(false);
      if (!next) setAttendance(undefined);
      else setAttendance('Present');
      applyAttendanceTypeToRedux(next, false);
    } else if (select_status === 'Holiday-Work') {
      const next = !holidaySelected;
      setHolidaySelected(next);
      setWeekendSelected(false);
      if (!next) setAttendance(undefined);
      else {
        setAttendance('Present');
        setProject(false);
        setArryProjects([]);
        dispatch(setTotalProject(0));
      }
      applyAttendanceTypeToRedux(false, next);
    } else if (select_status === 'undefined' || select_status === 'Present') {
      setAttendance(select_status === 'Present' ? 'Present' : undefined);
      setWeekendSelected(false);
      setHolidaySelected(false);
      if (select_status === 'Present') applyAttendanceTypeToRedux(false, false);
    } else {
      setAttendance(undefined);
    }
  };

  const handleinputChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {

    // // // // console.log(handleInputChange(e))
    const updatedProjectData = [...selectedProjects];
  
    // If the object at the current index doesn't exist, initialize it
    if (!updatedProjectData[index]) {
      updatedProjectData[index] = { project: '', hours: '' }; // Initialize with empty values
    }
  
    // Update the hours field at the current index
    updatedProjectData[index].hours = e.target.value;
  
    setSelectedProjects(updatedProjectData); // Update state
  };

  const handleStandarChange = (type: 'standard' | 'customize') => {

    setIsStandar(type === 'standard');
    setIsCustomize(type === 'customize');

    if ((type === 'standard') && department === 'Construction')
    {
      // setIsAttend(true)

      const the_employee = employees_statis.find(employee_id => employee_id.employee_status)
      console.log("this is the employee ",  the_employee)
      setStatus(the_employee?.employee_status![0])
      console.log("this is the status ", staus)
      dispatch(setAttendanceStatus({status:"present", employee_id: employee.employee_id}))
      dispatch(setEmployeesStatus({status: "Present", employee_id: employee.employee_id}))
      // handleAttendChange(isAttend)
      console.log("this is the statis for the attendance ", isAttend)
      // handleInputChange(1)
      // setProject(true);
      // setVisibleProjects(1);
      // setHowManyProjects(1)
      // setArryProjects()
    }
  };
  

  const syncStatusToAttendanceEntry = (status: 'present' | 'absent' | 'vacation') => {
    const notes = (employee1?.employee_status?.[0] as { note?: string | null } | undefined)?.note ?? attendanceEntryNotes ?? null;
    dispatch(setAttendanceEntry({ employee_id: employee.employee_id, status, notes }));
  };

  const handleAttendChange = (e: React.ChangeEvent<HTMLInputElement> |  boolean) => {

    const newAttendance = typeof e === 'boolean' ? e : e.target.checked;

    setIsAttend(newAttendance);
    if (newAttendance) {
      setIsAbsent(false);
      setIsHold(false);
    }
    if ((isAttend === false || isAttend === true) && isStandar)
    {
      if (newAttendance === false) {
        setProject(false);
        setArryProjects([]);
        dispatch(setTotalProject(0));
      }
      if (isAttend === false)
      {
        handleStandarChange('standard');
        addProject();
      }
      else {
        dispatch(setAttendanceStatus({status:"present", employee_id: employee.employee_id}))
        dispatch(setEmployeesStatus({status: "Present", employee_id: employee.employee_id}))
        syncStatusToAttendanceEntry('present');
      }
    }
    else
    {
        dispatch(setAttendanceStatus({status:"present", employee_id: employee.employee_id}))
        syncStatusToAttendanceEntry('present');
        if (left_Hours === 8)
        {
          dispatch(setLeftHours(0))
        }
        if (newAttendance) {
          setArryProjects([]);
          dispatch(setTotalProject(0));
          setProject(false);
          setAbsenceReason('');
        }
        else
        {
          setArryProjects([]);
          dispatch(setTotalProject(0));
          setProject(false);
        }
    }
  };

  const handleAbsentChange = (e: React.ChangeEvent<HTMLInputElement>) => {

    setIsAbsent(e.target.checked);
    dispatch(setAttendanceStatus({status:"absent", employee_id: employee.employee_id}))
    syncStatusToAttendanceEntry('absent');
    if (e.target.checked) {
      setIsAttend(false);
      setIsHold(false);
      setIshold(false);
      setAttendance('');
      setProject(false);
    }
  };

  const handleProjects = (projectType: string) => {
    if (projectType == 'Construction')
    {
      if (isConstruction == true)
        setIsconstructions(false)
      else if (isMaintenance == true)
      {
        setIsmaintenance(false)
        setIsBoth(false);
        setIsconstructions(true)
      }
      else
      {
        setIsconstructions(true)
        setIsBoth(false)
        setIsCustomer(false)
      }
    }
    else if (projectType == 'maintenance')
    {
      if (isConstruction == true)
      {
        setIsconstructions(false)
        setIsmaintenance(true)
      }
      else if (isMaintenance == true)
        setIsmaintenance(false); 
      else
      {
        setIsmaintenance(true); 
        setIsBoth(false)
        setIsCustomer(false)
      }
    }
    else if(projectType == 'both')
    {
      if (isBoth == true)
        setIsBoth(false)
      else if (isMaintenance == true || isConstruction == true || isCustomer == true)
      {
        setIsmaintenance(false)
        setIsCustomer(false)
        setIsconstructions(false)
        setIsBoth(true);
      }
      else
        setIsBoth(true)
    }
    else if (projectType == 'customer')
    {
      if (isCustomer == true)
        setIsCustomer(false)
      else if (isMaintenance == true || isConstruction == true || isBoth == true)
      {
        setIsmaintenance(false)
        setIsconstructions(false)
        setIsBoth(false);
        setIsCustomer(true)
      }
      else
        setIsCustomer(true)
    }
  };
  const handleHoldChange = () => {
    dispatch(setAttendanceStatus({status:"vacation", employee_id: employee.employee_id}))
    syncStatusToAttendanceEntry('vacation');
    setIsHold((prev) => !prev);
    setIsAttend(false);
    setIsAbsent(false);
    setProject(false);
    setArryProjects([]);
    dispatch(setTotalProject(0));
  };

  const [arr_projects, setArryProjects] = useState<Project[]>([]);
  const employees_statis = useSelector((state: RootState) => state.project.employees);

  const addProject = () => {
    setArryProjects((prev) => {
      if (prev.length >= 5) return prev;
      const next = attendance === 'half-day'
        ? [...prev, { type: null, hours: 4 }]
        : [...prev, { type: null }];
      dispatch(setTotalProject(next.length));
      return next;
    });
    setProject(true);
    setVisibleProjects((prev) => prev + 1);
  };

  const removeLastProject = () => {
    setArryProjects((prev) => {
      if (prev.length <= 0) return prev;
      const next = prev.slice(0, -1);
      dispatch(setTotalProject(next.length));
      if (next.length === 0) setProject(false);
      return next;
    });
    setVisibleProjects((prev) => Math.max(1, prev - 1));
  };

  const handleAbsentReason = (e: string) => {
    if (e !== "")
    {
      setAbsenceReason(e)
      if (e === 'Sick Leave')
      {
        addProject();
      }
      dispatch(setEmployeesStatus({status:e, employee_id: employee.employee_id}))
    }
  };

  const handleProjectTypeChange = (index: number, type: string) => {
    setArryProjects((prevProjects) => {
      const updatedProjects = [...prevProjects];
      updatedProjects[index].type = type;
      return updatedProjects;
    });
  };

  const [visibleProjects, setVisibleProjects] = useState<number>(1);

  const handleShowNextProject = () => {
    setVisibleProjects((prevVisible) => Math.min(prevVisible + 1, arr_projects.length)); // Increase visible projects up to the total number of projects
  };

  const employee1 = useSelector((state: RootState) =>
    state.project.employees.find(emp => emp.employee_id === employee.employee_id)
  );
  const reduxAbsenceReason = employee1?.employee_status?.[0]?.status_employee;
  useEffect(() => {
    if (initialStatus === 'absent' && reduxAbsenceReason && ['Sick Leave', 'Absence with excuse', 'Absence without excuse'].includes(reduxAbsenceReason)) {
      setAbsenceReason(reduxAbsenceReason);
    }
  }, [initialStatus, reduxAbsenceReason]);

  const attendanceEntryNotes = useSelector((state: RootState) =>
    state.project.attendanceEntries[employee.employee_id]?.notes ?? null
  );

  const total_projects = useSelector((state: RootState) =>
    state.project.totalProjects
  );

  
  const department = useSelector((state: RootState) => state.project.department);
  const debouncedDispatch = useCallback(
    debounce((emp: Employee, isHoldVal: boolean, absenceReasonVal: string, newNotes: string) => {
      if (isHoldVal || (absenceReasonVal === 'Absence with excuse' || absenceReasonVal === 'Absence without excuse')) {
        dispatch(Add_notes_to_cases_without_projects({ employee_id: emp.employee_id, notes: newNotes }));
      } else {
        dispatch(add_notes({ employee_id: emp.employee_id, project_index: 0, notes: newNotes }));
      }
      dispatch(setAttendanceNotes({ employee_id: emp.employee_id, notes: newNotes || null }));
    }, 300),
    [dispatch]
  );

  // Clean up the debounced function on component unmount
  useEffect(() => {
    return () => {
      debouncedDispatch.cancel();
    };
  }, [debouncedDispatch]);
  const handleNote = (e: React.ChangeEvent<HTMLInputElement>) => {
    // setNotes(notes)
    // console.log("this is the ", isHold , absenceReason, employee.employee_id, notes)
    // if (isHold || (absenceReason === "Personal Leave" || absenceReason === "Absence without excuse"))
    // {
    //   dispatch(Add_notes_to_cases_without_projects({employee_id:employee.employee_id, notes:notes}))
    // }
    // else
    // {
    //   dispatch(add_notes({employee_id:employee.employee_id , project_index:0, notes:notes}))
    // }
    // // dispatch
    // console.log("this is the note ,", notes)

    const newNotes = e.target.value;
    setNotes(newNotes);
    debouncedDispatch(employee, isHold, absenceReason, newNotes);
  };

  const isSaqiya = themeId === 'saqiya';
  const cardClass = isSaqiya
    ? 'p-4 w-full min-w-0 max-w-[23rem] mx-auto rounded-theme-card border-2 border-theme-accent bg-theme-card-bg flex flex-col items-center shadow-sm'
    : 'p-4 w-full min-w-0 max-w-[23rem] mx-auto rounded-lg shadow-md bg-[#710D15] flex flex-col items-center';
  const selectedRing = isSaqiya
    ? 'ring-4 ring-theme-accent ring-offset-2 ring-offset-theme-card-bg'
    : 'ring-4 ring-white ring-offset-2 ring-offset-[#710D15]';

  return (
    <div className={`${cardClass} ${disabled ? 'pointer-events-none opacity-70' : ''}`}>
      <h2 className={`text-xl font-semibold mb-4 ${isSaqiya ? 'text-theme-primary' : 'text-[#D94853]'}`}>الحضور</h2>
      <p className={`pl-4 my-5 text-2xl ${isSaqiya ? 'text-theme-accent' : 'text-white'}`}>{employee.name}</p>
      <hr className={`h-5 w-[15.26rem] ${isSaqiya ? 'bg-theme-accent/20' : ''}`}/>
      <div className={`p-4 pr-0 text-center ${isSaqiya ? 'text-theme-accent' : 'text-white'}`}>
      <div className="pr-0 space-y-4 flex flex-col items-center">

      {/* Check here to make sure before display the stander or customize options */}
      {!hideModeToggle && (department === 'Construction' || department === 'Maintenance') && (
        <>
        <div className='flex gap-5 mb-5'>
          <div>
            <Checkbox
              label="Stander" 
              checked={isStandar} 
              onChange={() => handleStandarChange('standard')}
            />
          </div>
          <div>
            <Checkbox
              label="Customize" 
              checked={isCustomize} 
              onChange={() => handleStandarChange('customize')}
            />
          </div>

        </div>
        </>
      )}

      {/* {isStandar !== true && (
        <>

        </>
      )} */}

        {/* Status: buttons in Standard (showProjectsWhenPresent), checkboxes otherwise */}
      {showProjectsWhenPresent ? (
        <div className="w-full space-y-2">
          <label className={`block text-sm font-medium ${isSaqiya ? 'text-theme-accent' : 'text-white'}`}>Status</label>
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleAttendChange(true)}
              aria-pressed={isAttend}
              className={`min-h-[44px] min-w-[72px] px-3 sm:px-4 py-2.5 rounded-theme-card text-white text-sm font-medium transition touch-manipulation bg-green-600 ${
                isAttend ? selectedRing : 'opacity-60 hover:opacity-80'
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                {isAttend && <span className="text-white drop-shadow-sm" aria-hidden>✓</span>}
                Present
              </span>
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleAbsentChange({ target: { checked: true } } as React.ChangeEvent<HTMLInputElement>)}
              aria-pressed={isAbsent}
              className={`min-h-[44px] min-w-[72px] px-3 sm:px-4 py-2.5 rounded-theme-card text-white text-sm font-medium transition touch-manipulation bg-red-600 ${
                isAbsent ? selectedRing : 'opacity-60 hover:opacity-80'
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                {isAbsent && <span className="text-white drop-shadow-sm" aria-hidden>✓</span>}
                Absent
              </span>
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={handleHoldChange}
              aria-pressed={isHold}
              className={`min-h-[44px] min-w-[72px] px-3 sm:px-4 py-2.5 rounded-theme-card text-white text-sm font-medium transition touch-manipulation bg-yellow-500 ${
                isHold ? selectedRing : 'opacity-60 hover:opacity-80'
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                {isHold && <span className="text-white drop-shadow-sm" aria-hidden>✓</span>}
                Vacation
              </span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {(isAbsent === false && isHold === false) && (
            <div>
              <Checkbox label="present" checked={isAttend} onChange={handleAttendChange} />
            </div>
          )}
          {(isAttend === false && isHold === false) && (
            <div>
              <Checkbox label="absent" checked={isAbsent} onChange={handleAbsentChange} />
            </div>
          )}
          {(isAttend === false && isAbsent === false) && (
            <div>
              <Checkbox label="vacation" checked={isHold} onChange={handleHoldChange} />
            </div>
          )}
        </>
      )}
      </div>
      {/* End the scop */}

      {/* Attendance type: buttons when Standard (hideModeToggle), dropdown otherwise */}
      {(isAttend) && (
        <div className="w-full space-y-2">
          <label className={`block text-sm font-medium mb-1 ${isSaqiya ? 'text-theme-accent' : 'text-white'}`}>حاله الحضور</label>
          <p className={`text-xs mb-1 ${isSaqiya ? 'text-theme-accent/80' : 'text-white/80'}`}>
            Select one: Weekend or Holiday (or neither).
          </p>
          {hideModeToggle ? (
            <div className="flex flex-wrap gap-2 justify-center">
              <button
                type="button"
                disabled={disabled}
                onClick={() => handleDropDownAttendance('Weekend')}
                aria-pressed={weekendSelected}
                className={`min-h-[40px] px-3 py-2 rounded-lg text-sm font-medium transition touch-manipulation bg-blue-600 text-white ${
                  weekendSelected ? selectedRing : 'opacity-60 hover:opacity-80'
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  {weekendSelected && <span className="text-white drop-shadow-sm" aria-hidden>✓</span>}
                  Weekend
                </span>
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => handleDropDownAttendance('Holiday-Work')}
                aria-pressed={holidaySelected}
                className={`min-h-[40px] px-3 py-2 rounded-lg text-sm font-medium transition touch-manipulation bg-amber-500 text-white ${
                  holidaySelected ? selectedRing : 'opacity-60 hover:opacity-80'
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  {holidaySelected && <span className="text-white drop-shadow-sm" aria-hidden>✓</span>}
                  Holiday
                </span>
              </button>
            </div>
          ) : (
            <select
              value={weekendSelected ? 'Weekend' : holidaySelected ? 'Holiday-Work' : (attendance ?? 'undefined')}
              onChange={(e) => handleDropDownAttendance(e.target.value, true)}
              className="w-full sm:w-[10rem] p-2 border rounded-lg focus:ring focus:ring-blue-200 text-black"
            >
              <option value="undefined">Status of attend</option>
              <option value="Present">Present</option>
              <option value="Weekend">Weekend</option>
              <option value="Holiday-Work">holiday</option>
            </select>
          )}
        </div>
      )}
      {/* Project section: hide when Holiday only (no projects); show for Present and when Weekend selected */}
      {((attendance !== undefined && (weekendSelected || !holidaySelected) && !isAbsent && !isHold && (isCustomizeFromParent || isStandar !== true)) || (showProjectsWhenPresent && isAttend && !isAbsent && !isHold && (weekendSelected || !holidaySelected))) && (
      <div className="mt-[4rem]">
        <button
          type="button"
          disabled={disabled || arr_projects.length >= 5}
          onClick={addProject}
          className="w-full sm:w-auto min-h-[40px] px-4 py-2 rounded-lg text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          Add project
        </button>
        {arr_projects.length > 0 && (
          <p className="text-sm text-white/80 mt-2">
            {arr_projects.length} project{arr_projects.length !== 1 ? 's' : ''} on this day
          </p>
        )}
      </div>
    )}
    {isCustomer && (
        <div  className="mt-10">
          {Array.from({ length: arr_projects.length }).map((_, index) => (
            <div key={index} className="my-3">
              {<OthersComponents employee_id={employee.employee_id} input_index={index} atten_status={staus} />}
            </div>
          ))}
      </div>
      )}

      {( project) && (
        <div className="mt-10">
          {arr_projects.slice(0, visibleProjects).map((proj, index) => (
            <div key={index} className="my-[2.5rem] flex flex-col justfiy-center items-center">
              <hr className='w-[15.26rem] h-6'/>
              {/* Project number as a button-style label */}
              <div className='text-lg font-medium bg-white text-black px-5 py-2.5 rounded-xl min-w-[150px] text-center shadow-sm border border-gray-200'>
                المشروع <span className="text-lg font-bold mr-3">{index + 1}</span>
              </div>
              {/* Project type as toggle buttons (same logic as before) */}
              <div className="flex flex-wrap items-center justify-center gap-3 mt-10">
                <button
                  type="button"
                  onClick={() => handleProjectTypeChange(index, 'maintenance')}
                  className={`min-h-[40px] px-4 py-2 rounded-lg text-sm font-medium transition touch-manipulation ${
                    proj.type === 'maintenance'
                      ? 'bg-blue-500 text-white ring-2 ring-white/50'
                      : 'bg-white/10 text-white border border-white/30 hover:bg-white/20'
                  }`}
                >
                  صيانه
                </button>
                <button
                  type="button"
                  onClick={() => handleProjectTypeChange(index, 'Construction')}
                  className={`min-h-[40px] px-4 py-2 rounded-lg text-sm font-medium transition touch-manipulation ${
                    proj.type === 'Construction'
                      ? 'bg-blue-500 text-white ring-2 ring-white/50'
                      : 'bg-white/10 text-white border border-white/30 hover:bg-white/20'
                  }`}
                >
                  مقاولات
                </button>
                {department !== 'Construction' && (
                  <button
                    type="button"
                    onClick={() => handleProjectTypeChange(index, 'customer')}
                    className={`min-h-[40px] px-4 py-2 rounded-lg text-sm font-medium transition touch-manipulation ${
                      proj.type === 'customer'
                        ? 'bg-blue-500 text-white ring-2 ring-white/50'
                        : 'bg-white/10 text-white border border-white/30 hover:bg-white/20'
                    }`}
                  >
                    مشاريع اخرى
                  </button>
                )}
              </div>

              {/* Conditionally show dropdowns based on the selected project type */}
              <div className="mt-10">
                {proj.type === 'Construction' && (
                  <div>
                    <ConstrDropdown
                      employee_id={employee.employee_id}
                      position={employee.position}
                      input_index={index}
                    />
                  </div>
                )}

                {proj.type === 'maintenance' && (
                  <MaintenanceDropdown
                    employee_id={employee.employee_id}
                    input_index={index}
                    departments={department}
                  />
                )}

                {proj.type === 'customer' && (
                  <OthersComponents
                    employee_id={employee.employee_id}
                    input_index={index}
                    atten_status={staus}
                  />
                )}
              </div>
            </div>
          ))}

          {/* Show "Show Next Project" button if there are more projects to display */}
          {visibleProjects < arr_projects.length && (
            <button
              type="button"
              onClick={handleShowNextProject}
              className="mt-5 p-2 bg-blue-500 text-white rounded"
            >
              Show Next Project
            </button>
          )}
          {/* Remove last project */}
          {arr_projects.length > 0 && (
            <button
              type="button"
              onClick={removeLastProject}
              className="mt-5 p-2 bg-red-500/80 text-white rounded hover:bg-red-600"
            >
              Remove last project
            </button>
          )}
        </div>
      )}
      {(isAttend || isAbsent) && (
          <div className='mt-10'>
            <h3>Selected Projects:</h3>
            {employee1?.projects?.projectId.map((projectId, index) => (
              <ul key={ index}> {/* Ensure key is unique */}
                <div className="bg-white my-[18px] py-[10px] rounded-[21px]">
                  <li className='text-black'>
                    <span className="text-blue-700 text-bold-800">Project {index + 1}:</span> {projectId.projectName}
                  </li>
                  <li className='text-black'>
                    <span className="text-blue-700 text-bold-800">Hours:</span> {projectId.hours}
                  </li>
                  <li className='text-black'>
                    <span className="text-blue-700 text-bold-800">Overtime:</span> {projectId.overtime}
                  </li>
                </div>
              </ul>
            ))}
            {/* {`this total hours ${employee1?.projects?.tthour}`} */}
          </div>
        )}
        {isAbsent && (
          <div className="my-[2.5rem]">
            <label className="block text-white mb-2 text-xl">Reason for Absence:</label>
            <select 
              value={absenceReason} 
              onChange={(e) => handleAbsentReason(e.target.value)} 
              className="w-[10rem] p-2 border rounded-lg focus:ring focus:ring-blue-200 text-black"
            >
            <option value="" disabled>Select reason for absence</option>
            <option value="Sick Leave">Sick Leave</option>
            <option value="Absence with excuse">Absence with excuse</option>
            <option value="Absence without excuse">Absence without excuse</option>
            </select>
          </div>
        )}
      </div>
      {/* <div className='w-[60%] h-[2px] bg-blue-500 my-3'></div> */}
      <hr className='h-5 w-[15.26rem]'/>
      <div className='mb-3'>
      <h2 className="text-xl font-semibold text-white mb-4 text-center  ">Notes</h2>
        <input 
          type="text" 
          className='text-black p-2 border rounded-lg focus:ring focus:ring-blue-200 w-full' 
          name="Notes" 
          placeholder='Your note here please'
          value={notes}
          onChange={handleNote}
        />
      </div>
    </div>
  );
};

export default React.memo(EmployeeCard);
