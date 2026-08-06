package os.vehicle.bridge.obd

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothSocket
import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import os.vehicle.bridge.BridgeConfig
import os.vehicle.bridge.BridgeException
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.util.UUID

/**
 * Transporte Bluetooth clásico (RFCOMM / perfil SPP), el más común en los
 * adaptadores ELM327 baratos.
 *
 * El adaptador debe estar previamente EMPAREJADO en los ajustes del
 * sistema; lo localizamos entre los dispositivos emparejados por
 * subcadena del nombre (config `btName`, por defecto "OBDII").
 *
 * Los permisos BLUETOOTH_CONNECT (API 31+) se conceden por adb o desde
 * los ajustes de la app; @SuppressLint porque este servicio no tiene UI
 * desde la que pedirlos en tiempo de ejecución.
 */
@SuppressLint("MissingPermission")
class BluetoothClassicTransport(
    private val context: Context,
    private val config: BridgeConfig,
) : StreamObdTransport() {

    override val name = "bluetooth"

    private var socket: BluetoothSocket? = null
    private var input: InputStream? = null
    private var output: OutputStream? = null

    override fun inputOrNull(): InputStream? = input
    override fun outputOrNull(): OutputStream? = output

    override suspend fun open(): Unit = withContext(Dispatchers.IO) {
        val adapter: BluetoothAdapter =
            context.getSystemService(BluetoothManager::class.java)?.adapter
                ?: throw BridgeException(BridgeException.NO_ADAPTER, "Este dispositivo no tiene Bluetooth")
        if (!adapter.isEnabled) {
            throw BridgeException(BridgeException.NO_ADAPTER, "Bluetooth desactivado")
        }

        val wanted = config.bluetoothName
        val device = adapter.bondedDevices.firstOrNull {
            it.name?.contains(wanted, ignoreCase = true) == true
        } ?: throw BridgeException(
            BridgeException.NO_ADAPTER,
            "No hay ningún dispositivo emparejado cuyo nombre contenga \"$wanted\"",
        )

        // El discovery activo degrada mucho la conexión RFCOMM.
        adapter.cancelDiscovery()

        val s = device.createRfcommSocketToServiceRecord(SPP_UUID)
        try {
            s.connect()
        } catch (e: IOException) {
            runCatching { s.close() }
            throw BridgeException(
                BridgeException.NO_ADAPTER,
                "No se pudo conectar por Bluetooth a ${device.name}: ${e.message}",
            )
        }
        socket = s
        input = s.inputStream
        output = s.outputStream
    }

    override suspend fun close(): Unit = withContext(Dispatchers.IO) {
        runCatching { socket?.close() }
        socket = null
        input = null
        output = null
    }

    companion object {
        /** UUID estándar del perfil Serial Port Profile (SPP). */
        val SPP_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
    }
}
