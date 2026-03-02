// ─── Enums ────────────────────────────────────────────────────────────────────

export type UserRole = 'parent' | 'child';

export type Lang = 'ru' | 'kz';

export type FamilyStatus = 'pending' | 'active' | 'paused';

export type TaskStatus = 'pending' | 'done' | 'approved' | 'rejected';

export type AppCategory =
  | 'games'
  | 'social'
  | 'education'
  | 'entertainment'
  | 'communication'
  | 'other';

export type AppRuleCategory = 'limited' | 'always' | 'blocked';

export type ScheduleType = 'sleep' | 'school' | 'custom';

export type SubPlan = 'free' | 'standard' | 'premium';

// ─── DB Row Types ─────────────────────────────────────────────────────────────
// NOTE: These MUST be `type` aliases (not `interface`) so they satisfy
// Record<string, unknown> which the Supabase SDK's GenericSchema requires.

export type User = {
  id: string;
  family_id: string | null;
  role: UserRole;
  name: string;
  avatar_index: number;
  age: number | null;
  lang: Lang;
  pin_hash: string | null;
  push_token: string | null;
  created_at: string;
};

export type Family = {
  id: string;
  name: string;
  invite_code: string;
  owner_id: string;
  parent_id: string | null;
  child_id: string | null;
  parent_pin: string | null;
  status: FamilyStatus;
  created_at: string;
};

export type Task = {
  id: string;
  family_id: string;
  child_id: string;
  created_by: string;
  title: string;
  description: string | null;
  reward_minutes: number;
  status: TaskStatus;
  requested_by_child: boolean;
  due_date: string | null;
  completed_at: string | null;
  approved_at: string | null;
  created_at: string;
};

export type ScreenTime = {
  id: string;
  child_id: string;
  date: string;
  daily_limit_minutes: number;
  used_minutes: number;
  bonus_minutes: number;
  daily_limit: number;
  used_today: number;
  streak_days: number;
  balance_minutes: number;
  is_blocked: boolean;
  updated_at: string;
};

export type AppRule = {
  id: string;
  family_id: string;
  package_name: string;
  app_name: string;
  category: AppRuleCategory;
  created_at: string;
};

export type Schedule = {
  id: string;
  family_id: string;
  type: ScheduleType;
  label: string | null;
  start_time: string; // "HH:MM"
  end_time: string;   // "HH:MM"
  days: number[];     // 0=Sun … 6=Sat
  is_active: boolean;
  created_at: string;
};

export type UsageLog = {
  id: string;
  child_id: string;
  package_name: string;
  app_name: string | null;
  date: string;
  minutes: number;
};

export type GpsLocation = {
  id: string;
  child_id: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  recorded_at: string;
};

export type Subscription = {
  id: string;
  family_id: string;
  plan: SubPlan;
  price_tenge: number;
  started_at: string;
  expires_at: string | null;
  kaspi_order_id: string | null;
  auto_renew: boolean;
};

// ─── Database helper type (for Supabase generics) ─────────────────────────────

// Insert: fields with DB defaults or nullable become optional
// Update: all fields except id are optional (Partial)

export type Database = {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: Pick<User, 'id' | 'role' | 'name'> & Partial<Omit<User, 'id' | 'role' | 'name'>>;
        Update: Partial<Omit<User, 'id'>>;
        Relationships: [];
      };
      families: {
        Row: Family;
        Insert: Pick<Family, 'name' | 'invite_code' | 'owner_id'> & Partial<Omit<Family, 'name' | 'invite_code' | 'owner_id'>>;
        Update: Partial<Omit<Family, 'id'>>;
        Relationships: [];
      };
      tasks: {
        Row: Task;
        Insert: Pick<Task, 'family_id' | 'child_id' | 'created_by' | 'title' | 'reward_minutes' | 'status'> & Partial<Omit<Task, 'family_id' | 'child_id' | 'created_by' | 'title' | 'reward_minutes' | 'status'>>;
        Update: Partial<Omit<Task, 'id'>>;
        Relationships: [];
      };
      screen_time: {
        Row: ScreenTime;
        Insert: Pick<ScreenTime, 'child_id'> & Partial<Omit<ScreenTime, 'child_id'>>;
        Update: Partial<Omit<ScreenTime, 'id'>>;
        Relationships: [];
      };
      app_rules: {
        Row: AppRule;
        Insert: Pick<AppRule, 'family_id' | 'package_name' | 'app_name'> & Partial<Omit<AppRule, 'family_id' | 'package_name' | 'app_name'>>;
        Update: Partial<Omit<AppRule, 'id'>>;
        Relationships: [];
      };
      schedules: {
        Row: Schedule;
        Insert: Pick<Schedule, 'family_id' | 'type' | 'start_time' | 'end_time'> & Partial<Omit<Schedule, 'family_id' | 'type' | 'start_time' | 'end_time'>>;
        Update: Partial<Omit<Schedule, 'id'>>;
        Relationships: [];
      };
      usage_logs: {
        Row: UsageLog;
        Insert: Pick<UsageLog, 'child_id' | 'package_name' | 'date'> & Partial<Omit<UsageLog, 'child_id' | 'package_name' | 'date'>>;
        Update: Partial<Omit<UsageLog, 'id'>>;
        Relationships: [];
      };
      gps_locations: {
        Row: GpsLocation;
        Insert: Pick<GpsLocation, 'child_id' | 'lat' | 'lng'> & Partial<Omit<GpsLocation, 'child_id' | 'lat' | 'lng'>>;
        Update: Partial<Omit<GpsLocation, 'id'>>;
        Relationships: [];
      };
      subscriptions: {
        Row: Subscription;
        Insert: Pick<Subscription, 'family_id'> & Partial<Omit<Subscription, 'family_id'>>;
        Update: Partial<Omit<Subscription, 'id'>>;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never
    };
    Functions: {
      [_ in never]: never
    };
  };
};
