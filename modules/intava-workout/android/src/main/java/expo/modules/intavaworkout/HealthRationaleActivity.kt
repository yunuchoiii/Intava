package expo.modules.intavaworkout

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle

/** 헬스 커넥트의 「앱이 데이터를 어떻게 쓰나요」 — 개인정보 처리방침 웹 페이지를 열고 닫는다 */
class HealthRationaleActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    runCatching {
      startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://yunuchoiii.github.io/intava-pages/privacy.html")))
    }
    finish()
  }
}
