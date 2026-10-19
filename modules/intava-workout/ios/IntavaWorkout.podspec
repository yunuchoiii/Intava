Pod::Spec.new do |s|
  s.name           = 'IntavaWorkout'
  s.version        = '1.0.0'
  s.summary        = 'Intava workout session (HKWorkoutSession) for background runtime'
  s.author         = 'Intava'
  s.homepage       = 'https://github.com/yunuchoiii/Intava'
  s.license        = 'MIT'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'HealthKit'
  s.source_files   = '**/*.{h,m,swift}'
end
