const { withEntitlementsPlist } = require('@expo/config-plugins');

/**
 * 푸시 알림 엔타이틀먼트(aps-environment)를 걷어낸다.
 *
 * expo-notifications 플러그인은 원격 푸시를 쓸 것을 전제로 이 값을 넣는데,
 * 이 앱은 **로컬 알림만** 쓴다(구간 전환 시각을 미리 예약하는 안전망).
 * 로컬 알림에는 이 권한이 필요 없고, 남아 있으면 Push Notifications 기능이
 * 없는 프로비저닝 프로파일로는 기기 빌드가 아예 실패한다.
 *
 * 나중에 원격 푸시를 쓰게 되면 이 플러그인을 빼고, 개발자 포털에서 App ID에
 * Push Notifications를 켜면 된다.
 *
 * ⚠︎ app.json의 plugins 배열에서 **맨 앞**에 둬야 한다. config-plugins의 모드는
 *    나중에 등록된 것이 먼저 돌기 때문에, 뒤에 두면 expo-notifications가 값을
 *    넣기 전에 실행되어 아무것도 지우지 못한다.
 */
module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults['aps-environment'];
    return cfg;
  });
};
