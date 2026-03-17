## Office BioTime Sync (Option 1: run locally)

This setup is intended for the PC/server that already has an SSH tunnel to the
BioTime appliance. The machine must also have outbound internet access to your
Supabase project.

### 1. Setup

1. Copy and fill environment variables:
   ```sh
   cd /path/to/your/repo
   cp scripts/office-biotime-sync.env.example .env
   # edit `.env` and provide real values for SUPABASE_URL,
   # SUPABASE_SERVICE_ROLE_KEY and BIOTIME_BASE_URL. Add
   # BIOTIME_AUTH_HEADER if needed.
   ```

   By default the generic sync (employees+punches) will run.  To use the
   **Office biometric sync** instead, set
   `BIOTIME_SYNC_TARGET=office` and ensure the tables described below exist
   in your schema (see section 2).

   The office mode pulls from the standard BioTime transaction endpoint and
   populates four tables: `office_employees`, `office_attendance_logs`,
   `office_attendance` and `office_qr_sessions` (QR sessions are optional).
   You only need the first three for the automatic sync; they must have the
   following columns:

   * `office_employees`: `id uuid primary key`, `employee_code text UNIQUE`,
     `device_id text` (optional).
   * `office_attendance_logs`: `id uuid primary key`,
     `employee_id uuid references office_employees(id)`,
     `action text`, `method text`, `timestamp timestamptz`,
     unique constraint on `(employee_id,action,method,timestamp)`.
   * `office_attendance`: `id uuid primary key`, `employee_id uuid`,
     `date date`, `check_in timestamptz`, `check_out timestamptz`,
     `method text`, unique constraint on `(employee_id,date)`.

   These are the only columns the script touches; you may add more fields
   as needed by your app.

   Transactions are fetched from the path configured by
   `BIOTIME_TRANSACTIONS_PATH` (default `/att/api/transactionReport/`).
   Each record should include at least:

   * `employee_code` – maps to `office_employees.employee_code`.
   * `punch_time` – ISO datetime string used for `timestamp`.
   * `punch_state` – integer `0` for check‑in, `1` for check‑out.

   (the script normalizes common alternate names such as `emp_code` or
   `datetime`).

   Optionally, if you need to log in to the BioTime API and fetch a JWT or
   general auth token (as described in the API docs), add the following
   variables to the same `.env` file and then run `node scripts/get-auth-token.js`:

   ```sh
   BASE_URL="http://zkeco.xmzkteco.com:8097"   # or your local server URL
   BIOTIME_USERNAME="admin"
   BIOTIME_PASSWORD="Dns@2020"
2. Make sure the workspace has the required dependencies. From the repo root:
   ```sh
   npm install @supabase/supabase-js dotenv
   ```
   (if you already run `npm install` for other parts of the project this may
   already be satisfied).

3. Run the script once to verify it works:
   ```powershell
   # generic mode (default)
   node scripts/office-biotime-sync.js

   # office mode (maps into office_* tables)
   $env:BIOTIME_SYNC_TARGET="office"; node scripts/office-biotime-office-sync.js
   ```
   You should see console output showing the number of transactions
   processed, along with counts of unknown/invalid rows.

   If you later run the built‑in web server (`npm start`) the dashboard at
   `/` will automatically query the appropriate tables based on
   `BIOTIME_SYNC_TARGET`.

### 2. Schedule periodic execution

There are two common approaches:

* **Task Scheduler / cron** – directly run the sync script every 5 minutes as
  shown below.
* **Persistent web server** – launch a Node process that calls the sync and
  exposes `/status` and `/sync` endpoints.  This is handy if you want a
  lightweight dashboard or avoid configuring Task Scheduler.

#### Option A: Task Scheduler (existing instructions)

Windows Task Scheduler can invoke the script every few minutes without Docker.
Example task configuration:

- **Program/script:** `node`
- **Add arguments (optional):** `scripts/office-biotime-sync.js`
- **Start in (optional):** `C:\Users\USER\Desktop\al-saqiya\biotime_script`
- **Trigger:** daily, repeat task every 5 minutes for a duration of 1 day,
  enabled.

#### Option B: Run the built‑in server

1. Install additional dependencies (only once):
   ```powershell
   npm install express node-cron
   ```
2. Start the server (port may be changed via `PORT` environment variable):
   ```powershell
   # default port 3000
   node server.js

   # use a different port if 3000 is occupied
   $env:PORT=4000; node server.js          # PowerShell
   # or (cmd.exe) set PORT=4000&& node server.js
   ```
3. Server behaviour:
   * automatically triggers a sync every 5 minutes
   * `GET /sync` runs a one‑off sync and returns the last-run JSON
   * `GET /status` returns `{ timestamp, success, message }` for the most
     recent attempt

   access the dashboard at `http://localhost:<port>/`

