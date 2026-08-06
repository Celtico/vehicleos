package os.vehicle.bridge.obd

import android.annotation.SuppressLint
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.content.Context
import android.hardware.usb.UsbManager
import com.hoho.android.usbserial.driver.UsbSerialProber
import os.vehicle.bridge.BridgeConfig
import os.vehicle.bridge.BridgeException

/**
 * Selección del transporte OBD según configuración, con autodetección
 * simple cuando `transport == "auto"`.
 *
 * Orden de autodetección (del más determinista al menos):
 *  1. USB   — hay un adaptador serie físicamente enchufado.
 *  2. Bluetooth clásico — hay un dispositivo emparejado con el nombre configurado.
 *  3. BLE   — hay un dispositivo emparejado tipo LE con ese nombre.
 *  4. WiFi  — último recurso: probamos el host configurado.
 */
object TransportFactory {

    fun create(context: Context, config: BridgeConfig): ObdTransport =
        when (val t = config.transport.lowercase()) {
            "bluetooth" -> BluetoothClassicTransport(context, config)
            "ble" -> BleTransport(context, config)
            "usb" -> UsbSerialTransport(context, config)
            "wifi" -> WifiTransport(config)
            "auto" -> autodetect(context, config)
            else -> throw BridgeException(
                BridgeException.INVALID_REQUEST,
                "Transporte desconocido en la configuración: \"$t\"",
            )
        }

    @SuppressLint("MissingPermission")
    private fun autodetect(context: Context, config: BridgeConfig): ObdTransport {
        // 1) USB: ¿hay un adaptador serie enchufado?
        val usbManager = context.getSystemService(Context.USB_SERVICE) as? UsbManager
        if (usbManager != null &&
            UsbSerialProber.getDefaultProber().findAllDrivers(usbManager).isNotEmpty()
        ) {
            return UsbSerialTransport(context, config)
        }

        // 2/3) Bluetooth: dispositivo emparejado por nombre; clásico o LE.
        val adapter = context.getSystemService(BluetoothManager::class.java)?.adapter
        if (adapter != null && adapter.isEnabled) {
            val bonded = runCatching { adapter.bondedDevices }.getOrNull().orEmpty()
            val match = bonded.firstOrNull {
                it.name?.contains(config.bluetoothName, ignoreCase = true) == true
            }
            if (match != null) {
                return if (match.type == BluetoothDevice.DEVICE_TYPE_LE) {
                    BleTransport(context, config)
                } else {
                    BluetoothClassicTransport(context, config)
                }
            }
        }

        // 4) WiFi como último recurso.
        return WifiTransport(config)
    }
}
