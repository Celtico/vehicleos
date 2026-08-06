package os.vehicle.bridge.telemetry

import android.os.SystemClock
import android.util.Log
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.json.JSONObject
import os.vehicle.bridge.BridgeCore
import os.vehicle.bridge.BridgeException
import os.vehicle.bridge.elm.Pid

/**
 * Bucle de telemetría: mientras haya suscriptores, lee el conjunto de
 * PIDs (~5-7 Hz), añade la posición GPS y emite el JSON de
 * VehicleTelemetry (EXACTO al contrato de packages/shared/src/vehicle.ts)
 * como BridgeEvent "telemetry" a todos los clientes suscritos.
 *
 * Estrategia de sondeo (un ELM327 tarda 20-60 ms por PID):
 *  - PIDs "rápidos" en cada ciclo: SPEED, RPM, THROTTLE, ENGINE_LOAD, MAP.
 *  - PIDs "lentos" cada [SLOW_EVERY] ciclos (cambian despacio):
 *    COOLANT_TEMP, CONTROL_MODULE_VOLTAGE, FUEL_LEVEL, BAROMETRIC, FUEL_RATE.
 *  - DTC (modo 03) cada [DTC_EVERY] ciclos para derivar `systems`.
 *
 * El odómetro no existe en OBD-II estándar: se integra la velocidad en el
 * tiempo y se persiste en la configuración.
 */
class TelemetryLoop(private val core: BridgeCore) {

    private var job: Job? = null

    /** Caché de la última lista de DTC (null = aún no leída). */
    @Volatile
    private var dtcCache: List<String>? = null

    /** Fuerza una relectura de DTC en el próximo ciclo (tras clearDtc). */
    fun invalidateDtcCache() {
        dtcCache = null
    }

    @Synchronized
    fun start() {
        if (job?.isActive == true) return
        job = core.scope.launch { run() }
    }

    @Synchronized
    fun stop() {
        job?.cancel()
        job = null
    }

    private suspend fun run() {
        core.location.start()
        Log.i(TAG, "Bucle de telemetría iniciado")

        val slow = mutableMapOf<Pid, Double>()
        var odometerKm = core.config.odometerKm
        var lastTickMs = SystemClock.elapsedRealtime()
        var cycle = 0L

        try {
            while (kotlinx.coroutines.currentCoroutineContext().isActive && core.hasSubscribers()) {
                val cycleStart = SystemClock.elapsedRealtime()
                val client = core.client

                if (client == null || core.state != "connected") {
                    // Sin adaptador: no hay nada que sondear todavía.
                    delay(IDLE_DELAY_MS)
                    lastTickMs = SystemClock.elapsedRealtime()
                    continue
                }

                try {
                    // --- PIDs rápidos (cada ciclo) ---
                    val speed = client.readPid(Pid.SPEED) ?: 0.0
                    val rpm = client.readPid(Pid.RPM) ?: 0.0
                    val throttle = client.readPid(Pid.THROTTLE) ?: 0.0
                    val engineLoad = client.readPid(Pid.ENGINE_LOAD) ?: 0.0
                    val mapKpa = client.readPid(Pid.INTAKE_MAP)

                    // --- PIDs lentos (cada SLOW_EVERY ciclos) ---
                    if (cycle % SLOW_EVERY == 0L || slow.isEmpty()) {
                        for (pid in SLOW_PIDS) {
                            client.readPid(pid)?.let { slow[pid] = it }
                        }
                    }

                    // --- DTC para `systems` (cada DTC_EVERY ciclos) ---
                    if (cycle % DTC_EVERY == 0L || dtcCache == null) {
                        runCatching { dtcCache = client.readDtc() }
                    }

                    // --- Odómetro integrado a partir de la velocidad ---
                    val now = SystemClock.elapsedRealtime()
                    val dtH = (now - lastTickMs) / 3_600_000.0
                    lastTickMs = now
                    odometerKm += speed * dtH
                    if (cycle % PERSIST_EVERY == 0L) core.config.odometerKm = odometerKm

                    val boostBar = mapKpa?.let {
                        os.vehicle.bridge.elm.Elm327Codec.boostFromMap(
                            it,
                            slow[Pid.BAROMETRIC] ?: 101.0,
                        )
                    } ?: 0.0

                    val telemetry = buildTelemetry(
                        speed = speed,
                        rpm = rpm,
                        coolantTemp = slow[Pid.COOLANT_TEMP] ?: 0.0,
                        batteryVoltage = slow[Pid.CONTROL_MODULE_VOLTAGE] ?: 0.0,
                        turboPressure = boostBar,
                        fuelLevel = slow[Pid.FUEL_LEVEL] ?: 0.0,
                        engineLoad = engineLoad,
                        throttle = throttle,
                        fuelRate = slow[Pid.FUEL_RATE] ?: 0.0,
                        odometerKm = odometerKm,
                    )
                    core.broadcastTelemetry(telemetry)
                } catch (e: BridgeException) {
                    // Timeout puntual o adaptador caído: avisar y reintentar.
                    core.broadcastEvent(
                        "error",
                        JSONObject().put("code", e.code).put("message", e.message ?: ""),
                    )
                    delay(ERROR_BACKOFF_MS)
                }

                cycle++
                // Mantener el periodo objetivo (~6-7 Hz).
                val elapsed = SystemClock.elapsedRealtime() - cycleStart
                if (elapsed < PERIOD_MS) delay(PERIOD_MS - elapsed)
            }
        } finally {
            core.config.odometerKm = odometerKm
            core.location.stop()
            Log.i(TAG, "Bucle de telemetría detenido")
        }
    }

