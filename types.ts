

export type ShiftType = 'בוקר (07:00-15:00)' | 'ערב (15:00-23:00)' | 'לילה (23:00-07:00)';

export interface SiteFault {
  id: string;
  siteNumber: string;
  siteName: string;
  reason: string;
  isPowerIssue: boolean;
  batteryBackupTime?: string;
  treatment: string;
  downtime: string;
  status: 'open' | 'closed';
  createdAt: number;
}

export interface PlannedWork {
  id: string;
  description: string;
  createdAt: number;
}

export interface GeneralNote {
  id: string;
  content: string;
  createdAt: number;
}

export interface ShiftSummary {
  controllers: [string, string];
  shiftType: ShiftType;
  date: string;
}
