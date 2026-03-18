export type OfficeReportDepartmentKey = 'Bait Alshaar' | 'Al Saqia';

export interface OfficeReportSetting {
  id: string;
  department: string;
  enabled: boolean;
  report_time: string;
  updated_at: string;
}

export interface OfficeReportEmailRow {
  id: string;
  department: string;
  email: string;
  created_at: string;
}
