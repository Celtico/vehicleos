package os.vehicle.bridge.obd

import android.annotation.SuppressLint
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.os.ParcelUuid
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.withTimeoutOrNull
import os.vehicle.bridge.BridgeConfig
import os.vehicle.bridge.BridgeException
import java.util.UUID
import kotlin.coroutines.resume

/**
 * Transporte BLE (GATT) para los clones ELM327 "Bluetooth 4.0/LE".
 *
 * Casi todos usan el mismo perfil UART-sobre-GATT:
 *  - Servicio FFF0
 *  - Característica FFF1: NOTIFY (respuestas del adaptador)
 *  - Característica FFF2: WRITE (comandos hacia el adaptador)
 *
 * Localización del dispositivo: primero entre los emparejados (por
 * subcadena de nombre, config `btName`); si no aparece, escaneo BLE
 * filtrado por el servicio FFF0 (requiere BLUETOOTH_SCAN, declarado
 * `neverForLocation`).
 */
@SuppressLint("MissingPermission")
class BleTransport(
    private val context: Context,
    private val config: BridgeConfig,
) : ObdTransport {

    override val name = "ble"

    private var gatt: BluetoothGatt? = null
    private var writeChar: BluetoothGattCharacteristic? = null

    /** Bytes recibidos por NOTIFY en FFF1. */
    private val incoming = Channel<ByteArray>(Channel.UNLIMITED)

    /** Confirmaciones de escritura (onCharacteristicWrite). */
    private val writeAck = Channel<Int>(Channel.CONFLATED)

    private var connected = CompletableDeferred<Unit>()
    private var servicesReady = CompletableDeferred<Unit>()
    private var descriptorWritten = CompletableDeferred<Unit>()

    private val callback = object : BluetoothGattCallback() {
        override fun onConnectionStateChange(g: BluetoothGatt, status: Int, newState: Int) {
            if (newState == BluetoothProfile.STATE_CONNECTED && status == BluetoothGatt.GATT_SUCCESS) {
                connected.complete(Unit)
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                val e = BridgeException(BridgeException.NO_ADAPTER, "BLE desconectado (status=$status)")
                connected.completeExceptionally(e)
                servicesReady.completeExceptionally(e)
                descriptorWritten.completeExceptionally(e)
            }
        }

        override fun onServicesDiscovered(g: BluetoothGatt, status: Int) {
            if (status == BluetoothGatt.GATT_SUCCESS) servicesReady.complete(Unit)
            else servicesReady.completeExceptionally(
                BridgeException(BridgeException.NO_ADAPTER, "Fallo al descubrir servicios GATT ($status)"),
            )
        }

        override fun onDescriptorWrite(g: BluetoothGatt, d: BluetoothGattDescriptor, status: Int) {
            if (status == BluetoothGatt.GATT_SUCCESS) descriptorWritten.complete(Unit)
            else descriptorWritten.completeExceptionally(
                BridgeException(BridgeException.NO_ADAPTER, "No se pudo habilitar NOTIFY ($status)"),
            )
        }

        override fun onCharacteristicWrite(
            g: BluetoothGatt,
            c: BluetoothGattCharacteristic,
            status: Int,
        ) {
            writeAck.trySend(status)
        }

        @Deprecated("Firma pre-API 33; los clones ELM327 la siguen usando")
        override fun onCharacteristicChanged(g: BluetoothGatt, c: BluetoothGattCharacteristic) {
            c.value?.let { incoming.trySend(it.clone()) }
        }

        override fun onCharacteristicChanged(
            g: BluetoothGatt,
            c: BluetoothGattCharacteristic,
            value: ByteArray,
        ) {
            incoming.trySend(value.clone())
        }
    }

    override suspend fun open(): Unit = withContext(Dispatchers.Default) {
        val adapter = context.getSystemService(BluetoothManager::class.java)?.adapter
            ?: throw BridgeException(BridgeException.NO_ADAPTER, "Este dispositivo no tiene Bluetooth")
        if (!adapter.isEnabled) {
            throw BridgeException(BridgeException.NO_ADAPTER, "Bluetooth desactivado")
        }

        // 1) Dispositivo emparejado por nombre; 2) escaneo por servicio FFF0.
        val device = adapter.bondedDevices.firstOrNull {
            it.name?.contains(config.bluetoothName, ignoreCase = true) == true &&
                it.type != BluetoothDevice.DEVICE_TYPE_CLASSIC
        } ?: scanForDevice(adapter.bluetoothLeScanner)
            ?: throw BridgeException(
                BridgeException.NO_ADAPTER,
                "No se encontró ningún adaptador BLE (servicio FFF0)",
            )

        connected = CompletableDeferred()
        servicesReady = CompletableDeferred()
        descriptorWritten = CompletableDeferred()

        val g = device.connectGatt(context, false, callback, BluetoothDevice.TRANSPORT_LE)
        gatt = g
        try {
            withTimeout(CONNECT_TIMEOUT_MS) { connected.await() }
            g.discoverServices()
            withTimeout(CONNECT_TIMEOUT_MS) { servicesReady.await() }

            val service = g.getService(SERVICE_UUID)
                ?: throw BridgeException(BridgeException.NO_ADAPTER, "El dispositivo no expone el servicio FFF0")
            val notify = service.getCharacteristic(NOTIFY_UUID)
                ?: throw BridgeException(BridgeException.NO_ADAPTER, "Falta la característica FFF1 (notify)")
            writeChar = service.getCharacteristic(WRITE_UUID)
                ?: throw BridgeException(BridgeException.NO_ADAPTER, "Falta la característica FFF2 (write)")

            // Habilitar notificaciones: flag local + descriptor CCCD remoto.
            g.setCharacteristicNotification(notify, true)
            val cccd = notify.getDescriptor(CCCD_UUID)
            if (cccd != null) {
                @Suppress("DEPRECATION")
                cccd.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
                @Suppress("DEPRECATION")
                g.writeDescriptor(cccd)
                withTimeout(CONNECT_TIMEOUT_MS) { descriptorWritten.await() }
            }
        } catch (e: TimeoutCancellationException) {
            close()
            throw BridgeException(BridgeException.TIMEOUT, "Timeout conectando por BLE")
        } catch (e: Exception) {
            close()
            throw e
        }
    }

    /** Escaneo BLE de hasta 10 s filtrado por el servicio FFF0. */
    private suspend fun scanForDevice(scanner: android.bluetooth.le.BluetoothLeScanner?): BluetoothDevice? {
        if (scanner == null) return null
        return withTimeoutOrNull(SCAN_TIMEOUT_MS) {
            suspendCancellableCoroutine { cont ->
                val cb = object : ScanCallback() {
                    override fun onScanResult(callbackType: Int, result: ScanResult) {
                        scanner.stopScan(this)
                        if (cont.isActive) cont.resume(result.device)
                    }

                    override fun onScanFailed(errorCode: Int) {
                        scanner.stopScan(this)
                        if (cont.isActive) cont.resume(null)
                    }
                }
                val filter = ScanFilter.Builder()
                    .setServiceUuid(ParcelUuid(SERVICE_UUID))
                    .build()
                val settings = ScanSettings.Builder()
                    .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                    .build()
                scanner.startScan(listOf(filter), settings, cb)
                cont.invokeOnCancellation { scanner.stopScan(cb) }
            }
        }
    }

    override suspend fun close(): Unit = withContext(Dispatchers.Default) {
        runCatching { gatt?.disconnect() }
        runCatching { gatt?.close() }
        gatt = null
        writeChar = null
        // Vaciar restos de respuestas anteriores.
        while (incoming.tryReceive().isSuccess) Unit
    }

    override suspend fun sendCommand(cmd: String): String {
        val g = gatt ?: throw BridgeException(BridgeException.NO_ADAPTER, "BLE no abierto")
        val wc = writeChar ?: throw BridgeException(BridgeException.NO_ADAPTER, "BLE no abierto")

        // Descartar bytes residuales de comandos anteriores.
        while (incoming.tryReceive().isSuccess) Unit

        // Escribir en trozos de ≤20 bytes (MTU BLE por defecto = 23).
        val payload = (cmd + "\r").toByteArray(Charsets.US_ASCII)
        var offset = 0
        while (offset < payload.size) {
            val chunk = payload.copyOfRange(offset, minOf(offset + MAX_CHUNK, payload.size))
            @Suppress("DEPRECATION")
            wc.value = chunk
            @Suppress("DEPRECATION")
            if (!g.writeCharacteristic(wc)) {
                throw BridgeException(BridgeException.NO_ADAPTER, "Fallo de escritura BLE")
            }
            val status = writeAck.receive()
            if (status != BluetoothGatt.GATT_SUCCESS) {
                throw BridgeException(BridgeException.NO_ADAPTER, "Escritura BLE rechazada ($status)")
            }
            offset += MAX_CHUNK
        }

        // Acumular notificaciones hasta ver el prompt '>'.
        val sb = StringBuilder()
        while (true) {
            val bytes = incoming.receive()
            for (b in bytes) {
                val ch = b.toInt().toChar()
                if (ch == '>') return sb.toString()
                sb.append(ch)
            }
        }
    }

    companion object {
        val SERVICE_UUID: UUID = UUID.fromString("0000FFF0-0000-1000-8000-00805F9B34FB")
        val NOTIFY_UUID: UUID = UUID.fromString("0000FFF1-0000-1000-8000-00805F9B34FB")
        val WRITE_UUID: UUID = UUID.fromString("0000FFF2-0000-1000-8000-00805F9B34FB")

        /** Client Characteristic Configuration Descriptor. */
        val CCCD_UUID: UUID = UUID.fromString("00002902-0000-1000-8000-00805F9B34FB")

        const val CONNECT_TIMEOUT_MS = 10_000L
        const val SCAN_TIMEOUT_MS = 10_000L
        const val MAX_CHUNK = 20
    }
}
