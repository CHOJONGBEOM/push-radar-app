/**
 * Supabase Service
 * DB 저장 및 조회 기능
 */

import { supabase, TABLE_NAME } from '../config/supabase';
import { PushMessage } from '../types';

/**
 * 푸시 메시지 저장 (중복 시 무시)
 */
export const insertMessage = async (message: PushMessage): Promise<boolean> => {
  console.log('insertMessage called:', message.app_name, message.title);
  try {
    const { error } = await supabase
      .from(TABLE_NAME)
      .upsert(message, {
        // device_id가 포함된 새로운 중복 체크 제약조건 사용
        onConflict: 'package_name,body,posted_at,device_id',
        ignoreDuplicates: true,
      });

    if (error) {
      // 중복 키 에러는 정상 처리
      if (error.code === '23505') {
        console.log('Duplicate message skipped:', message.app_name, message.title);
        return true;
      }
      console.error('Insert error:', error.message, error.code);
      return false;
    }

    console.log('Message saved:', message.app_name, message.title);
    return true;
  } catch (e: any) {
    console.error('Insert exception:', e?.message || e);
    return false;
  }
};

/**
 * 최근 메시지 조회 (숨김 제외)
 */
export const getRecentMessages = async (limit: number = 20): Promise<PushMessage[]> => {
  try {
    // is_hidden 필터 시도
    let { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .or('is_hidden.is.null,is_hidden.eq.false')
      .order('posted_at', { ascending: false })
      .limit(limit);

    // is_hidden 컬럼 없으면 필터 없이 재시도
    if (error) {
      const errMsg = error?.message || '';
      if (errMsg === '' || errMsg.includes('is_hidden')) {
        const fallback = await supabase
          .from(TABLE_NAME)
          .select('*')
          .order('posted_at', { ascending: false })
          .limit(limit);
        data = fallback.data;
        error = fallback.error;
      }
    }

    if (error) {
      console.error('Fetch error:', error);
      return [];
    }

    return data || [];
  } catch (e) {
    console.error('Fetch exception:', e);
    return [];
  }
};

/**
 * 특정 날짜의 메시지 조회 (숨김 제외)
 */
export const getMessagesByDate = async (date: Date): Promise<PushMessage[]> => {
  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    let { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .gte('posted_at', startOfDay.toISOString())
      .lte('posted_at', endOfDay.toISOString())
      .or('is_hidden.is.null,is_hidden.eq.false')
      .order('posted_at', { ascending: false });

    // is_hidden 컬럼 없으면 필터 없이 재시도
    if (error) {
      const errMsg = error?.message || '';
      if (errMsg === '' || errMsg.includes('is_hidden')) {
        const fallback = await supabase
          .from(TABLE_NAME)
          .select('*')
          .gte('posted_at', startOfDay.toISOString())
          .lte('posted_at', endOfDay.toISOString())
          .order('posted_at', { ascending: false });
        data = fallback.data;
        error = fallback.error;
      }
    }

    if (error) {
      console.error('Fetch by date error:', error);
      return [];
    }

    return data || [];
  } catch (e) {
    console.error('Fetch by date exception:', e);
    return [];
  }
};

/**
 * 수집 가능한 날짜 목록 조회 (데이터가 있는 날짜들)
 */
export const getAvailableDates = async (): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('posted_at')
      .order('posted_at', { ascending: false });

    if (error) {
      console.error('Fetch dates error:', error);
      return [];
    }

    // 중복 제거하여 날짜만 추출
    const dates = new Set<string>();
    data?.forEach((row: { posted_at: string }) => {
      const date = new Date(row.posted_at).toISOString().split('T')[0];
      dates.add(date);
    });

    return Array.from(dates);
  } catch (e) {
    console.error('Fetch dates exception:', e);
    return [];
  }
};

/**
 * 특정 날짜의 메시지 수
 */
