export interface UsageStat {
  packageName: string;
  /** Total time in foreground in milliseconds */
  totalTimeInForeground: number;
  /** Timestamp of last usage in milliseconds */
  lastTimeUsed: number;
  /** Start of the usage interval in milliseconds */
  firstTimeStamp: number;
  /** End of the usage interval in milliseconds */
  lastTimeStamp: number;
}

export interface PermissionStatus {
  usageStats: boolean;
  accessibility: boolean;
  overlay: boolean;
  deviceAdmin: boolean;
  batteryOpt: boolean;
}
