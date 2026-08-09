/**
 * Supabase Client Configuration
 * 동적으로 설정을 로드하여 클라이언트 생성
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadDBConfig, getCachedConfig, DBConfig } from '../services/dbConfigService';

export const TABLE_NAME = 'push_messages';

let supabaseClient: SupabaseClient | null = null;

/**
 * Supabase 클라이언트 생성 (설정이 있을 때만)
 */
const createSupabaseClient = (config: DBConfig): SupabaseClient | null => {
  if (!config.supabaseUrl || !config.supabaseKey) {
    return null;
  }

  return createClient(config.supabaseUrl, config.supabaseKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
};

/**
 * Supabase 클라이언트 초기화 (앱 시작 시 호출)
 */
export const initSupabase = async (): Promise<boolean> => {
  const config = await loadDBConfig();
  supabaseClient = createSupabaseClient(config);
  return supabaseClient !== null;
};

/**
 * Supabase 클라이언트 가져오기
 */
export const getSupabase = (): SupabaseClient | null => {
  if (!supabaseClient) {
    const config = getCachedConfig();
    if (config) {
      supabaseClient = createSupabaseClient(config);
    }
  }
  return supabaseClient;
};

/**
 * Supabase 클라이언트 재설정 (설정 변경 시 호출)
 */
export const resetSupabase = async (): Promise<boolean> => {
  supabaseClient = null;
  return await initSupabase();
};

/**
 * Supabase 연결 테스트
 */
export const testSupabaseConnection = async (url: string, key: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const testClient = createClient(url, key, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });

    // 간단한 쿼리로 연결 테스트
    const { error } = await testClient.from(TABLE_NAME).select('id').limit(1);

    if (error) {
      // 테이블이 없는 경우는 연결은 성공한 것
      if (error.code === '42P01' || error.message.includes('does not exist')) {
        return { success: true, error: 'push_messages 테이블이 없습니다. 테이블을 먼저 생성하세요.' };
      }
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || 'Unknown error' };
  }
};

// 하위 호환성을 위한 export (deprecated)
// 설정 안 되어 있으면 빈 결과 반환하는 더미 객체
const createDummyBuilder = (): any => {
  const builder: any = {
    select: () => builder,
    insert: () => builder,
    update: () => builder,
    delete: () => builder,
    upsert: () => builder,
    eq: () => builder,
    neq: () => builder,
    gte: () => builder,
    lte: () => builder,
    like: () => builder,
    or: () => builder,
    order: () => builder,
    limit: () => builder,
    then: (resolve: any, reject?: any) => {
      Promise.resolve({ data: null, error: null, count: 0 }).then(resolve, reject);
    },
    catch: (reject: any) => Promise.resolve({ data: null, error: null, count: 0 }),
  };
  return builder;
};

export const supabase = {
  from: (table: string) => {
    const client = getSupabase();
    if (!client) {
      // 설정 안 됨 - 조용히 빈 결과 반환
      return createDummyBuilder();
    }
    return client.from(table);
  },
};
