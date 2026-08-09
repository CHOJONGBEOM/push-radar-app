import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    SafeAreaView,
    Platform,
    StatusBar,
    ScrollView,
} from 'react-native';
import {
    isIgnoringBatteryOptimizations,
    openBatteryOptimizationSettings,
    openAppSettings,
} from '../services/batteryOptimization';
import { openNotificationSettings } from '../services/notificationService';

interface Props {
    onBack: () => void;
}

export default function SystemSettingsScreen({ onBack }: Props) {
    const [batteryOptimizationIgnored, setBatteryOptimizationIgnored] = useState(false);

    useEffect(() => {
        const checkBatteryStatus = async () => {
            const isIgnoring = await isIgnoringBatteryOptimizations();
            setBatteryOptimizationIgnored(isIgnoring);
        };
        checkBatteryStatus();
    }, []);

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <Text style={styles.backText}>← 뒤로</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>시스템 설정</Text>
                <View style={styles.headerRight} />
            </View>

            <ScrollView style={styles.content}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>⚙️ 시스템 권한 및 설정</Text>
                    <Text style={styles.sectionDesc}>
                        안정적인 백그라운드 수집을 위해 아래 설정을 권장합니다.
                    </Text>

                    <TouchableOpacity
                        style={styles.settingButton}
                        onPress={async () => {
                            await openBatteryOptimizationSettings();
                            // 설정 후 돌아올 때 상태 재확인
                            setTimeout(async () => {
                                const isIgnoring = await isIgnoringBatteryOptimizations();
                                setBatteryOptimizationIgnored(isIgnoring);
                            }, 1000);
                        }}
                    >
                        <View style={styles.settingLeft}>
                            <Text style={styles.settingIcon}>🔋</Text>
                            <View style={styles.settingTextContainer}>
                                <Text style={styles.settingTitle}>배터리 최적화 해제</Text>
                                <Text style={styles.settingSubtitle}>제한 없음 권장</Text>
                            </View>
                        </View>
                        <Text style={batteryOptimizationIgnored ? styles.statusOk : styles.statusWarning}>
                            {batteryOptimizationIgnored ? '✅ 설정됨' : '⚠️ 미설정'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.settingButton}
                        onPress={() => openAppSettings()}
                    >
                        <View style={styles.settingLeft}>
                            <Text style={styles.settingIcon}>🌐</Text>
                            <View style={styles.settingTextContainer}>
                                <Text style={styles.settingTitle}>백그라운드 사용 허용</Text>
                                <Text style={styles.settingSubtitle}>앱 상세 설정 › 데이터를 사용...</Text>
                            </View>
                        </View>
                        <Text style={styles.settingArrow}>›</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.settingButton}
                        onPress={() => openNotificationSettings()}
                    >
                        <View style={styles.settingLeft}>
                            <Text style={styles.settingIcon}>🔔</Text>
                            <View style={styles.settingTextContainer}>
                                <Text style={styles.settingTitle}>알림 액세스 권한</Text>
                                <Text style={styles.settingSubtitle}>알림 수집 필수</Text>
                            </View>
                        </View>
                        <Text style={styles.settingArrow}>›</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
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
        width: 40,
    },
    content: {
        flex: 1,
    },
    section: {
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#2c2c2e',
        backgroundColor: '#1c1c1e',
        marginTop: 20,
        marginHorizontal: 16,
        borderRadius: 12,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 4,
    },
    sectionDesc: {
        fontSize: 13,
        color: '#8e8e93',
        marginBottom: 16,
        lineHeight: 18,
    },
    settingButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        borderTopWidth: 1,
        borderTopColor: '#2c2c2e',
    },
    settingLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    settingIcon: {
        fontSize: 22,
        marginRight: 14,
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
});
