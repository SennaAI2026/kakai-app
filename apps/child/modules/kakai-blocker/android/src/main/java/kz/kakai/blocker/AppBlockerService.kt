package kz.kakai.blocker

import android.accessibilityservice.AccessibilityService
import android.content.SharedPreferences
import android.util.Log
import android.view.accessibility.AccessibilityEvent

class AppBlockerService : AccessibilityService() {

    companion object {
        private const val TAG = "AppBlockerService"
        private const val PREFS_NAME = "kakai_blocker_prefs"
        private const val KEY_BLOCKED_APPS = "blocked_apps"
        private const val KEY_BLOCKING_ENABLED = "blocking_enabled"

        var instance: AppBlockerService? = null
            private set
    }

    private lateinit var prefs: SharedPreferences
    private lateinit var overlayManager: OverlayManager
    private var lastBlockedPackage: String? = null

    override fun onCreate() {
        super.onCreate()
        prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        overlayManager = OverlayManager(this)
        instance = this
        Log.d(TAG, "AppBlockerService created")
    }

    override fun onDestroy() {
        super.onDestroy()
        overlayManager.hideLockScreen()
        instance = null
        Log.d(TAG, "AppBlockerService destroyed")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
        if (!isBlockingEnabled()) return

        val packageName = event.packageName?.toString() ?: return

        // Don't block our own app, system UI, or launchers
        if (isSystemPackage(packageName)) {
            if (overlayManager.isShowing && packageName != lastBlockedPackage) {
                overlayManager.hideLockScreen()
                lastBlockedPackage = null
            }
            return
        }

        val blockedApps = getBlockedApps()

        if (blockedApps.contains(packageName)) {
            Log.d(TAG, "Blocking app: $packageName")
            lastBlockedPackage = packageName
            if (!overlayManager.isShowing) {
                overlayManager.showLockScreen()
            }
        } else {
            if (overlayManager.isShowing) {
                overlayManager.hideLockScreen()
                lastBlockedPackage = null
            }
        }
    }

    override fun onInterrupt() {
        Log.d(TAG, "AppBlockerService interrupted")
        overlayManager.hideLockScreen()
    }

    private fun getBlockedApps(): Set<String> {
        return prefs.getStringSet(KEY_BLOCKED_APPS, emptySet()) ?: emptySet()
    }

    private fun isBlockingEnabled(): Boolean {
        return prefs.getBoolean(KEY_BLOCKING_ENABLED, true)
    }

    private fun isSystemPackage(packageName: String): Boolean {
        return packageName == this.packageName ||
            packageName == "com.android.systemui" ||
            packageName == "com.android.launcher" ||
            packageName == "com.android.launcher3" ||
            packageName == "com.google.android.apps.nexuslauncher" ||
            packageName == "com.sec.android.app.launcher" ||
            packageName == "com.huawei.android.launcher" ||
            packageName == "com.miui.home" ||
            packageName == "com.android.settings" ||
            packageName.startsWith("com.android.provider")
    }
}
