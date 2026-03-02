package kz.kakai.blocker

import android.app.usage.UsageStats
import android.app.usage.UsageStatsManager
import android.content.Context
import android.os.Bundle

class UsageTracker(private val context: Context) {

    private val usageStatsManager: UsageStatsManager
        get() = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager

    fun queryUsageStats(startTime: Long, endTime: Long): List<Bundle> {
        val stats: List<UsageStats> = usageStatsManager.queryUsageStats(
            UsageStatsManager.INTERVAL_DAILY,
            startTime,
            endTime
        ) ?: emptyList()

        return stats
            .filter { it.totalTimeInForeground > 0 }
            .sortedByDescending { it.totalTimeInForeground }
            .map { stat ->
                Bundle().apply {
                    putString("packageName", stat.packageName)
                    putLong("totalTimeInForeground", stat.totalTimeInForeground)
                    putLong("lastTimeUsed", stat.lastTimeUsed)
                    putLong("firstTimeStamp", stat.firstTimeStamp)
                    putLong("lastTimeStamp", stat.lastTimeStamp)
                }
            }
    }

    fun getForegroundApp(): String? {
        val endTime = System.currentTimeMillis()
        val startTime = endTime - 60_000 // last minute

        val stats = usageStatsManager.queryUsageStats(
            UsageStatsManager.INTERVAL_DAILY,
            startTime,
            endTime
        ) ?: return null

        return stats
            .filter { it.totalTimeInForeground > 0 }
            .maxByOrNull { it.lastTimeUsed }
            ?.packageName
    }
}
