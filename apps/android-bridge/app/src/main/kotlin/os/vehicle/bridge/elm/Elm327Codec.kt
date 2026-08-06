package os.vehicle.bridge.elm

/**
 * Códec ELM327: construcción de comandos y parseo de respuestas.
 *
 * Espejo Kotlin de `packages/vehicle-protocol/src/elm327.ts` y `dtc.ts`.
 * Es agnóstico del transporte (Bluetooth/BLE/USB/WiFi) y 100 % JVM puro,
 * por lo que se verifica con tests unitarios sin Android.
 */
object Elm327Codec {

    /** Secuencia de inicialización recomendada para un adaptador ELM327. */
    val INIT_SEQUENCE = listOf(
        "ATZ",  // reset del adaptador
        "ATE0", // echo off
        "ATL0", // linefeeds off
        "ATS0", // espacios off
        "ATH0", // cabeceras off
        "ATSP0", // autodetección de protocolo
    )

    /** Comando del modo 03 (leer DTC almacenados). */
    const val CMD_READ_DTC = "03"

    /** Comando del modo 04 (borrar DTC y apagar el testigo MIL). */
    const val CMD_CLEAR_DTC = "04"

    private val LETTERS = charArrayOf('P', 'C', 'B', 'U')

    /** Construye el comando hex para solicitar un PID ("010C" para RPM). */
    fun buildPidCommand(pid: Pid): String =
        "%02X%02X".format(pid.mode, pid.pid)

    /**
     * Limpia una respuesta cruda del ELM327 y devuelve los bytes de datos.
     *
     * Ejemplo: para "41 0C 1A F8" con [Pid.RPM] devuelve [0x1A, 0xF8].
     * Devuelve null si la respuesta es "NO DATA", un error o no
     * corresponde al PID solicitado.
     */
    fun parsePidResponse(raw: String, pid: Pid): IntArray? {
        val clean = sanitize(raw)
        if (clean.isEmpty() || "NODATA" in clean || "ERROR" in clean) return null

        val expectedPrefix = "%02X%02X".format(pid.mode + 0x40, pid.pid)
        val idx = clean.indexOf(expectedPrefix)
        if (idx == -1) return null

        val start = idx + 4
        val end = start + pid.bytes * 2
        if (end > clean.length) return null

        val dataHex = clean.substring(start, end)
        return IntArray(pid.bytes) { i ->
            dataHex.substring(i * 2, i * 2 + 2).toIntOrNull(16) ?: return null
        }
    }

    /** Aplica la fórmula SAE del PID sobre una respuesta cruda; null si inválida. */
    fun parsePidValue(raw: String, pid: Pid): Double? =
        parsePidResponse(raw, pid)?.let(pid.parse)

    /** Decodifica un par de bytes a su código DTC, p. ej. (0x04, 0x01) → "P0401". */
    fun decodeDtcBytes(b1: Int, b2: Int): String {
        val letter = LETTERS[(b1 and 0xC0) shr 6]
        val d1 = (b1 and 0x30) shr 4
        val d2 = "%X".format(b1 and 0x0F)
        val d3 = "%X".format((b2 and 0xF0) shr 4)
        val d4 = "%X".format(b2 and 0x0F)
        return "$letter$d1$d2$d3$d4"
    }

    /**
     * Parsea la respuesta cruda del modo 03 a la lista de códigos DTC.
     *
     * Soporta las dos variantes que produce un ELM327:
     *  - CAN (ISO 15765): "43 02 01 04 C1 23" — el byte tras 0x43 es el
     *    número de códigos, seguido de pares de bytes.
     *  - Protocolos legacy: "43 01 04 00 00 00 00" — pares directamente,
     *    rellenados con 0x0000.
     *
     * Los pares 0x0000 se descartan (relleno). Devuelve lista vacía si no
     * hay códigos y null si la respuesta no es del modo 03.
     */
    fun parseDtcResponse(raw: String): List<String>? {
        val clean = sanitize(raw)
        if (clean.isEmpty() || "ERROR" in clean) return null
        if ("NODATA" in clean) return emptyList()

        val idx = clean.indexOf("43")
        if (idx == -1) return null

        val dataHex = clean.substring(idx + 2)
        val bytes = mutableListOf<Int>()
        var i = 0
        while (i + 1 < dataHex.length) {
            val b = dataHex.substring(i, i + 2).toIntOrNull(16) ?: break
            bytes.add(b)
            i += 2
        }

        // Si el número de bytes es impar, el primero es el contador CAN.
        val payload = if (bytes.size % 2 == 1) bytes.drop(1) else bytes

        val codes = mutableListOf<String>()
        var j = 0
        while (j + 1 < payload.size) {
            val b1 = payload[j]
            val b2 = payload[j + 1]
            if (b1 != 0 || b2 != 0) codes.add(decodeDtcBytes(b1, b2))
            j += 2
        }
        return codes
    }

    /** ¿La respuesta al modo 04 confirma el borrado? (eco "44" u "OK"). */
    fun isClearDtcOk(raw: String): Boolean {
        val clean = sanitize(raw)
        return "44" in clean || "OK" in clean
    }

    /**
     * Presión de turbo relativa (boost) en bar a partir de la presión
     * absoluta del colector (MAP, PID 0x0B) y la barométrica (PID 0x33):
     * boost = MAP − baro. Nunca negativa (en vacío no hay sobrepresión).
     */
    fun boostFromMap(mapKpa: Double, baroKpa: Double = 101.0): Double =
        maxOf(0.0, (mapKpa - baroKpa) / 100.0)

    /** Quita espacios, CR/LF y el prompt '>' y pasa a mayúsculas. */
    private fun sanitize(raw: String): String =
        raw.replace(Regex("[\\s\\r\\n>]"), "").uppercase()
}
