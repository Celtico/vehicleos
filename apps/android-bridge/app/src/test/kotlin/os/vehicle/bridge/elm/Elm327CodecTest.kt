package os.vehicle.bridge.elm

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Tests JVM puros (sin Android) de la decodificación ELM327:
 * comandos, fórmulas SAE J1979 y códigos DTC (SAE J2012).
 *
 * Los valores esperados son los mismos que verifican los tests del
 * paquete TypeScript packages/vehicle-protocol.
 */
class Elm327CodecTest {

    private val delta = 1e-9

    // --------------------------------------------------------------
    // Construcción de comandos
    // --------------------------------------------------------------

    @Test
    fun `buildPidCommand genera modo y pid en hex`() {
        assertEquals("010C", Elm327Codec.buildPidCommand(Pid.RPM))
        assertEquals("010D", Elm327Codec.buildPidCommand(Pid.SPEED))
        assertEquals("0105", Elm327Codec.buildPidCommand(Pid.COOLANT_TEMP))
        assertEquals("0142", Elm327Codec.buildPidCommand(Pid.CONTROL_MODULE_VOLTAGE))
        assertEquals("015E", Elm327Codec.buildPidCommand(Pid.FUEL_RATE))
    }

    @Test
    fun `la secuencia de init es la canonica del ELM327`() {
        assertEquals(
            listOf("ATZ", "ATE0", "ATL0", "ATS0", "ATH0", "ATSP0"),
            Elm327Codec.INIT_SEQUENCE,
        )
    }

    // --------------------------------------------------------------
    // Parseo de respuestas de PID
    // --------------------------------------------------------------

    @Test
    fun `parsePidResponse extrae los bytes con espacios y prompt`() {
        val bytes = Elm327Codec.parsePidResponse("41 0C 1A F8 \r\n>", Pid.RPM)
        assertNotNull(bytes)
        assertEquals(listOf(0x1A, 0xF8), bytes!!.toList())
    }

    @Test
    fun `rpm aplica la formula (Ax256+B) div 4`() {
        // 0x1AF8 = 6904; 6904 / 4 = 1726 rpm
        assertEquals(1726.0, Elm327Codec.parsePidValue("410C1AF8", Pid.RPM)!!, delta)
    }

    @Test
    fun `velocidad es el byte A directo`() {
        assertEquals(96.0, Elm327Codec.parsePidValue("410D60", Pid.SPEED)!!, delta)
        assertEquals(0.0, Elm327Codec.parsePidValue("410D00", Pid.SPEED)!!, delta)
    }

    @Test
    fun `refrigerante aplica A menos 40`() {
        // 0x7B = 123 → 83 °C
        assertEquals(83.0, Elm327Codec.parsePidValue("41057B", Pid.COOLANT_TEMP)!!, delta)
    }

    @Test
    fun `tension aplica (Ax256+B) div 1000`() {
        // 0x3854 = 14420 → 14.42 V
        assertEquals(14.42, Elm327Codec.parsePidValue("41423854", Pid.CONTROL_MODULE_VOLTAGE)!!, delta)
    }

    @Test
    fun `nivel de combustible aplica Ax100 div 255`() {
        // 0xFF → 100 %; 0x80 → ~50.2 %
        assertEquals(100.0, Elm327Codec.parsePidValue("412FFF", Pid.FUEL_LEVEL)!!, delta)
        assertEquals(128 * 100.0 / 255.0, Elm327Codec.parsePidValue("412F80", Pid.FUEL_LEVEL)!!, delta)
    }

    @Test
    fun `carga y acelerador aplican Ax100 div 255`() {
        assertEquals(51 * 100.0 / 255.0, Elm327Codec.parsePidValue("410433", Pid.ENGINE_LOAD)!!, delta)
        assertEquals(51 * 100.0 / 255.0, Elm327Codec.parsePidValue("411133", Pid.THROTTLE)!!, delta)
    }

    @Test
    fun `consumo aplica (Ax256+B) div 20`() {
        // 0x00C8 = 200 → 10 L/h
        assertEquals(10.0, Elm327Codec.parsePidValue("415E00C8", Pid.FUEL_RATE)!!, delta)
    }

