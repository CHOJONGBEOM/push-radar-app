/**
 * 배터리 최적화 설정 관련 네이티브 모듈 래퍼
 */

import { NativeModules, Platform } from 'react-native';

interface BatteryOptimizationModuleInterface {
    isIgnoringBatteryOptimizations(): Promise<boolean>;
    openBatteryOptimizationSettings(): Promise<boolean>;
    openAppSettings(): Promise<boolean>;
}

const { BatteryOptimizationModule } = NativeModules;

/**
 * 배터리 최적화가 무시되고 있는지 확인
 */
export const isIgnoringBatteryOptimizations = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
        return true;
    }

    try {
        return await BatteryOptimizationModule.isIgnoringBatteryOptimizations();
    } catch (error) {
        console.error('Failed to check battery optimization:', error);
        return false;
    }
};

/**
 * 배터리 최적화 설정 화면 열기
 */
export const openBatteryOptimizationSettings = async (): Promise<void> => {
    if (Platform.OS !== 'android') {
        return;
    }

    try {
        await BatteryOptimizationModule.openBatteryOptimizationSettings();
    } catch (error) {
        console.error('Failed to open battery optimization settings:', error);
    }
};

/**
 * 앱 상세 설정 화면 열기
 */
export const openAppSettings = async (): Promise<void> => {
    if (Platform.OS !== 'android') {
        return;
    }

    try {
        await BatteryOptimizationModule.openAppSettings();
    } catch (error) {
        console.error('Failed to open app settings:', error);
    }
};
