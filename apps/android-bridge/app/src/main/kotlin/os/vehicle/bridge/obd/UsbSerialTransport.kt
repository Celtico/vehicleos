package os.vehicle.bridge.obd

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.hoho.android.usbserial.driver.UsbSerialPort
import com.hoho.android.usbserial.driver.UsbSerialProber
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import os.vehicle.bridge.BridgeConfig
import os.vehicle.bridge.BridgeException
import kotlin.coroutines.resume

/**
 * Transporte USB serie (cables ELM327 USB) mediante la librería
 * usb-serial-for-android (soporta FTDI, CH340, CP210x, CDC-ACM…).
 *
 * Como la app no tiene UI, el permiso USB por dispositivo se solicita
 * con un broadcast: Android muestra su diálogo del sistema y esperamos
 * la respuesta. Con un dispositivo Android "de coche" dedicado se puede
 * fijar el permiso permanentemente marcando "usar por defecto".
 */
class UsbSerialTransport(
    private val context: Context,
    private val config: BridgeConfig,
) : ObdTransport {

    override val name = "usb"

    private var port: UsbSerialPort? = null

    override suspend fun open(): Unit = withContext(Dispatchers.IO) {
        val usbManager = context.getSystemService(Context.USB_SERVICE) as UsbManager
        val driver = UsbSerialProber.getDefaultProber().findAllDrivers(usbManager).firstOrNull()
            ?: throw BridgeException(BridgeException.NO_ADAPTER, "No hay ningún adaptador USB serie conectado")

        if (!usbManager.hasPermission(driver.device) && !requestPermission(usbManager, driver.device)) {
            throw BridgeException(BridgeException.NO_ADAPTER, "Permiso USB denegado para el adaptador")
        }

        val connection = usbManager.openDevice(driver.device)
            ?: throw BridgeException(BridgeException.NO_ADAPTER, "No se pudo abrir el dispositivo USB")

        val p = driver.ports.firstOrNull()
            ?: throw BridgeException(BridgeException.NO_ADAPTER, "El adaptador USB no expone puertos serie")
        p.open(connection)
        p.setParameters(config.usbBaudRate, 8, UsbSerialPort.STOPBITS_1, UsbSerialPort.PARITY_NONE)
        port = p
    }

    /** Pide el permiso USB al sistema y espera la respuesta del usuario. */
    private suspend fun requestPermission(
        usbManager: UsbManager,
        device: android.hardware.usb.UsbDevice,
    ): Boolean {
        val granted = withTimeoutOrNull(PERMISSION_TIMEOUT_MS) {
            suspendCancellableCoroutine { cont ->
                val receiver = object : BroadcastReceiver() {
                    override fun onReceive(ctx: Context, intent: Intent) {
                        context.unregisterReceiver(this)
                        val ok = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)
                        if (cont.isActive) cont.resume(ok)
                    }
                }
                ContextCompat.registerReceiver(
                    context,
                    receiver,
                    IntentFilter(ACTION_USB_PERMISSION),
                    ContextCompat.RECEIVER_NOT_EXPORTED,
                )
                // FLAG_MUTABLE: el sistema añade extras al PendingIntent.
                val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    PendingIntent.FLAG_MUTABLE
                } else {
                    0
                }
                val pi = PendingIntent.getBroadcast(
                    context, 0, Intent(ACTION_USB_PERMISSION).setPackage(context.packageName), flags,
                )
                usbManager.requestPermission(device, pi)
                cont.invokeOnCancellation { runCatching { context.unregisterReceiver(receiver) } }
            }
        }
        return granted == true
    }

    override suspend fun close(): Unit = withContext(Dispatchers.IO) {
        runCatching { port?.close() }
        port = null
    }

    override suspend fun sendCommand(cmd: String): String = withContext(Dispatchers.IO) {
        val p = port ?: throw BridgeException(BridgeException.NO_ADAPTER, "USB no abierto")
        p.write((cmd + "\r").toByteArray(Charsets.US_ASCII), WRITE_TIMEOUT_MS)

        val sb = StringBuilder()
        val buf = ByteArray(256)
        var done = false
        while (!done) {
            // read() con timeout corto: mantiene el bucle cancelable.
            val n = p.read(buf, READ_SLICE_MS)
            if (n > 0) {
                for (i in 0 until n) {
                    val ch = buf[i].toInt().toChar()
                    if (ch == '>') {
                        done = true
                        break
                    }
                    sb.append(ch)
                }
            } else {
                delay(5)
            }
        }
        sb.toString()
    }

    companion object {
        const val ACTION_USB_PERMISSION = "os.vehicle.bridge.USB_PERMISSION"
        const val PERMISSION_TIMEOUT_MS = 30_000L
        const val WRITE_TIMEOUT_MS = 1000
        const val READ_SLICE_MS = 50
    }
}
