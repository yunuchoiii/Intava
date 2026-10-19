import ExpoModulesCore
import HealthKit

/**
 * 운동 중 iOS 운동 세션(HKWorkoutSession)을 켜 둔다 — iPhone 단독은 iOS 26부터.
 *
 * 시험: 인타바는 무음 오디오로만 백그라운드에 살아 있어 liveactivitiesd가 라이브 액티비티
 * 갱신을 「only playing background media」로 거절한다. 운동 세션이라는 정당한 실행 사유가
 * 생기면 그 거절이 풀리는지 본다.
 */
public class IntavaWorkoutModule: Module {
  private let store = HKHealthStore()
  private var session: AnyObject?
  private var builder: AnyObject?

  public func definition() -> ModuleDefinition {
    Name("IntavaWorkout")

    // 앱이 처음 열릴 때 묻는다 — iOS는 한 번 답하면 다시 창을 띄우지 않는다
    AsyncFunction("requestAuthorization") { () async -> String in
      guard HKHealthStore.isHealthDataAvailable() else { return "unavailable" }
      do {
        try await self.store.requestAuthorization(toShare: [HKObjectType.workoutType()], read: [])
        return "asked status=\(self.store.authorizationStatus(for: HKObjectType.workoutType()).rawValue)"
      } catch {
        return "error \(error.localizedDescription)"
      }
    }

    // 0 아직 안 물음 · 1 거절 · 2 허용 — 운동 시작 때 권한 창이 뜰지 미리 안다
    Function("authorizationStatus") { () -> Int in
      guard HKHealthStore.isHealthDataAvailable() else { return -1 }
      return self.store.authorizationStatus(for: HKObjectType.workoutType()).rawValue
    }

    /*
      시작 — 이미 돌고 있으면 그대로, iOS에 남은 세션이 있으면 이어받고, 없으면 새로 만든다.

      세션은 기기에 하나만 돈다. 앱이 다시 실행되면(설치·강제 종료) 이전 세션이 iOS 쪽에
      남아 있어, 새로 만들면 곧바로 「종료됨」이 되었다(실기기 로그 15:20:49). 그래서 먼저
      recoverActiveWorkoutSession으로 이어받는다. 뒤에서 시작해도 곧바로 끝나므로 JS는
      앱이 앞에 있을 때만 부른다.
    */
    AsyncFunction("start") { () async -> String in
      guard #available(iOS 26.0, *) else { return "unsupported" }
      guard HKHealthStore.isHealthDataAvailable() else { return "unavailable" }
      if let s = self.session as? HKWorkoutSession {
        if s.state == .running || s.state == .paused { return "running" }
        self.session = nil
        self.builder = nil
      }
      do {
        try await self.store.requestAuthorization(toShare: [HKObjectType.workoutType()], read: [])
        if let recovered = try? await self.store.recoverActiveWorkoutSession(),
           recovered.state == .running || recovered.state == .paused {
          self.session = recovered
          self.builder = recovered.associatedWorkoutBuilder()
          if recovered.state == .paused { recovered.resume() }
          return "recovered state=\(recovered.state.rawValue)"
        }
        let config = HKWorkoutConfiguration()
        config.activityType = .highIntensityIntervalTraining
        config.locationType = .indoor
        let s = try HKWorkoutSession(healthStore: self.store, configuration: config)
        let b = s.associatedWorkoutBuilder()
        b.dataSource = HKLiveWorkoutDataSource(healthStore: self.store, workoutConfiguration: config)
        let now = Date()
        s.startActivity(with: now)
        try await b.beginCollection(at: now)
        self.session = s
        self.builder = b
        return "started state=\(s.state.rawValue)"
      } catch {
        return "error \(error.localizedDescription)"
      }
    }

    AsyncFunction("stop") { () async -> String in
      guard #available(iOS 26.0, *) else { return "unsupported" }
      var target = self.session as? HKWorkoutSession
      if target == nil {
        // 앱이 다시 실행된 뒤라 들고 있지 않아도 iOS에 남은 것은 끝낸다
        target = try? await self.store.recoverActiveWorkoutSession()
      }
      guard let s = target else { return "none" }
      let b = (self.builder as? HKLiveWorkoutBuilder) ?? s.associatedWorkoutBuilder()
      s.end()
      try? await b.endCollection(at: Date())
      // 시험이라 건강 앱에 남기지 않는다
      b.discardWorkout()
      self.session = nil
      self.builder = nil
      return "stopped"
    }

    Function("state") { () -> Int in
      guard #available(iOS 26.0, *), let s = self.session as? HKWorkoutSession else { return -1 }
      return s.state.rawValue
    }
  }
}
