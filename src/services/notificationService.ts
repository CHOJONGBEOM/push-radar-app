/**
 * Notification Listener Service
 * Android NotificationListenerService 연동
 */

import { NativeModules, NativeEventEmitter, Linking, Platform } from 'react-native';
import { NotificationData, PushMessage } from '../types';
import { insertMessage } from './supabaseService';
import {
  discoverApp,
  isAppEnabled,
  incrementCollectedCount,
  getAppNameByPackage,
} from './appStorage';
import { getDeviceId } from '../utils/device';

const { RNAndroidNotificationListener } = NativeModules;

// 알림 수신 콜백 타입
type NotificationCallback = (data: NotificationData, collected: boolean) => void;

let notificationCallback: NotificationCallback | null = null;
let eventEmitter: NativeEventEmitter | null = null;
let subscription: any = null;

// 이모지 패턴
const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;

// 광고 키워드
const AD_KEYWORDS = [
  '할인', '세일', 'SALE', '특가', '쿠폰', '적립',
  '%', '배송비', '무료배송', '마감', '한정',
  '오늘만', '지금', '놓치지', '서두르', '라스트',
];

// 카테고리 키워드
// CATEGORY_KEYWORDS 제거: DB의 OpenAI trigger가 자동 분류


/**
 * 네이티브 알림 데이터를 NotificationData로 변환
 */
const parseNativeNotification = (notification: any): NotificationData => {
  // 라이브러리가 JSON string으로 보내는 경우 파싱
  const data = typeof notification === 'string' ? JSON.parse(notification) : notification;
  const packageName = data.app || data.packageName || '';

  return {
    packageName,
    appName: getAppNameByPackage(packageName),  // 동적 조회
    title: data.title || '',
    text: data.text || data.body || '',
    postTime: data.time || Date.now(),
  };
};

/**
 * 알림 권한 설정 열기 함수
 */
export const openNotificationSettings = () => {
  if (Platform.OS === 'android') {
    RNAndroidNotificationListener.requestPermission();
  }
};

/**
 * 알림 리스너 시작
 */
export const startListening = (callback?: NotificationCallback): void => {
  notificationCallback = callback || null;

  if (Platform.OS !== 'android') {
    console.log('Notification listener only works on Android');
    return;
  }

  if (!RNAndroidNotificationListener) {
    console.log('RNAndroidNotificationListener module not found');
    return;
  }

  try {
    // 이벤트 에미터 생성
    eventEmitter = new NativeEventEmitter(RNAndroidNotificationListener);

    // 알림 수신 이벤트 구독
    subscription = eventEmitter.addListener(
      'notificationReceived',
      async (notification) => {
        try {
          const data = parseNativeNotification(notification);
          await handleNotification(data);
        } catch (error) {
          console.error('Error handling notification:', error);
        }
      }
    );

    console.log('Notification listener started');
  } catch (error) {
    console.error('Failed to start notification listener:', error);
  }
};

/**
 * 알림 리스너 중지
 */
export const stopListening = (): void => {
  if (subscription) {
    subscription.remove();
    subscription = null;
  }
  notificationCallback = null;
  console.log('Notification listener stopped');
};

/**
 * 안전한 날짜 변환
 */
const safeToISOString = (timestamp: number | undefined): string => {
  try {
    // timestamp가 없거나 유효하지 않으면 현재 시간 사용
    if (!timestamp || timestamp < 0 || timestamp > 8640000000000000) {
      return new Date().toISOString();
    }
    const date = new Date(timestamp);
    // Invalid Date 체크
    if (isNaN(date.getTime())) {
      return new Date().toISOString();
    }
    return date.toISOString();
  } catch (e) {
    return new Date().toISOString();
  }
};

/**
 * 알림 파싱
 */
