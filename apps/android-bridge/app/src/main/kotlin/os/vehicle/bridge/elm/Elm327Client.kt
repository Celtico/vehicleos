package os.vehicle.bridge.elm

import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withTimeout
import os.vehicle.bridge.BridgeException
import os.vehicle.bridge.obd.ObdTransport

/**
 * Cliente ELM327 sobre un [ObdTransport] cualquiera.
 *
 * - Serializa TODOS los comandos con un [Mutex]: un ELM327 solo procesa
 *   un comando a la vez (telemetría, `read` puntual y DTC comparten
 *   adaptador sin pisarse).
 * - Aplica timeout por comando y lo traduce al error 1002 del contrato.
 */
class Elm327Client(
    private val transport: ObdTransport,
    private val commandTimeoutMs: Long = 3000,
) {
    private val mutex = Mutex()

    /**
     * Secuencia de inicialización estándar: ATZ, ATE0, ATL0, ATS0, ATH0,
     * ATSP0 (autodetección de protocolo).
     */
    suspend fun initialize() {
        for (cmd in Elm327Codec.INIT_SEQUENCE) {
            command(cmd, timeoutMs = INIT_TIMEOUT_MS)
            // ATZ reinicia el micro del adaptador: darle un respiro.
            if (cmd == "ATZ") delay(500)
        }
    }

    /** Lee un PID y devuelve su valor físico; null si la ECU no responde datos. */
    suspend fun readPid(pid: Pid): Double? {
        val raw = command(Elm327Codec.buildPidCommand(pid))
        return Elm327Codec.parsePidValue(raw, pid)
    }

    /**
     * Presión de turbo (bar relativos): MAP (0x0B) menos barométrica (0x33).
     * Si la barométrica no está disponible se asume 101 kPa.
     */
    suspend fun readBoostBar(): Double? {
        val map = readPid(Pid.INTAKE_MAP) ?: return null
        val baro = readPid(Pid.BAROMETRIC) ?: 101.0
        return Elm327Codec.boostFromMap(map, baro)
    }

    /** Modo 03: lista de códigos DTC almacenados ("P0401", "C1234"…). */
    suspend fun readDtc(): List<String> {
        val raw = command(Elm327Codec.CMD_READ_DTC, timeoutMs = DTC_TIMEOUT_MS)
        return Elm327Codec.parseDtcResponse(raw)
            ?: throw BridgeException(BridgeException.INTERNAL, "Respuesta de modo 03 no reconocida: $raw")
    }

    /** Modo 04: borra los DTC y apaga el testigo. */
    suspend fun clearDtc(): Boolean {
        val raw = command(Elm327Codec.CMD_CLEAR_DTC, timeoutMs = DTC_TIMEOUT_MS)
        return Elm327Codec.isClearDtcOk(raw)
    }

    /** Envía un comando serializado por el mutex y con timeout. */
    private suspend fun command(cmd: String, timeoutMs: Long = commandTimeoutMs): String =
        mutex.withLock {
            try {
                withTimeout(timeoutMs) { transport.sendCommand(cmd) }
            } catch (e: TimeoutCancellationException) {
                throw BridgeException(
                    BridgeException.TIMEOUT,
                    "El adaptador no respondió a \"$cmd\" en ${timeoutMs} ms",
                )
            }
        }

    private companion object {
        // ATZ/ATSP0 y las lecturas DTC pueden tardar más que un PID.
        const val INIT_TIMEOUT_MS = 5000L
        const val DTC_TIMEOUT_MS = 5000L
    }
}
