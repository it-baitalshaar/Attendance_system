-- Updates office_reconcile_employee_attendance_day with new punch rules:
--   • Single punch before 11:00 → check-in only
--   • Single punch at/after 11:00 → check-out only (check-in also set to that punch)
--   • 2+ punches → first = check-in, last = check-out (no minimum span required)
--   • Friday is a global half-day; worked_hours ceiling set to 4 when day is Friday
-- No table changes — only replaces the existing function.

CREATE OR REPLACE FUNCTION public.office_reconcile_employee_attendance_day(
  p_employee_id uuid,
  p_date date,
  p_tz text DEFAULT 'Asia/Dubai',
  p_min_span_minutes integer DEFAULT 45,              -- kept for signature compatibility, no longer used
  p_single_punch_checkout_from_hour integer DEFAULT 11 -- before 11:00 = check-in, 11:00+ = check-out
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_method           text;
  v_existing_check_in  timestamptz;
  v_existing_check_out timestamptz;
  v_cnt              integer;
  v_first            timestamptz;
  v_last             timestamptz;
  v_check_in         timestamptz;
  v_check_out        timestamptz;
  v_hour             int;
  v_is_friday        boolean;
  v_worked_hours     numeric;
BEGIN
  -- Clamp parameter
  IF p_single_punch_checkout_from_hour IS NULL
     OR p_single_punch_checkout_from_hour < 0
     OR p_single_punch_checkout_from_hour > 23
  THEN
    p_single_punch_checkout_from_hour := 11;
  END IF;

  -- Read existing record (if any)
  SELECT oa.method, oa.check_in, oa.check_out
  INTO v_method, v_existing_check_in, v_existing_check_out
  FROM public.office_attendance oa
  WHERE oa.employee_id = p_employee_id AND oa.date = p_date;

  -- Never overwrite manual entries
  IF v_method = 'manual' THEN
    RETURN;
  END IF;

  -- Read raw punch logs for this employee on this date
  SELECT
    COUNT(*)::int,
    MIN(l.timestamp),
    MAX(l.timestamp)
  INTO v_cnt, v_first, v_last
  FROM public.office_attendance_logs l
  WHERE l.employee_id = p_employee_id
    AND public.office_attendance_calendar_date(l.timestamp, p_tz) = p_date;

  IF v_cnt IS NULL OR v_cnt = 0 OR v_first IS NULL THEN
    RETURN;
  END IF;

  -- Determine Friday (globally a half-day)
  v_is_friday := EXTRACT(DOW FROM p_date) = 5;

  IF v_cnt = 1 THEN
    v_hour := EXTRACT(HOUR FROM (v_first AT TIME ZONE p_tz))::int;
    IF v_hour >= p_single_punch_checkout_from_hour THEN
      -- Late punch → treat as check-out; also record it as check-in if none exists
      v_check_in  := COALESCE(v_existing_check_in, v_first);
      v_check_out := v_first;
    ELSE
      -- Early punch → check-in only
      v_check_in  := COALESCE(v_existing_check_in, v_first);
      v_check_out := NULL;
    END IF;
  ELSE
    -- 2+ punches: first = check-in, last = check-out (no span requirement)
    v_check_in  := COALESCE(v_existing_check_in, v_first);
    v_check_out := v_last;
  END IF;

  -- Compute worked_hours from resolved times
  IF v_check_in IS NOT NULL AND v_check_out IS NOT NULL THEN
    v_worked_hours := EXTRACT(EPOCH FROM (v_check_out - v_check_in)) / 3600.0;
    -- Cap at 4 hours on Fridays (global half-day)
    IF v_is_friday THEN
      v_worked_hours := LEAST(v_worked_hours, 4);
    END IF;
  ELSE
    v_worked_hours := NULL;
  END IF;

  INSERT INTO public.office_attendance (
    employee_id,
    date,
    check_in,
    check_out,
    worked_hours,
    method,
    device
  )
  VALUES (
    p_employee_id,
    p_date,
    v_check_in,
    v_check_out,
    v_worked_hours,
    'biometric',
    'BioTime'
  )
  ON CONFLICT (employee_id, date) DO UPDATE
  SET
    check_in     = COALESCE(public.office_attendance.check_in, EXCLUDED.check_in),
    check_out    = COALESCE(EXCLUDED.check_out, public.office_attendance.check_out),
    worked_hours = COALESCE(EXCLUDED.worked_hours, public.office_attendance.worked_hours),
    device       = COALESCE(public.office_attendance.device, EXCLUDED.device),
    method       = CASE
                     WHEN public.office_attendance.method = 'manual' THEN public.office_attendance.method
                     ELSE 'biometric'
                   END
  WHERE public.office_attendance.method <> 'manual';
END;
$$;

COMMENT ON FUNCTION public.office_reconcile_employee_attendance_day(uuid, date, text, integer, integer) IS
  'Rebuilds office_attendance check_in/check_out from logs. Rules: single punch <11:00 = check-in only; >=11:00 = check-out. 2+ punches = first/last. Friday capped at 4 worked hours. Skips method=manual.';
