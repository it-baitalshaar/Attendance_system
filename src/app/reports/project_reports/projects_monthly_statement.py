import psycopg2
import pandas as pd
import os

host = 'aws-0-ap-south-1.pooler.supabase.com'
port = 6543
dbname = 'postgres'
user = 'postgres.fhsvgeacwnnvqidyhnok'
password = 'Bait-Alshaar20'  # Replace with your actual password

try:
    connection = psycopg2.connect(
        host=host,
        port=port,
        dbname=dbname,
        user=user,
        password=password
    )
    cursor = connection.cursor()
    print("Connected to the database!")

    # SQL query to get the data
    query = '''
        SELECT 
            e.employee_id,
            e.name,
            e.salary,
            e.department AS employee_department,
            p.project_name,
            p.department AS project_department,
            ap.working_hours,
            ap.overtime_hours,
            a.status_attendance
        FROM 
            "Employee" e
        LEFT JOIN 
            "Attendance" a ON e.employee_id = a.employee_id
        LEFT JOIN
            "Attendance_projects" ap ON a.id = ap.attendance_id
        LEFT JOIN
            projects p ON ap.project_id = p.project_id
        WHERE 
            a.date BETWEEN '2026-01-01' AND '2026-01-31'
        ORDER BY 
            e.employee_id;
    '''
    cursor.execute(query)
    if cursor.description is not None:
        columns = [desc[0] for desc in cursor.description]
        rows = cursor.fetchall()
        df = pd.DataFrame(rows, columns=pd.Index(columns))
    else:
        print("No data returned from the query.")
        df = pd.DataFrame(columns=pd.Index([
            'employee_id', 'name', 'salary', 'project_name', 'working_hours', 'overtime_hours', 'status_attendance'
        ]))

    # Helper: sum overtime hours for an employee filtered by a specific status value
    def sum_overtime_for_status(frame: pd.DataFrame, employee_id, status_value, employee_department=None) -> float:
        mask = (frame['employee_id'] == employee_id) & (frame['status_attendance'] == status_value)
        if employee_department is not None and 'employee_department' in frame.columns:
            mask = mask & (frame['employee_department'] == employee_department)
        return pd.to_numeric(frame.loc[mask, 'overtime_hours'], errors='coerce').fillna(0).sum()

    if not df.empty:
        # Define status deductions (hours to deduct for each status)
        status_deductions = {
            'AWO': 16,  # Absent without leave - deduct 2 days (16 hours)
            'A': 8,    # Annual leave - deduct 1 day (8 hours)
        }
        
        # Calculate total deductions per employee
        employee_deductions = df.groupby(['employee_id', 'name', 'salary', 'employee_department']).agg({
            'status_attendance': lambda x: sum(status_deductions.get(status, 0) for status in x if status in status_deductions)
        }).reset_index()
        employee_deductions.rename(columns={'status_attendance': 'total_deductions'}, inplace=True)
        
        # Calculate AWO count per employee
        awo_count = df.groupby(['employee_id', 'name', 'salary', 'employee_department']).agg({
            'status_attendance': lambda x: sum(1 for status in x if status == 'Absence without excuse')
        }).reset_index()
        awo_count.rename(columns={'status_attendance': 'awo_count'}, inplace=True)
        
        # Group and pivot
        pivot = df.groupby(['employee_id', 'name', 'salary', 'employee_department', 'project_name']).agg({
            'working_hours': 'sum',
            'overtime_hours': 'sum'
        }).reset_index()

        # Pivot so each project_name becomes columns (metrics first, then project)
        final = pivot.pivot_table(
            index=['employee_id', 'name', 'salary', 'employee_department'],
            columns=['project_name'],
            values=['working_hours', 'overtime_hours'],
            fill_value=0
        )

        # Swap levels so project is top-level, then metric
        final = final.swaplevel(axis=1)
        final = final.sort_index(axis=1, level=0)
        final = final.infer_objects(copy=False)

        # Convert per-project overtime hours to monetary amount using salary/248 * (hours * rate_by_status)
        salary_values = pd.to_numeric(final.index.get_level_values('salary'), errors='coerce')
        # Keep raw working hours per employee (before per-project conversion) for downstream totals/deductions
        total_working_hours_raw = final.xs('working_hours', axis=1, level=1).sum(axis=1)

        # Convert per-project working hours to monetary amount using salary/248 * hours
        for project in final.columns.get_level_values(0).unique():
            working_col = (project, 'working_hours')
            if working_col in final.columns:
                project_working = pd.to_numeric(final[working_col], errors='coerce').fillna(0)
                final[working_col] = salary_values / 248 * project_working

        # Sum overtime per employee/project/status so we can apply different rates
        project_status_ot = (
            df.groupby(['employee_id', 'name', 'salary', 'employee_department', 'project_name', 'status_attendance'])['overtime_hours']
              .sum()
              .reset_index()
        )
        # Avoid dtype downcast warnings in future pandas versions
        project_status_ot = project_status_ot.infer_objects(copy=False)
        rate_by_status = {
            'Present': 1.25,
            'Weekend': 1.5,
            'Holiday': 2.5,
        }
        for project in final.columns.get_level_values(0).unique():
            overtime_col = (project, 'overtime_hours')
            if overtime_col in final.columns:
                # Build a weighted hours series per employee for this project based on status rates
                subset = project_status_ot[project_status_ot['project_name'] == project]
                pivot_status = subset.pivot_table(
                    index=['employee_id', 'name', 'salary', 'employee_department'],
                    columns='status_attendance',
                    values='overtime_hours',
                    fill_value=0
                )
                pivot_status = pivot_status.infer_objects(copy=False)
                weighted_hours = pd.Series(0, index=final.index, dtype=float)
                for status, rate in rate_by_status.items():
                    if status in pivot_status.columns:
                        weighted_hours = weighted_hours.add(
                            pd.to_numeric(pivot_status[status], errors='coerce').reindex(final.index, fill_value=0) * rate,
                            fill_value=0
                        )
                final[overtime_col] = salary_values / 248 * weighted_hours

        # Add total columns for each employee (use original sub-column names)
        total_working = total_working_hours_raw
        
        # Apply deductions based on attendance status
        # Create a simple mapping from employee_id to deductions
        deductions_dict = {}
        for _, row in employee_deductions.iterrows():
            key = (str(row['employee_id']), row['employee_department'])
            deductions_dict[key] = row['total_deductions']
        
        # Calculate adjusted working hours for each employee
        adjusted_working_hours = total_working.copy()
        for i, (emp_id, emp_dept) in enumerate(zip(final.index.get_level_values('employee_id'), final.index.get_level_values('employee_department'))):
            emp_key = (str(emp_id), emp_dept)
            deduction = deductions_dict.get(emp_key, 0)
            adjusted_working_hours.iloc[i] = total_working.iloc[i] - deduction
        
        # Add AWO count to final DataFrame
        # Create a mapping from employee_id to AWO count
        awo_dict = {}
        for _, row in awo_count.iterrows():
            key = (str(row['employee_id']), row['employee_department'])
            awo_dict[key] = row['awo_count']
        
        # Add AWO count column to final DataFrame
        awo_count_series = pd.Series(index=final.index, dtype=int)
        
        for i, (emp_id, emp_dept) in enumerate(zip(final.index.get_level_values('employee_id'), final.index.get_level_values('employee_department'))):
            emp_key = (str(emp_id), emp_dept)
            awo_count_series.iloc[i] = awo_dict.get(emp_key, 0)
        
        final[('AWO_Count', 'gg')] = awo_count_series
        
        # Build overtime buckets per employee based on status_attendance letters (P/W/H)
        df['overtime_hours'] = pd.to_numeric(df['overtime_hours'], errors='coerce').fillna(0)
        ot_by_status = (
            df.groupby(['employee_id', 'name', 'salary', 'employee_department', 'status_attendance'])['overtime_hours']
              .sum()
              .reset_index()
        )

        normal_map = ot_by_status.loc[ot_by_status['status_attendance'] == 'P'] \
            .set_index('employee_id')['overtime_hours'].to_dict()
        weekend_map = ot_by_status.loc[ot_by_status['status_attendance'] == 'W'] \
            .set_index('employee_id')['overtime_hours'].to_dict()
        holiday_map = ot_by_status.loc[ot_by_status['status_attendance'] == 'H'] \
            .set_index('employee_id')['overtime_hours'].to_dict()

        ot_normal_series = pd.Series(index=final.index, dtype=int)
        ot_weekend_series = pd.Series(index=final.index, dtype=int)
        ot_holiday_series = pd.Series(index=final.index, dtype=int)

        for i, (emp_id, emp_dept) in enumerate(zip(final.index.get_level_values('employee_id'), final.index.get_level_values('employee_department'))):
            ot_normal_series.iloc[i] = sum_overtime_for_status(df, emp_id, 'Present', emp_dept)
            ot_weekend_series.iloc[i] = sum_overtime_for_status(df, emp_id, 'Weekend', emp_dept)
            ot_holiday_series.iloc[i] = sum_overtime_for_status(df, emp_id, 'Holiday-Work', emp_dept)

        # Expose as separate columns similar to AWO_Count
        final[('OT_Normal', 'gg')] = ot_normal_series
        final[('OT_Weekend', 'gg')] = ot_weekend_series
        final[('OT_Holiday', 'gg')] = ot_holiday_series

        # Get AWO count for each employee to discount from working hours
        awo_count_series = final[('AWO_Count', 'gg')]
        # Calculate total working amount with AWO discount
        # Formula: (salary / 248) * (adjusted_working_hours - AWO_count * 8)
        # Each AWO day = 8 hours deduction
        total_working_amount = salary_values / 248 * (adjusted_working_hours - awo_count_series * 8)
        # Calculate overtime amount with distinct rates per bucket
        rate_normal = 1.25
        rate_weekend = 1.5
        rate_holiday = 2.5
        total_overtime_amount = (
            salary_values / 248 * (
                ot_normal_series * rate_normal
                + ot_weekend_series * rate_weekend
                + ot_holiday_series * rate_holiday
            )
        )
        
        final[('المجموع', 'working_hours')] = total_working_amount
        final[('المجموع', 'overtime_hours')] = total_overtime_amount

        # Re-sort columns so 'المجموع' is at the end
        final = final.reindex(
            columns=sorted([col for col in final.columns if col[0] != 'المجموع'], key=lambda x: x[0]) + [('المجموع', 'working_hours'), ('المجموع', 'overtime_hours')],
            fill_value=0
        )

        # Rename sub-columns to Arabic
        final.columns = pd.MultiIndex.from_tuples([
            (project, 'قيمة الأيام' if metric == 'working_hours' else 'قيمة الإضافي')
            for project, metric in final.columns
        ])

        # Reset index to export
        final.reset_index(inplace=True)
    else:
        # Create an empty DataFrame with expected structure
        final = pd.DataFrame()

    # Export to Excel with multi-level headers, one file per department
    if not final.empty and 'employee_department' in final.columns:
        unique_departments = list(final['employee_department'].dropna().unique())
    else:
        unique_departments = []

    if len(unique_departments) == 0:
        # fallback: single file if no department info
        file_name = 'employee_report_test_September.xlsx'
        with pd.ExcelWriter(file_name, engine='xlsxwriter') as writer:
            final.to_excel(writer, sheet_name='Attendance', index=True)
            worksheet = writer.sheets['Attendance']
            worksheet.set_column('A:A', 5)   # index column
            worksheet.set_column('B:B', 10)  # employee_id
            worksheet.set_column('C:C', 30)  # name
            worksheet.set_column('D:D', 15)  # salary
            worksheet.set_column('E:ZZ', 15)  # projects
        print(f"Excel file created successfully: {os.path.join(os.getcwd(), file_name)}")
    else:
        for dept in unique_departments:
            safe_dept = str(dept).replace(' ', '_')
            file_name = f'employee_report_{safe_dept}2.xlsx'
            dept_df = final[final['employee_department'] == dept]
            with pd.ExcelWriter(file_name, engine='xlsxwriter') as writer:
                dept_df.to_excel(writer, sheet_name='Attendance', index=True)
                worksheet = writer.sheets['Attendance']
                worksheet.set_column('A:A', 5)   # index column
                worksheet.set_column('B:B', 10)  # employee_id
                worksheet.set_column('C:C', 30)  # name
                worksheet.set_column('D:D', 15)  # salary
                worksheet.set_column('E:ZZ', 15)  # projects
            print(f"Excel file created successfully: {os.path.join(os.getcwd(), file_name)}")

except Exception as error:
    print(f"Error: {error}")

finally:
    if 'cursor' in locals():
        cursor.close()
    if 'connection' in locals():
        connection.close()
        print("Database connection closed.")