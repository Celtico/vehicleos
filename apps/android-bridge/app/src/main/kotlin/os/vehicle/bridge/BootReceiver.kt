package os.vehicle.bridge

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Arranque del servicio sin intervención del usuario (no hay UI):
 *
 *  1. BOOT_COMPLETED — al encender el dispositivo del coche el bridge
 *     queda disponible automáticamente.
 *  2. os.vehicle.bridge.START — acción exportada para arrancarlo bajo
 *     demanda, por ejemplo desde adb:
 *
 *     adb shell am broadcast -a os.vehicle.bridge.START
 *
 *     Opcionalmente admite extras de configuración, que se persisten en
 *     SharedPreferences antes de arrancar:
 *
 *     adb shell am broadcast -a os.vehicle.bridge.START \
 *         --es transport wifi --es wifiHost 192.168.0.10 --ei wifiPort 35000
 */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED, ACTION_START -> {
                applyConfigExtras(context, intent)
                Log.i(TAG, "Arrancando VehicleBridgeService (accion=${intent.action})")
                VehicleBridgeService.start(context)
            }
        }
    }

    /** Copia a la configuración los extras conocidos, si vienen en el intent. */
    private fun applyConfigExtras(context: Context, intent: Intent) {
        if (intent.extras == null) return
        val config = BridgeConfig(context)
        intent.getStringExtra(BridgeConfig.KEY_TRANSPORT)?.let { config.transport = it }
        intent.getStringExtra(BridgeConfig.KEY_BT_NAME)?.let { config.bluetoothName = it }
        intent.getStringExtra(BridgeConfig.KEY_WIFI_HOST)?.let { config.wifiHost = it }
        if (intent.hasExtra(BridgeConfig.KEY_WIFI_PORT)) {
            config.wifiPort = intent.getIntExtra(BridgeConfig.KEY_WIFI_PORT, config.wifiPort)
        }
        if (intent.hasExtra(BridgeConfig.KEY_USB_BAUD)) {
            config.usbBaudRate = intent.getIntExtra(BridgeConfig.KEY_USB_BAUD, config.usbBaudRate)
        }
    }

    companion object {
        private const val TAG = "VehicleBridge"
        const val ACTION_START = "os.vehicle.bridge.START"
    }
}
