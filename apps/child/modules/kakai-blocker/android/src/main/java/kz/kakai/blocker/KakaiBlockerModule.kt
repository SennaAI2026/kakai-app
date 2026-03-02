package kz.kakai.blocker

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class KakaiBlockerModule : Module() {

    companion object {
        private const val PREFS_NAME = "kakai_blocker_prefs"
        private const val KEY_BLOCKED_APPS = "blocked_apps"
        private const val KEY_BLOCKING_ENABLED = "blocking_enabled"
    }

    private val context: Context
        get() = appContext.reactContext ?: throw IllegalStateException("React context is null")

    private val prefs: SharedPreferences
        get() = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private val usageTracker: UsageTracker
        get() = UsageTracker(context)

    override fun definition() = ModuleDefinition {
        Name("KakaiBlocker")

        // ── Permission checks ──────────────────────────────────────────

        Function("hasUsageStatsPermission") {
            PermissionChecker.hasUsageStatsPermission(context)
        }

        Function("hasAccessibilityPermission") {
            PermissionChecker.hasAccessibilityPermission(context)
        }

        Function("hasOverlayPermission") {
            PermissionChecker.hasOverlayPermission(context)
        }

        Function("hasDeviceAdminPermission") {
            PermissionChecker.hasDeviceAdminPermission(context)
        }

        Function("hasBatteryOptPermission") {
            PermissionChecker.hasBatteryOptPermission(context)
        }

        // ── Permission requests ────────────────────────────────────────

        Function("requestUsageStats") {
            val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        }

        Function("requestAccessibility") {
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        }

        Function("requestOverlay") {
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:${context.packageName}")
            ).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        }

        Function("requestDeviceAdmin") {
            val adminComponent = ComponentName(context, KakaiDeviceAdmin::class.java)
            val intent = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN).apply {
                putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, adminComponent)
                putExtra(
                    DevicePolicyManager.EXTRA_ADD_EXPLANATION,
                    "Kakai нужны права администратора для защиты приложения от удаления"
                )
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        }

        Function("requestBatteryOpt") {
            val intent = Intent(
                Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                Uri.parse("package:${context.packageName}")
            ).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        }

        // ── Usage Stats ────────────────────────────────────────────────

        Function("getUsageStats") { startTime: Long, endTime: Long ->
            val stats = usageTracker.queryUsageStats(startTime, endTime)
            stats.map { bundle ->
                mapOf(
                    "packageName" to (bundle.getString("packageName") ?: ""),
                    "totalTimeInForeground" to bundle.getLong("totalTimeInForeground"),
                    "lastTimeUsed" to bundle.getLong("lastTimeUsed"),
                    "firstTimeStamp" to bundle.getLong("firstTimeStamp"),
                    "lastTimeStamp" to bundle.getLong("lastTimeStamp")
                )
            }
        }

        // ── Blocked apps management ────────────────────────────────────

        Function("setBlockedApps") { packages: List<String> ->
            prefs.edit()
                .putStringSet(KEY_BLOCKED_APPS, packages.toSet())
                .apply()
        }

        Function("getBlockedApps") {
            val apps = prefs.getStringSet(KEY_BLOCKED_APPS, emptySet()) ?: emptySet()
            apps.toList()
        }

        // ── Blocking toggle ────────────────────────────────────────────

        Function("setBlockingEnabled") { enabled: Boolean ->
            prefs.edit()
                .putBoolean(KEY_BLOCKING_ENABLED, enabled)
                .apply()
        }

        Function("isBlockingEnabled") {
            prefs.getBoolean(KEY_BLOCKING_ENABLED, true)
        }
    }
}
