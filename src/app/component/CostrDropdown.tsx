'use client';

import React, { useState, useEffect } from 'react';
import { createSupabbaseFrontendClient } from '@/lib/supabase';
// import { setSelectedProject } from '@/redux/slice';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '@/redux/store';
import { addProjectToEmployee, addHours, setRemainingHours, setLeftHours, sum_hours, overtime_hours } from '@/redux/slice';
import { cpSync } from 'fs';

async function fetchProjects(department: string) {

  const supabase = createSupabbaseFrontendClient();

  const { data, error } = await supabase
    .from('projects')
    .select('project_name')
    // .eq('department', department)
    .in('department', ['Construction Maintenance', department])
    .eq('project_status', 'active');

  if (error) {
    console.error('Error fetching projects:', error);
    return [];
  }

  return data;
}

interface employee_status {
  status_attendance: string | null
  status_employee: string | null
}

interface ConstrDropdownProps {
  employee_id:string
  input_index:number
  position:string
}

const ConstrDropdown = ({employee_id, input_index, position}:ConstrDropdownProps) => {
  const [project, setProject] = useState('');
  const [overtime_input, setOvertimeInput] = useState<Boolean>(false)
  const [selectedHours, setSelectedHours] = useState<number | null>(null);
  const [selectedOvertime, setSelectedOvertime] = useState<number | null>(null);
  // const [remainingHours, setRemainingHours] = useState<number>(8);
  const [projectIndex, indexProject] = useState<number | null>(null);
  // const [hours, setHours] = useState('');
  const [projects, setProjects] = useState<string[]>([]);
  let [hours, setHours] = useState<number[] | number>();
  let [overtime, setOvertime] = useState<number[] | number>(Array.from({ length: 7 }, (_, i) => i));
  const [show_H, showHours] = useState<string | null>(null);

  // const dispatch = useDispatch();
  const dispatch = useDispatch<AppDispatch>();

  const employee1 = useSelector((state: RootState) =>
    state.project.employees.find(emp => emp.employee_id === employee_id)
  );

  const totalProjects = useSelector((state: RootState) =>
    state.project.totalProjects
  );
  
  const remaining = useSelector((state: RootState) =>
    state.project.remaining
  );

  const left_Hours = useSelector((state: RootState) =>
    state.project.leftHours
  );

  const tt = useSelector((state: RootState) =>
    state.project.total_hours
  );

  console.log("this is the employee status from the constructoons ", employee1?.employee_status![0].status_employee)
  
  useEffect(() => {
    async function getProjects() {
      const data = await fetchProjects('Construction');

      // Filter out projects that were already selected in previous indexes
      const filteredProjects = data
        ?.map((proj: { project_name: string }) => proj.project_name)
        .filter((proj) => {
          // If input_index > 0, check previous project selections
          if (input_index > 0 && employee1?.projects?.projectId) {
            for (let i = 0; i < input_index; i++) {
              if (employee1.projects.projectId[i]?.projectName.includes(proj)) {
                return false; // Project was already selected
              }
            }
          }
          return true; // Project wasn't selected yet
        }) || [];

      setProjects(filteredProjects);
    }

    getProjects();
  }, [input_index, employee1]);

  // // console.log("this os th",left_Hours)
  useEffect(() => {
    console.log("thbkjbkjbkjsbkjavdjv")
    const project = employee1?.projects?.projectId?.[input_index]; // Safely access the project
    // console.log("the field Effect ", project?.hours, input_index)
    if (project && project.hours === -1) {
      // Only execute the code if hours is defined

      let change_total = 0
      for(let index = 0; index < input_index; index++)
      {
        change_total += employee1.projects!.projectId[index].hours
      }

      console.log("change totoal ", change_total)
      // employee1.projects!.projectId[input_index + 1].hours = -1
      if (input_index + 1 ===  totalProjects)
      {
        // console.log("this is the input index",left_Hours) 
        let reach = 8 - change_total
        console.log("this is from reach one", reach)
        setHours(reach);  
        dispatch(addHours({hours:reach, project_index:input_index, employee_id}))
      }
      else
      {
        let reach = 8 - change_total
        console.log("this is from reach two", reach)
        const newHours = Array.from({ length: reach - 1 }, (_, i) => i + 1);
        setHours(newHours);
        dispatch(addHours({hours:reach - 1, project_index:input_index, employee_id}))
      }
      // if ((input_index+1 === totalProjects && project.hours === -1) || (employee1.projects?.projectId[0].hours === 6))
      // {
      //     // console.log("this is the value and index ", input_index, employee1?.projects?.projectId[input_index].hours)
      //     // employee1!.projects!.projectId[input_index].hours = hours
      //      // console.log("this is the change totoal ", change_total, input_index)
      //      let reach = 8 - change_total
      //     //  console.log("here the reach var  ", reach, input_index)
      //     console.log("this is from reach three", reach)
      //     dispatch(addHours({hours:reach, project_index:input_index, employee_id}))
      // }
      // console.log("This is the field", input_index, project.hours, change_total);
    }
  }, [employee1?.projects?.projectId?.[input_index]?.hours]);

  useEffect(()=>{
    // const the_employee = employees_statis.find(employee1 => employee1.employee_id)
    // console.log("from the useeffect ",the_employee?.employee_status![0])
    if (employee1?.employee_status![0].status_attendance === 'present')
    {
      // console.log("insdie first condition ", the_employee?.employee_status![0].status_employee )
      if (employee1?.employee_status![0].status_employee !== 'Present')
      {
        console.log("inside the anohter condition ")
        setOvertimeInput(true)
      }
      showHours(employee1?.employee_status![0].status_employee)
      console.log("this is the showhours value ", show_H)
    }
    console.log("this is the in useeffect employeeid", employee1?.employee_status![0])
  },[employee1?.employee_id])

  useEffect(() => {

    if (input_index + 1 === totalProjects)
      setOvertimeInput(true)
    if (totalProjects === 1) {
      setHours(8)
      return ;
    }
    // if (atten_status[0].employee_status === 'half-day')
    // {
    //   const newHours = Array.from({ length: 4 }, (_, i) => i + 1);
    //   setHours(newHours);
    // }
    else 
    {
      if (input_index === 0)
      {
        const newHours = Array.from({ length: (8 - totalProjects) + 1 }, (_, i) => i + 1);
        setHours(newHours);
      }
      else{
        // console.log("this is the selected ", left_Hours + remaining)
        // console.log(8 - remaining)
  
          if (input_index + 1 ===  totalProjects)
          {
            // console.log("this is the input index",employee1!.projects!.tthour) 
            let reach = 8 - employee1!.projects!.tthour
            setHours(reach);  
          }
          else
          {
            let reach = 8 - employee1!.projects!.tthour
            const newHours = Array.from({ length: reach - 1 }, (_, i) => i + 1);
            setHours(newHours);
          }
      }
    }

    return () => {

      console.log('Component is being unmounted or cleaned up.');
    }

  }, []);
  // useEffect(() => {

  //   return () => {

  //     console.log('Component is being unmounted or cleaned up.');
  //   }

  // }, []);


  const handleProjectChange = (e: React.ChangeEvent<HTMLSelectElement>, index: number) => {
    const selected_project = e.target.value;
    const hours = parseInt("8", 10);

    setProject(selected_project);

    console.log("here call the function ")
    // if (input_index > 0)
    //   // console.log (employee1?.projects?.projectId[input_index - 1].projectName[input_index - 1])
    // console.log("from dropdown this is the project index ", index, " and this is the index of input ", input_index)

    // Dispatch the selected project and its index
    // let the_num = atten_status[0].attendance_status
    dispatch(addProjectToEmployee({ employee_id, selected_project, project_index: input_index }));
    dispatch(addHours({hours, project_index:input_index, employee_id}))
  };


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hours =  parseFloat(e.target.value)
    const input = e.target.value
    
    // if (Number(input) <= 10 && Number(input) > 0) {
    setSelectedHours(hours);
    // dispatch(setLeftHours(hours))
      dispatch(addHours({hours, project_index:input_index, employee_id}))
    // }
    // else if (input === '')
    // {
    //   setSelectedHours(null)
    // }
  };
  
