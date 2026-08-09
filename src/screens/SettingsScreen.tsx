/**
 * Settings Screen
 * 설치된 앱 목록에서 수집할 앱 선택
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Switch,
  RefreshControl,
  SafeAreaView,
  Platform,
  StatusBar,
  TextInput,
  ActivityIndicator,
  SectionList,
} from 'react-native';
import {
  getDiscoveredApps,
  toggleAppEnabled,
  registerApp,
  DiscoveredApp,
  updateAppNameCache,
} from '../services/appStorage';
// 안전하게 InstalledApps 로드 (Android 전용)
let RNAndroidInstalledApps: any = null;
try {
  RNAndroidInstalledApps = require('react-native-android-installed-apps');
} catch (e) {
  console.warn('react-native-android-installed-apps not available:', e);
}

interface InstalledApp {
  packageName: string;
  appName: string;
  versionName: string;
  versionCode: number;
  icon: string;
}

interface Props {
  onBack: () => void;
}

type TabType = 'active' | 'recommended' | 'all';

export default function SettingsScreen({ onBack }: Props) {
  const [installedApps, setInstalledApps] = useState<InstalledApp[]>([]);
  const [registeredApps, setRegisteredApps] = useState<DiscoveredApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [tab, setTab] = useState<TabType>('active');

  // 등록된 앱 로드
  const loadRegisteredApps = useCallback(async () => {
    const apps = await getDiscoveredApps();
    setRegisteredApps(apps);
  }, []);

  // 설치된 앱 로드 (Android 전용)
  const loadInstalledApps = useCallback(async () => {
    if (!RNAndroidInstalledApps) {
      console.warn('RNAndroidInstalledApps module not available');
      setInstalledApps([]);
      return;
    }
    try {
      const apps = await RNAndroidInstalledApps.getNonSystemApps();
      if (!apps) {
        setInstalledApps([]);
        return;
      }
      const sorted = apps
        .filter((app: InstalledApp) => app.appName)
        .sort((a: InstalledApp, b: InstalledApp) => a.appName.localeCompare(b.appName));
      setInstalledApps(sorted);

      // 앱 이름 캐시 업데이트 (알림 수신 시 앱 이름 조회용)
      await updateAppNameCache(sorted);
    } catch (error) {
      console.error('Failed to load installed apps:', error);
      setInstalledApps([]);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([loadRegisteredApps(), loadInstalledApps()]);
      setLoading(false);
    };
    init();
  }, [loadRegisteredApps, loadInstalledApps]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadRegisteredApps(), loadInstalledApps()]);
    setRefreshing(false);
  };

  // 앱 토글
  const handleToggle = async (packageName: string, appName: string, currentlyEnabled: boolean) => {
    const isRegistered = registeredApps.some(a => a.package_name === packageName);

    if (!isRegistered) {
      await registerApp(packageName, appName);
    } else {
      await toggleAppEnabled(packageName);
    }
    await loadRegisteredApps();
  };

  // 앱 활성화 상태 확인
  const isAppEnabled = (packageName: string): boolean => {
    const app = registeredApps.find(a => a.package_name === packageName);
    return app?.is_enabled ?? false;
  };

  // 필터링된 데이터
  const activeApps = registeredApps.filter(a => a.is_enabled);
  const recommendedApps = registeredApps.filter(a => !a.is_enabled && a.notification_count > 0);

  const filteredInstalledApps = installedApps.filter(app =>
    app.appName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    app.packageName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const enabledCount = activeApps.length;

  // 등록된 앱 렌더링
  const renderRegisteredApp = ({ item }: { item: DiscoveredApp }) => (
    <View style={styles.appCard}>
      <View style={styles.appInfo}>
        <Text style={styles.appName}>{item.app_name}</Text>
        <Text style={styles.packageName}>{item.package_name}</Text>
        <Text style={styles.statText}>
          {item.notification_count > 0
            ? `알림: ${item.notification_count}건 / 수집: ${item.collected_count}건`
            : `수집: ${item.collected_count}건`
          }
        </Text>
      </View>
      <Switch
        value={item.is_enabled}
        onValueChange={() => handleToggle(item.package_name, item.app_name, item.is_enabled)}
        trackColor={{ false: '#3a3a3c', true: '#30d158' }}
        thumbColor="#fff"
      />
    </View>
  );

  // 추천 앱 렌더링 (알림 받았지만 미등록)
  const renderRecommendedApp = ({ item }: { item: DiscoveredApp }) => (
    <View style={styles.appCard}>
      <View style={styles.appInfo}>
        <View style={styles.recommendBadgeRow}>
          <Text style={styles.appName}>{item.app_name}</Text>
          <View style={styles.recommendBadge}>
            <Text style={styles.recommendBadgeText}>NEW</Text>
          </View>
        </View>
        <Text style={styles.packageName}>{item.package_name}</Text>
        <Text style={styles.statText}>알림 {item.notification_count}건 수신됨</Text>
      </View>
      <Switch
        value={item.is_enabled}
        onValueChange={() => handleToggle(item.package_name, item.app_name, item.is_enabled)}
        trackColor={{ false: '#3a3a3c', true: '#30d158' }}
        thumbColor="#fff"
      />
    </View>
  );

  // 설치된 앱 렌더링
  const renderInstalledApp = ({ item }: { item: InstalledApp }) => {
    const enabled = isAppEnabled(item.packageName);
    const registered = registeredApps.find(a => a.package_name === item.packageName);

    return (
      <View style={styles.appCard}>
        <View style={styles.appInfo}>
          <Text style={styles.appName}>{item.appName}</Text>
          <Text style={styles.packageName}>{item.packageName}</Text>
          {registered && (
            <Text style={styles.statText}>
              {registered.notification_count > 0
                ? `알림: ${registered.notification_count}건`
                : '등록됨'
              }
            </Text>
          )}
        </View>
        <Switch
          value={enabled}
          onValueChange={() => handleToggle(item.packageName, item.appName, enabled)}
          trackColor={{ false: '#3a3a3c', true: '#30d158' }}
          thumbColor="#fff"
        />
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0a84ff" />
          <Text style={styles.loadingText}>앱 목록 로딩 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>← 뒤로</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>수집 앱 설정</Text>
        <View style={styles.headerRight}>
          <Text style={styles.enabledCount}>{enabledCount}개 활성</Text>
        </View>
      </View>



      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'active' && styles.tabActive]}
          onPress={() => setTab('active')}
        >
          <Text style={[styles.tabText, tab === 'active' && styles.tabTextActive]}>
            활성 ({activeApps.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'recommended' && styles.tabActive]}
          onPress={() => setTab('recommended')}
        >
          <Text style={[styles.tabText, tab === 'recommended' && styles.tabTextActive]}>
            추천 ({recommendedApps.length})
          </Text>
          {recommendedApps.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{recommendedApps.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'all' && styles.tabActive]}
          onPress={() => setTab('all')}
        >
          <Text style={[styles.tabText, tab === 'all' && styles.tabTextActive]}>
            전체 앱
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search (only for all apps tab) */}
      {tab === 'all' && (
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="앱 이름으로 검색..."
            placeholderTextColor="#666"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      )}

      {/* List */}
      {tab === 'active' ? (
        <FlatList
          data={activeApps}
          renderItem={renderRegisteredApp}
          keyExtractor={(item) => item.package_name}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#888" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📱</Text>
              <Text style={styles.emptyTitle}>활성화된 앱이 없습니다</Text>
              <Text style={styles.emptyText}>
                '추천' 또는 '전체 앱' 탭에서{'\n'}수집할 앱을 선택하세요
              </Text>
            </View>
          }
        />
      ) : tab === 'recommended' ? (
        <FlatList
          data={recommendedApps}
          renderItem={renderRecommendedApp}
          keyExtractor={(item) => item.package_name}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#888" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>✨</Text>
              <Text style={styles.emptyTitle}>추천 앱이 없습니다</Text>
              <Text style={styles.emptyText}>
                알림이 오면 자동으로 여기에{'\n'}추천 앱이 표시됩니다
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={filteredInstalledApps}
          renderItem={renderInstalledApp}
          keyExtractor={(item) => item.packageName}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#888" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyTitle}>앱을 찾을 수 없습니다</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#888',
    marginTop: 12,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 16 : 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1c1c1e',
  },
  backButton: {
    padding: 8,
  },
  backText: {
    color: '#0a84ff',
    fontSize: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  headerRight: {
    minWidth: 80,
    alignItems: 'flex-end',
  },
  enabledCount: {
    color: '#30d158',
    fontSize: 14,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#1c1c1e',
  },
  systemSettings: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2c2c2e',
    backgroundColor: '#1c1c1e',
    marginBottom: 10,
  },
  systemSettingsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  systemSettingsDesc: {
    fontSize: 12,
    color: '#8e8e93',
    marginBottom: 12,
  },
  settingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#2c2c2e',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '500',
  },
  settingSubtitle: {
    fontSize: 12,
    color: '#8e8e93',
    marginTop: 2,
  },
  settingArrow: {
    fontSize: 20,
    color: '#636366',
    fontWeight: '600',
  },
  statusOk: {
    fontSize: 13,
    color: '#30d158',
    fontWeight: '600',
  },
  statusWarning: {
    fontSize: 13,
    color: '#ff9f0a',
    fontWeight: '600',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#0a84ff',
  },
  tabText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#0a84ff',
  },
  badge: {
    backgroundColor: '#ff453a',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  searchContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  searchInput: {
    backgroundColor: '#1c1c1e',
    borderRadius: 10,
    padding: 12,
    color: '#fff',
    fontSize: 15,
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
  appCard: {
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  appInfo: {
    flex: 1,
  },
  appName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  packageName: {
    color: '#666',
    fontSize: 11,
    marginBottom: 4,
  },
  statText: {
    color: '#888',
    fontSize: 12,
  },
  recommendBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  recommendBadge: {
    backgroundColor: '#ff9f0a',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  recommendBadgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
});
