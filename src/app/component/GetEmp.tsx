// import { createSupabaseServerComponentClient } from "@/lib/supabaseAppRouterClient";
// import { useDispatch } from "react-redux";
// import { setEmployeeData } from "@/redux/slice";
// interface Employee {
//     id: string;
//     name: string;
//     employee_id:string
// }

// async function fetchEmployees(): Promise<Employee[]> {
//     const supbase = createSupabaseServerComponentClient();

//     const dispatch = useDispatch();

//     let { data: Employees, error } = await supbase
//     .from('Employee')
//     .select('*')
  
//     if (error) {
//       console.error('Error fetching employees:', error);
//       return [];
//     }

//     dispatch(setEmployeeData(Employees))

//     return Employees || [];
// }
  

