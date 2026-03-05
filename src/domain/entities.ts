import type { LucideIcon } from 'lucide-react';

export type LicenseStatus = 'valid' | 'expiring' | 'expired';
export type ShiftType = 'day' | 'night' | '24h' | 'off';

export interface Employee {
  id: number;
  name: string;
  post: string;
  licenseDate: string;
  status?: LicenseStatus;
  phone: string;
  medCheck: string;
  periodicCheckDate: string;
  weapon: string;
}

export interface DashboardStat {
  id: number;
  title: string;
  value: string;
  trend: string;
  isPositive: boolean;
  icon: LucideIcon;
}

export interface RecentAlert {
  id: number;
  type: 'sos' | 'warning' | 'info';
  title: string;
  desc: string;
  time: string;
  color: string;
  icon: LucideIcon;
}

export interface SecurityObject {
  id: number;
  name: string;
  type: string;
  address: string;
  postsCount: number;
  posts: string[];
  status: 'active';
  passport: 'valid' | 'updating' | 'missing';
}

export interface WeekDay {
  date: string;
  day: string;
  isWeekend: boolean;
}

export interface ScheduleEntry {
  id: number;
  name: string;
  post: string;
  shifts: ShiftType[];
  hours: number;
}

export interface KhoStat {
  id: number;
  title: string;
  value: string;
  desc: string;
  icon: LucideIcon;
  color: string;
  bg: string;
}

export interface JournalRecord {
  id: number;
  timeOut: string;
  timeIn: string;
  employee: string;
  weapon: string;
  ammo: string;
  status: 'issued' | 'returned';
}

export interface Integration {
  id: number;
  name: string;
  desc: string;
  status: 'connected' | 'disconnected';
  lastSync: string;
  icon: LucideIcon;
  color: string;
  bg: string;
}
