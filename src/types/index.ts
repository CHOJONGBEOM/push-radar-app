/**
 * Push Message Types
 */

export interface PushMessage {
  id?: number;
  package_name: string;
  app_name: string;
  title: string;
  body: string;
  posted_at: string;
  raw_data?: string;
  is_ad?: boolean;
  category?: string | null;
  has_emoji?: boolean;
  message_length?: number;
  is_hidden?: boolean;
  device_id?: string; // 기기 식별을 위한 ID
}

export interface NotificationData {
  packageName: string;
  appName?: string;
  title: string;
  text: string;
  postTime: number;
}

export interface TargetApp {
  package_name: string;
  app_name: string;
}
