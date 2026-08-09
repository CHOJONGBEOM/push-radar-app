/**
 * App Storage Service
 * 발견된 앱 목록과 수집 설정을 AsyncStorage에 저장
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@pushradar_apps';
const APP_NAME_CACHE_KEY = '@pushradar_app_name_cache';

// 앱 이름 캐시 (메모리)
let appNameCache: Record<string, string> = {};

export interface DiscoveredApp {
  package_name: string;
  app_name: string;
  is_enabled: boolean;       // 수집 여부
  discovered_at: string;     // 최초 발견 시간
  last_notification_at: string; // 마지막 알림 시간
  notification_count: number;   // 총 알림 수 (수집 여부 무관)
  collected_count: number;      // 실제 수집된 수
}

/**
 * 저장된 앱 목록 가져오기
 */
export const getDiscoveredApps = async (): Promise<DiscoveredApp[]> => {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    return json ? JSON.parse(json) : [];
  } catch (e) {
    console.error('Failed to load apps:', e);
    return [];
  }
};

/**
 * 앱 목록 저장
 */
export const saveDiscoveredApps = async (apps: DiscoveredApp[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(apps));
  } catch (e) {
    console.error('Failed to save apps:', e);
  }
};

/**
 * 새 앱 발견 시 추가 (또는 기존 앱 업데이트)
 * 새 앱은 기본적으로 enabled=false (사용자가 직접 켜야 함)
 */
export const discoverApp = async (
  packageName: string,
  appName: string
): Promise<DiscoveredApp> => {
  const apps = await getDiscoveredApps();
  const now = new Date().toISOString();

  const existingIndex = apps.findIndex(a => a.package_name === packageName);

  if (existingIndex >= 0) {
    // 기존 앱 업데이트
    apps[existingIndex].last_notification_at = now;
    apps[existingIndex].notification_count += 1;
    if (apps[existingIndex].app_name !== appName) {
      apps[existingIndex].app_name = appName;
    }
    await saveDiscoveredApps(apps);
    return apps[existingIndex];
  } else {
    // 새 앱 추가
    const newApp: DiscoveredApp = {
      package_name: packageName,
      app_name: appName,
      is_enabled: false,  // 기본 OFF - 사용자가 켜야 수집
      discovered_at: now,
      last_notification_at: now,
      notification_count: 1,
      collected_count: 0,
    };
    apps.unshift(newApp); // 최근 발견 앱이 위로
    await saveDiscoveredApps(apps);
    return newApp;
  }
};

/**
 * 앱 수집 여부 토글
 */
export const toggleAppEnabled = async (packageName: string): Promise<boolean> => {
  const apps = await getDiscoveredApps();
  const app = apps.find(a => a.package_name === packageName);

  if (app) {
    app.is_enabled = !app.is_enabled;
    await saveDiscoveredApps(apps);
    return app.is_enabled;
  }
  return false;
};

/**
 * 앱이 수집 대상인지 확인
 */
export const isAppEnabled = async (packageName: string): Promise<boolean> => {
  const apps = await getDiscoveredApps();
  const app = apps.find(a => a.package_name === packageName);
  return app?.is_enabled ?? false;
};

/**
 * 수집 카운트 증가
 */
export const incrementCollectedCount = async (packageName: string): Promise<void> => {
  const apps = await getDiscoveredApps();
  const app = apps.find(a => a.package_name === packageName);

  if (app) {
    app.collected_count += 1;
    await saveDiscoveredApps(apps);
  }
};

/**
 * 앱 삭제
 */
export const removeApp = async (packageName: string): Promise<void> => {
  const apps = await getDiscoveredApps();
  const filtered = apps.filter(a => a.package_name !== packageName);
  await saveDiscoveredApps(filtered);
};

/**
 * 전체 초기화
 */
export const clearAllApps = async (): Promise<void> => {
  await AsyncStorage.removeItem(STORAGE_KEY);
};

/**
 * 앱 수동 등록 (미리 등록)
 * enabled=true로 등록하여 첫 알림부터 수집
 */
export const registerApp = async (
  packageName: string,
  appName: string,
  enabled: boolean = true
): Promise<DiscoveredApp | null> => {
  const apps = await getDiscoveredApps();

  // 이미 등록된 앱인지 확인
  const existing = apps.find(a => a.package_name === packageName);
  if (existing) {
    return null; // 이미 존재
  }

  const now = new Date().toISOString();
  const newApp: DiscoveredApp = {
    package_name: packageName,
    app_name: appName,
    is_enabled: enabled,
    discovered_at: now,
    last_notification_at: now,
    notification_count: 0,
    collected_count: 0,
  };

  apps.unshift(newApp);
  await saveDiscoveredApps(apps);
  return newApp;
};

// ============================================
// 앱 이름 캐시 관리
// ============================================

/**
 * 설치된 앱 목록으로 캐시 초기화
 */
export const initAppNameCache = async (): Promise<void> => {
  try {
    // 저장된 캐시 로드
    const cached = await AsyncStorage.getItem(APP_NAME_CACHE_KEY);
    if (cached) {
      appNameCache = JSON.parse(cached);
    }
  } catch (e) {
    console.error('Failed to load app name cache:', e);
  }
};

/**
 * 설치된 앱 목록으로 캐시 업데이트
 * + 기존 discovered apps의 이름도 함께 업데이트
 */
export const updateAppNameCache = async (
  apps: Array<{ packageName: string; appName: string }>
): Promise<void> => {
  try {
    // 1. 캐시 업데이트
    for (const app of apps) {
      if (app.packageName && app.appName) {
        appNameCache[app.packageName] = app.appName;
      }
    }
    await AsyncStorage.setItem(APP_NAME_CACHE_KEY, JSON.stringify(appNameCache));

    // 2. 기존 discovered apps의 이름도 업데이트 (캐시와 동기화)
    const discoveredApps = await getDiscoveredApps();
    let updated = false;
    for (const discovered of discoveredApps) {
      const correctName = appNameCache[discovered.package_name];
      if (correctName && discovered.app_name !== correctName) {
        discovered.app_name = correctName;
        updated = true;
      }
    }
    if (updated) {
      await saveDiscoveredApps(discoveredApps);
    }
  } catch (e) {
    console.error('Failed to update app name cache:', e);
  }
};

/**
 * 패키지명으로 앱 이름 조회
 */
export const getAppNameByPackage = (packageName: string): string => {
  // 1. 캐시에서 찾기
  if (appNameCache[packageName]) {
    return appNameCache[packageName];
  }

  // 2. 발견된 앱 목록에서 찾기 (동기적으로 접근 불가, 여기선 패스)

  // 3. 패키지명에서 추출 (fallback)
  const parts = packageName.split('.');
  const lastPart = parts[parts.length - 1];

  // 'app', 'mobile', 'android', 'kr' 같은 generic 이름이면 그 전 부분 사용
  const genericNames = ['app', 'mobile', 'android', 'kr', 'store', 'client'];
  if (genericNames.includes(lastPart.toLowerCase()) && parts.length > 2) {
    // 첫 글자 대문자로
    const name = parts[parts.length - 2];
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  return lastPart.charAt(0).toUpperCase() + lastPart.slice(1);
};

/**
 * 앱 이름 캐시에 추가 (단일)
 */
export const cacheAppName = async (packageName: string, appName: string): Promise<void> => {
  if (packageName && appName) {
    appNameCache[packageName] = appName;
    try {
      await AsyncStorage.setItem(APP_NAME_CACHE_KEY, JSON.stringify(appNameCache));
    } catch (e) {
      // 저장 실패해도 메모리 캐시는 유지
    }
  }
};
