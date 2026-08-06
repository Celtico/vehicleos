package os.vehicle.bridge.rpc

import android.util.Log
import kotlinx.coroutines.launch
import org.java_websocket.WebSocket
import org.java_websocket.handshake.ClientHandshake
import org.java_websocket.server.WebSocketServer
import os.vehicle.bridge.BridgeCore
import java.net.InetSocketAddress

/**
 * Servidor WebSocket del bridge: ws://127.0.0.1:8722.
 *
 * SEGURIDAD: se liga EXCLUSIVAMENTE a la interfaz loopback, de modo que
 * solo procesos del propio dispositivo (la PWA en el navegador/WebView)
 * pueden conectarse; nada es accesible desde la red.
 *
 * Cada conexión es un "sink" del BridgeCore; los mensajes entrantes son
 * BridgeRequest y se responden con BridgeResponse. Los BridgeEvent
 * ("telemetry", "connection", "error") se emiten push desde el core.
 */
class BridgeWebSocketServer(
    private val core: BridgeCore,
    port: Int = BRIDGE_WS_PORT,
) : WebSocketServer(InetSocketAddress("127.0.0.1", port)) {

    init {
        // Permite reiniciar el servicio sin esperar el TIME_WAIT del puerto.
        isReuseAddr = true
        connectionLostTimeout = 30
    }

    private fun idOf(conn: WebSocket): String =
        "ws-" + System.identityHashCode(conn)

    override fun onStart() {
        Log.i(TAG, "Servidor WebSocket escuchando en 127.0.0.1:$port")
    }

    override fun onOpen(conn: WebSocket, handshake: ClientHandshake) {
        core.registerSink(idOf(conn)) { json ->
            if (conn.isOpen) conn.send(json)
        }
    }

    override fun onClose(conn: WebSocket, code: Int, reason: String, remote: Boolean) {
        // Al desaparecer el cliente se retira también su suscripción
        // (si era el último, el bucle de telemetría se detiene).
        core.unregisterSink(idOf(conn))
    }

    override fun onMessage(conn: WebSocket, message: String) {
        val clientId = idOf(conn)
        core.scope.launch {
            val response = core.dispatcher.dispatch(clientId, message)
            if (conn.isOpen) conn.send(response)
        }
    }

    override fun onError(conn: WebSocket?, ex: Exception) {
        Log.w(TAG, "Error WebSocket: ${ex.message}")
        if (conn != null) core.unregisterSink(idOf(conn))
    }

    companion object {
        private const val TAG = "VehicleBridge"

        /** Puerto del contrato (BRIDGE_WS_PORT en packages/shared/src/bridge.ts). */
        const val BRIDGE_WS_PORT = 8722
    }
}
