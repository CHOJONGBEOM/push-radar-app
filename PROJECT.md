# 📡 PushRadar - Android 수집 앱 (PROJECT.md)

이 문서는 실물 Android 단말(Samsung S10e 등)에서 경쟁사의 푸시 알림을 포착하여 Supabase 데이터베이스로 전송하는 **React Native 기반의 모바일 알림 수집기**에 대한 개발 가이드입니다.

---

## 1. 기술 스택 및 환경 요구사양

### 1.1 패키지 버전
* **React**: 18.2.0 (LTS)
* **React Native**: 0.74.5
* **TypeScript**: 5.3.3
* **@supabase/supabase-js**: 2.94.1 (DB 연동)
* **react-native-android-notification-listener**: 5.0.1 (알림 가로채기 핵심 모듈)
* **react-native-android-installed-apps**: 1.0.1 (설치된 앱 검색 및 패키지 필터용)

### 1.2 Android 빌드 구성
* **compileSdkVersion**: 34
* **targetSdkVersion**: 34
* **minSdkVersion**: 23 (Android 6.0+)
* **Gradle**: 8.6
* **Kotlin**: 1.9.22
* **Package Name**: `com.pushradar`

---

## 2. 로컬 실행 및 빌드 명령어

모든 디버깅과 로컬 설치는 USB 케이블을 통해 테스트 단말을 연결한 뒤 실행합니다.

```bash
# 1. Metro 번들러 서버 시작
npm start

# 2. USB 연결 단말에 디버그 빌드 설치 및 실행
npx react-native run-android

# 3. (디버그 설치 대체) Gradle 직접 빌드 및 설치
cd android && ./gradlew app:installDebug

# 4. 배포용 Release APK 빌드
cd android && ./gradlew assembleRelease
# 빌드된 APK 파일 경로: android/app/build/outputs/apk/release/app-release.apk
```

---

## 3. 필수 Android 권한 정책

안드로이드 백그라운드에서 정상적으로 알림을 캡처하려면 특수 권한이 수동으로 허용되어야 합니다.

* **BIND_NOTIFICATION_LISTENER_SERVICE**: 시스템 알림에 접근하기 위한 특수 권한 (설정 ➡️ 애플리케이션 ➡️ 특별한 접근 ➡️ 알림 접근 권한 ➡️ PushRadar 켬)
* **QUERY_ALL_PACKAGES**: 설치된 전체 앱 목록을 조회해 사용자가 필터 탭에서 선택할 수 있도록 하기 위한 권한 (Android 11+ 필수)
* **WAKE_LOCK / FOREGROUND_SERVICE**: 화면이 꺼지거나 백그라운드 유휴 상태(Doze Mode)일 때 프로세스가 종료되지 않게 제어하기 위한 권한

---

## 4. 데이터 수집 파이프라인

단말에서 알림을 감지하면 다음과 같은 흐름으로 처리가 진행됩니다:

1. **알림 가로채기**: `NotificationListenerService`가 수신 알림 포착.
2. **차단 앱 필터링**: 시스템 앱 및 개인 메신저(`com.kakao.talk` 등)는 파싱 단계 이전에 조기 반환(`return`).
3. **사용자 동의 필터링**: 수집 대상 설정 화면에서 체크된 앱의 알림만 Supabase 전송 절차를 수행.
4. **파싱 및 전송**: 날짜를 ISOString(UTC)으로 포맷하고, 이모지 포함 및 광고 여부를 정규식으로 간이 판별하여 Supabase의 `push_messages` 테이블로 `upsert` 전송.
5. **AI 태깅**: Supabase 서버 측 DB Trigger가 작동하여 OpenAI API를 통해 `category`, `marketing_hook`, `hook_trigger`를 최종 분석 및 업데이트.

---

## ⚠️ 패치 및 트러블슈팅
* **Gradle 빌드 실패**: `react-native-android-installed-apps` 모듈이 오래된 Gradle 문법(`compile`)을 사용하고 있으므로, 빌드 오류 시 `patches/react-native-android-installed-apps+1.0.1.patch`가 정상적으로 `patch-package`에 의해 로드되었는지 점검해 주세요 (`postinstall` 스크립트 실행).
* **알림 수집 중단 현상**: 알림 접근 허용 상태임에도 데이터가 적재되지 않는 경우, 안드로이드 OS가 리스너 바인딩을 끊은 상태일 수 있으므로 폰 설정의 알림 접근 권한을 한 번 껐다 켜주시기 바랍니다.
