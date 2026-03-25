export interface HomeEmployee {
  employee_id: string;
  name: string;
  position?: string;
  department?: string;
  overtime_enabled?: boolean | null;
}

export interface ReportData {
  date: string;
  department: string;
  submittedBy?: string;
  submittedAt?: string;
  lastEditedBy?: string;
  lastEditedAt?: string;
  present: number;
  absent: number;
  vacation: number;
  nonPresentList: { name: string; status: string; notes?: string | null }[];
}

export interface ExistingSubmission {
  trackId: string;
  submittedBy?: string;
  submittedAt?: string;
  submittedByName?: string | null;
}
