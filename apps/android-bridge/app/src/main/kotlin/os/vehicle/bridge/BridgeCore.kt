package os.vehicle.bridge

import android.content.Context
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONObject
import os.vehicle.bridge.elm.Elm327Client
import os.vehicle.bridge.obd.ObdTransport
import os.vehicle.bridge.obd.TransportFactory
import os.vehicle.bridge.rpc.BridgeDispatcher
import os.vehicle.bridge.telemetry.LocationTracker
import os.vehicle.bridge.telemetry.TelemetryLoop
import java.util.Collections
import java.util.concurrent.ConcurrentHashMap

/**
 * Núcleo del bridge, compartido por el servidor WebSocket y por la
 * interfaz de WebView: gestiona la conexión OBD, los "sinks" (clientes a
 * los que enviamos JSON) y los suscriptores de telemetría.
 *
 * Optimización de batería: el bucle de telemetría (y el GPS) solo
 * funcionan mientras exista al menos un suscriptor; al quedarse sin
 * clientes se detienen y el adaptador deja de sondearse.
 */
class BridgeCore(context: Context) {

    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    val config = BridgeConfig(context)
    val location = LocationTracker(context)

    private val appContext = context.applicationContext

    /** Clientes conectados: id → función de envío de JSON. */
    private val sinks = ConcurrentHashMap<String, (String) -> Unit>()

    /** Subconjunto de sinks suscritos al stream de telemetría. */
    private val subscribers: MutableSet<String> =
        Collections.newSetFromMap(ConcurrentHashMap())

    /** Estado de la conexión con el vehículo (ConnectionState del contrato). */
    @Volatile
    var state: String = "disconnected"
        private set

    @Volatile
    var transport: ObdTransport? = null
        private set

    @Volatile
    var client: Elm327Client? = null
        private set

    private val connMutex = Mutex()

    val telemetryLoop = TelemetryLoop(this)
    val dispatcher = BridgeDispatcher(this)

    // ------------------------------------------------------------------
    // Gestión de clientes (sinks) y suscriptores
    // ------------------------------------------------------------------

    fun registerSink(id: String, send: (String) -> Unit) {
        sinks[id] = send
    }

    fun unregisterSink(id: String) {
        sinks.remove(id)
        unsubscribe(id)
    }

    fun subscribe(id: String) {
        subscribers.add(id)
        telemetryLoop.start()
    }

    fun unsubscribe(id: String) {
        subscribers.remove(id)
        if (subscribers.isEmpty()) {
            // Sin clientes: paramos el sondeo del adaptador (batería).
            telemetryLoop.stop()
        }
    }

    fun hasSubscribers(): Boolean = subscribers.isNotEmpty()

    fun subscriberCount(): Int = subscribers.size

    // ------------------------------------------------------------------
    // Emisión de eventos push (BridgeEvent del contrato)
    // ------------------------------------------------------------------

    /** Envía `{event, data}` a los suscriptores o a todos los clientes. */
    fun broadcastEvent(event: String, data: Any?, onlySubscribers: Boolean = false) {
        val json = JSONObject()
            .put("event", event)
            .put("data", data ?: JSONObject.NULL)
            .toString()
        for ((id, send) in sinks) {
            if (onlySubscribers && id !in subscribers) continue
            runCatching { send(json) }
        }
    }

    /** El JSON de VehicleTelemetry ya montado se emite solo a suscriptores. */
    fun broadcastTelemetry(telemetryJson: JSONObject) {
        broadcastEvent("telemetry", telemetryJson, onlySubscribers = true)
    }

    private fun emitConnectionState(newState: String) {
        state = newState
        broadcastEvent("connection", JSONObject().put("state", newState))
    }

    // ------------------------------------------------------------------
    // Ciclo de conexión OBD
    // ------------------------------------------------------------------

    /** Abre el transporte configurado e inicializa el ELM327. */
    suspend fun connect(): JSONObject = connMutex.withLock {
        if (state == "connected" && client != null) {
            return JSONObject()
                .put("state", "connected")
                .put("transport", transport?.name ?: JSONObject.NULL)
        }

        emitConnectionState("connecting")
        val t = try {
            TransportFactory.create(appContext, config)
        } catch (e: Exception) {
            emitConnectionState("error")
            throw e
        }

        try {
            t.open()
            val c = Elm327Client(t)
            c.initialize()
            transport = t
            client = c
            emitConnectionState("connected")
            Log.i(TAG, "Conectado al adaptador OBD por ${t.name}")
            JSONObject().put("state", "connected").put("transport", t.name)
        } catch (e: Exception) {
            runCatching { t.close() }
            transport = null
            client = null
            emitConnectionState("error")
            Log.w(TAG, "Fallo al conectar: ${e.message}")
            throw if (e is BridgeException) e else BridgeException(
                BridgeException.NO_ADAPTER,
                "No se pudo conectar al adaptador: ${e.message}",
            )
        }
    }

    /** Cierra la conexión con el adaptador y detiene la telemetría. */
    suspend fun disconnect(): JSONObject = connMutex.withLock {
        telemetryLoop.stop()
        runCatching { transport?.close() }
        transport = null
        client = null
        emitConnectionState("disconnected")
        JSONObject().put("state", "disconnected")
    }

    /** Apagado completo (onDestroy del servicio). */
    fun shutdown() {
        runBlocking { runCatching { disconnect() } }
        scope.cancel()
    }

    private companion object {
        const val TAG = "VehicleBridge"
    }
}
