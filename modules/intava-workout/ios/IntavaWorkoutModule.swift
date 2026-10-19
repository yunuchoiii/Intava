import ExpoModulesCore
import HealthKit

/**
 * 운동 중 iOS 운동 세션(HKWorkoutSession)을 켜 두고, 끝나면 건강 앱에 운동을 남긴다.
 *
 * 두 가지 일을 한다.
 *
 * 1. **라이브 액티비티를 살린다.** 인타바는 무음 오디오로만 백그라운드에 살아 있어
 *    liveactivitiesd가 「only playing background media so is forbidden to update activity」로
 *    아일랜드 갱신을 버렸다. 운동 세션이라는 정당한 실행 사유가 있으면 반영된다
 *    (실기기 10-19: 20건 반영·0건 거절). iPhone 단독 세션은 iOS 26부터다.
 * 2. **건강·피트니스에 기록한다.** 세션을 저장으로 닫으면(finishWorkout) 그 운동이 건강
 *    앱과 피트니스에 남는다. 세션이 없었으면(iOS 26 미만 등) 끝난 뒤 HKWorkoutBuilder로
 *    시작·끝 시각만 한 건 써넣는다(saveWorkout).
 *
 * 종류는 문자열 키로 받는다(activityType) — JS 쪽에 HealthKit 숫자를 흘리지 않는다.
 */
public class IntavaWorkoutModule: Module {
  private let store = HKHealthStore()
  private var session: AnyObject?
  private var builder: AnyObject?

