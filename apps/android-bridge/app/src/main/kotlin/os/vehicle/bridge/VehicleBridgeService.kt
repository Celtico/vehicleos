package os.vehicle.bridge

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import os.vehicle.bridge.rpc.BridgeWebSocketServer

/**
 * Servicio principal del bridge: Foreground Service START_STICKY.
 *
 * - Arranca el servidor WebSocket local (ws://127.0.0.1:8722).
 * - Gestiona el ciclo de conexión OBD a través del BridgeCore.
 * - Es el ÚNICO proceso con acceso al hardware (regla de seguridad):
 *   la PWA solo ve la API JSON-RPC local.
 *
 * NOTIFICACIÓN: Android exige una notificación persistente para todo
 * servicio en primer plano. Es el ÚNICO elemento visible permitido de
 * esta app (no hay ninguna Activity): usamos un canal silencioso de baja
 * importancia ("VehicleOS Bridge activo") que no suena ni vibra.
 *
 * BATERÍA: el sondeo del adaptador y el GPS solo corren mientras exista
 * al menos un suscriptor de telemetría (ver BridgeCore/TelemetryLoop).
 */
class VehicleBridgeService : Service() {

    private var core: BridgeCore? = null
    private var wsServer: BridgeWebSocketServer? = null

    override fun onCreate() {
        super.onCreate()
        startAsForeground()

        val c = BridgeCore(applicationContext)
        core = c
        wsServer = BridgeWebSocketServer(c).also { it.start() }
        Log.i(TAG, "VehicleBridgeService creado")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // START_STICKY: si el sistema mata el proceso, lo recrea (el
        // bridge debe estar siempre disponible mientras se conduce).
        return START_STICKY
    }

    /** Servicio sin binding: toda la API va por WebSocket/WebView. */
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        runCatching { wsServer?.stop(1000) }
        wsServer = null
        core?.shutdown()
        core = null
        Log.i(TAG, "VehicleBridgeService destruido")
        super.onDestroy()
    }

    // ------------------------------------------------------------------
    // Notificación persistente (obligatoria para el foreground service)
    // ------------------------------------------------------------------

    private fun startAsForeground() {
        val nm = getSystemService(NotificationManager::class.java)
        // IMPORTANCE_LOW = sin sonido ni vibración: canal silencioso.
        val channel = NotificationChannel(
            CHANNEL_ID,
            getString(R.string.notification_channel),
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            setShowBadge(false)
            description = getString(R.string.notification_text)
        }
        nm.createNotificationChannel(channel)

        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(getString(R.string.notification_title))
            .setContentText(getString(R.string.notification_text))
            .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()

        // Tipos del servicio: dispositivo conectado (adaptador OBD) y, si
        // el permiso está concedido, ubicación (GPS de la telemetría).
        var type = 0
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            type = ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE
            val hasLocation = ContextCompat.checkSelfPermission(
                this, Manifest.permission.ACCESS_FINE_LOCATION,
            ) == PackageManager.PERMISSION_GRANTED
            if (hasLocation) type = type or ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
        }
        ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, type)
    }

    companion object {
        private const val TAG = "VehicleBridge"
        private const val CHANNEL_ID = "vehicle_bridge"
        private const val NOTIFICATION_ID = 1

        /** Arranque como foreground service desde cualquier contexto. */
        fun start(context: Context) {
            val intent = Intent(context, VehicleBridgeService::class.java)
            ContextCompat.startForegroundService(context, intent)
        }
    }
}
