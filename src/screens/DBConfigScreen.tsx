/**
 * DB Configuration Screen
 * Supabase URL/Key 설정 화면
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { loadDBConfig, saveDBConfig, DBConfig } from '../services/dbConfigService';
import { testSupabaseConnection, resetSupabase } from '../config/supabase';

interface Props {
  onBack: () => void;
  onConfigured: () => void;
}

export default function DBConfigScreen({ onBack, onConfigured }: Props) {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    const config = await loadDBConfig();
    setUrl(config.supabaseUrl);
    setKey(config.supabaseKey);
    setIsConfigured(!!(config.supabaseUrl && config.supabaseKey));
    setLoading(false);
  };

  const handleTest = async () => {
    if (!url.trim() || !key.trim()) {
      Alert.alert('오류', 'URL과 Key를 모두 입력하세요.');
      return;
    }

    setTesting(true);
    const result = await testSupabaseConnection(url.trim(), key.trim());
    setTesting(false);

    if (result.success) {
      if (result.error) {
        Alert.alert('연결 성공', result.error);
      } else {
        Alert.alert('연결 성공', 'Supabase에 정상적으로 연결되었습니다.');
      }
    } else {
      Alert.alert('연결 실패', result.error || '알 수 없는 오류');
    }
  };

  const handleSave = async () => {
    if (!url.trim() || !key.trim()) {
      Alert.alert('오류', 'URL과 Key를 모두 입력하세요.');
      return;
    }

    setLoading(true);

    // 먼저 연결 테스트
    const result = await testSupabaseConnection(url.trim(), key.trim());

    if (!result.success) {
      setLoading(false);
      Alert.alert('연결 실패', `저장하지 않았습니다.\n\n${result.error}`);
      return;
    }

    // 저장
    const config: DBConfig = {
      supabaseUrl: url.trim(),
      supabaseKey: key.trim(),
    };

    const saved = await saveDBConfig(config);

    if (saved) {
      // Supabase 클라이언트 재설정
      await resetSupabase();
      setIsConfigured(true);
      setLoading(false);
      Alert.alert('저장 완료', 'DB 설정이 저장되었습니다.', [
        { text: '확인', onPress: onConfigured }
      ]);
    } else {
      setLoading(false);
      Alert.alert('오류', '설정 저장에 실패했습니다.');
    }
  };

  if (loading && !url && !key) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0a84ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>← 뒤로</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>DB 설정</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        {/* Status */}
        <View style={[styles.statusBanner, isConfigured ? styles.statusSuccess : styles.statusWarning]}>
          <Text style={styles.statusText}>
            {isConfigured ? '설정 완료됨' : '설정 필요'}
          </Text>
        </View>

        {/* Info */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Supabase 연결 설정</Text>
          <Text style={styles.infoText}>
            Supabase 대시보드에서 Project URL과 API Key (anon/service_role)를 복사하여 입력하세요.
          </Text>
          <Text style={styles.infoText}>
            {'\n'}Settings → API 에서 확인할 수 있습니다.
          </Text>
        </View>

        {/* URL Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Supabase URL</Text>
          <TextInput
            style={styles.input}
            value={url}
            onChangeText={setUrl}
            placeholder="https://xxxxx.supabase.co"
            placeholderTextColor="#666"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        </View>

        {/* Key Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>API Key (anon 또는 service_role)</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={key}
            onChangeText={setKey}
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            placeholderTextColor="#666"
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Buttons */}
        <View style={styles.buttons}>
          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={handleTest}
            disabled={testing || loading}
          >
            {testing ? (
              <ActivityIndicator size="small" color="#0a84ff" />
            ) : (
              <Text style={styles.buttonSecondaryText}>연결 테스트</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary]}
            onPress={handleSave}
            disabled={testing || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.buttonPrimaryText}>저장</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Table Info */}
        <View style={styles.tableInfo}>
          <Text style={styles.tableInfoTitle}>필요한 테이블: push_messages</Text>
          <Text style={styles.tableInfoCode}>
{`CREATE TABLE push_messages (
  id BIGSERIAL PRIMARY KEY,
  package_name TEXT NOT NULL,
  app_name TEXT NOT NULL,
  title TEXT,
  body TEXT,
  posted_at TIMESTAMPTZ NOT NULL,
  raw_data JSONB,
  is_ad BOOLEAN DEFAULT false,
  category TEXT,
  has_emoji BOOLEAN DEFAULT false,
  message_length INTEGER,
  is_hidden BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(package_name, body, posted_at)
);`}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    justifyContent: 'center',
    alignItems: 'center',
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
  statusBanner: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  statusSuccess: {
    backgroundColor: '#30d15833',
  },
  statusWarning: {
    backgroundColor: '#ff950033',
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: '#1c1c1e',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  infoTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoText: {
    color: '#888',
    fontSize: 14,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    color: '#888',
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1c1c1e',
    borderRadius: 10,
    padding: 14,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#2c2c2e',
  },
  inputMultiline: {
    height: 80,
    textAlignVertical: 'top',
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 24,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonPrimary: {
    backgroundColor: '#0a84ff',
  },
  buttonSecondary: {
    backgroundColor: '#1c1c1e',
    borderWidth: 1,
    borderColor: '#0a84ff',
  },
  buttonPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSecondaryText: {
    color: '#0a84ff',
    fontSize: 16,
    fontWeight: '600',
  },
  tableInfo: {
    backgroundColor: '#1c1c1e',
    padding: 16,
    borderRadius: 12,
    marginBottom: 40,
  },
  tableInfoTitle: {
    color: '#888',
    fontSize: 14,
    marginBottom: 12,
  },
  tableInfoCode: {
    color: '#30d158',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 16,
  },
});
