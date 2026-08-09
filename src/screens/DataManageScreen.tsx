/**
 * Data Manage Screen
 * Supabase 데이터 관리 (조회, 삭제)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  StatusBar,
  Alert,
  ScrollView,
  RefreshControl,
} from 'react-native';
import {
  getTotalCount,
  getTodayCount,
  getAppStats,
  deleteTestMessages,
  deleteAllMessages,
  getAvailableDates,
  getMessagesByApp,
  hideMessage,
  unhideMessage,
  getHiddenMessages,
  getHiddenCount,
  unhideAllMessages,
} from '../services/supabaseService';
import { PushMessage } from '../types';

interface Props {
  onBack: () => void;
}

export default function DataManageScreen({ onBack }: Props) {
  const [totalCount, setTotalCount] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [appStats, setAppStats] = useState<Record<string, number>>({});
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [appMessages, setAppMessages] = useState<PushMessage[]>([]);
  const [hiddenCount, setHiddenCount] = useState(0);
  const [hiddenMessages, setHiddenMessages] = useState<PushMessage[]>([]);
  const [showHidden, setShowHidden] = useState(false);

  const loadData = useCallback(async () => {
    const [total, today, stats, dates, hidden] = await Promise.all([
      getTotalCount(),
      getTodayCount(),
      getAppStats(),
      getAvailableDates(),
      getHiddenCount(),
    ]);
    setTotalCount(total);
    setTodayCount(today);
    setAppStats(stats);
    setAvailableDates(dates);
    setHiddenCount(hidden);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleDeleteTest = () => {
    Alert.alert(
      '테스트 데이터 삭제',
      '제목에 [테스트]가 포함된 모든 메시지를 삭제합니다.\n계속하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            const deleted = await deleteTestMessages();
            setLoading(false);
            Alert.alert('완료', `${deleted}건의 테스트 데이터가 삭제되었습니다.`);
            loadData();
          },
        },
      ]
    );
  };

  const handleDeleteAll = () => {
    Alert.alert(
      '⚠️ 전체 삭제',
      `정말로 모든 데이터(${totalCount}건)를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '전체 삭제',
          style: 'destructive',
          onPress: () => {
            // 2차 확인
            Alert.alert(
              '최종 확인',
              '정말 삭제하시겠습니까?',
              [
                { text: '취소', style: 'cancel' },
                {
                  text: '삭제',
                  style: 'destructive',
                  onPress: async () => {
                    setLoading(true);
                    await deleteAllMessages();
                    setLoading(false);
                    Alert.alert('완료', '모든 데이터가 삭제되었습니다.');
                    loadData();
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const sortedApps = Object.entries(appStats).sort((a, b) => b[1] - a[1]);

  const handleAppClick = async (appName: string) => {
    if (selectedApp === appName) {
      // 같은 앱 클릭 시 접기
      setSelectedApp(null);
      setAppMessages([]);
    } else {
      setLoading(true);
      setSelectedApp(appName);
      const messages = await getMessagesByApp(appName);
      setAppMessages(messages);
      setLoading(false);
    }
  };

  const handleHideMessage = async (msg: PushMessage) => {
    if (!msg.id) return;

    Alert.alert(
      '메시지 숨기기',
      '이 메시지를 숨기시겠습니까?\n(데이터는 유지되며 언제든 복원 가능)',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '숨기기',
          onPress: async () => {
            setLoading(true);
            await hideMessage(msg.id!);
            // 현재 선택된 앱의 메시지 다시 로드
            if (selectedApp) {
              const messages = await getMessagesByApp(selectedApp);
              setAppMessages(messages);
            }
            await loadData();
            setLoading(false);
          },
        },
      ]
    );
  };

  const handleUnhideMessage = async (msg: PushMessage) => {
    if (!msg.id) return;

    setLoading(true);
    await unhideMessage(msg.id);
    const hidden = await getHiddenMessages();
    setHiddenMessages(hidden);
    await loadData();
    setLoading(false);
  };

  const handleShowHidden = async () => {
    if (showHidden) {
      setShowHidden(false);
      setHiddenMessages([]);
    } else {
      setLoading(true);
      const hidden = await getHiddenMessages();
      setHiddenMessages(hidden);
      setShowHidden(true);
      setLoading(false);
    }
  };

  const handleUnhideAll = () => {
    Alert.alert(
      '전체 복원',
      `숨겨진 ${hiddenCount}건의 메시지를 모두 복원합니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '복원',
          onPress: async () => {
            setLoading(true);
            await unhideAllMessages();
            setShowHidden(false);
            setHiddenMessages([]);
            await loadData();
            setLoading(false);
          },
        },
      ]
    );
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('ko-KR', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>← 뒤로</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>데이터 관리</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#888"
          />
        }
      >
        {/* Stats Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📊 통계</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{totalCount}</Text>
              <Text style={styles.statLabel}>전체</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{todayCount}</Text>
              <Text style={styles.statLabel}>오늘</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{availableDates.length}</Text>
              <Text style={styles.statLabel}>일수</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{sortedApps.length}</Text>
              <Text style={styles.statLabel}>앱 수</Text>
            </View>
          </View>
        </View>

        {/* App Stats Card */}
        {sortedApps.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📱 앱별 수집 현황</Text>
            <Text style={styles.cardHint}>앱 이름을 탭하면 메시지 목록 표시</Text>
            {sortedApps.map(([app, count]) => (
              <View key={app}>
                <TouchableOpacity
                  style={[
                    styles.appRow,
                    selectedApp === app && styles.appRowSelected,
                  ]}
                  onPress={() => handleAppClick(app)}
                >
                  <Text style={[
                    styles.appName,
                    selectedApp === app && styles.appNameSelected,
                  ]}>
                    {selectedApp === app ? '▼ ' : '▶ '}{app}
                  </Text>
                  <Text style={styles.appCount}>{count}건</Text>
                </TouchableOpacity>

                {/* 선택된 앱의 메시지 목록 */}
                {selectedApp === app && appMessages.length > 0 && (
                  <View style={styles.messageList}>
                    {appMessages.map((msg, idx) => (
                      <View key={`${msg.posted_at}-${idx}`} style={styles.messageItem}>
                        <View style={styles.messageHeader}>
                          <Text style={styles.messageTitle} numberOfLines={1}>
                            {msg.title}
                          </Text>
                          <View style={styles.messageActions}>
                            <Text style={styles.messageTime}>
                              {formatTime(msg.posted_at)}
                            </Text>
                            <TouchableOpacity
                              style={styles.hideButton}
                              onPress={() => handleHideMessage(msg)}
                            >
                              <Text style={styles.hideButtonText}>숨김</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                        <Text style={styles.messageBody} numberOfLines={2}>
                          {msg.body}
                        </Text>
                        {(msg.is_ad || msg.category) && (
                          <View style={styles.messageTags}>
                            {msg.is_ad && <Text style={styles.tagAd}>광고</Text>}
                            {msg.category && <Text style={styles.tagCategory}>{msg.category}</Text>}
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Hidden Messages */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>📦 숨긴 메시지</Text>
            {hiddenCount > 0 && (
              <Text style={styles.hiddenBadge}>{hiddenCount}건</Text>
            )}
          </View>

          {hiddenCount === 0 ? (
            <Text style={styles.emptyText}>숨긴 메시지가 없습니다</Text>
          ) : (
            <>
              <TouchableOpacity
                style={styles.showHiddenButton}
                onPress={handleShowHidden}
              >
                <Text style={styles.showHiddenText}>
                  {showHidden ? '접기' : '숨긴 메시지 보기'}
                </Text>
              </TouchableOpacity>

              {showHidden && (
                <>
                  <View style={styles.hiddenList}>
                    {hiddenMessages.map((msg, idx) => (
                      <View key={`hidden-${msg.id}-${idx}`} style={styles.hiddenItem}>
                        <View style={styles.hiddenItemContent}>
                          <Text style={styles.hiddenAppName}>{msg.app_name}</Text>
                          <Text style={styles.hiddenTitle} numberOfLines={1}>
                            {msg.title}
                          </Text>
                          <Text style={styles.hiddenTime}>
                            {formatTime(msg.posted_at)}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.restoreButton}
                          onPress={() => handleUnhideMessage(msg)}
                        >
                          <Text style={styles.restoreButtonText}>복원</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={styles.unhideAllButton}
                    onPress={handleUnhideAll}
                  >
                    <Text style={styles.unhideAllText}>
                      전체 복원 ({hiddenCount}건)
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}
        </View>

        {/* Delete Actions */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🗑️ 데이터 삭제</Text>
          <Text style={styles.cardHint}>실제 DB에서 삭제됩니다 (복구 불가)</Text>

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeleteTest}
            disabled={loading}
          >
            <Text style={styles.deleteButtonText}>테스트 데이터 삭제</Text>
            <Text style={styles.deleteButtonDesc}>[테스트] 포함된 메시지</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.deleteButton, styles.deleteAllButton]}
            onPress={handleDeleteAll}
            disabled={loading || totalCount === 0}
          >
            <Text style={[styles.deleteButtonText, styles.deleteAllText]}>
              ⚠️ 전체 삭제 ({totalCount}건)
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {loading && (
        <View style={styles.loadingOverlay}>
          <Text style={styles.loadingText}>처리 중...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
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
    width: 60,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardHint: {
    color: '#666',
    fontSize: 12,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  appRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2c2c2e',
  },
  appRowSelected: {
    backgroundColor: '#2c2c2e',
    marginHorizontal: -16,
    paddingHorizontal: 16,
    borderBottomColor: '#3c3c3e',
  },
  appName: {
    color: '#fff',
    fontSize: 14,
  },
  appNameSelected: {
    color: '#0a84ff',
    fontWeight: '600',
  },
  appCount: {
    color: '#888',
    fontSize: 14,
  },
  messageList: {
    backgroundColor: '#252528',
    marginHorizontal: -16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2c2c2e',
  },
  messageItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#3c3c3e',
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  messageTitle: {
    color: '#fff',
    fontSize: 13,
    flex: 1,
    marginRight: 8,
  },
  messageActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  messageTime: {
    color: '#666',
    fontSize: 11,
  },
  hideButton: {
    backgroundColor: '#3a3a3c',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  hideButtonText: {
    color: '#888',
    fontSize: 10,
  },
  messageBody: {
    color: '#888',
    fontSize: 12,
    lineHeight: 16,
  },
  messageTags: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 6,
  },
  tagAd: {
    backgroundColor: '#ff3b30',
    color: '#fff',
    fontSize: 9,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    overflow: 'hidden',
  },
  tagCategory: {
    backgroundColor: '#30d158',
    color: '#fff',
    fontSize: 9,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    overflow: 'hidden',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  hiddenBadge: {
    backgroundColor: '#ff9500',
    color: '#fff',
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  emptyText: {
    color: '#666',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 12,
  },
  showHiddenButton: {
    backgroundColor: '#2c2c2e',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  showHiddenText: {
    color: '#0a84ff',
    fontSize: 14,
  },
  hiddenList: {
    marginTop: 12,
  },
  hiddenItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2c2c2e',
  },
  hiddenItemContent: {
    flex: 1,
  },
  hiddenAppName: {
    color: '#888',
    fontSize: 11,
    marginBottom: 2,
  },
  hiddenTitle: {
    color: '#fff',
    fontSize: 13,
  },
  hiddenTime: {
    color: '#555',
    fontSize: 10,
    marginTop: 2,
  },
  restoreButton: {
    backgroundColor: '#30d158',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 10,
  },
  restoreButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  unhideAllButton: {
    backgroundColor: '#0a84ff',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  unhideAllText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  deleteButton: {
    backgroundColor: '#2c2c2e',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  deleteButtonText: {
    color: '#ff453a',
    fontSize: 15,
    fontWeight: '500',
  },
  deleteButtonDesc: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  deleteAllButton: {
    backgroundColor: '#3a1c1c',
    marginTop: 10,
  },
  deleteAllText: {
    textAlign: 'center',
  },
  bottomSpacer: {
    height: 40,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
  },
});
