export interface ReminderSetting {
  id: string;
  department: string;
  enabled: boolean;
  reminder_time: string;
  updated_at: string;
}

export interface ReminderEmailRow {
  id: string;
  department: string;
  email: string;
  created_at: string;
}

export type DepartmentKey = 'Construction' | 'maintenance';
