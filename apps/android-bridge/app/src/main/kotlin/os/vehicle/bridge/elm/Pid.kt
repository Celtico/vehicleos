package os.vehicle.bridge.elm

/**
 * PIDs OBD-II (modo 01) soportados por el bridge, con sus fórmulas de
 * conversión SAE J1979.
 *
 * Es el espejo Kotlin de `packages/vehicle-protocol/src/pids.ts`: las
 * claves (`name` del enum) coinciden EXACTAMENTE con las claves del
 * contrato TypeScript, porque el método JSON-RPC `read` las recibe tal
 * cual (p. ej. `{ "pid": "COOLANT_TEMP" }`).
 *
 * Kotlin puro, sin dependencias de Android: se cubre con tests JVM.
 */
enum class Pid(
    /** Modo OBD-II (0x01 = datos en tiempo real). */
    val mode: Int,
    /** Identificador del PID. */
    val pid: Int,
    /** Número de bytes de datos que devuelve la ECU. */
    val bytes: Int,
    /** Unidad del valor ya convertido. */
    val unit: String,
    /** Convierte los bytes crudos de la ECU al valor físico. */
    val parse: (IntArray) -> Double,
) {
    ENGINE_LOAD(0x01, 0x04, 1, "%", { d -> d[0] * 100.0 / 255.0 }),
    COOLANT_TEMP(0x01, 0x05, 1, "°C", { d -> d[0] - 40.0 }),
    INTAKE_MAP(0x01, 0x0B, 1, "kPa", { d -> d[0].toDouble() }),
    RPM(0x01, 0x0C, 2, "rpm", { d -> (d[0] * 256.0 + d[1]) / 4.0 }),
    SPEED(0x01, 0x0D, 1, "km/h", { d -> d[0].toDouble() }),
    INTAKE_TEMP(0x01, 0x0F, 1, "°C", { d -> d[0] - 40.0 }),
    THROTTLE(0x01, 0x11, 1, "%", { d -> d[0] * 100.0 / 255.0 }),
    FUEL_LEVEL(0x01, 0x2F, 1, "%", { d -> d[0] * 100.0 / 255.0 }),
    BAROMETRIC(0x01, 0x33, 1, "kPa", { d -> d[0].toDouble() }),
    CONTROL_MODULE_VOLTAGE(0x01, 0x42, 2, "V", { d -> (d[0] * 256.0 + d[1]) / 1000.0 }),
    FUEL_RATE(0x01, 0x5E, 2, "L/h", { d -> (d[0] * 256.0 + d[1]) / 20.0 });

    companion object {
        /** Busca un PID por su clave del contrato TS; null si no existe. */
        fun fromKey(key: String): Pid? = entries.firstOrNull { it.name == key }
    }
}
