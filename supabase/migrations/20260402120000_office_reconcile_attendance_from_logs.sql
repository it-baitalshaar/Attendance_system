-- Recompute office_attendance.check_in / check_out from office_attendance_logs per office calendar day.
-- Handles devices stuck on "check in" (all logs may be action=checkin): last punch of the day can become checkout
-- when span rules pass. Does not touch rows with method = 'manual'.
--
-- Office calendar day uses Asia/Dubai by default (matches app email logic).

CREATE OR REPLACE FUNCTION public.office_attendance_calendar_date(
  ts timestamptz,
  tz text DEFAULT 'Asia/Dubai'
)
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ((ts AT TIME ZONE tz))::date;
$$;

CREATE OR REPLACE FUNCTION public.office_reconcile_employee_attendance_day(
  p_employee_id uuid,
  p_date date,
  p_tz text DEFAULT 'Asia/Dubai',
  p_min_span_minutes integer DEFAULT 45,
  p_single_punch_checkout_from_hour integer DEFAULT 15
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_method text;
  v_existing_check_in timestamptz;
  v_existing_check_out timestamptz;
  v_cnt integer;
  v_first timestamptz;
  v_last timestamptz;
  v_span interval;
  v_check_in timestamptz;
  v_check_out timestamptz;
  v_hour int;
BEGIN
  IF p_min_span_minutes IS NULL OR p_min_span_minutes < 0 THEN
    p_min_span_minutes := 45;
  END IF;
  IF p_single_punch_checkout_from_hour IS NULL OR p_single_punch_checkout_from_hour < 0 OR p_single_punch_checkout_from_hour > 23 THEN
    p_single_punch_checkout_from_hour := 15;
  END IF;

  SELECT
    oa.method,
    oa.check_in,
    oa.check_out
  INTO v_method
  FROM public.office_attendance oa
  WHERE oa.employee_id = p_employee_id AND oa.date = p_date;

  IF v_method = 'manual' THEN
    RETURN;
  END IF;

  -- If we already have a checkout stored (from BioTime or a previous reconcile), don't change it.
  IF v_existing_check_out IS NOT NULL THEN
    RETURN;
  END IF;

  SELECT
    COUNT(*)::int,
    MIN(l.timestamp),
    MAX(l.timestamp)
  INTO v_cnt, v_first, v_last
  FROM public.office_attendance_logs l
  WHERE l.employee_id = p_employee_id
    AND public.office_attendance_calendar_date(l.timestamp, p_tz) = p_date;

  IF v_cnt IS NULL OR v_cnt = 0 OR v_first IS NULL OR v_last IS NULL THEN
    RETURN;
  END IF;

  -- Keep the existing check_in if present; otherwise set it from logs.
  v_check_in := v_existing_check_in;
  v_check_out := NULL;

  IF v_cnt = 1 THEN
    v_hour := EXTRACT(HOUR FROM (v_first AT TIME ZONE p_tz))::int;
    IF v_hour >= p_single_punch_checkout_from_hour THEN
      IF v_check_in IS NULL THEN v_check_in := v_first; END IF;
      v_check_out := v_first;
    ELSE
      IF v_check_in IS NULL THEN v_check_in := v_first; END IF;
      v_check_out := NULL;
    END IF;
  ELSE
    v_span := v_last - v_first;
    IF v_span >= make_interval(mins => p_min_span_minutes) THEN
      IF v_check_in IS NULL THEN v_check_in := v_first; END IF;
      v_check_out := v_last;
    ELSE
      IF v_check_in IS NULL THEN v_check_in := v_first; END IF;
      v_check_out := NULL;
    END IF;
  END IF;

  INSERT INTO public.office_attendance (
    employee_id,
    date,
    check_in,
    check_out,
    method,
    device
  )
  VALUES (
    p_employee_id,
    p_date,
    v_check_in,
    v_check_out,
    'biometric',
    'BioTime'
  )
  ON CONFLICT (employee_id, date) DO UPDATE
  SET
    -- Only set check_in if we didn't already have it (to avoid shifting min/max unexpectedly).
    check_in = COALESCE(public.office_attendance.check_in, EXCLUDED.check_in),
    check_out = EXCLUDED.check_out,
    device = COALESCE(public.office_attendance.device, EXCLUDED.device),
    method = CASE
      WHEN public.office_attendance.method = 'manual' THEN public.office_attendance.method
      ELSE 'biometric'
    END
  WHERE public.office_attendance.method <> 'manual';
END;
$$;

CREATE OR REPLACE FUNCTION public.office_reconcile_office_day(
  p_date date,
  p_tz text DEFAULT 'Asia/Dubai'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  IF p_date IS NULL THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT DISTINCT l.employee_id
    FROM public.office_attendance_logs l
    WHERE public.office_attendance_calendar_date(l.timestamp, p_tz) = p_date
  LOOP
    PERFORM public.office_reconcile_employee_attendance_day(r.employee_id, p_date, p_tz);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.office_reconcile_office_date_range(
  p_start date,
  p_end date,
  p_tz text DEFAULT 'Asia/Dubai'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d date;
BEGIN
  IF p_start IS NULL OR p_end IS NULL OR p_start > p_end THEN
    RETURN;
  END IF;

  FOR d IN
    SELECT generate_series(p_start, p_end, interval '1 day')::date
  LOOP
    PERFORM public.office_reconcile_office_day(d, p_tz);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.office_attendance_calendar_date(timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.office_attendance_calendar_date(timestamptz, text) TO service_role;

REVOKE ALL ON FUNCTION public.office_reconcile_employee_attendance_day(uuid, date, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.office_reconcile_employee_attendance_day(uuid, date, text, integer, integer) TO service_role;

REVOKE ALL ON FUNCTION public.office_reconcile_office_day(date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.office_reconcile_office_day(date, text) TO service_role;

REVOKE ALL ON FUNCTION public.office_reconcile_office_date_range(date, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.office_reconcile_office_date_range(date, date, text) TO service_role;

COMMENT ON FUNCTION public.office_reconcile_office_day(date, text) IS
  'Rebuilds office_attendance in/out for one office-calendar day from logs (Asia/Dubai). Ignores punch_state; fills checkout only when office_attendance.check_out is NULL. Skips method=manual.';