const parseNotification = async (data: NotificationData): Promise<PushMessage> => {
  const title = data.title || '';
  const body = data.text || '';
  const fullText = `${title} ${body}`;

  // 광고 여부 판별
  const isAd = AD_KEYWORDS.some(keyword =>
    fullText.toLowerCase().includes(keyword.toLowerCase())
  );

  // 디바이스 ID 조회
  const deviceId = await getDeviceId();

  // 카테고리는 DB의 OpenAI trigger가 자동으로 분류
  // null로 보내면 trigger가 body 텍스트를 분석하여 설정

  return {
    package_name: data.packageName,
    app_name: data.appName || data.packageName,
    title,
    body,
    posted_at: safeToISOString(data.postTime),
    raw_data: JSON.stringify(data),
    is_ad: isAd,
    category: null,  // OpenAI trigger가 자동 분류
    has_emoji: EMOJI_REGEX.test(fullText),
    message_length: body.length,
    device_id: deviceId,
  };
};

// 무시할 패키지 목록 (시스템 + 개인정보)
const IGNORED_PACKAGES = [
  'com.android.systemui',
  'android',
  'com.samsung.android',
  'com.kakao.talk',  // 카카오톡 - 개인정보 보호
];

/**
 * 알림 수신 처리 (핵심 로직)
 */
export const handleNotification = async (data: NotificationData): Promise<void> => {
  // 제외 패키지는 무시
  if (IGNORED_PACKAGES.some(pkg => data.packageName.startsWith(pkg))) {
    return;
  }

  console.log('Notification received:', data.packageName, data.title);

  // 1. 앱 발견/업데이트 (무조건 실행 - 수집 여부와 무관)
  const appName = data.appName || data.packageName.split('.').pop() || data.packageName;
  await discoverApp(data.packageName, appName);

  // 2. 수집 대상 앱인지 확인
  const enabled = await isAppEnabled(data.packageName);

  if (enabled) {
    // 3. 파싱 및 Supabase 저장
    const message = await parseNotification(data);
    const success = await insertMessage(message);

    if (success) {
      await incrementCollectedCount(data.packageName);
    }

    // 콜백 호출 (수집됨)
    if (notificationCallback) {
      notificationCallback(data, true);
    }
  } else {
    // 콜백 호출 (수집 안 됨)
    if (notificationCallback) {
      notificationCallback(data, false);
    }
  }
};

/**
 * 권한 상태 확인
 * @returns 'authorized' | 'denied' | 'unknown'
 */
export const getPermissionStatus = async (): Promise<string> => {
  if (Platform.OS !== 'android' || !RNAndroidNotificationListener) {
    return 'unknown';
  }

  try {
    const status = await RNAndroidNotificationListener.getPermissionStatus();
    console.log('Permission status:', status);
    return status || 'unknown';
  } catch (error) {
    console.error('Permission check failed:', error);
    return 'unknown';
  }
};

/**
 * 권한이 있는지 확인 (boolean)
 */
export const checkPermission = async (): Promise<boolean> => {
  const status = await getPermissionStatus();
  return status === 'authorized';
};

/**
 * 알림 접근 권한 설정 화면으로 직접 이동
 */
export const requestPermission = (): void => {
  if (Platform.OS !== 'android') {
    return;
  }

  // 알림 접근 설정 화면으로 직접 이동
  Linking.sendIntent('android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS').catch(() => {
    // 폴백: URL 방식
    Linking.openURL('android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS').catch(() => {
      // 최후 폴백: 일반 설정
      Linking.openSettings().catch(console.error);
    });
  });
};

