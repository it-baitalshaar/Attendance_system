# Office employees: BioTime sync and app edits

**You do not need to change your BioTime script.** The app stores admin edits (department, personal email, etc.) in a separate table that the sync never touches.

---

## How it works

- **`office_employees`** — Your BioTime sync (on the SSH computer) can update this table as it does today (e.g. `employee_code`, `name`, `email`, `device_id`, and optionally `department`).
- **`office_employee_overrides`** — The app stores only the fields that admins edit in Admin → Office Employees → Edit: `department`, `personal_email`, `phone`, `salary`, `min_working_hours`, `max_working_hours`. The BioTime script does not use this table.

When the app shows an employee or runs reports, it **merges** the two: override value wins when present, otherwise the value from `office_employees` is used. So whatever your sync writes to `office_employees` will not overwrite what admins set in the app.

---

## Columns in `office_employee_overrides` (app-only)

| Column               | Notes |
|----------------------|--------|
| `personal_email`     | For work-hours report. |
| `phone`              | Optional. |
| `salary`             | Optional. |
| `min_working_hours`   | Optional. |
| `max_working_hours`  | Optional. |

**Department** is not stored in overrides. It always comes from BioTime (`office_employees.department`) so the sync controls it and reports/filters work correctly.

---

## Optional: safe employee sync script

If you want a **reference** script that syncs employees from BioTime into `office_employees` without overwriting any columns (in case you add such a sync later), see **`scripts/office-biotime-sync-employees.js`**. Your current BioTime script does not need to be changed.
