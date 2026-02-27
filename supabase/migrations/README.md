# Supabase migrations

Run these in **Supabase Dashboard → SQL Editor** (or with `supabase db push` if you use the CLI).

## Migrations in this folder

- **add_department_theme_id.sql** – Department theme (if used).
- **add_employee_salary_and_history.sql** – For the **Manage Employee** feature:
  - Adds optional `salary` column to `Employee` (no change to existing rows).
  - Creates `Employee_history` table so the History section in the Manage Employee modal can store and show change history.

After running `add_employee_salary_and_history.sql`:
- You can set/edit **Salary** when adding or managing employees.
- The **History** section in the Manage Employee modal will show entries after you save changes (e.g. "updated — Name: …; Position: …").

## If you get "column Employee(id) does not exist"

Your `Employee` table may use `employee_id` as the primary key and have no `id` column. The migration above uses `REFERENCES "Employee"(employee_id)` and `employee_id text` in `Employee_history` for that case. If your `Employee.employee_id` type is different (e.g. `varchar(20)`), the migration should still work; if it fails, change the `employee_id` column type in the `CREATE TABLE` to match your `Employee.employee_id` type.
