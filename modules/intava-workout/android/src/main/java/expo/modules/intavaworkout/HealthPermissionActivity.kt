package expo.modules.intavaworkout

import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.result.ActivityResultLauncher
import androidx.health.connect.client.PermissionController

/**
 * 헬스 커넥트 권한 창을 띄우고 답을 돌려주는 투명한 화면.
 * 권한 창은 ActivityResult로만 열려서, 모듈이 직접 띄우지 못하고 이 화면을 거친다.
 */
class HealthPermissionActivity : ComponentActivity() {
  companion object {
    private var pending: ((Boolean) -> Unit)? = null
    private var wanted: Set<String> = emptySet()

    fun request(ctx: Context, permissions: Set<String>, done: (Boolean) -> Unit) {
      pending?.invoke(false)
      pending = done
      wanted = permissions
      ctx.startActivity(Intent(ctx, HealthPermissionActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
  }

  private lateinit var launcher: ActivityResultLauncher<Set<String>>
  private var result = false

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    launcher = registerForActivityResult(PermissionController.createRequestPermissionResultContract()) { got ->
      result = got.containsAll(wanted)
      finish()
    }
    if (savedInstanceState == null) launcher.launch(wanted)
  }

  /*
    답은 이 화면이 다 닫힌 뒤에 넘긴다 — 결과를 받자마자 넘기면 JS가 그 순간 띄운 안내창(삼성 헬스
    동기화)이 이 투명한 화면에 붙었다가 함께 사라졌다(갤럭시 실기기).
  */
  override fun onDestroy() {
    super.onDestroy()
    if (isFinishing) {
      pending?.invoke(result)
      pending = null
    }
  }
}
