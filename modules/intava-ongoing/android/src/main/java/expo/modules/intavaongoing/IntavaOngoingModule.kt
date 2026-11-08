package expo.modules.intavaongoing

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * 안드로이드의 「잠금화면 타이머」 — 진행 중 알림 + 포그라운드 서비스(OngoingService).
 *
 * iOS의 라이브 액티비티 자리를 맡는다. JS(src/live/index.ts)가 구간이 바뀔 때·멈추고 이어 갈 때만
 * 새 내용을 보내고, 그 사이 숫자는 알림의 크로노미터가 스스로 줄인다.
 */
class IntavaOngoingModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("IntavaOngoing")

    Function("show") { payload: Map<String, Any?> ->
      val ctx = appContext.reactContext ?: return@Function false
      OngoingService.show(ctx, OngoingContent.from(payload))
      true
    }

    Function("hide") {
      val ctx = appContext.reactContext ?: return@Function false
      OngoingService.hide(ctx)
      true
    }
  }
}
