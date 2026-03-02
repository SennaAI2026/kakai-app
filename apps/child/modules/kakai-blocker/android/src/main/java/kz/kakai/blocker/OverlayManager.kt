package kz.kakai.blocker

import android.content.Context
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.os.Build
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class OverlayManager(private val context: Context) {

    private var overlayView: View? = null
    private val windowManager: WindowManager
        get() = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager

    fun showLockScreen() {
        if (overlayView != null) return

        val layout = createLockScreenLayout()
        val params = createLayoutParams()

        overlayView = layout
        windowManager.addView(layout, params)
    }

    fun hideLockScreen() {
        overlayView?.let {
            try {
                windowManager.removeView(it)
            } catch (_: IllegalArgumentException) {
                // View already removed
            }
            overlayView = null
        }
    }

    val isShowing: Boolean
        get() = overlayView != null

    private fun createLayoutParams(): WindowManager.LayoutParams {
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_SYSTEM_ALERT
        }

        return WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.CENTER
        }
    }

    private fun createLockScreenLayout(): View {
        val container = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#F2F0E8"))
            setPadding(dp(32), dp(64), dp(32), dp(64))
        }

        // Lock icon
        val lockIcon = TextView(context).apply {
            text = "\uD83D\uDD12" // 🔒
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 64f)
            gravity = Gravity.CENTER
        }
        container.addView(lockIcon)

        // Title
        val title = TextView(context).apply {
            text = "Приложение заблокировано"
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 24f)
            setTextColor(Color.parseColor("#0D1B12"))
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            setPadding(0, dp(24), 0, dp(12))
        }
        container.addView(title)

        // Subtitle
        val subtitle = TextView(context).apply {
            text = "Экранное время закончилось.\nВыполни задание, чтобы получить\nдополнительное время."
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            setTextColor(Color.parseColor("#6B7B6E"))
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, dp(40))
            setLineSpacing(dp(4).toFloat(), 1f)
        }
        container.addView(subtitle)

        // CTA button
        val button = Button(context).apply {
            text = "Получить время за задание"
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            setTextColor(Color.WHITE)
            typeface = Typeface.DEFAULT_BOLD
            setBackgroundColor(Color.parseColor("#0FA968"))
            setPadding(dp(32), dp(16), dp(32), dp(16))
            isAllCaps = false
            // Navigate back to Kakai app
            setOnClickListener {
                val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
                if (launchIntent != null) {
                    launchIntent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                    context.startActivity(launchIntent)
                }
                hideLockScreen()
            }
        }
        container.addView(button)

        return container
    }

    private fun dp(value: Int): Int {
        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            value.toFloat(),
            context.resources.displayMetrics
        ).toInt()
    }
}
