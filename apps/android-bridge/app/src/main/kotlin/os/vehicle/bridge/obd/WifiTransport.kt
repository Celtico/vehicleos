package os.vehicle.bridge.obd

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import os.vehicle.bridge.BridgeConfig
import os.vehicle.bridge.BridgeException
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.net.InetSocketAddress
import java.net.Socket

/**
 * Transporte WiFi: socket TCP contra un adaptador ELM327 WiFi.
 *
 * Los adaptadores típicos crean su propio punto de acceso y escuchan en
 * 192.168.0.10:35000 (configurable en `wifiHost`/`wifiPort`).
 */
class WifiTransport(private val config: BridgeConfig) : StreamObdTransport() {

    override val name = "wifi"

    private var socket: Socket? = null
    private var input: InputStream? = null
    private var output: OutputStream? = null

    override fun inputOrNull(): InputStream? = input
    override fun outputOrNull(): OutputStream? = output

    override suspend fun open(): Unit = withContext(Dispatchers.IO) {
        val s = Socket()
        try {
            s.tcpNoDelay = true
            s.connect(InetSocketAddress(config.wifiHost, config.wifiPort), CONNECT_TIMEOUT_MS)
        } catch (e: IOException) {
            runCatching { s.close() }
            throw BridgeException(
                BridgeException.NO_ADAPTER,
                "No se pudo conectar al adaptador WiFi ${config.wifiHost}:${config.wifiPort}: ${e.message}",
            )
        }
        socket = s
        input = s.getInputStream()
        output = s.getOutputStream()
    }

    override suspend fun close(): Unit = withContext(Dispatchers.IO) {
        runCatching { socket?.close() }
        socket = null
        input = null
        output = null
    }

    private companion object {
        const val CONNECT_TIMEOUT_MS = 5000
    }
}