const handleHoursChange = (e: React.ChangeEvent<HTMLSelectElement>) => {

  const hours = parseInt(e.target.value, 10);
  console.log('from the handle function error ', hours)
  dispatch(setRemainingHours(hours))
  
  if (left_Hours > 8)
    dispatch(setLeftHours(0))
  else
    dispatch(setLeftHours(left_Hours + hours))

  dispatch(addHours({hours, project_index:input_index, employee_id}))
  
  dispatch(sum_hours({employee_id, project_index:input_index}))
  
  setSelectedHours(hours);
};

const handleOvertTimeHoursChange = (e: React.ChangeEvent<HTMLSelectElement>) => {

  const hours = parseInt(e.target.value, 10);
  
  dispatch(overtime_hours({overtime_Hours:hours, employee_id, project_index:input_index}))

  setSelectedOvertime(hours);
};

  const renderHours = () => {
    // If it's an array, map through it
    // // console.log(Array.isArray(hours))

    if (Array.isArray(hours)) {
      return hours.map((hour, index) => (
        <>
          <option key={hour} value={hour}>{hour} hours</option>
        </>
      ));
    }

    // If it's a single number, handle it as such
    return <option>{hours} hours</option>;
  };

  const renderOvertime = () => {
    // If it's an array, map through it
    // // console.log(Array.isArray(hours))

    if (Array.isArray(overtime)) {
      return overtime.map((hour, index) => (
        <option key={hour} value={hour}>{hour} hours</option>
      ));
    }

    // If it's a single number, handle it as such
    return <option>{hours} hours</option>;
  };
  
  return (
    <div className="mb-4 flex flex-col items-end mt-8">
      <select 
        value={project} 
        onChange={(e) => handleProjectChange(e, projects.indexOf(e.target.value))}
          // Trigger onChange when a project is selected
        className="w-full p-2 border rounded-lg focus:ring focus:ring-blue-200 text-black"
      >
        <option  value="" disabled>مشاريع المقاولات</option>
        {projects.map((proj, index) => (
          <option key={index} value={proj}>{proj}</option>
        ))}
      </select>
      {/* {show_H === 'Present' && 
        <div>
          <select 
            value={selectedHours || ''}
            onChange={handleHoursChange}
            className='text-black p-2 border rounded-lg focus:ring focus:ring-blue-200 w-full mt-5'
            >
            <option value="" disabled>الساعات الاساسية</option>
            {renderHours()}
          </select>
        </div>
      } */}
      {(overtime_input && position !== 'foreman' && employee1?.employee_status![0].status_employee !== 'Sick Leave') && (
        <div>
          <select 
            value={selectedOvertime ?? ''}
            onChange={handleOvertTimeHoursChange}
            className='text-black p-2 border rounded-lg focus:ring focus:ring-blue-200 w-full mt-5'
            >
            <option value="" disabled>الساعات الاضافية</option>
            {renderOvertime()}
          </select>
        </div>
      )}

    </div>
  );
};

export default ConstrDropdown;