  public func definition() -> ModuleDefinition {
    Name("IntavaWorkout")

    // 0 아직 안 물음 · 1 거절 · 2 허용 — 운동 시작 때 권한 창이 뜰지 미리 안다
    Function("authorizationStatus") { () -> Int in
      guard HKHealthStore.isHealthDataAvailable() else { return -1 }
      return self.store.authorizationStatus(for: HKObjectType.workoutType()).rawValue
    }

    AsyncFunction("requestAuthorization") { () async -> String in
      guard HKHealthStore.isHealthDataAvailable() else { return "unavailable" }
      do {
        try await self.store.requestAuthorization(toShare: [HKObjectType.workoutType()], read: [])
        return "asked"
      } catch {
        return "error \(error.localizedDescription)"
      }
    }

    /*
      시작 — 이미 돌고 있으면 그대로, iOS에 남은 세션이 있으면 이어받고, 없으면 새로 만든다.

      세션은 기기에 하나만 돈다. 앱이 다시 실행되면(설치·강제 종료) 이전 세션이 iOS 쪽에
      남아 있어, 그냥 새로 만들면 곧바로 「종료됨」이 되었다(실기기 15:20:49).

      남은 세션을 이어받기만 해서도 안 된다. 앞 프로세스가 죽을 때 healthd가 실행 보증을
      다시 잡지 못하면(「Failed to acquire reconnection assertion」) 이어받은 세션은 돌고
      있어도 새 프로세스에 「Running workout session」 보증이 붙지 않아, 아일랜드 갱신이
      다시 「only playing background media」로 버려졌다(실기기 10-19 16:17:30~). 앱에서는
      보증이 붙었는지 알 길이 없으므로, 남은 세션은 원래 시작 시각만 넘겨받고 끝낸 뒤
      같은 시각으로 새로 시작한다. 뒤에서 시작해도 곧바로 끝나므로 JS는 앱이 앞에 있을
      때만 부른다.
    */
    AsyncFunction("start") { (type: String) async -> String in
      guard #available(iOS 26.0, *) else { return "unsupported" }
      guard HKHealthStore.isHealthDataAvailable() else { return "unavailable" }
      if let s = self.session as? HKWorkoutSession {
        if s.state == .running || s.state == .paused { return "running" }
        self.session = nil
        self.builder = nil
      }
      do {
        try await self.store.requestAuthorization(toShare: [HKObjectType.workoutType()], read: [])
        var startAt = Date()
        var outcome = "started"
        if let old = try? await self.store.recoverActiveWorkoutSession() {
          if old.state == .running || old.state == .paused {
            startAt = old.startDate ?? startAt
            outcome = "restarted"
          }
          await Self.endAndWait(old)
        }
        let config = Self.configuration(type)
        let s = try HKWorkoutSession(healthStore: self.store, configuration: config)
        let b = s.associatedWorkoutBuilder()
        b.dataSource = HKLiveWorkoutDataSource(healthStore: self.store, workoutConfiguration: config)
        s.startActivity(with: startAt)
        try await b.beginCollection(at: startAt)
        self.session = s
        self.builder = b
        return outcome
      } catch {
        return "error \(error.localizedDescription)"
      }
    }

    // 타이머를 멈추고 재개할 때 — 멈춘 동안은 운동 시간에서 빠진다
    Function("pause") {
      guard #available(iOS 26.0, *), let s = self.session as? HKWorkoutSession, s.state == .running else { return }
      s.pause()
    }

    Function("resume") {
      guard #available(iOS 26.0, *), let s = self.session as? HKWorkoutSession, s.state == .paused else { return }
      s.resume()
    }

    /*
      끝 — save가 참이면 건강 앱에 남기고(finishWorkout), 아니면 버린다.
      들고 있는 세션이 없어도(앱이 다시 실행된 뒤) iOS에 남은 것을 찾아 끝낸다.
      돌려주는 값이 "saved"면 기록이 남았고, "none"이면 끝낼 세션이 없었다.
    */
    AsyncFunction("stop") { (save: Bool) async -> String in
      guard #available(iOS 26.0, *) else { return "none" }
      var target = self.session as? HKWorkoutSession
      if target == nil {
        target = try? await self.store.recoverActiveWorkoutSession()
      }
      guard let s = target else { return "none" }
      let b = (self.builder as? HKLiveWorkoutBuilder) ?? s.associatedWorkoutBuilder()
      self.session = nil
      self.builder = nil
      let now = Date()
      s.stopActivity(with: now)
      s.end()
      do {
        try await b.endCollection(at: now)
        if save {
          _ = try await b.finishWorkout()
          return "saved"
        }
        b.discardWorkout()
        return "discarded"
      } catch {
        b.discardWorkout()
        return "error \(error.localizedDescription)"
      }
    }

    /*
      세션 없이 한 건 써넣기 — iOS 26 미만, 또는 세션을 못 켰던 운동.
      시작·끝 시각만 있다. 멈춘 시간은 빼지 못한다(세션이 없어 그 정보가 없다).
    */
    AsyncFunction("saveWorkout") { (type: String, startMs: Double, endMs: Double) async -> String in
      guard HKHealthStore.isHealthDataAvailable() else { return "unavailable" }
      guard self.store.authorizationStatus(for: HKObjectType.workoutType()) == .sharingAuthorized else {
        return "denied"
      }
      let start = Date(timeIntervalSince1970: startMs / 1000)
      let end = Date(timeIntervalSince1970: endMs / 1000)
      guard end > start else { return "empty" }
      let b = HKWorkoutBuilder(healthStore: self.store, configuration: Self.configuration(type), device: .local())
      do {
        try await b.beginCollection(at: start)
        try await b.endCollection(at: end)
        _ = try await b.finishWorkout()
        return "saved"
      } catch {
        return "error \(error.localizedDescription)"
      }
    }

    // -1 세션 없음 · 2 실행 중 · 4 일시정지 · 그 밖은 HKWorkoutSessionState 값
    Function("state") { () -> Int in
      guard #available(iOS 26.0, *), let s = self.session as? HKWorkoutSession else { return -1 }
      return s.state.rawValue
    }
  }

  /** 남은 세션을 기록 없이 끝내고, 「종료됨」이 될 때까지 잠깐(최대 3초) 기다린다 — 그 전에 새로 만들면 새 것이 끝난다 */
  @available(iOS 26.0, *)
  private static func endAndWait(_ s: HKWorkoutSession) async {
    let b = s.associatedWorkoutBuilder()
    if s.state != .ended && s.state != .stopped {
      s.end()
    }
    for _ in 0..<30 where s.state != .ended {
      try? await Task.sleep(nanoseconds: 100_000_000)
    }
    b.discardWorkout()
  }

  private static func configuration(_ type: String) -> HKWorkoutConfiguration {
    let config = HKWorkoutConfiguration()
    config.activityType = activityType(type)
    config.locationType = .indoor
    return config
  }

  /** 루틴의 운동 종류 키 → HealthKit 종류. 모르는 키는 고강도 인터벌로 */
  private static func activityType(_ key: String) -> HKWorkoutActivityType {
    switch key {
    case "functionalStrength": return .functionalStrengthTraining
    case "traditionalStrength": return .traditionalStrengthTraining
    case "core": return .coreTraining
    case "cross": return .crossTraining
    case "mixedCardio": return .mixedCardio
    case "jumpRope": return .jumpRope
    case "flexibility": return .flexibility
    case "yoga": return .yoga
    case "pilates": return .pilates
    default: return .highIntensityIntervalTraining
    }
  }
}
