/**
 * History Screen
 * 일자별 메시지 조회
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  StatusBar,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { getMessagesByDate, getAvailableDates, getCountByDate } from '../services/supabaseService';
import { PushMessage } from '../types';

interface Props {
  onBack: () => void;
}

export default function HistoryScreen({ onBack }: Props) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [messages, setMessages] = useState<PushMessage[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [dateStats, setDateStats] = useState<Record<string, number>>({});
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  // 최근 14일 날짜 생성
  const getRecentDates = () => {
    const dates: Date[] = [];
    for (let i = 0; i < 14; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dates.push(date);
    }
    return dates;
  };

  const recentDates = getRecentDates();

  // 주말 체크
  const isWeekend = (date: Date) => {
    const day = date.getDay();
    return day === 0 || day === 6; // 일요일(0) 또는 토요일(6)
  };

  // 월별 그룹 생성 (데이터가 있는 월만)
  const getMonthGroups = () => {
    const groups: Record<string, string[]> = {};
    availableDates.forEach(dateStr => {
      const date = new Date(dateStr);
      const monthKey = `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      groups[monthKey].push(dateStr);
    });
    return groups;
  };

  const monthGroups = getMonthGroups();

  const loadData = useCallback(async () => {
    const msgs = await getMessagesByDate(selectedDate);
    setMessages(msgs);

    // 날짜별 통계 로드
    const stats: Record<string, number> = {};
    for (const date of recentDates) {
      const dateStr = date.toISOString().split('T')[0];
      stats[dateStr] = await getCountByDate(date);
    }
    setDateStats(stats);
  }, [selectedDate]);

  useEffect(() => {
    loadData();
    getAvailableDates().then(setAvailableDates);
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const formatDateShort = (date: Date) => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return '오늘';
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return '어제';
    }
    // 요일 표시
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const getDayLabel = (date: Date) => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return days[date.getDay()];
  };

  const formatDateFull = (date: Date) => {
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
  };

  const isSelected = (date: Date) => {
    return date.toDateString() === selectedDate.toDateString();
  };

  const getDateCount = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return dateStats[dateStr] || 0;
  };

  // 앱별 통계
  const appStats = messages.reduce((acc, msg) => {
    acc[msg.app_name] = (acc[msg.app_name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const renderMessage = ({ item }: { item: PushMessage }) => (
    <View style={styles.messageCard}>
      <View style={styles.messageHeader}>
        <Text style={styles.appName}>{item.app_name}</Text>
        <Text style={styles.time}>
          {new Date(item.posted_at).toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {item.title}
      </Text>
      <Text style={styles.body} numberOfLines={2}>
        {item.body}
      </Text>
      <View style={styles.tags}>
        {item.is_ad && <Text style={styles.tag}>광고</Text>}
        {item.category && <Text style={styles.tagCategory}>{item.category}</Text>}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>← 뒤로</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>히스토리</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Date Selector - 최근 2주 */}
      <View style={styles.dateSelectorWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.dateSelector}
          contentContainerStyle={styles.dateSelectorContent}
        >
          {recentDates.map((date, index) => {
            const count = getDateCount(date);
            const weekend = isWeekend(date);
            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dateButton,
                  weekend && styles.dateButtonWeekend,
                  isSelected(date) && styles.dateButtonSelected,
                ]}
                onPress={() => setSelectedDate(date)}
              >
                <Text
                  style={[
                    styles.dateText,
                    weekend && styles.dateTextWeekend,
                    isSelected(date) && styles.dateTextSelected,
                  ]}
                >
                  {formatDateShort(date)}
                </Text>
                <Text
                  style={[
                    styles.dateDayLabel,
                    weekend && styles.dateDayLabelWeekend,
                    isSelected(date) && styles.dateDayLabelSelected,
                  ]}
                >
                  {getDayLabel(date)}
                </Text>
                <Text
                  style={[
                    styles.dateCount,
                    isSelected(date) && styles.dateCountSelected,
                  ]}
                >
                  {count}건
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <TouchableOpacity
          style={styles.monthPickerButton}
          onPress={() => setShowMonthPicker(!showMonthPicker)}
        >
          <Text style={styles.monthPickerButtonText}>
            {showMonthPicker ? '접기' : '더보기'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Month Picker */}
      {showMonthPicker && (
        <View style={styles.monthPicker}>
          <Text style={styles.monthPickerTitle}>📅 월별 조회</Text>
          {Object.entries(monthGroups).map(([month, dates]) => (
            <View key={month} style={styles.monthGroup}>
              <Text style={styles.monthLabel}>{month} ({dates.length}건)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.monthDates}>
                  {dates.slice(0, 10).map(dateStr => {
                    const date = new Date(dateStr);
                    const weekend = isWeekend(date);
                    const selected = date.toDateString() === selectedDate.toDateString();
                    return (
                      <TouchableOpacity
                        key={dateStr}
                        style={[
                          styles.monthDateButton,
                          weekend && styles.monthDateButtonWeekend,
                          selected && styles.monthDateButtonSelected,
                        ]}
                        onPress={() => {
                          setSelectedDate(date);
                          setShowMonthPicker(false);
                        }}
                      >
                        <Text style={[
                          styles.monthDateText,
                          weekend && styles.monthDateTextWeekend,
                          selected && styles.monthDateTextSelected,
                        ]}>
                          {date.getDate()}일
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  {dates.length > 10 && (
                    <Text style={styles.moreText}>+{dates.length - 10}</Text>
                  )}
                </View>
              </ScrollView>
            </View>
          ))}
        </View>
      )}

      {/* Selected Date Info */}
      <View style={styles.dateInfo}>
        <Text style={styles.dateInfoText}>{formatDateFull(selectedDate)}</Text>
        <Text style={styles.dateInfoCount}>총 {messages.length}건</Text>
      </View>

      {/* App Stats */}
      {Object.keys(appStats).length > 0 && (
        <View style={styles.statsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {Object.entries(appStats)
              .sort((a, b) => b[1] - a[1])
              .map(([app, count]) => (
                <View key={app} style={styles.statChip}>
                  <Text style={styles.statChipText}>
                    {app} {count}
                  </Text>
                </View>
              ))}
          </ScrollView>
        </View>
      )}

      {/* Message List */}
      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item, index) => `${item.package_name}-${item.posted_at}-${index}`}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#888"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyTitle}>이 날짜에 수집된 메시지가 없습니다</Text>
          </View>
        }
      />
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
  dateSelectorWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: '#1c1c1e',
  },
  dateSelector: {
    maxHeight: 90,
  },
  dateSelectorContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  dateButton: {
    backgroundColor: '#1c1c1e',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 3,
    minWidth: 56,
  },
  dateButtonWeekend: {
    backgroundColor: '#2a1a1a',
  },
  dateButtonSelected: {
    backgroundColor: '#0a84ff',
  },
  dateText: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
  },
  dateTextWeekend: {
    color: '#ff6b6b',
  },
  dateTextSelected: {
    color: '#fff',
  },
  dateDayLabel: {
    color: '#555',
    fontSize: 10,
    marginTop: 1,
  },
  dateDayLabelWeekend: {
    color: '#ff6b6b',
  },
  dateDayLabelSelected: {
    color: 'rgba(255,255,255,0.7)',
  },
  dateCount: {
    color: '#666',
    fontSize: 10,
    marginTop: 2,
  },
  dateCountSelected: {
    color: 'rgba(255,255,255,0.8)',
  },
  monthPickerButton: {
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#2c2c2e',
  },
  monthPickerButtonText: {
    color: '#0a84ff',
    fontSize: 13,
  },
  monthPicker: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1c1c1e',
  },
  monthPickerTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },
  monthGroup: {
    marginBottom: 12,
  },
  monthLabel: {
    color: '#888',
    fontSize: 13,
    marginBottom: 8,
  },
  monthDates: {
    flexDirection: 'row',
    gap: 6,
  },
  monthDateButton: {
    backgroundColor: '#2c2c2e',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  monthDateButtonWeekend: {
    backgroundColor: '#2a1a1a',
  },
  monthDateButtonSelected: {
    backgroundColor: '#0a84ff',
  },
  monthDateText: {
    color: '#888',
    fontSize: 12,
  },
  monthDateTextWeekend: {
    color: '#ff6b6b',
  },
  monthDateTextSelected: {
    color: '#fff',
  },
  moreText: {
    color: '#666',
    fontSize: 12,
    alignSelf: 'center',
    marginLeft: 4,
  },
  dateInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dateInfoText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dateInfoCount: {
    color: '#888',
    fontSize: 14,
  },
  statsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  statChip: {
    backgroundColor: '#2c2c2e',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    marginRight: 8,
  },
  statChipText: {
    color: '#888',
    fontSize: 12,
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
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
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#888',
    fontSize: 16,
  },
});