The server logs success or errors to the console so you can use any process
manager or Task Scheduler to keep `node server.js` running on the tunnel PC.


Alternatively, wrap the node command in a small PowerShell script if you
prefer.

> **Note:** the `Start in` field is important; otherwise the relative imports
> may break.

### 2. Office‑module synchronous logic

When running in `office` mode the script performs the following steps for
each BioTime transaction fetched:

1. **Validate** – skip rows lacking `employee_code`, `punch_time`, or with
   an invalid `punch_state` (must be `0` or `1`).
2. **Map employee** – look up `office_employees.id` where
   `employee_code` matches; unknown codes are skipped and counted.
3. **Insert log** – upsert into `office_attendance_logs` with
   `(employee_id,action,method,timestamp)`; duplicates are ignored by the
   unique constraint.
4. **Update daily summary** – compute the date portion of the punch;
   load any existing `office_attendance` record for that employee/date and
   adjust `check_in` (min) or `check_out` (max) accordingly.  Preserve
   `method='manual'` if already set, otherwise mark `biometric`.

Dedupe rules:

* `office_attendance_logs` has a unique constraint on
  `(employee_id,action,method,timestamp)` so the same biometric punch is
  never processed twice.
* `office_attendance` is keyed by `(employee_id,date)` ensuring one row per
  employee/day; the script merges multiple punches.

Optional:

* you can track the last synced timestamp by writing a simple cursor table
  and only fetching new transactions – the current implementation pulls
  everything and relies on the database constraints to ignore duplicates.

The generic sync (employees + punches) is unchanged and remains useful for
other workflows; run it with `npm run sync` or leave `BIOTIME_SYNC_TARGET`
unset.

### 3. Departmental report (check‑in/out hours)

A simple helper script is provided to compute daily and monthly hours for
employees in the `al saqia` and `baitalshaar` departments. It reads the
same Supabase tables populated by the sync script.

Usage example:

```powershell
# ensure your .env has SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
# (and optionally BIOTIME_BASE_URL if you also run the sync here)
node scripts/report-departments.js 2026-01-01 2026-01-31
```

If you omit the date arguments the script defaults to the current calendar
month.  The output prints each employee's daily totals followed by their
monthly total, plus a grand total for both departments.

> ⚠️ The JavaScript assumes the following column names; modify them if your
> schema differs:
>
> * `biotime_employees`: `id`, `name`, `department`
> * `biotime_punches`: `employeeId`, `datetime`, `type` (where `type` marks
>   an "in" vs "out" punch, e.g. `'in'`/`'out'` or `0`/`1`)

### 4. Vercel cron reminder

The original project previously included a `vercel.json` cron entry calling
`/api/office/biotime/sync`. That cron will fail when Vercel cannot reach your
local BioTime instance, so **disable or remove** the cron if you switch to a
local sync (Option 1). If you still want the cron, run the sync server-side and
have the cron hit that instead.

### 4. Troubleshooting

- If the script complains about missing tables, ensure your Supabase schema
  contains `biotime_employees` and `biotime_punches` (or change the constant
  names in the script).
- Adjust the BioTime API paths (`/employees`, `/punches`) in the script to
  match what your device exposes.
- Run the script manually and inspect output before scheduling.

### 5. BioTime API authentication (reference)

The BioTime device exposes two token endpoints used by the helper scripts:

#### JWT Auth Token

- **Method:** POST
- **URL:** `/jwt-api-token-auth/`
- **Headers:** `Content-Type: application/json`
- **Body:**
  ```json
  { "username": "<user>", "password": "<pass>" }
  ```
- **Response:**
  ```json
  { "token": "eyJhbGciOiJI..." }
  ```

#### General API Token

- **Method:** POST
- **URL:** `/api-token-auth/`
- **Headers:** `Content-Type: application/json`
- **Body:** same as above
- **Response:**
  ```json
  { "token": "gP4K...biHUoy" }
  ```