export const getCountByDate = async (date: Date): Promise<number> => {
  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const { count, error } = await supabase
      .from(TABLE_NAME)
      .select('*', { count: 'exact', head: true })
      .gte('posted_at', startOfDay.toISOString())
      .lte('posted_at', endOfDay.toISOString());

    if (error) {
      console.error('Count by date error:', error);
      return 0;
    }

    return count || 0;
  } catch (e) {
    console.error('Count by date exception:', e);
    return 0;
  }
};

/**
 * 오늘 수집된 메시지 수 (숨김 제외)
 */
export const getTodayCount = async (): Promise<number> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let { count, error } = await supabase
      .from(TABLE_NAME)
      .select('*', { count: 'exact', head: true })
      .gte('posted_at', today.toISOString())
      .or('is_hidden.is.null,is_hidden.eq.false');

    // is_hidden 컬럼 없으면 필터 없이 재시도
    // (에러 메시지가 비어있거나 is_hidden 관련이면 fallback)
    if (error) {
      const errMsg = error?.message || '';
      if (errMsg === '' || errMsg.includes('is_hidden')) {
        const fallback = await supabase
          .from(TABLE_NAME)
          .select('*', { count: 'exact', head: true })
          .gte('posted_at', today.toISOString());
        count = fallback.count;
        error = fallback.error;
      }
    }

    if (error) {
      console.error('Count error:', error);
      return 0;
    }

    return count || 0;
  } catch (e) {
    console.error('Count exception:', e);
    return 0;
  }
};

/**
 * 전체 메시지 수 (숨김 제외)
 */
export const getTotalCount = async (): Promise<number> => {
  try {
    let { count, error } = await supabase
      .from(TABLE_NAME)
      .select('*', { count: 'exact', head: true })
      .or('is_hidden.is.null,is_hidden.eq.false');

    // is_hidden 컬럼 없으면 필터 없이 재시도
    if (error) {
      const errMsg = error?.message || '';
      if (errMsg === '' || errMsg.includes('is_hidden')) {
        const fallback = await supabase
          .from(TABLE_NAME)
          .select('*', { count: 'exact', head: true });
        count = fallback.count;
        error = fallback.error;
      }
    }

    if (error) {
      console.error('Total count error:', error);
      return 0;
    }

    return count || 0;
  } catch (e) {
    console.error('Total count exception:', e);
    return 0;
  }
};

/**
 * 개별 메시지 삭제
 */
export const deleteMessage = async (id: number): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Delete error:', error);
      return false;
    }

    return true;
  } catch (e) {
    console.error('Delete exception:', e);
    return false;
  }
};

/**
 * 테스트 메시지 삭제 (title에 [테스트] 포함)
 */
export const deleteTestMessages = async (): Promise<number> => {
  try {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .like('title', '%[테스트]%')
      .select();

    if (error) {
      console.error('Delete test messages error:', error);
      return 0;
    }

    return data?.length || 0;
  } catch (e) {
    console.error('Delete test messages exception:', e);
    return 0;
  }
};

/**
 * 특정 날짜의 메시지 삭제
 */
export const deleteMessagesByDate = async (date: Date): Promise<number> => {
  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .gte('posted_at', startOfDay.toISOString())
      .lte('posted_at', endOfDay.toISOString())
      .select();

    if (error) {
      console.error('Delete by date error:', error);
      return 0;
    }

    return data?.length || 0;
  } catch (e) {
    console.error('Delete by date exception:', e);
    return 0;
  }
};

/**
 * 전체 메시지 삭제
 */
export const deleteAllMessages = async (): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .neq('id', 0); // 모든 레코드 삭제

    if (error) {
      console.error('Delete all error:', error);
      return false;
    }

    return true;
  } catch (e) {
    console.error('Delete all exception:', e);
    return false;
  }
};

/**
 * 특정 앱의 메시지 조회 (숨김 제외)
 */
