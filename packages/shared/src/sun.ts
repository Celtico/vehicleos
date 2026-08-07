/**
 * Amanecer y anochecer a partir de la posición y la fecha.
 *
 * Sirve para que el cockpit sepa si es de día o de noche y ajuste el brillo
 * solo: de día hace falta el máximo contraste porque da el sol en la
 * pantalla; de noche, lo contrario, o deslumbra al conducir.
 *
 * Se calcula, no se consulta: el algoritmo es el de la NOAA y solo necesita
 * latitud, longitud y fecha, todo lo cual ya está en la telemetría. Ni
 * servicios externos, ni claves de API, ni depender de tener cobertura.
 *
 * La precisión es de aproximadamente un minuto, de sobra para decidir si se
 * atenúa una pantalla.
 */
import type { GeoPoint } from "./vehicle";

const GRADOS = Math.PI / 180;

/** Ángulo del sol bajo el horizonte que define el orto y el ocaso. */
const CENIT_OFICIAL = 90.833; // incluye refracción atmosférica y radio solar

/** Momentos del día calculados para una posición y fecha. */
export interface SolarTimes {
  /** Salida del sol, en milisegundos Unix. `null` si no sale ese día. */
  sunrise: number | null;
  /** Puesta del sol, en milisegundos Unix. `null` si no se pone ese día. */
  sunset: number | null;
  /**
   * `true` cuando el sol no llega a salir o no llega a ponerse: pasa en
   * latitudes altas, y hay que contemplarlo o el cálculo daría NaN.
   */
  polar: boolean;
}

/** Día juliano de una fecha. */
function diaJuliano(fecha: Date): number {
  return fecha.getTime() / 86_400_000 + 2440587.5;
}

/**
 * Calcula orto y ocaso para una posición y un instante.
 *
 * Implementa el algoritmo solar de la NOAA: anomalía media, ecuación del
 * centro, longitud eclíptica, declinación y ángulo horario.
 */
export function solarTimes(pos: GeoPoint, cuando: Date = new Date()): SolarTimes {
  const jd = diaJuliano(cuando);
  // Días desde J2000, ajustados al meridiano local.
  const n = Math.round(jd - 2451545.0 + 0.0008 - -pos.lon / 360);

  const mediodiaSolar = 2451545.0 + 0.0009 + -pos.lon / 360 + n;

  // Anomalía media del Sol.
  const M = (357.5291 + 0.98560028 * (mediodiaSolar - 2451545)) % 360;
  const Mrad = M * GRADOS;

  // Ecuación del centro y longitud eclíptica verdadera.
  const C = 1.9148 * Math.sin(Mrad) + 0.02 * Math.sin(2 * Mrad) + 0.0003 * Math.sin(3 * Mrad);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const lambdaRad = lambda * GRADOS;

  // Tránsito solar (mediodía verdadero).
  const jTransit = mediodiaSolar + 0.0053 * Math.sin(Mrad) - 0.0069 * Math.sin(2 * lambdaRad);

  // Declinación del Sol.
  const senoDec = Math.sin(lambdaRad) * Math.sin(23.4397 * GRADOS);
  const cosDec = Math.cos(Math.asin(senoDec));

  // Ángulo horario del orto/ocaso.
  const latRad = pos.lat * GRADOS;
  const cosOmega =
    (Math.cos(CENIT_OFICIAL * GRADOS) - senoDec * Math.sin(latRad)) /
    (Math.cos(latRad) * cosDec);

  // |cos| > 1 significa sol de medianoche o noche polar.
  if (cosOmega > 1) return { sunrise: null, sunset: null, polar: true };
  if (cosOmega < -1) return { sunrise: null, sunset: null, polar: true };

  const omega = Math.acos(cosOmega) / GRADOS;
  const jSet = jTransit + omega / 360;
  const jRise = jTransit - omega / 360;

  const aMs = (j: number) => (j - 2440587.5) * 86_400_000;
  return { sunrise: aMs(jRise), sunset: aMs(jSet), polar: false };
}

/** Si es de día o de noche en ese punto y momento. */
export type Daylight = "day" | "night";

/**
 * Decide día o noche.
 *
 * Sin posición no se puede calcular nada, así que se recurre a la hora
 * local con un umbral razonable: no es exacto, pero es mejor que dejar la
 * pantalla a pleno brillo de madrugada.
 */
export function daylightAt(pos: GeoPoint | undefined, cuando: Date = new Date()): Daylight {
  if (!pos) {
    const h = cuando.getHours();
    return h >= 8 && h < 20 ? "day" : "night";
  }

  const { sunrise, sunset, polar } = solarTimes(pos, cuando);
  if (polar || sunrise === null || sunset === null) {
    // Verano o invierno polar: se decide por la altura del sol implícita en
    // la latitud y la estación, aproximada por el mes.
    const mesVerano = cuando.getMonth() >= 3 && cuando.getMonth() <= 8;
    const norte = pos.lat >= 0;
    return mesVerano === norte ? "day" : "night";
  }

  const t = cuando.getTime();
  return t >= sunrise && t < sunset ? "day" : "night";
}

/** Minutos de crepúsculo durante los que se atenúa progresivamente. */
const CREPUSCULO_MIN = 25;

/**
 * Factor de luz diurna entre 0 (noche cerrada) y 1 (pleno día).
 *
 * Existe para que el cambio no sea un salto: conduciendo al atardecer, que
 * la pantalla pase de golpe de brillo máximo a mínimo distrae más que
 * ayudar. Con esto se atenúa a lo largo del crepúsculo.
 *
 * Nótese que NO depende de ningún sensor de luz, y eso es deliberado: un
 * sensor cambiaría de modo cada vez que el coche pasa bajo un puente o
 * entra en un túnel. El orto y el ocaso solo ocurren dos veces al día.
 */
export function daylightFactor(pos: GeoPoint | undefined, cuando: Date = new Date()): number {
  if (!pos) return daylightAt(pos, cuando) === "day" ? 1 : 0;

  const { sunrise, sunset, polar } = solarTimes(pos, cuando);
  if (polar || sunrise === null || sunset === null) {
    return daylightAt(pos, cuando) === "day" ? 1 : 0;
  }

  const t = cuando.getTime();
  const ventana = CREPUSCULO_MIN * 60_000;

  // Amanecer: sube de 0 a 1 a lo largo de la ventana.
  if (t < sunrise - ventana) return 0;
  if (t < sunrise + ventana) return (t - (sunrise - ventana)) / (2 * ventana);
  // Pleno día.
  if (t < sunset - ventana) return 1;
  // Anochecer: baja de 1 a 0.
  if (t < sunset + ventana) return 1 - (t - (sunset - ventana)) / (2 * ventana);
  return 0;
}
