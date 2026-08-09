import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  Platform,
  StatusBar,
  AppState,
  AppStateStatus,
  BackHandler,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  startListening,
  stopListening,
  checkPermission,
  getPermissionStatus,
  requestPermission,
  sendTestNotification,
} from './src/services/notificationService';
import { getRecentMessages, getTodayCount } from './src/services/supabaseService';
import { getDiscoveredApps, initAppNameCache, updateAppNameCache } from './src/services/appStorage';

// 설치된 앱 목록 로드 (Android 전용)
let RNAndroidInstalledApps: any = null;
try {
  RNAndroidInstalledApps = require('react-native-android-installed-apps');
} catch (e) {
  // 무시
}
import { PushMessage } from './src/types';
import SystemSettingsScreen from './src/screens/SystemSettingsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import DataManageScreen from './src/screens/DataManageScreen';
import DBConfigScreen from './src/screens/DBConfigScreen';
import { initSupabase } from './src/config/supabase';
import { hasDBConfig } from './src/services/dbConfigService';

const LISTENING_STATE_KEY = '@push_collector_listening';

type Screen = 'home' | 'settings' | 'system_settings' | 'history' | 'data' | 'dbconfig';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [isListening, setIsListening] = useState(true); // 기본값 true
  const [permissionStatus, setPermissionStatus] = useState<string>('unknown');
  const [todayCount, setTodayCount] = useState(0);
  const [recentMessages, setRecentMessages] = useState<PushMessage[]>([]);
  const [enabledAppCount, setEnabledAppCount] = useState(0);
  const [hiddenMessages, setHiddenMessages] = useState<Set<string>>(new Set());
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [dbConfigured, setDbConfigured] = useState<boolean | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const isInitialized = useRef(false);

  // 메시지 숨기기 (UI에서만, Supabase는 유지)
  const hideMessage = (message: PushMessage) => {
    const key = `${message.package_name}-${message.posted_at}`;
    setHiddenMessages(prev => new Set(prev).add(key));
  };

  // 숨김 해제
  const clearHiddenMessages = () => {
    setHiddenMessages(new Set());
  };

  // 메시지 확장 토글
  const toggleMessageExpand = (message: PushMessage) => {
    const key = `${message.package_name}-${message.posted_at}`;
    setExpandedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  // 메시지가 확장되었는지 확인
  const isMessageExpanded = (message: PushMessage): boolean => {
    const key = `${message.package_name}-${message.posted_at}`;
    return expandedMessages.has(key);
  };

  // 표시할 메시지 필터링
  const visibleMessages = recentMessages.filter(m => {
    const key = `${m.package_name}-${m.posted_at}`;
    return !hiddenMessages.has(key);
  });

  // 날짜 포맷 (오늘, 어제, 또는 날짜)
  const formatDateLabel = (dateStr: string): string => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return '오늘';
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return '어제';
    }
    return `${date.getMonth() + 1}월 ${date.getDate()}일`;
  };

  // 메시지의 날짜 추출 (YYYY-MM-DD)
  const getDateKey = (postedAt: string): string => {
    return postedAt.split('T')[0];
  };

  // 이전 메시지와 날짜가 다른지 확인
  const shouldShowDateSeparator = (index: number): boolean => {
    if (index === 0) return true;
    const currentDate = getDateKey(visibleMessages[index].posted_at);
    const prevDate = getDateKey(visibleMessages[index - 1].posted_at);
    return currentDate !== prevDate;
  };

  // 권한 상태 확인
  const refreshPermission = useCallback(async () => {
    const status = await getPermissionStatus();
    console.log('Permission status updated:', status);
    setPermissionStatus(status);
  }, []);

  const refreshData = useCallback(async () => {
    // DB 설정이 되어 있을 때만 Supabase 호출 (에러 무시)
    getTodayCount().then(setTodayCount).catch(() => { });
    getRecentMessages(10).then(setRecentMessages).catch(() => { });
    const apps = await getDiscoveredApps();
    setEnabledAppCount(apps.filter(a => a.is_enabled).length);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  // 수집 상태 저장
  const saveListeningState = async (listening: boolean) => {
    try {
      await AsyncStorage.setItem(LISTENING_STATE_KEY, JSON.stringify(listening));
    } catch (e) {
      console.error('Failed to save listening state:', e);
    }
  };

  // 앱 초기화: 저장된 상태 불러오고 자동 시작
  useEffect(() => {
    const initializeApp = async () => {
      if (isInitialized.current) return;
      isInitialized.current = true;

      // DB 설정 확인 및 초기화
      const dbOk = await hasDBConfig();
      setDbConfigured(dbOk);
      if (dbOk) {
        await initSupabase();
      }

      // 앱 이름 캐시 로드 (저장된 캐시)
      await initAppNameCache();

      // 설치된 앱 목록에서 앱 이름 캐시 업데이트 (앱 시작 시 바로 실행)
      if (RNAndroidInstalledApps) {
        try {
          const installedApps = await RNAndroidInstalledApps.getNonSystemApps();
          if (installedApps && installedApps.length > 0) {
            await updateAppNameCache(installedApps);
            console.log(`App name cache updated with ${installedApps.length} apps`);
          }
        } catch (e) {
          console.warn('Failed to load installed apps for cache:', e);
        }
      }

      // 저장된 상태 불러오기 (없으면 기본값 true)
      let shouldListen = true;
      try {
        const saved = await AsyncStorage.getItem(LISTENING_STATE_KEY);
        if (saved !== null) {
          shouldListen = JSON.parse(saved);
        }
      } catch (e) {
        console.error('Failed to load listening state:', e);
      }

      setIsListening(shouldListen);

      // 자동으로 수집 시작
      if (shouldListen) {
        startListening(() => {
          refreshData();
        });
        console.log('Auto-started listening');
      }
    };

    initializeApp();
  }, [refreshData]);

  // 앱 상태 변경 시 권한 재확인 (설정에서 돌아올 때)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        refreshPermission();
        refreshData();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // 초기 로드
    refreshPermission();
    refreshData();

    return () => {
      subscription.remove();
    };
  }, [refreshPermission, refreshData]);

  // Android 뒤로가기 버튼 처리
  useEffect(() => {
    const backAction = () => {
      if (currentScreen !== 'home') {
        setCurrentScreen('home');
        refreshData();
        return true; // 이벤트 소비 (앱 종료 방지)
      }
      return false; // 기본 동작 (앱 종료)
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => backHandler.remove();
  }, [currentScreen, refreshData]);

  const hasPermission = permissionStatus === 'authorized';

  const handleToggleListening = async () => {
    if (isListening) {
      stopListening();
      setIsListening(false);
      await saveListeningState(false);
    } else {
      startListening(() => {
        refreshData();
      });
      setIsListening(true);
      await saveListeningState(true);
    }
  };

  const handleTestNotification = async () => {
    if (!isListening) return; // 수집 중일 때만 작동
    await sendTestNotification();
    refreshData();
  };

  const handlePermissionPress = () => {
    // 권한 상태와 관계없이 항상 설정 화면으로 이동
    requestPermission();
  };

  const renderMessage = ({ item, index }: { item: PushMessage; index: number }) => {
    const isExpanded = isMessageExpanded(item);
    const showDateSeparator = shouldShowDateSeparator(index);

    return (
      <>
        {showDateSeparator && (
          <View style={styles.dateSeparator}>
            <View style={styles.dateSeparatorLine} />
            <Text style={styles.dateSeparatorText}>
              {formatDateLabel(item.posted_at)}
            </Text>
            <View style={styles.dateSeparatorLine} />
          </View>
        )}
        <TouchableOpacity
          style={styles.messageCard}
          onPress={() => toggleMessageExpand(item)}
          activeOpacity={0.7}
        >
          <View style={styles.messageHeader}>
            <Text style={styles.appName}>{item.app_name}</Text>
            <View style={styles.messageHeaderRight}>
              <Text style={styles.time}>
                {new Date(item.posted_at).toLocaleTimeString('ko-KR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
              <TouchableOpacity
                style={styles.hideButton}
                onPress={(e) => {
                  e.stopPropagation();
                  hideMessage(item);
                }}
              >
                <Text style={styles.hideButtonText}>×</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.title} numberOfLines={isExpanded ? undefined : 1}>
            {item.title}
          </Text>
          <Text style={styles.body} numberOfLines={isExpanded ? undefined : 2}>
            {item.body}
          </Text>
          {!isExpanded && (item.body?.length > 50 || item.title?.length > 30) && (
            <Text style={styles.expandHint}>탭하여 더 보기</Text>
          )}
          <View style={styles.tags}>
            {item.title?.includes('[테스트]') && <Text style={styles.tagTest}>테스트</Text>}
            {item.is_ad && <Text style={styles.tag}>광고</Text>}
            {item.category && item.category !== 'other' && (
              <Text style={styles.tagCategory}>{item.category}</Text>
            )}
            {item.has_emoji && <Text style={styles.tagEmoji}>이모지</Text>}
          </View>
        </TouchableOpacity>
      </>
    );
  };

  // 시스템 설정 화면
  if (currentScreen === 'system_settings') {
    return (
      <SystemSettingsScreen
        onBack={() => {
          setCurrentScreen('home');
          refreshData();
        }}
      />
    );
  }

  // 설정 화면
  if (currentScreen === 'settings') {
    return (
      <SettingsScreen
        onBack={() => {
          setCurrentScreen('home');
          refreshData();
        }}
      />
    );
  }

  // 히스토리 화면
  if (currentScreen === 'history') {
    return (
      <HistoryScreen
        onBack={() => {
          setCurrentScreen('home');
          refreshData();
        }}
      />
    );
  }

  // 데이터 관리 화면
  if (currentScreen === 'data') {
    return (
      <DataManageScreen
        onBack={() => {
          setCurrentScreen('home');
          refreshData();
        }}
      />
    );
  }

  // DB 설정 화면
  if (currentScreen === 'dbconfig') {
    return (
      <DBConfigScreen
        onBack={() => {
          setCurrentScreen('home');
        }}
        onConfigured={() => {
          setDbConfigured(true);
          setCurrentScreen('home');
          refreshData();
        }}
      />
    );
  }

  // 메인 화면
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f0f0f" />

      {/* Header - 상단 여백 포함 */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.liveIndicator}>
            <View style={[styles.liveDot, isListening && styles.liveDotActive]} />
            <Text style={styles.liveText}>{isListening ? 'LIVE' : 'OFF'}</Text>
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={styles.systemSettingsButton}
              onPress={() => setCurrentScreen('system_settings')}
            >
              <Text style={styles.settingsText}>시스템 설정</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => setCurrentScreen('settings')}
            >
              <Text style={styles.settingsText}>수집 앱 설정 ({enabledAppCount})</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>📡 PushRadar</Text>
          <TouchableOpacity
            style={styles.dbConfigButton}
            onPress={() => setCurrentScreen('dbconfig')}
          >
            <Text style={styles.dbConfigButtonText}>DB</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.headerSubtitle}>오늘 {todayCount}건 수집</Text>
      </View>

      {/* Permission Banner */}
      <TouchableOpacity
        style={[
          styles.permissionBanner,
          hasPermission && styles.permissionBannerSuccess
        ]}
        onPress={handlePermissionPress}
      >
        <Text style={styles.permissionText}>
          {hasPermission
            ? '✓ 알림 접근 권한 활성화됨'
            : `⚠ 알림 접근 권한 필요 (${permissionStatus})`}
        </Text>
      </TouchableOpacity>

      {/* DB Config Banner */}
      {dbConfigured === false && (
        <TouchableOpacity
          style={styles.dbConfigBanner}
          onPress={() => setCurrentScreen('dbconfig')}
        >
          <Text style={styles.dbConfigText}>
            ⚠ DB 설정 필요 - 탭하여 Supabase 연결
          </Text>
        </TouchableOpacity>
      )}

      {/* No Target Apps Warning */}
      {enabledAppCount === 0 && (
        <TouchableOpacity
          style={styles.noAppsBanner}
          onPress={() => setCurrentScreen('settings')}
        >
          <Text style={styles.noAppsText}>
            수집 대상 앱이 없습니다. 탭하여 설정
          </Text>
        </TouchableOpacity>
      )}

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.button, isListening && styles.buttonActive]}
          onPress={handleToggleListening}
        >
          <Text style={styles.buttonText}>
            {isListening ? '수집 중지' : '수집 시작'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.buttonSecondary,
            isListening && styles.buttonSecondaryActive
          ]}
          onPress={handleTestNotification}
          disabled={!isListening}
        >
          <Text style={[
            styles.buttonSecondaryText,
            isListening && styles.buttonSecondaryTextActive
          ]}>
            테스트
          </Text>
        </TouchableOpacity>
      </View>

      {/* Message List */}
      <View style={styles.listContainer}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>최근 수집 메시지</Text>
          <View style={styles.sectionActions}>
            {hiddenMessages.size > 0 && (
              <TouchableOpacity onPress={clearHiddenMessages}>
                <Text style={styles.clearHiddenText}>
                  숨김 {hiddenMessages.size}건
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setCurrentScreen('history')}>
              <Text style={styles.historyLink}>히스토리</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setCurrentScreen('data')}>
              <Text style={styles.dataLink}>관리</Text>
            </TouchableOpacity>
          </View>
        </View>
        <FlatList
          data={visibleMessages}
          renderItem={renderMessage}
          keyExtractor={(item, index) => `${item.package_name}-${item.posted_at}-${index}`}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#888" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>수집된 메시지가 없습니다</Text>
              <Text style={styles.emptySubtext}>
                설정에서 수집할 앱을 선택하세요
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  header: {
    padding: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 16 : 50,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start', // 상단 정렬로 변경
    marginBottom: 12,
  },
  headerButtons: {
    alignItems: 'flex-end',
    gap: 8,
  },
  systemSettingsButton: {
    backgroundColor: '#1c1c1e',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 0,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#666',
    marginRight: 6,
  },
  liveDotActive: {
    backgroundColor: '#ff3b30',
  },
  liveText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  settingsButton: {
    backgroundColor: '#1c1c1e',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  settingsText: {
    color: '#0a84ff',
    fontSize: 14,
    fontWeight: '500',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#666',
    fontSize: 14,
    marginTop: 4,
  },
  permissionBanner: {
    backgroundColor: '#ff9500',
    padding: 14,
    marginHorizontal: 20,
    borderRadius: 10,
    marginBottom: 10,
  },
  permissionBannerSuccess: {
    backgroundColor: '#30d158',
  },
  permissionText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 14,
  },
  noAppsBanner: {
    backgroundColor: '#5856d6',
    padding: 14,
    marginHorizontal: 20,
    borderRadius: 10,
    marginBottom: 10,
  },
  noAppsText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 14,
  },
  controls: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  button: {
    flex: 1,
    backgroundColor: '#1c1c1e',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonActive: {
    backgroundColor: '#ff3b30',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSecondary: {
    backgroundColor: '#1c1c1e',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  buttonSecondaryActive: {
    backgroundColor: '#2c2c2e',
  },
  buttonSecondaryText: {
    color: '#555',
    fontSize: 16,
    fontWeight: '500',
  },
  buttonSecondaryTextActive: {
    color: '#fff',
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#888',
    fontSize: 14,
  },
  sectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clearHiddenText: {
    color: '#888',
    fontSize: 13,
  },
  historyLink: {
    color: '#0a84ff',
    fontSize: 13,
    fontWeight: '500',
  },
  dataLink: {
    color: '#ff9500',
    fontSize: 13,
    fontWeight: '500',
  },
  messageCard: {
    backgroundColor: '#1c1c1e',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  messageHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hideButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#3a3a3c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hideButtonText: {
    color: '#888',
    fontSize: 16,
    fontWeight: '300',
    marginTop: -1,
  },
  appName: {
    color: '#fff',
    fontWeight: '600',
  },
  time: {
    color: '#666',
    fontSize: 12,
  },
  title: {
    color: '#fff',
    fontSize: 15,
    marginBottom: 4,
  },
  body: {
    color: '#888',
    fontSize: 13,
    lineHeight: 18,
  },
  expandHint: {
    color: '#0a84ff',
    fontSize: 12,
    marginTop: 4,
  },
  tags: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  tag: {
    backgroundColor: '#ff3b30',
    color: '#fff',
    fontSize: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    overflow: 'hidden',
  },
  tagCategory: {
    backgroundColor: '#30d158',
    color: '#fff',
    fontSize: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    overflow: 'hidden',
  },
  tagEmoji: {
    backgroundColor: '#5856d6',
    color: '#fff',
    fontSize: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    overflow: 'hidden',
  },
  tagTest: {
    backgroundColor: '#ff9500',
    color: '#fff',
    fontSize: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    overflow: 'hidden',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    color: '#888',
    fontSize: 16,
    marginBottom: 4,
  },
  emptySubtext: {
    color: '#666',
    fontSize: 14,
  },
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    paddingHorizontal: 4,
  },
  dateSeparatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#2c2c2e',
  },
  dateSeparatorText: {
    color: '#888',
    fontSize: 12,
    fontWeight: '500',
    paddingHorizontal: 12,
  },
  dbConfigBanner: {
    backgroundColor: '#ff3b30',
    padding: 14,
    marginHorizontal: 20,
    borderRadius: 10,
    marginBottom: 10,
  },
  dbConfigText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 14,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dbConfigButton: {
    backgroundColor: '#2c2c2e',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  dbConfigButtonText: {
    color: '#888',
    fontSize: 12,
    fontWeight: '500',
  },
});
