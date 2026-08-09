import { AppRegistry } from 'react-native';
import App from './App';

// 메인 앱 등록
AppRegistry.registerComponent('PushRadar', () => App);

// Headless JS 등록 - 백그라운드/종료 상태에서 알림 수신
try {
  const { RNAndroidNotificationListenerHeadlessJsName } = require('react-native-android-notification-listener');
  const { headlessNotificationListener } = require('./src/services/notificationService');

  AppRegistry.registerHeadlessTask(
    RNAndroidNotificationListenerHeadlessJsName,
    () => headlessNotificationListener
  );
} catch (error) {
  console.warn('Notification listener registration failed:', error);
}
