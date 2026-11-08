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
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.IBinder

/** 한 구간 — 이 구간이 끝나는 시각(endMs)까지 보일 내용 */
data class OngoingStep(val title: String, val text: String, val endMs: Long, val color: Int)

/**
 * JS가 보내는 한 판의 내용 — 지금 구간부터 남은 구간들(steps).
 *
 * 안드로이드의 RN은 앱이 뒤로 가거나 화면이 꺼지면 JS 타이머를 멈춘다. 구간마다 JS가 알림을 고치게
 * 했더니 첫 구간(웜업)에 멈춘 채 크로노미터가 음수(「-0:05」)로 넘어갔다(갤럭시 실기기). 그래서 남은
 * 일정을 통째로 받아 서비스가 구간 끝마다 스스로 다음 구간으로 넘긴다.
 */
data class OngoingContent(
  val steps: List<OngoingStep>,
  /** 멈췄을 때 — 일정 대신 이 말을 고정해 보인다(steps는 비어 있다) */
  val pausedTitle: String,
  val pausedText: String,
  val pausedColor: Int,
  val channelName: String,
) {
  companion object {
    private fun color(v: Any?): Int = runCatching { Color.parseColor(v as? String ?: "#D32F3E") }.getOrDefault(Color.RED)

    fun from(p: Map<String, Any?>): OngoingContent {
      @Suppress("UNCHECKED_CAST")
      val raw = p["steps"] as? List<Map<String, Any?>> ?: emptyList()
      return OngoingContent(
        steps = raw.map {
          OngoingStep(
            title = it["title"] as? String ?: "",
            text = it["text"] as? String ?: "",
            endMs = (it["endMs"] as? Number)?.toLong() ?: 0L,
            color = color(it["color"]),
          )
        },
        pausedTitle = p["pausedTitle"] as? String ?: "",
        pausedText = p["pausedText"] as? String ?: "",
        pausedColor = color(p["pausedColor"]),
        channelName = p["channelName"] as? String ?: "Workout",
      )
    }
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

    private val main = Handler(Looper.getMainLooper())
    private var content: OngoingContent? = null
    private var appCtx: Context? = null
    /** 다음 구간으로 넘기는 예약 — 새 일정이 오면 갈아 끼운다 */
    private val advance = Runnable { render() }

    fun show(ctx: Context, c: OngoingContent) {
      ensureChannel(ctx, c.channelName)
      appCtx = ctx.applicationContext
      content = c
      val n = current(ctx, c)
      schedule(c)
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

    /** 지금 시각의 구간을 다시 그리고, 다음 구간 끝에 또 깨어난다 */
    private fun render() {
      val ctx = appCtx ?: return
      val c = content ?: return
      ctx.getSystemService(NotificationManager::class.java)?.notify(ID, current(ctx, c))
      schedule(c)
    }

    private fun schedule(c: OngoingContent) {
      main.removeCallbacks(advance)
      val now = System.currentTimeMillis()
      val next = c.steps.firstOrNull { it.endMs > now } ?: return
      // 끝 시각 바로 뒤에 — 앞서 깨면 같은 구간을 한 번 더 그린다
      main.postDelayed(advance, next.endMs - now + 30)
    }

    /** 지금 보일 판 — 끝나지 않은 첫 구간. 다 지났으면 마지막 구간을 숫자 없이 */
    private fun current(ctx: Context, c: OngoingContent): Notification {
      if (c.steps.isEmpty()) return build(ctx, c.pausedTitle, c.pausedText, 0L, c.pausedColor)
      val now = System.currentTimeMillis()
      val s = c.steps.firstOrNull { it.endMs > now } ?: c.steps.last()
      return build(ctx, s.title, s.text, s.endMs, s.color)
    }

    fun hide(ctx: Context) {
      main.removeCallbacks(advance)
      content = null
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

    private fun build(ctx: Context, title: String, text: String, endMs: Long, color: Int): Notification {
      val b = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(ctx, CHANNEL)
      else @Suppress("DEPRECATION") Notification.Builder(ctx)

      val launch = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)?.apply {
        addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      }
      val tap = launch?.let {
        PendingIntent.getActivity(ctx, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
      }

      val counting = endMs > System.currentTimeMillis()
      b.setSmallIcon(R.drawable.intava_ongoing_icon)
        .setContentTitle(title)
        .setContentText(text)
        .setColor(color)
        .setOngoing(true)
        .setOnlyAlertOnce(true)
        .setShowWhen(counting)
        .setCategory(Notification.CATEGORY_STOPWATCH)
        .setVisibility(Notification.VISIBILITY_PUBLIC)
      if (tap != null) b.setContentIntent(tap)
      if (counting) {
        // 끝 시각까지 스스로 줄어드는 숫자 — 앱이 매초 보내지 않는다
        b.setWhen(endMs).setUsesChronometer(true)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) b.setChronometerCountDown(true)
      }
      if (Build.VERSION.SDK_INT >= 36) {
        // 안드로이드 16 Live Updates — 상태 표시줄 칩(갤럭시는 Now Bar)으로 올려 달라고 청한다. 시스템이 거절할 수 있다
        runCatching {
          // setRequestPromotedOngoing은 compileSdk 36에 아직 없다(EAS 빌드 실패) — 같은 뜻의 extra를 직접 붙인다
          b.addExtras(Bundle().apply { putBoolean("android.requestPromotedOngoing", true) })
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
