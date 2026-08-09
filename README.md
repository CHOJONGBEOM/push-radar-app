# push-radar-app

**PushNow** 서비스의 데이터 수집 클라이언트입니다.  
Android 기기에서 경쟁사 앱의 푸시 메시지를 자동으로 감지하고, AI로 분류한 뒤 Supabase에 적재합니다.

## 개요

마케터가 경쟁사 푸시 메시지 전략을 분석할 수 있도록, 실시간으로 알림 데이터를 수집·가공하여 DB에 저장하는 Android 앱입니다.  
수집된 데이터는 [PushNow](https://pushnow.kr) 서비스의 분석 화면에서 활용됩니다.

## 동작 방식

```
Android 알림 감지 (NotificationListenerService)
        ↓
수집 대상 앱 여부 확인 (사용자가 앱별로 ON/OFF)
        ↓
AI 분류 (Gemini API)
  - 메시지 유형: 프로모션 / 재방문 유도 / 신규 기능 안내 / 기타
  - 핵심 키워드 추출
  - 할인·혜택 여부 태깅
        ↓
Supabase에 upsert (중복 메시지 자동 무시)
```

## 주요 기능

- **선택적 수집** : 기기에 설치된 앱 목록을 자동으로 탐색하고, 수집할 앱을 사용자가 직접 선택
- **중복 방지** : `package_name + body + posted_at + device_id` 조합으로 동일 메시지 재저장 방지
- **AI 분류** : Gemini API를 통해 메시지 유형과 키워드를 자동 태깅
- **백그라운드 동작** : WorkManager + Foreground Service로 앱이 꺼져 있어도 수집 유지
- **소프트 삭제** : 민감하거나 불필요한 메시지는 `is_hidden` 플래그로 숨김 처리

## 기술 스택

| 분류 | 사용 기술 |
|------|-----------|
| 프레임워크 | React Native (TypeScript) |
| Android 네이티브 | Kotlin (NotificationListenerService, WorkManager) |
| DB | Supabase (PostgreSQL) |
| AI | Google Gemini API |
| 로컬 저장소 | AsyncStorage |

## 환경 설정

프로젝트 루트에 `.env` 파일을 생성하고 아래 값을 입력하세요.

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
GEMINI_API_KEY=your_gemini_api_key
```

## 관련 서비스

- **PushNow** : 수집된 데이터를 시각화하고 AI 카피 생성까지 제공하는 마케터용 분석 서비스
