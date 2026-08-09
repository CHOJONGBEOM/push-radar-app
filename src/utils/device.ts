import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = 'device_id';

// 메모리 캐시 - AsyncStorage를 매번 읽지 않도록
let cachedDeviceId: string | null = null;

/**
 * 기기의 고유 ID를 가져옵니다.
 * 없으면 새로 생성하여 저장합니다 (UUID v4 형식과 유사한 랜덤 문자열).
 * 앱을 재설치하면 초기화됩니다.
 */
export const getDeviceId = async (): Promise<string> => {
    // 메모리 캐시에 있으면 바로 반환 (디스크 I/O 없음)
    if (cachedDeviceId) {
        return cachedDeviceId;
    }

    try {
        const existingId = await AsyncStorage.getItem(DEVICE_ID_KEY);
        if (existingId) {
            cachedDeviceId = existingId;
            return existingId;
        }

        // 간단한 UUID 생성 (외부 라이브러리 의존성 없이)
        const newId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });

        await AsyncStorage.setItem(DEVICE_ID_KEY, newId);
        cachedDeviceId = newId;
        return newId;
    } catch (error) {
        console.error('Error getting device ID:', error);
        return 'unknown-device-' + Date.now();
    }
};
