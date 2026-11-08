package expo.modules.intavaworkout

import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.metadata.Device
import androidx.health.connect.client.records.metadata.Metadata
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.runBlocking
import java.time.Instant
import java.time.ZoneId

/**
 * 안드로이드의 운동 기록 — 헬스 커넥트(삼성 헬스 · 구글 핏이 읽는 저장소).
 *
 * iOS(ios/IntavaWorkoutModule.swift)와 같은 이름 · 같은 함수를 연다. 다만 안드로이드에는 운동 세션이
 * 없어 start/pause/resume은 아무것도 하지 않고 stop은 "none"을 돌려준다 — 그러면 JS(session.tsx)가
 * 시작 · 끝 시각으로 saveWorkout을 불러 한 건 써넣는다(iOS 26 미만과 같은 길).
 */
class IntavaWorkoutModule : Module() {
  private val ctx: Context get() = requireNotNull(appContext.reactContext)
  private val prefs get() = ctx.getSharedPreferences("intava_health", Context.MODE_PRIVATE)

  private fun available(): Boolean =
    HealthConnectClient.getSdkStatus(ctx) == HealthConnectClient.SDK_AVAILABLE

  private fun granted(): Boolean = runCatching {
    runBlocking {
      HealthConnectClient.getOrCreate(ctx).permissionController.getGrantedPermissions().contains(WRITE)
    }
  }.getOrDefault(false)

  override fun definition() = ModuleDefinition {
    Name("IntavaWorkout")

    /** -1 쓸 수 없음 · 0 아직 안 물음 · 1 거절 · 2 허용 — iOS와 같은 뜻 */
    Function("authorizationStatus") {
      when {
        !available() -> -1
        granted() -> 2
        prefs.getBoolean("asked", false) -> 1
        else -> 0
      }
    }

    AsyncFunction("requestAuthorization") { promise: Promise ->
      if (!available()) {
        promise.resolve("unavailable")
        return@AsyncFunction
      }
      prefs.edit().putBoolean("asked", true).apply()
      HealthPermissionActivity.request(ctx, setOf(WRITE)) { ok -> promise.resolve(if (ok) "granted" else "denied") }
    }

    // 안드로이드에는 운동 세션이 없다 — 앱을 살려 두는 일은 진행 중 알림 서비스(intava-ongoing)가 맡는다
    AsyncFunction("start") { _: String -> "none" }
    Function("pause") { }
    Function("resume") { }
    AsyncFunction("stop") { _: Boolean -> "none" }
    Function("state") { -1 }

    /** 헬스 커넥트 화면 — 기록이 들어갔는지 사용자가 직접 본다. 안드로이드 14+는 설정 안에 들어 있다 */
    Function("openHealthConnect") {
      val action = if (Build.VERSION.SDK_INT >= 34) "android.health.connect.action.HEALTH_HOME_SETTINGS"
      else "androidx.health.ACTION_HEALTH_CONNECT_SETTINGS"
      runCatching { ctx.startActivity(Intent(action).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); true }.getOrDefault(false)
    }

    /** 삼성 헬스가 깔려 있나 — 헬스 커넥트 동기화를 켜라고 안내할지 정한다 */
    Function("hasSamsungHealth") {
      ctx.packageManager.getLaunchIntentForPackage(SAMSUNG_HEALTH) != null
    }

    Function("openSamsungHealth") {
      val i = ctx.packageManager.getLaunchIntentForPackage(SAMSUNG_HEALTH) ?: return@Function false
      runCatching { ctx.startActivity(i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); true }.getOrDefault(false)
    }

    AsyncFunction("saveWorkout") Coroutine { type: String, startMs: Double, endMs: Double ->
      if (!available() || !granted()) return@Coroutine "denied"
      val start = Instant.ofEpochMilli(startMs.toLong())
      val end = Instant.ofEpochMilli(endMs.toLong())
      val zone = ZoneId.systemDefault().rules
      val record = ExerciseSessionRecord(
        startTime = start,
        startZoneOffset = zone.getOffset(start),
        endTime = end,
        endZoneOffset = zone.getOffset(end),
        metadata = Metadata.activelyRecorded(Device(type = Device.TYPE_PHONE)),
        exerciseType = exerciseType(type),
      )
      HealthConnectClient.getOrCreate(ctx).insertRecords(listOf(record))
      "saved"
    }
  }

  companion object {
    val WRITE = HealthPermission.getWritePermission(ExerciseSessionRecord::class)
    const val SAMSUNG_HEALTH = "com.sec.android.app.shealth"

    /** 루틴의 운동 종류 키(src/types.ts WORKOUT_TYPES) → 헬스 커넥트 운동 종류. 딱 맞는 것이 없으면 가까운 것 */
    fun exerciseType(key: String): Int = when (key) {
      "hiit", "mixedCardio" -> ExerciseSessionRecord.EXERCISE_TYPE_HIGH_INTENSITY_INTERVAL_TRAINING
      "functionalStrength" -> ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING
      "traditionalStrength" -> ExerciseSessionRecord.EXERCISE_TYPE_WEIGHTLIFTING
      "core" -> ExerciseSessionRecord.EXERCISE_TYPE_CALISTHENICS
      "cross" -> ExerciseSessionRecord.EXERCISE_TYPE_BOOT_CAMP
      "flexibility" -> ExerciseSessionRecord.EXERCISE_TYPE_STRETCHING
      "yoga" -> ExerciseSessionRecord.EXERCISE_TYPE_YOGA
      "pilates" -> ExerciseSessionRecord.EXERCISE_TYPE_PILATES
      else -> ExerciseSessionRecord.EXERCISE_TYPE_OTHER_WORKOUT
    }
  }
}
