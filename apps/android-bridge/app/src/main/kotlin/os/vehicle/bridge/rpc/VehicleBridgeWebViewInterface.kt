package os.vehicle.bridge.rpc

import android.webkit.JavascriptInterface
import kotlinx.coroutines.launch
import os.vehicle.bridge.BridgeCore

/**
 * Puente para el caso de empaquetar la PWA dentro de una WebView.
 *
 * La app anfitriona (un launcher de coche, por ejemplo) inyecta esta
 * clase en su WebView y la PWA la ve como `window.VehicleBridge`
 * (interfaz VehicleBridgeWebView del contrato TS):
 *
 * ```kotlin
 * val core = ... // BridgeCore del servicio
 * val iface = VehicleBridgeWebViewInterface(core) { json ->
 *     webView.post {
 *         // Entrega de respuestas y eventos al callback global de la PWA.
 *         webView.evaluateJavascript(
 *             "window.VehicleBridgeOnMessage(" + JSONObject.quote(json) + ")",
 *             null,
 *         )
 *     }
 * }
 * webView.addJavascriptInterface(iface, "VehicleBridge")
 * ```
 *
 * La PWA llama `window.VehicleBridge.postMessage(JSON.stringify(request))`
 * y recibe BridgeResponse/BridgeEvent por `window.VehicleBridgeOnMessage`.
 * Se reutiliza EXACTAMENTE el mismo despachador JSON-RPC que el
 * WebSocket: misma semántica por ambas vías.
 */
class VehicleBridgeWebViewInterface(
    private val core: BridgeCore,
    private val deliver: (String) -> Unit,
) {
    /** Un id de sink estable por instancia de WebView. */
    private val sinkId = "webview-" + System.identityHashCode(this)

    init {
        // La WebView también recibe los eventos push (telemetry, connection…).
        core.registerSink(sinkId, deliver)
    }

    /**
     * Punto de entrada desde JavaScript: recibe una BridgeRequest
     * serializada; la BridgeResponse llega por el callback [deliver].
     */
    @JavascriptInterface
    fun postMessage(requestJson: String) {
        core.scope.launch {
            deliver(core.dispatcher.dispatch(sinkId, requestJson))
        }
    }

    /** Llamar cuando la WebView se destruye (retira sink y suscripción). */
    fun dispose() {
        core.unregisterSink(sinkId)
    }
}
