package os.vehicle.bridge.telemetry

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Looper
import androidx.core.content.ContextCompat

/**
 * Última posición GPS conocida para el campo `location` de la telemetría.
 *
 * Usa LocationManager (sin dependencia de Google Play Services, que en un
 * dispositivo "de coche" con AOSP puede no existir). Si no hay permiso
 * ACCESS_FINE_LOCATION, la telemetría simplemente omite `location`
 * (opcional en el contrato).
 *
 * Batería: solo pedimos updates mientras el TelemetryLoop está activo.
 */
class LocationTracker(private val context: Context) {

    @Volatile
    private var latest: Location? = null

    private var manager: LocationManager? = null

    private val listener = LocationListener { location -> latest = location }

    private fun hasPermission(): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED

    /** Empieza a recibir posiciones (GPS con red como respaldo). */
    @SuppressLint("MissingPermission")
    fun start() {
        if (!hasPermission()) return
        val lm = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return
        manager = lm
        for (provider in listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)) {
            if (runCatching { lm.isProviderEnabled(provider) }.getOrDefault(false)) {
                lm.requestLocationUpdates(provider, MIN_TIME_MS, MIN_DISTANCE_M, listener, Looper.getMainLooper())
            }
        }
        // Semilla inmediata con la última posición conocida del sistema.
        latest = latest ?: runCatching {
            lm.getLastKnownLocation(LocationManager.GPS_PROVIDER)
                ?: lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
        }.getOrNull()
    }

    /** Deja de recibir posiciones (ahorro de batería sin suscriptores). */
    fun stop() {
        manager?.removeUpdates(listener)
        manager = null
    }

    /**
     * Última posición como GeoPoint del contrato, o null si no hay fix.
     * Se descartan fixes de más de 60 s (el coche se mueve).
     */
    fun currentGeoPoint(): GeoPoint? {
        val loc = latest ?: return null
        val ageMs = System.currentTimeMillis() - loc.time
        if (ageMs > MAX_FIX_AGE_MS) return null
        return GeoPoint(
            lat = loc.latitude,
            lon = loc.longitude,
            heading = if (loc.hasBearing()) loc.bearing.toDouble() else null,
        )
    }

    /** Posición GPS (subset del GeoPoint del contrato TS). */
    data class GeoPoint(val lat: Double, val lon: Double, val heading: Double?)

    private companion object {
        const val MIN_TIME_MS = 1000L
        const val MIN_DISTANCE_M = 0f
        const val MAX_FIX_AGE_MS = 60_000L
    }
}
