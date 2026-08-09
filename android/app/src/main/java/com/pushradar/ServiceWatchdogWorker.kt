package com.pushradar

import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.app.NotificationManagerCompat
import androidx.work.Worker
import androidx.work.WorkerParameters

/**
 * WorkManager 워커 - 주기적으로 NotificationListenerService가 살아있는지 확인
 */
class ServiceWatchdogWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    
    companion object {
        private const val TAG = "ServiceWatchdog"
    }

    override fun doWork(): Result {
        Log.d(TAG, "Watchdog checking service status...")

        try {
            // NotificationListenerService가 연결되어 있는지 확인
            val enabledPackages = NotificationManagerCompat.getEnabledListenerPackages(applicationContext)
            val isConnected = enabledPackages.contains(applicationContext.packageName)

            if (isConnected) {
                Log.d(TAG, "Service is running - OK")
            } else {
                Log.w(TAG, "Service is NOT running - attempting restart")
                
                // 서비스 재시작 시도
                // NotificationListenerService는 시스템이 관리하므로
                // 권한이 활성화되어 있다면 시스템이 자동으로 재시작함
                // 여기서는 앱 프로세스를 깨워서 시스템이 서비스를 재연결하도록 유도
                
                val launchIntent = applicationContext.packageManager
                    .getLaunchIntentForPackage(applicationContext.packageName)
                
                if (launchIntent != null) {
                    launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    applicationContext.startActivity(launchIntent)
                    Log.d(TAG, "App launched to trigger service reconnection")
                }
            }

            return Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "Watchdog error", e)
            return Result.retry()
        }
    }
}
