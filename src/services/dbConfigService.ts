/**
 * DB Configuration Service
 * Supabase 설정을 AsyncStorage에 저장/로드
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const DB_CONFIG_KEY = '@push_collector_db_config';

export interface DBConfig {
  supabaseUrl: string;
  supabaseKey: string;
}

// 기본값 (빈 값 - 사용자가 직접 입력해야 함)
const DEFAULT_CONFIG: DBConfig = {
  supabaseUrl: '',
  supabaseKey: '',
};

let cachedConfig: DBConfig | null = null;

/**
 * DB 설정 로드
 */
export const loadDBConfig = async (): Promise<DBConfig> => {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    const saved = await AsyncStorage.getItem(DB_CONFIG_KEY);
    if (saved) {
      cachedConfig = JSON.parse(saved);
      return cachedConfig!;
    }
  } catch (e) {
    console.error('Failed to load DB config:', e);
  }

  return DEFAULT_CONFIG;
};

/**
 * DB 설정 저장
 */
export const saveDBConfig = async (config: DBConfig): Promise<boolean> => {
  try {
    await AsyncStorage.setItem(DB_CONFIG_KEY, JSON.stringify(config));
    cachedConfig = config;
    return true;
  } catch (e) {
    console.error('Failed to save DB config:', e);
    return false;
  }
};

/**
 * DB 설정이 있는지 확인
 */
export const hasDBConfig = async (): Promise<boolean> => {
  const config = await loadDBConfig();
  return !!(config.supabaseUrl && config.supabaseKey);
};

/**
 * DB 설정 초기화 (삭제)
 */
export const clearDBConfig = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(DB_CONFIG_KEY);
    cachedConfig = null;
  } catch (e) {
    console.error('Failed to clear DB config:', e);
  }
};

/**
 * 캐시된 설정 가져오기 (동기)
 */
export const getCachedConfig = (): DBConfig | null => {
  return cachedConfig;
};