#### Examples

_Python (requests)_
```python
import json, requests
url = "http://zkeco.xmzkteco.com:8097/jwt-api-token-auth/"
headers = {"Content-Type": "application/json"}
data = {"username": "admin", "password": "admin"}
response = requests.post(url, data=json.dumps(data), headers=headers)
print(response.text)
```

_Java_ (see original doc block above) – request JSON, read response.

_Additional GET example_:

```python
import requests
url = "http://zkeco.xmzkteco.com:8097/personnel/api/areas/"
# use General token
headers = {
    "Content-Type": "application/json",
    "Authorization": "Token ae600......2b7",
}
# or use JWT token
headers = {
    "Content-Type": "application/json",
    "Authorization": "JWT ey.........oQi98",
}
response = requests.get(url, headers=headers)
print(response.text)
```

Java GET example:
```java
public static String doGet(String httpUrl, String token){
    HttpURLConnection connection = null;
    InputStream is = null;
    BufferedReader br = null;
    String result = null;
    try {
        URL url = new URL(httpUrl);
        connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod("GET");
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(60000);
        connection.setRequestProperty("Content-Type", "application/json");
        connection.setRequestProperty("Authorization", token);
        connection.connect();
        if (connection.getResponseCode() == 200) {
            is = connection.getInputStream();
            br = new BufferedReader(new InputStreamReader(is, "UTF-8"));
            StringBuffer sbf = new StringBuffer();
            String temp = null;
            while ((temp = br.readLine()) != null) {
                sbf.append(temp);
                sbf.append("\r\n");
            }
            result = sbf.toString();
        }
    } catch (Exception e) {
        e.printStackTrace();
    } finally {
        try { if (br != null) br.close(); } catch (IOException e) { e.printStackTrace(); }
        try { if (is != null) is.close(); } catch (IOException e) { e.printStackTrace(); }
        if (connection != null) connection.disconnect();
    }
    return result;
}

public static void main(String[] args){
    final String url = "http://zkeco.xmzkteco.com:8097/personnel/api/areas/";
    final String token = "Token ae600......2b7";
    String result = doGet(url, token);
}
```

> Add these URLs/credentials to `.env` (`BASE_URL`, `BIOTIME_USERNAME`, `BIOTIME_PASSWORD`) if
> you want the sync script to automatically authenticate before fetching
> employees/punches (it will store the returned token in `BIOTIME_AUTH_HEADER`).

---

### Employee endpoints

All of the following require an `Authorization: JWT <token>` header (or the
general token directly instead of "JWT").

#### List employees

- **Method**: GET
- **URL**: `/personnel/api/employees/`
- **Query parameters**: `page`, `page_size`, `emp_code`,
  `emp_code_icontains`, `first_name`, etc. filterable fields as documented.
- **Response**: paginated JSON with `data` array of employee objects.

#### Read employee

- **Method**: GET
- **URL**: `/personnel/api/employees/{id}/`
- **Response**: single employee object (see docs above for full schema).

#### Create employee

- **Method**: POST
- **URL**: `/personnel/api/employees/`
- **Body**: JSON containing `emp_code`, `department`, `area` list, plus
  optional fields like `hire_date`, `first_name`, etc.
- **Response**: newly created employee object.

#### Update employee

- **Method**: PUT
- **URL**: `/personnel/api/employees/{id}/`
- **Body**: same structure as create
- **Response**: updated employee object.

#### Delete employee

- **Method**: DELETE
- **URL**: `/personnel/api/employees/{id}/`
- **Response**: none (204).

#### Bulk operations

* **Adjust area** – POST `/personnel/api/employees/adjust_area/` with
  `{ employees: [ids], areas: [areaIds] }`.
* **Adjust department** – POST `/personnel/api/employees/adjust_department/`
  with `{ employees: [ids], department: deptId }`.
* **Adjust resign** – POST `/personnel/api/employees/adjust_regsin/`
  including resign_date, resign_type, reason, disableatt.
* **Delete bio template** – POST `/personnel/api/employees/del_bio_template/`
  with options `finger_print`, `face`, etc.
* **Resync to device** – POST `/personnel/api/employees/resync_to_device/`
  sending `{ employees: [ids] }`.

(Refer to earlier request body examples for required fields.)