export const getMessagesByApp = async (appName: string): Promise<PushMessage[]> => {
  try {
    let { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('app_name', appName)
      .or('is_hidden.is.null,is_hidden.eq.false')
      .order('posted_at', { ascending: false });

    // is_hidden 컬럼 없으면 필터 없이 재시도
    if (error) {
      const errMsg = error?.message || '';
      if (errMsg === '' || errMsg.includes('is_hidden')) {
        const fallback = await supabase
          .from(TABLE_NAME)
          .select('*')
          .eq('app_name', appName)
          .order('posted_at', { ascending: false });
        data = fallback.data;
        error = fallback.error;
      }
    }

    if (error) {
      console.error('Fetch by app error:', error);
      return [];
    }

    return data || [];
  } catch (e) {
    console.error('Fetch by app exception:', e);
    return [];
  }
};

/**
 * 통계 조회 (앱별 메시지 수) - 숨김 제외
 */
export const getAppStats = async (): Promise<Record<string, number>> => {
  try {
    let { data, error } = await supabase
      .from(TABLE_NAME)
      .select('app_name')
      .or('is_hidden.is.null,is_hidden.eq.false');

    // is_hidden 컬럼 없으면 필터 없이 재시도
    if (error) {
      const errMsg = error?.message || '';
      if (errMsg === '' || errMsg.includes('is_hidden')) {
        const fallback = await supabase
          .from(TABLE_NAME)
          .select('app_name');
        data = fallback.data;
        error = fallback.error;
      }
    }

    if (error) {
      console.error('Stats error:', error);
      return {};
    }

    const stats: Record<string, number> = {};
    data?.forEach((row: { app_name: string }) => {
      stats[row.app_name] = (stats[row.app_name] || 0) + 1;
    });

    return stats;
  } catch (e) {
    console.error('Stats exception:', e);
    return {};
  }
};

/**
 * 메시지 숨기기 (soft delete)
 */
export const hideMessage = async (id: number): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from(TABLE_NAME)
      .update({ is_hidden: true })
      .eq('id', id);

    if (error) {
      console.error('Hide message error:', error);
      return false;
    }

    return true;
  } catch (e) {
    console.error('Hide message exception:', e);
    return false;
  }
};

/**
 * 메시지 숨김 해제
 */
export const unhideMessage = async (id: number): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from(TABLE_NAME)
      .update({ is_hidden: false })
      .eq('id', id);

    if (error) {
      console.error('Unhide message error:', error);
      return false;
    }

    return true;
  } catch (e) {
    console.error('Unhide message exception:', e);
    return false;
  }
};

/**
 * 숨겨진 메시지 목록 조회
 */
export const getHiddenMessages = async (): Promise<PushMessage[]> => {
  try {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('is_hidden', true)
      .order('posted_at', { ascending: false });

    // is_hidden 컬럼 없으면 빈 배열 반환
    if (error) {
      const errMsg = error?.message || '';
      if (errMsg === '' || errMsg.includes('is_hidden')) {
        return [];
      }
      console.error('Fetch hidden error:', error);
      return [];
    }

    return data || [];
  } catch (e) {
    console.error('Fetch hidden exception:', e);
    return [];
  }
};

/**
 * 숨겨진 메시지 수
 */
export const getHiddenCount = async (): Promise<number> => {
  try {
    const { count, error } = await supabase
      .from(TABLE_NAME)
      .select('*', { count: 'exact', head: true })
      .eq('is_hidden', true);

    // is_hidden 컬럼 없으면 0 반환
    if (error) {
      const errMsg = error?.message || '';
      if (errMsg === '' || errMsg.includes('is_hidden')) {
        return 0;
      }
      console.error('Hidden count error:', error);
      return 0;
    }

    return count || 0;
  } catch (e) {
    console.error('Hidden count exception:', e);
    return 0;
  }
};

/**
 * 모든 숨김 해제
 */
export const unhideAllMessages = async (): Promise<number> => {
  try {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update({ is_hidden: false })
      .eq('is_hidden', true)
      .select();

    if (error) {
      console.error('Unhide all error:', error);
      return 0;
    }

    return data?.length || 0;
  } catch (e) {
    console.error('Unhide all exception:', e);
    return 0;
  }
};
