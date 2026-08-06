package os.vehicle.bridge

/**
 * Error del bridge con código numérico, tal y como viaja en
 * `BridgeResponse.error = { code, message }` del contrato TS.
 */
class BridgeException(val code: Int, message: String) : Exception(message) {
    companion object {
        /** Petición JSON-RPC malformada o método desconocido. */
        const val INVALID_REQUEST = 1000

        /** No hay adaptador OBD disponible o no estamos conectados. */
        const val NO_ADAPTER = 1001

        /** El adaptador no respondió a tiempo. */
        const val TIMEOUT = 1002

        /** Clave de PID desconocida en `read`. */
        const val UNKNOWN_PID = 1003

        /** Error interno inesperado. */
        const val INTERNAL = 1500
    }
}