    /** Compone el JSON con la forma EXACTA de VehicleTelemetry. */
    private fun buildTelemetry(
        speed: Double,
        rpm: Double,
        coolantTemp: Double,
        batteryVoltage: Double,
        turboPressure: Double,
        fuelLevel: Double,
        engineLoad: Double,
        throttle: Double,
        fuelRate: Double,
        odometerKm: Double,
    ): JSONObject {
        val json = JSONObject()
            .put("timestamp", System.currentTimeMillis())
            .put("speed", speed)
            .put("rpm", rpm)
            .put("coolantTemp", coolantTemp)
            .put("batteryVoltage", batteryVoltage)
            .put("turboPressure", turboPressure)
            .put("fuelLevel", fuelLevel)
            .put("engineLoad", engineLoad)
            .put("throttle", throttle)
            .put("fuelRate", fuelRate)
            .put("odometer", odometerKm)
            .put("engineRunning", rpm > 0.0)

        // location es opcional en el contrato: solo si hay fix GPS reciente.
        core.location.currentGeoPoint()?.let { p ->
            val loc = JSONObject().put("lat", p.lat).put("lon", p.lon)
            p.heading?.let { loc.put("heading", it) }
            json.put("location", loc)
        }

        json.put("systems", buildSystems(coolantTemp))
        return json
    }

    /**
     * Deriva VehicleSystems de los DTC almacenados:
     *  - engine: "error" con códigos P, "warning" con refrigerante > 115 °C.
     *  - abs / esp: "warning" con códigos C (chasis).
     *  - airbag: "warning" con códigos B (carrocería).
     *  - "unknown" mientras no se hayan podido leer los DTC.
     */
    private fun buildSystems(coolantTemp: Double): JSONObject {
        val dtc = dtcCache
        val json = JSONObject()
        if (dtc == null) {
            return json.put("engine", "unknown").put("abs", "unknown")
                .put("esp", "unknown").put("airbag", "unknown")
        }
        val engine = when {
            dtc.any { it.startsWith("P") } -> "error"
            coolantTemp > OVERHEAT_C -> "warning"
            else -> "ok"
        }
        val chassis = if (dtc.any { it.startsWith("C") }) "warning" else "ok"
        val body = if (dtc.any { it.startsWith("B") }) "warning" else "ok"
        return json.put("engine", engine).put("abs", chassis)
            .put("esp", chassis).put("airbag", body)
    }

    companion object {
        private const val TAG = "VehicleBridge"

        /** Periodo objetivo del ciclo (~150 ms ⇒ 6-7 Hz). */
        const val PERIOD_MS = 150L
        const val IDLE_DELAY_MS = 500L
        const val ERROR_BACKOFF_MS = 1000L

        /** PIDs lentos: cada 10 ciclos (~1,5 s). */
        const val SLOW_EVERY = 10L

        /** DTC: cada 200 ciclos (~30 s). */
        const val DTC_EVERY = 200L

        /** Persistencia del odómetro: cada 50 ciclos (~7,5 s). */
        const val PERSIST_EVERY = 50L

        const val OVERHEAT_C = 115.0

        val SLOW_PIDS = listOf(
            Pid.COOLANT_TEMP,
            Pid.CONTROL_MODULE_VOLTAGE,
            Pid.FUEL_LEVEL,
            Pid.BAROMETRIC,
            Pid.FUEL_RATE,
        )
    }
}
