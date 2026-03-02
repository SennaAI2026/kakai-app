import { requireNativeModule } from "expo-modules-core";
import type { UsageStat, PermissionStatus } from "./KakaiBlocker.types";

const KakaiBlocker = requireNativeModule("KakaiBlocker");

// ── Permission checks ──────────────────────────────────────────────

export function hasUsageStatsPermission(): boolean {
  return KakaiBlocker.hasUsageStatsPermission();
}

export function hasAccessibilityPermission(): boolean {
  return KakaiBlocker.hasAccessibilityPermission();
}

export function hasOverlayPermission(): boolean {
  return KakaiBlocker.hasOverlayPermission();
}

export function hasDeviceAdminPermission(): boolean {
  return KakaiBlocker.hasDeviceAdminPermission();
}

export function hasBatteryOptPermission(): boolean {
  return KakaiBlocker.hasBatteryOptPermission();
}

export function getAllPermissions(): PermissionStatus {
  return {
    usageStats: hasUsageStatsPermission(),
    accessibility: hasAccessibilityPermission(),
    overlay: hasOverlayPermission(),
    deviceAdmin: hasDeviceAdminPermission(),
    batteryOpt: hasBatteryOptPermission(),
  };
}

// ── Permission requests ────────────────────────────────────────────

export function requestUsageStats(): void {
  KakaiBlocker.requestUsageStats();
}

export function requestAccessibility(): void {
  KakaiBlocker.requestAccessibility();
}

export function requestOverlay(): void {
  KakaiBlocker.requestOverlay();
}

export function requestDeviceAdmin(): void {
  KakaiBlocker.requestDeviceAdmin();
}

export function requestBatteryOpt(): void {
  KakaiBlocker.requestBatteryOpt();
}

// ── Usage Stats ────────────────────────────────────────────────────

export function getUsageStats(
  startTime: number,
  endTime: number
): UsageStat[] {
  return KakaiBlocker.getUsageStats(startTime, endTime);
}

// ── Blocked apps management ────────────────────────────────────────

export function setBlockedApps(packages: string[]): void {
  KakaiBlocker.setBlockedApps(packages);
}

export function getBlockedApps(): string[] {
  return KakaiBlocker.getBlockedApps();
}

// ── Blocking toggle ────────────────────────────────────────────────

export function setBlockingEnabled(enabled: boolean): void {
  KakaiBlocker.setBlockingEnabled(enabled);
}

export function isBlockingEnabled(): boolean {
  return KakaiBlocker.isBlockingEnabled();
}

// ── Re-export types ────────────────────────────────────────────────

export type { UsageStat, PermissionStatus } from "./KakaiBlocker.types";
