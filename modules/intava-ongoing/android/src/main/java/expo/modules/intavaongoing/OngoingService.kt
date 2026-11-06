package expo.modules.intavaongoing

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.os.Build
import android.os.IBinder

/** JS가 보내는 한 판의 내용 */
data class OngoingContent(
  val title: String,
  val text: String,
  /** 지금 구간이 끝나는 시각(ms). 0이면 멈춤·완료 — 크로노미터를 돌리지 않는다 */
  val endMs: Long,
  /** 상태 칩·멈춤 때 보일 짧은 말(남은 시간) */
  val shortText: String,
  val color: Int,
  val channelName: String,
) {
  companion object {
    fun from(p: Map<String, Any?>): OngoingContent = OngoingContent(
      title = p["title"] as? String ?: "",
      text = p["text"] as? String ?: "",
      endMs = (p["endMs"] as? Number)?.toLong() ?: 0L,
      shortText = p["shortText"] as? String ?: "",
      color = runCatching { Color.parseColor(p["color"] as? String ?: "#D32F3E") }.getOrDefault(Color.RED),
      channelName = p["channelName"] as? String ?: "Workout",
    )
  }
}

/**
 * 운동 동안 앱을 살려 두는 포그라운드 서비스와 그 알림.
 *
 * 안드로이드는 화면이 꺼지거나 다른 앱으로 오래 가 있으면 앱을 멈출 수 있다 — iOS가 운동 세션
 * (HKWorkoutSession)으로 버티는 것과 같은 자리를 이 서비스가 맡는다. 알림은 구간 끝 시각을
 * 크로노미터로 받아 스스로 줄어든다.
 */
class OngoingService : Service() {
  companion object {
    private const val CHANNEL = "intava_ongoing"
    private const val ID = 4711

    @Volatile private var running = false
    @Volatile private var pending: Notification? = null

    fun show(ctx: Context, c: OngoingContent) {
      ensureChannel(ctx, c.channelName)
      val n = build(ctx, c)
      if (running) {
        ctx.getSystemService(NotificationManager::class.java)?.notify(ID, n)
        return
      }
      pending = n
      val intent = Intent(ctx, OngoingService::class.java)
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ctx.startForegroundService(intent) else ctx.startService(intent)
      } catch (_: Exception) {
        // 뒤에 있을 때는 서비스를 새로 켤 수 없다(안드로이드 12+) — 알림만이라도 띄운다
        ctx.getSystemService(NotificationManager::class.java)?.notify(ID, n)
      }
    }

    fun hide(ctx: Context) {
      pending = null
      ctx.stopService(Intent(ctx, OngoingService::class.java))
      ctx.getSystemService(NotificationManager::class.java)?.cancel(ID)
    }

    private fun ensureChannel(ctx: Context, name: String) {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
      val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
      // 소리·진동은 앱이 직접 낸다(구간 알림음) — 이 알림은 조용히 떠 있기만 한다
      val ch = NotificationChannel(CHANNEL, name, NotificationManager.IMPORTANCE_LOW).apply {
        setShowBadge(false)
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      }
      nm.createNotificationChannel(ch)
    }

    private fun build(ctx: Context, c: OngoingContent): Notification {
      val b = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(ctx, CHANNEL)
      else @Suppress("DEPRECATION") Notification.Builder(ctx)

      val launch = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)?.apply {
        addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      }
      val tap = launch?.let {
        PendingIntent.getActivity(ctx, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
      }

      val counting = c.endMs > System.currentTimeMillis()
      b.setSmallIcon(R.drawable.intava_ongoing_icon)
        .setContentTitle(c.title)
        .setContentText(if (counting) c.text else listOf(c.shortText, c.text).filter { it.isNotEmpty() }.joinToString(" · "))
        .setColor(c.color)
        .setOngoing(true)
        .setOnlyAlertOnce(true)
        .setShowWhen(counting)
        .setCategory(Notification.CATEGORY_STOPWATCH)
        .setVisibility(Notification.VISIBILITY_PUBLIC)
      if (tap != null) b.setContentIntent(tap)
      if (counting) {
        // 끝 시각까지 스스로 줄어드는 숫자 — 앱이 매초 보내지 않는다
        b.setWhen(c.endMs).setUsesChronometer(true)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) b.setChronometerCountDown(true)
      }
      if (Build.VERSION.SDK_INT >= 36) {
        // 안드로이드 16 Live Updates — 상태 표시줄 칩(갤럭시는 Now Bar)으로 올려 달라고 청한다. 시스템이 거절할 수 있다
        runCatching {
          b.setRequestPromotedOngoing(true)
          if (c.shortText.isNotEmpty() && !counting) b.setShortCriticalText(c.shortText)
        }
      }
      return b.build()
    }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val n = pending ?: run {
      stopSelf()
      return START_NOT_STICKY
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startForeground(ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
    } else {
      startForeground(ID, n)
    }
    running = true
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    running = false
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null
}
