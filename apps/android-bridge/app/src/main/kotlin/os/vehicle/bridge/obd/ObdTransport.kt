package os.vehicle.bridge.obd

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream

/**
 * Transporte físico hacia un adaptador ELM327.
 *
 * El contrato es de nivel comando: `sendCommand` envía una línea (sin el
 * retorno de carro, que añade el transporte) y devuelve TODO lo recibido
 * hasta el prompt '>' del ELM327 (sin incluirlo).
 *
 * Los timeouts los impone la capa superior (Elm327Client) con
 * `withTimeout`, por lo que las implementaciones deben leer de forma
 * cancelable (polling con `delay`, canales…), nunca con bloqueos
 * indefinidos no interrumpibles.
 */
interface ObdTransport {
    /** Nombre corto para logs y para el resultado de `status`. */
    val name: String

    /** Abre la conexión física. Lanza IOException/BridgeException si falla. */
    suspend fun open()

    /** Cierra la conexión y libera recursos. Idempotente. */
    suspend fun close()

    /** Envía un comando y devuelve la respuesta cruda hasta el prompt '>'. */
    suspend fun sendCommand(cmd: String): String
}

/**
 * Base común para transportes basados en streams (Bluetooth clásico y
 * WiFi/TCP): escribe `cmd + '\r'` y lee hasta '>' con polling cancelable.
 */
abstract class StreamObdTransport : ObdTransport {

    protected abstract fun inputOrNull(): InputStream?
    protected abstract fun outputOrNull(): OutputStream?

    override suspend fun sendCommand(cmd: String): String = withContext(Dispatchers.IO) {
        val output = outputOrNull() ?: throw IOException("$name: transporte no abierto")
        val input = inputOrNull() ?: throw IOException("$name: transporte no abierto")

        output.write((cmd + "\r").toByteArray(Charsets.US_ASCII))
        output.flush()

        val sb = StringBuilder()
        while (true) {
            if (input.available() > 0) {
                val c = input.read()
                if (c == -1) throw IOException("$name: conexión cerrada por el adaptador")
                val ch = c.toChar()
                if (ch == '>') break
                sb.append(ch)
            } else {
                // Polling corto: mantiene la lectura cancelable por withTimeout.
                delay(POLL_MS)
            }
        }
        sb.toString()
    }

    private companion object {
        const val POLL_MS = 10L
    }
}
