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
}

const EmployeeCard: React.FC<EmployeeCardProps> = ({ employee, hideModeToggle = false, isCustomizeFromParent = false, disabled = false, initialStatus, initialNotes, showProjectsWhenPresent = false }) => {
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
  const [absenceReason, setAbsenceReason] = useState('');
  const [overtimeHours, setOvertimeHours] = useState<number | null>(null);
  let   [inputHours, setInputHours] = useState<number | 0>(0);
  const [workingHours, setworkingHours] = useState<number | null>(null);
  const [notes, setNotes] = useState(initialNotes ?? '');
  const [isHold, setIsHold] = useState(false);
  const [HowManyProjects, setHowManyProjects] = useState<number | string>('');
  const [selectedProjects, setSelectedProjects] = useState<ProjectData[]>([]);  // Store selected projects
  const [staus, setStatus] = useState<employee_status>();  // Store selected projects

  const dispatch = useDispatch<AppDispatch>();

  const left_Hours = useSelector((state: RootState) =>
    state.project.leftHours
  );

  
  useEffect(() => {
    if (department === 'construction') {
      handleStandarChange('standard');
    } else {
      setIsStandar(false);
    }
  }, []);

  // Sync from Standard mode: when initialStatus/initialNotes are provided, keep card state and Redux in sync
  useEffect(() => {
    if (initialStatus === undefined) return;
    setIsAttend(initialStatus === 'present');
    setIsAbsent(initialStatus === 'absent');
    setIshold(initialStatus === 'vacation');
    setIsHold(initialStatus === 'vacation');
    setAttendance(initialStatus === 'present' ? 'Present' : undefined);
    setNotes(initialNotes ?? '');
    dispatch(setAttendanceStatus({ status: initialStatus, employee_id: employee.employee_id }));
    dispatch(setEmployeesStatus({ status: initialStatus === 'present' ? 'Present' : initialStatus === 'vacation' ? 'vacation' : 'absent', employee_id: employee.employee_id }));
    if (initialNotes != null && initialNotes !== '') {
      dispatch(Add_notes_to_cases_without_projects({ employee_id: employee.employee_id, notes: initialNotes }));
      dispatch(setAttendanceNotes({ employee_id: employee.employee_id, notes: initialNotes }));
    }
  }, [initialStatus, initialNotes, employee.employee_id, dispatch]);


  const handleDropDownAttendance = (select_status: string) => {
    if (select_status !== "undefined") {
      dispatch(setEmployeesStatus({ status: select_status, employee_id: employee.employee_id }));
      setAttendance(select_status);
      if (select_status === 'Weekend') {
        dispatch(setAttendanceNotes({ employee_id: employee.employee_id, notes: 'Weekend' }));
        dispatch(Add_notes_to_cases_without_projects({ employee_id: employee.employee_id, notes: 'Weekend' }));
        setProject(false);
        setHowManyProjects('');
      } else if (select_status === 'Holiday-Work') {
        dispatch(setAttendanceNotes({ employee_id: employee.employee_id, notes: 'Holiday' }));
        dispatch(Add_notes_to_cases_without_projects({ employee_id: employee.employee_id, notes: 'Holiday' }));
        setProject(false);
        setHowManyProjects('');
      }
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

    if ((type === 'standard') && department === 'construction')
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
    if ((isAttend === false || isAttend === true) && isStandar)
    {
      if (newAttendance === false)
        setProject(false)
      if (isAttend === false)
      {
        handleStandarChange('standard')
        handleInputChange(1)
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
          setIsAbsent(false); // Uncheck "Absent" if "Attend" is checked
          setHowManyProjects('')
          setProject(false)
          setAbsenceReason(''); // Reset absence reason if "Attend" is selected
          setIshold(false)
        }
        else
        {
          setHowManyProjects('')
          setProject(false)
        }
    }
  };

  const handleAbsentChange = (e: React.ChangeEvent<HTMLInputElement>) => {

    setIsAbsent(e.target.checked);
    dispatch(setAttendanceStatus({status:"absent", employee_id: employee.employee_id}))
    syncStatusToAttendanceEntry('absent');
    if (e.target.checked) {
      setIsAttend(false); // Uncheck "Attend" if "Absent" is checked
      setAttendance(''); // Reset attendance if "Absent" is selected
      setIshold(false)
      setProject(false)
    }
  };

  const handleProjects = (projectType: string) => {
    if (attendance === 'half-day')
      setHowManyProjects(1);
    if (projectType == 'construction')
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
    setHowManyProjects('');
  };
  
  const [arr_projects, setArryProjects] = useState<Project[]>([]);
  const employees_statis = useSelector((state: RootState) => state.project.employees);

  const handleInputChange = (e: React.ChangeEvent<HTMLSelectElement> | number) => {

    let newValue: string | number;

    if (typeof e === 'number') {
      // If it's a number, use it directly
      newValue = e;
    } else {
      // If it's an event, extract the value from the event target
      newValue = e.target.value;
    }


    console.log("from the handle input change function ", attendance)
 
    const the_employee = employees_statis.find(employee_id => employee_id.employee_status)
    setStatus(the_employee?.employee_status![0])
    console.log("this is the emplouu", the_employee?.employee_status![0])
    if (Number(newValue) <= 10 && Number(newValue) > 0) {
      const projectCount = typeof newValue === 'number' ? newValue : parseInt(newValue, 10);
      console.log("this is the number for the how many projects ", projectCount)
      setHowManyProjects(projectCount);
      // Update Redux store with the total project count
      dispatch(setTotalProject(projectCount));

      // Adjust projects array dynamically based on input
      console.log("this is before the set array projects ", arr_projects)
      setArryProjects((prevProjects) => {
        const updatedProjects = [...prevProjects];
        if (attendance === 'half-day'){
          if (updatedProjects.length === 1) {
            // Update the existing single project
            updatedProjects[0] = { type: null}; // Set 4 hours for half-day
          } else {
            // Reset or create a single project with 4 hours
            return [{ type: null, hours: 4 }];
          }
        }
        else {
          if (projectCount > updatedProjects.length) {
            // Add new entries if the number of projects increases
            for (let i = updatedProjects.length; i < projectCount; i++) {
              updatedProjects.push({ type: null });
            }
          } else {
            // Remove entries if the number of projects decreases
            updatedProjects.splice(projectCount);
          }
        }
        // const updatedProjects = [...prevProjects];
        return updatedProjects;
      });
      
      console.log("this is After the set array projects ", arr_projects)
      setProject(true);
      setVisibleProjects(1);

      return 1;
    } else if (newValue === '') {
      setHowManyProjects(newValue);
      setProject(false);
      setArryProjects([]); // Reset the projects when no input is provided
      setVisibleProjects(1);
      return 0;
    }

    return 1;
  };

  const handleAbsentReason = (e: string) => {
    if (e !== "")
    {
      setAbsenceReason(e)
      if (e === 'Sick Leave')
      {
        console.log("This is the absent the function ")
        handleInputChange(1)
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

  return (
    <div className={`p-4 w-full min-w-0 max-w-[23rem] mx-auto rounded-lg shadow-md bg-[#710D15] flex flex-col items-center ${disabled ? 'pointer-events-none opacity-70' : ''}`}>
      <h2 className="text-xl font-semibold text-[#D94853] mb-4">الحضور</h2>
      <p className='pl-4 my-5 text-white text-2xl'>{employee.name}</p>
      {/* <div className='w-[60%] h-[2px] bg-blue-500 my-3'></div> */}
      <hr className='h-5 w-[15.26rem]'/>
      <div className='p-4 pr-0 text-white text-center'>
      <div className="pr-0 space-y-4 flex flex-col items-center">

      {/* Check here to make sure before display the stander or customize options */}
      {!hideModeToggle && (department === 'construction' || department === 'Maintenance') && (
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
          <label className="block text-white text-sm font-medium">Status</label>
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleAttendChange(true)}
              className={`min-h-[44px] min-w-[72px] px-3 sm:px-4 py-2.5 rounded-lg text-white text-sm font-medium transition touch-manipulation bg-green-600 ${
                isAttend ? 'ring-2 ring-white ring-offset-2 ring-offset-[#710D15]' : 'opacity-80 hover:opacity-100'
              }`}
            >
              Present
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleAbsentChange({ target: { checked: true } } as React.ChangeEvent<HTMLInputElement>)}
              className={`min-h-[44px] min-w-[72px] px-3 sm:px-4 py-2.5 rounded-lg text-white text-sm font-medium transition touch-manipulation bg-red-600 ${
                isAbsent ? 'ring-2 ring-white ring-offset-2 ring-offset-[#710D15]' : 'opacity-80 hover:opacity-100'
              }`}
            >
              Absent
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={handleHoldChange}
              className={`min-h-[44px] min-w-[72px] px-3 sm:px-4 py-2.5 rounded-lg text-white text-sm font-medium transition touch-manipulation bg-yellow-500 ${
                isHold ? 'ring-2 ring-white ring-offset-2 ring-offset-[#710D15]' : 'opacity-80 hover:opacity-100'
              }`}
            >
              Vacation
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
          <label className="block text-white text-sm font-medium mb-1">حاله الحضور</label>
          {hideModeToggle ? (
            <div className="flex flex-wrap gap-2 justify-center">
              <button
                type="button"
                disabled={disabled}
                onClick={() => handleDropDownAttendance('Weekend')}
                className={`min-h-[40px] px-3 py-2 rounded-lg text-sm font-medium transition touch-manipulation bg-blue-600 text-white ${
                  attendance === 'Weekend' ? 'ring-2 ring-white ring-offset-2 ring-offset-[#710D15]' : 'opacity-80 hover:opacity-100'
                }`}
              >
                Weekend
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => handleDropDownAttendance('Holiday-Work')}
                className={`min-h-[40px] px-3 py-2 rounded-lg text-sm font-medium transition touch-manipulation bg-amber-500 text-white ${
                  attendance === 'Holiday-Work' ? 'ring-2 ring-white ring-offset-2 ring-offset-[#710D15]' : 'opacity-80 hover:opacity-100'
                }`}
              >
                Holiday
              </button>
            </div>
          ) : (
            <select
              value={attendance ?? 'undefined'}
              onChange={(e) => handleDropDownAttendance(e.target.value)}
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
      {/* Project section: hide when Weekend or Holiday (no project_index needed) */}
      {((attendance !== undefined && attendance !== 'Weekend' && attendance !== 'Holiday-Work' && !isAbsent && !isHold && (isCustomizeFromParent || isStandar !== true)) || (showProjectsWhenPresent && isAttend && !isAbsent && !isHold && attendance !== 'Weekend' && attendance !== 'Holiday-Work')) && (
      <div>
        <label className='block mb-2 text-xl mt-[4rem]'>
          How many projects on this day
        </label>
        <select
          onChange={handleInputChange}
          value={HowManyProjects}
          className='text-black p-2 border rounded-lg focus:ring focus:ring-blue-200 w-full mt-5'
        >
          <option value="">Select how many projects</option>
          {[...Array(5)].map((_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1} project{ i > 0 && 's'}
            </option>
          ))}
        </select>
      </div>
    )}
    {isCustomer && (
        <div  className="mt-10">
          {Array.from({ length: Number(HowManyProjects) }).map((_, index) => (
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
              <div className='text-lg font-medium bg-white  text-black p-2 rounded-xl w-[150px] '>
                المشروع <span className="text-lg font-bold mr-3">{index + 1}</span>
              </div>
              {/* Checkboxes to choose the type of project */}
              <div className="flex flex-col items-center mt-10 gap-3">
                <Checkbox
                  label="صيانه"
                  checked={proj.type === 'maintenance'}
                  onChange={() => handleProjectTypeChange(index, 'maintenance')}
                />
                <Checkbox
                  label="مقاولات"
                  checked={proj.type === 'construction'}
                  onChange={() => handleProjectTypeChange(index, 'construction')}
                />
                { (department !== 'construction') &&
                  <Checkbox
                    label="مشاريع اخرى"
                    checked={proj.type === 'customer'}
                    onChange={() => handleProjectTypeChange(index, 'customer')}
                  />

                }
              </div>

              {/* Conditionally show dropdowns based on the selected project type */}
              <div className="mt-10">
                {proj.type === 'construction' && (
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
              onClick={handleShowNextProject}
              className="mt-5 p-2 bg-blue-500 text-white rounded"
            >
              Show Next Project
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
