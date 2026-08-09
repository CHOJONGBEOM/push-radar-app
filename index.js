// URL Polyfill - 반드시 가장 먼저 로드
import 'react-native-url-polyfill/auto';

// 불필요한 경고 숨기기
import { LogBox } from 'react-native';
LogBox.ignoreLogs([
  '`new NativeEventEmitter()`',  // react-native-android-notification-listener 경고
  'new NativeEventEmitter',
]);

// TypeScript 엔트리포인트 로드
require('./index.ts');
