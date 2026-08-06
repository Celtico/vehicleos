package os.vehicle.bridge

import android.content.Context
import android.content.SharedPreferences

/**
 * Configuración persistente del bridge (SharedPreferences).
 *
 * No hay UI de ajustes: los valores se cambian por adb, p. ej.:
 *   adb shell am broadcast -a os.vehicle.bridge.START \
 *       --es transport wifi --es wifiHost 192.168.0.10
 * (el BootReceiver copia los extras conocidos a las preferencias).
 */
class BridgeConfig(context: Context) {

    private val prefs: SharedPreferences =
        context.getSharedPreferences("bridge_config", Context.MODE_PRIVATE)

    /** Transporte preferido: auto | bluetooth | ble | usb | wifi. */
    var transport: String
        get() = prefs.getString(KEY_TRANSPORT, "auto") ?: "auto"
        set(v) = prefs.edit().putString(KEY_TRANSPORT, v).apply()

    /** Subcadena del nombre del adaptador Bluetooth/BLE emparejado. */
    var bluetoothName: String
        get() = prefs.getString(KEY_BT_NAME, "OBDII") ?: "OBDII"
        set(v) = prefs.edit().putString(KEY_BT_NAME, v).apply()

    /** Host del adaptador WiFi (típico de los ELM327 WiFi). */
    var wifiHost: String
        get() = prefs.getString(KEY_WIFI_HOST, "192.168.0.10") ?: "192.168.0.10"
        set(v) = prefs.edit().putString(KEY_WIFI_HOST, v).apply()

    /** Puerto TCP del adaptador WiFi. */
    var wifiPort: Int
        get() = prefs.getInt(KEY_WIFI_PORT, 35000)
        set(v) = prefs.edit().putInt(KEY_WIFI_PORT, v).apply()

    /** Baudios del adaptador USB serie (38400 es el habitual del ELM327). */
    var usbBaudRate: Int
        get() = prefs.getInt(KEY_USB_BAUD, 38400)
        set(v) = prefs.edit().putInt(KEY_USB_BAUD, v).apply()

    /**
     * Odómetro acumulado en km. OBD-II estándar no expone el odómetro
     * real, así que lo integramos a partir de la velocidad y lo
     * persistimos aquí.
     */
    var odometerKm: Double
        get() = Double.fromBits(prefs.getLong(KEY_ODOMETER, 0.0.toRawBits()))
        set(v) = prefs.edit().putLong(KEY_ODOMETER, v.toRawBits()).apply()

    companion object {
        const val KEY_TRANSPORT = "transport"
        const val KEY_BT_NAME = "btName"
        const val KEY_WIFI_HOST = "wifiHost"
        const val KEY_WIFI_PORT = "wifiPort"
        const val KEY_USB_BAUD = "usbBaud"
        const val KEY_ODOMETER = "odometerKm"
    }
}
