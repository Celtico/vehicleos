package os.vehicle.bridge.rpc

import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject
import os.vehicle.bridge.BridgeCore
import os.vehicle.bridge.BridgeException
import os.vehicle.bridge.elm.Elm327Client
import os.vehicle.bridge.elm.Pid

/**
 * Despachador JSON-RPC del bridge, compartido por el servidor WebSocket
 * y por la interfaz de WebView (misma semántica por ambas vías).
 *
 * Contrato (packages/shared/src/bridge.ts):
 *  - BridgeRequest  { id: number, method: BridgeMethod, params?: object }
 *  - BridgeResponse { id: number, result?: unknown, error?: { code, message } }
 *
 * Métodos: connect, disconnect, status, read {pid}, dtc, clearDtc,
 * subscribe, unsubscribe.
 *
 * `read` acepta las claves de PID del contrato TS (SPEED, RPM,
 * COOLANT_TEMP, CONTROL_MODULE_VOLTAGE, FUEL_LEVEL…) más la clave
 * virtual BOOST (MAP 0x0B − barométrica 0x33, en bar).
 */
class BridgeDispatcher(private val core: BridgeCore) {

    /**
     * Procesa una BridgeRequest serializada y devuelve la BridgeResponse
     * serializada. Nunca lanza: todo error se convierte en
     * `{ id, error: { code, message } }`.
     */
    suspend fun dispatch(clientId: String, requestJson: String): String {
        var id = -1
        return try {
            val request = try {
                JSONObject(requestJson)
            } catch (e: JSONException) {
                throw BridgeException(BridgeException.INVALID_REQUEST, "JSON malformado: ${e.message}")
            }
            id = request.optInt("id", -1)
            val method = request.optString("method", "")
            val params = request.optJSONObject("params")

            val result = handle(clientId, method, params)
            JSONObject().put("id", id).put("result", result).toString()
        } catch (e: BridgeException) {
            errorResponse(id, e.code, e.message ?: "Error del bridge")
        } catch (e: Exception) {
            errorResponse(id, BridgeException.INTERNAL, "Error interno: ${e.message}")
        }
    }

    private suspend fun handle(clientId: String, method: String, params: JSONObject?): Any =
        when (method) {
            "connect" -> core.connect()

            "disconnect" -> core.disconnect()

            "status" -> JSONObject()
                .put("state", core.state)
                .put("transport", core.transport?.name ?: JSONObject.NULL)
                .put("subscribers", core.subscriberCount())

            "read" -> read(params)

            "dtc" -> {
                val codes = requireClient().readDtc()
                // DiagnosticTroubleCode[] del contrato: { code, status }.
                JSONArray().also { arr ->
                    codes.forEach { code ->
                        arr.put(JSONObject().put("code", code).put("status", "stored"))
                    }
                }
            }

            "clearDtc" -> {
                val ok = requireClient().clearDtc()
                if (ok) core.telemetryLoop.invalidateDtcCache()
                JSONObject().put("cleared", ok)
            }

            "subscribe" -> {
                core.subscribe(clientId)
                JSONObject().put("subscribed", true)
            }

            "unsubscribe" -> {
                core.unsubscribe(clientId)
                JSONObject().put("subscribed", false)
            }

            "raw" -> raw(params)

            else -> throw BridgeException(
                BridgeException.INVALID_REQUEST,
                "Método desconocido: \"$method\"",
            )
        }

    /**
     * `raw { command, timeoutMs? }`: comando literal al adaptador.
     *
     * Necesario para las centralitas propietarias (ver MercedesProvider en
     * el SDK). Devuelve la respuesta tal cual, sin interpretarla: quien
     * sabe leerla es el protocolo del lado TypeScript.
     */
    private suspend fun raw(params: JSONObject?): String {
        val command = params?.optString("command")?.takeIf { it.isNotBlank() }
            ?: throw BridgeException(
                BridgeException.INVALID_REQUEST,
                "Falta el parámetro \"command\"",
            )
        val timeout = params.optLong("timeoutMs", 0L).takeIf { it > 0 } ?: RAW_TIMEOUT_MS
        return requireClient().raw(command, timeout)
    }

    /** `read { pid }`: lectura puntual de un PID por su clave del contrato. */
    private suspend fun read(params: JSONObject?): JSONObject {
        val key = params?.optString("pid")?.takeIf { it.isNotEmpty() }
            ?: throw BridgeException(BridgeException.INVALID_REQUEST, "read requiere params.pid")
        val client = requireClient()

        // BOOST es una clave virtual: se calcula con dos PIDs.
        if (key == "BOOST") {
            val value = client.readBoostBar()
            return JSONObject()
                .put("pid", key)
                .put("value", value ?: JSONObject.NULL)
                .put("unit", "bar")
        }

        val pid = Pid.fromKey(key)
            ?: throw BridgeException(BridgeException.UNKNOWN_PID, "PID desconocido: \"$key\"")
        val value = client.readPid(pid)
        return JSONObject()
            .put("pid", key)
            .put("value", value ?: JSONObject.NULL)
            .put("unit", pid.unit)
    }

    private fun requireClient(): Elm327Client =
        core.client ?: throw BridgeException(
            BridgeException.NO_ADAPTER,
            "No hay conexión con el adaptador OBD (llama antes a connect)",
        )

    private fun errorResponse(id: Int, code: Int, message: String): String =
        JSONObject()
            .put("id", id)
            .put("error", JSONObject().put("code", code).put("message", message))
            .toString()

    private companion object {
        /**
         * Las centralitas de chasis tardan más que el motor en contestar, y
         * la inicialización de KWP2000 incluye un arranque de bus.
         */
        const val RAW_TIMEOUT_MS = 5_000L
    }
}