    @Test
    fun `NO DATA y ERROR devuelven null`() {
        assertNull(Elm327Codec.parsePidResponse("NO DATA\r\n>", Pid.RPM))
        assertNull(Elm327Codec.parsePidResponse("BUS ERROR", Pid.RPM))
        assertNull(Elm327Codec.parsePidResponse("", Pid.RPM))
    }

    @Test
    fun `respuesta de otro pid devuelve null`() {
        // Respuesta del PID 0x0D cuando pedimos RPM (0x0C).
        assertNull(Elm327Codec.parsePidResponse("410D60", Pid.RPM))
    }

    @Test
    fun `respuesta truncada devuelve null`() {
        // RPM necesita 2 bytes de datos; solo llega uno.
        assertNull(Elm327Codec.parsePidResponse("410C1A", Pid.RPM))
    }

    // --------------------------------------------------------------
    // Boost (MAP − barométrica)
    // --------------------------------------------------------------

    @Test
    fun `boost es MAP menos barometrica en bar y nunca negativo`() {
        assertEquals(0.5, Elm327Codec.boostFromMap(151.0, 101.0), delta)
        assertEquals(0.0, Elm327Codec.boostFromMap(35.0, 101.0), delta) // vacío en ralentí
        assertEquals(0.99, Elm327Codec.boostFromMap(200.0), delta) // baro por defecto 101
    }

    // --------------------------------------------------------------
    // DTC (modo 03 / 04)
    // --------------------------------------------------------------

    @Test
    fun `decodeDtcBytes cubre las cuatro letras`() {
        assertEquals("P0401", Elm327Codec.decodeDtcBytes(0x04, 0x01))
        assertEquals("C1234", Elm327Codec.decodeDtcBytes(0x52, 0x34))
        assertEquals("B0003", Elm327Codec.decodeDtcBytes(0x80, 0x03))
        assertEquals("U0100", Elm327Codec.decodeDtcBytes(0xC1, 0x00))
        // Dígitos hex altos: 0x2A 0xBC → P2ABC
        assertEquals("P2ABC", Elm327Codec.decodeDtcBytes(0x2A, 0xBC))
    }

    @Test
    fun `modo 03 legacy con relleno de ceros`() {
        // Sin byte contador (protocolos K-line): pares directos + relleno.
        val codes = Elm327Codec.parseDtcResponse("43 01 04 00 00 00 00 \r\n>")
        assertEquals(listOf("P0104"), codes)
    }

    @Test
    fun `modo 03 CAN con byte contador`() {
        // ISO 15765: "43" + contador (02) + dos códigos.
        val codes = Elm327Codec.parseDtcResponse("43 02 01 04 51 23")
        assertEquals(listOf("P0104", "C1123"), codes)
    }

    @Test
    fun `modo 03 sin codigos devuelve lista vacia`() {
        assertEquals(emptyList<String>(), Elm327Codec.parseDtcResponse("43 00 00 00 00 00 00"))
        assertEquals(emptyList<String>(), Elm327Codec.parseDtcResponse("NO DATA"))
    }

    @Test
    fun `modo 03 con respuesta invalida devuelve null`() {
        assertNull(Elm327Codec.parseDtcResponse("CAN ERROR"))
        assertNull(Elm327Codec.parseDtcResponse("?"))
    }

    @Test
    fun `modo 04 confirma con 44 u OK`() {
        assertTrue(Elm327Codec.isClearDtcOk("44 \r\n>"))
        assertTrue(Elm327Codec.isClearDtcOk("OK"))
        assertFalse(Elm327Codec.isClearDtcOk("NO DATA"))
    }

    // --------------------------------------------------------------
    // Claves de PID del contrato TS
    // --------------------------------------------------------------

    @Test
    fun `las claves del contrato TS resuelven a su PID`() {
        assertEquals(Pid.SPEED, Pid.fromKey("SPEED"))
        assertEquals(Pid.RPM, Pid.fromKey("RPM"))
        assertEquals(Pid.COOLANT_TEMP, Pid.fromKey("COOLANT_TEMP"))
        assertEquals(Pid.CONTROL_MODULE_VOLTAGE, Pid.fromKey("CONTROL_MODULE_VOLTAGE"))
        assertEquals(Pid.FUEL_LEVEL, Pid.fromKey("FUEL_LEVEL"))
        assertNull(Pid.fromKey("NO_EXISTE"))
    }
}
