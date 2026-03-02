import type { ScheduleType } from './types';

// ─── Screen time ──────────────────────────────────────────────────────────────

export const DEFAULT_DAILY_LIMIT = 120; // minutes

export const DEFAULT_REWARD_MINUTES = 15;

// ─── Auth / invite ────────────────────────────────────────────────────────────

export const PIN_LENGTH = 4;

export const INVITE_CODE_LENGTH = 6;

// ─── UI ───────────────────────────────────────────────────────────────────────

export const MAX_AVATARS = 4;

// ─── Default schedules ────────────────────────────────────────────────────────

export const DEFAULT_SCHEDULES: Array<{
  type: ScheduleType;
  label: string;
  start_time: string;
  end_time: string;
  days: number[];
  is_active: boolean;
}> = [
  {
    type: 'sleep',
    label: 'Сон',
    start_time: '21:00',
    end_time: '07:00',
    days: [0, 1, 2, 3, 4, 5, 6],
    is_active: true,
  },
  {
    type: 'school',
    label: 'Школа',
    start_time: '08:00',
    end_time: '16:00',
    days: [1, 2, 3, 4, 5],
    is_active: true,
  },
];

// ─── Sync intervals ───────────────────────────────────────────────────────────

export const USAGE_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