// 테스트용 더미 알림들 (다양한 앱과 카테고리)
const TEST_NOTIFICATIONS: NotificationData[] = [
  // sale 카테고리
  {
    packageName: 'com.test.saleapp',
    appName: '테스트 쇼핑몰',
    title: '[테스트] 오늘만 최대 80% 세일! 🔥',
    text: '찜한 상품이 할인 중이에요. 놓치지 마세요!',
    postTime: Date.now(),
  },
  {
    packageName: 'com.test.market',
    appName: '테스트 마켓',
    title: '[테스트] 로켓배송 특가',
    text: '50% 반값 할인! 오늘 자정까지',
    postTime: Date.now(),
  },
  // new 카테고리
  {
    packageName: 'com.test.fashion',
    appName: '테스트 패션',
    title: '[테스트] 봄 신상 입고 🌸',
    text: '2026 S/S 컬렉션을 만나보세요',
    postTime: Date.now(),
  },
  {
    packageName: 'com.test.mall',
    appName: '테스트 몰',
    title: '[테스트] NEW 신제품 출시',
    text: '관심 브랜드에서 새로운 상품이 출시되었습니다',
    postTime: Date.now(),
  },
  // restock 카테고리
  {
    packageName: 'com.test.codi',
    appName: '테스트 코디',
    title: '[테스트] 재입고 알림',
    text: '품절됐던 인기 상품이 다시 입고!',
    postTime: Date.now(),
  },
  {
    packageName: 'com.test.sneakers',
    appName: '테스트 스니커즈',
    title: '[테스트] 리스탁 안내',
    text: 'Air Jordan 1 재출시 예정',
    postTime: Date.now(),
  },
  // reminder 카테고리
  {
    packageName: 'com.test.mart',
    appName: '테스트 마트',
    title: '[테스트] 장바구니 알림',
    text: '담아둔 상품의 가격이 변동되었어요',
    postTime: Date.now(),
  },
  {
    packageName: 'com.test.dept',
    appName: '테스트 백화점',
    title: '[테스트] 찜한 상품 소식',
    text: '관심 상품을 지금 확인하세요',
    postTime: Date.now(),
  },
  // event 카테고리
  {
    packageName: 'com.test.selectshop',
    appName: '테스트 편집샵',
    title: '[테스트] 이벤트 당첨 🎉',
    text: '축하합니다! 경품 응모에 당첨되었습니다',
    postTime: Date.now(),
  },
  {
    packageName: 'com.test.homeshopping',
    appName: '테스트 홈쇼핑',
    title: '[테스트] 럭키드로우 이벤트',
    text: '지금 응모하고 경품 받아가세요!',
    postTime: Date.now(),
  },
  // other 카테고리 (키워드 없음)
  {
    packageName: 'com.test.beauty',
    appName: '테스트 뷰티',
    title: '[테스트] 오늘의 추천',
    text: '회원님을 위한 맞춤 상품을 확인해보세요',
    postTime: Date.now(),
  },
  {
    packageName: 'com.test.food',
    appName: '테스트 푸드',
    title: '[테스트] 주문하신 메뉴 준비중',
    text: '잠시만 기다려주세요. 곧 완료됩니다!',
    postTime: Date.now(),
  },
];

let testIndex = 0;

/**
 * 테스트용 더미 알림 생성 (순환) - 항상 저장
 */
export const sendTestNotification = async (): Promise<void> => {
  const testData = TEST_NOTIFICATIONS[testIndex % TEST_NOTIFICATIONS.length];
  testIndex++;

  const data = {
    ...testData,
    postTime: Date.now(),
  };

  console.log('Test notification:', data.packageName, data.title);

  // 테스트 알림은 isAppEnabled 체크 없이 바로 저장
  const appName = data.appName || data.packageName.split('.').pop() || data.packageName;
  await discoverApp(data.packageName, appName);

  // 바로 저장 (활성화 여부 무시)
  const message = await parseNotification(data);
  const success = await insertMessage(message);
  console.log('Test notification saved:', success);

  if (notificationCallback) {
    notificationCallback(data, success);
  }
};

/**
 * Headless JS 알림 리스너 (백그라운드 수신용)
 * index.ts에서 AppRegistry.registerHeadlessTask로 등록됨
 */
export const headlessNotificationListener = async ({ notification }: { notification: string }) => {
  if (!notification) {
    return;
  }

  try {
    const data = parseNativeNotification(notification);

    // 제외 패키지는 조기 필터링 (로그도 남기지 않음)
    if (IGNORED_PACKAGES.some(pkg => data.packageName.startsWith(pkg))) {
      return;
    }

    console.log('[Headless] Notification:', data.packageName, data.title);
    await handleNotification(data);
  } catch (error) {
    console.error('[Headless] Error:', error);
  }
};
