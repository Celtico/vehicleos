/**
 * MercedesProvider — lee las centralitas que el OBD-II genérico no expone.
 *
 * EL PROBLEMA QUE RESUELVE. El modo 03 del OBD-II estándar solo devuelve
 * códigos del grupo motopropulsor. En un Mercedes de la época del W209, los
 * de ABS, ESP y airbag viven en centralitas aparte, a las que se llega por
 * la línea K del conector hablando KWP2000 y direccionando cada módulo. Sin
 * esto, la pantalla de diagnóstico dice "sin averías" mientras el testigo
 * del ABS está encendido, que es la peor mentira que puede contar una
 * herramienta de diagnóstico.
 *
 * QUÉ ESTÁ VERIFICADO Y QUÉ NO. La mecánica del protocolo
 * (@vehicleos/vehicle-protocol/kwp2000) es norma pública ISO 14230 y está
 * cubierta por tests. Lo que NO puede estarlo es el mapa de direcciones de
 * las centralitas de un coche concreto ni el significado de cada código
 * propietario: eso es información del fabricante. Por eso este provider
 * NO trae direcciones inventadas: descubre qué módulos responden con
 * `escanearModulos()` y trabaja con lo que encuentre.
 *
 * DELEGACIÓN. Los datos de motor (velocidad, rpm, temperatura…) los sigue
 * dando el provider base, normalmente el AndroidBridgeProvider: aquí solo
 * se añade lo que aquel no puede ver. La regla de oro se mantiene intacta,
 * porque los comandos viajan al bridge, que es quien toca el hardware.
 */
import {
  aHex,
  desdeHex,
  ELM_INIT_KWP_RAPIDA,
  ELM327_INIT_SEQUENCE,
  comandoCabecera,
  esRespuestaPendiente,
  parsearDtc,
  parsearRespuesta,
  peticionBorrarDtc,
  peticionIdentificacion,
  peticionLeerDtc,
  peticionSesion,
  quitarCabecera,
  sinRespuesta,
  KWP_SERVICE,
  type KwpDtc,
} from "@vehicleos/vehicle-protocol";
import type {
  ConnectionState,
  DiagnosticTroubleCode,
  VehicleTelemetry,
} from "@vehicleos/shared";
import type { Unsubscribe, VehicleProvider } from "../provider";

/** Subsistema al que corresponde una centralita. */
export type ModuleKind = "abs" | "esp" | "airbag" | "confort" | "desconocido";

/** Una centralita direccionable del vehículo. */
export interface EcuModule {
  /** Dirección en el bus (destino de la cabecera KWP2000). */
  address: number;
  /** Nombre legible. */
  name: string;
  /** Subsistema que gobierna, para pintar el testigo correspondiente. */
  kind: ModuleKind;
  /**
   * Prefijo con el que se etiquetan sus códigos en la interfaz. Los códigos
   * propietarios no siguen la nomenclatura SAE, así que se muestran con su
   * valor real precedido del módulo, en vez de disfrazarlos de "C0035".
   */
  prefix: string;
}

/** Resultado del descubrimiento de centralitas. */
export interface ModuloDescubierto {
  address: number;
  /** Identificación cruda que devolvió, si la dio. */
  identificacion?: string;
  /** Nº de códigos que reportó en el momento del escaneo. */
  codigos: number;
}

export interface MercedesProviderOptions {
  /**
   * Provider que aporta los datos de motor y el canal con el adaptador.
   * Debe implementar `raw()` (lo hace AndroidBridgeProvider).
   */
  base: VehicleProvider & { raw(command: string, timeoutMs?: number): Promise<string> };
  /**
   * Centralitas a consultar. Vacío por defecto A PROPÓSITO: las direcciones
   * dependen del modelo y del año, y ponerlas a ojo daría lecturas falsas.
   * Usa `escanearModulos()` una vez sobre tu coche y fija aquí lo que
   * responda.
   */
  modules?: EcuModule[];
  /** Timeout por comando en ms. Las centralitas de chasis son lentas. */
  commandTimeoutMs?: number;
  /** Reintentos ante "respuesta pendiente" (NRC 0x78). */
  maxReintentos?: number;
}

/** Rango de direcciones que se prueba al escanear, si no se indica otro. */
const RANGO_ESCANEO_POR_DEFECTO = Array.from({ length: 0x60 }, (_, i) => 0x00 + i);

export class MercedesProvider implements VehicleProvider {
  readonly id = "mercedes";

  private readonly base: MercedesProviderOptions["base"];
  private readonly modules: EcuModule[];
  private readonly commandTimeoutMs: number;
  private readonly maxReintentos: number;

  /** Códigos leídos de las centralitas propietarias en la última consulta. */
  private extraDtc: DiagnosticTroubleCode[] = [];
  /** Módulos que fallaron, para poder avisar en vez de callar. */
  private modulosSinRespuesta: string[] = [];

  constructor(options: MercedesProviderOptions) {
    this.base = options.base;
    this.modules = options.modules ?? [];
    this.commandTimeoutMs = options.commandTimeoutMs ?? 5000;
    this.maxReintentos = options.maxReintentos ?? 3;
  }

  // ── Delegación pura al provider base ──────────────────────────

  async connect(): Promise<void> {
    await this.base.connect();
  }
  async disconnect(): Promise<void> {
    await this.base.disconnect();
  }
  state(): ConnectionState {
    return this.base.state();
  }
  speed(): Promise<number> {
    return this.base.speed();
  }
  rpm(): Promise<number> {
    return this.base.rpm();
  }
  battery(): Promise<number> {
    return this.base.battery();
  }
  coolant(): Promise<number> {
    return this.base.coolant();
  }
  turbo(): Promise<number> {
    return this.base.turbo();
  }
  fuel(): Promise<number> {
    return this.base.fuel();
  }

  /**
   * Telemetría del provider base, con los testigos corregidos según lo que
   * dicen las centralitas de chasis. Es la razón de ser de este provider:
   * sin él, `systems.abs` sería siempre "ok" aunque el testigo esté rojo.
   */
  live(listener: (t: VehicleTelemetry) => void): Unsubscribe {
    return this.base.live((t) => listener(this.aplicarEstadoModulos(t)));
  }

  // ── Diagnóstico ampliado ──────────────────────────────────────

  /**
   * Códigos del motor (OBD-II estándar) más los de las centralitas
   * configuradas. Si una centralita no contesta se anota, pero no se
   * interrumpe el resto: media lectura vale más que ninguna.
   */
  async dtc(): Promise<DiagnosticTroubleCode[]> {
    const estandar = await this.base.dtc();
    if (this.modules.length === 0) {
      this.extraDtc = [];
      return estandar;
    }

    const propietarios: DiagnosticTroubleCode[] = [];
    const fallos: string[] = [];

    await this.prepararKwp();
    for (const modulo of this.modules) {
      try {
        const codigos = await this.leerModulo(modulo);
        propietarios.push(...codigos);
      } catch {
        fallos.push(modulo.name);
      }
    }

    this.extraDtc = propietarios;
    this.modulosSinRespuesta = fallos;
    return [...estandar, ...propietarios];
  }

  /** Borra los códigos del motor y los de cada centralita configurada. */
  async clearDtc(): Promise<void> {
    await this.base.clearDtc();
    if (this.modules.length === 0) return;

    await this.prepararKwp();
    for (const modulo of this.modules) {
      try {
        await this.enviarKwp(modulo.address, peticionBorrarDtc());
      } catch {
        // Una centralita que no deja borrar no debe impedir borrar las demás.
      }
    }
    this.extraDtc = [];
  }

  /** Centralitas que no respondieron en la última lectura. */
  getModulosSinRespuesta(): string[] {
    return [...this.modulosSinRespuesta];
  }

  /**
   * Recorre un rango de direcciones y devuelve las que contestan.
   *
   * Es la alternativa honesta a traer una tabla de direcciones inventada:
   * se ejecuta una vez sobre el coche real, con el contacto dado y el motor
   * parado, y lo que responda se fija en `options.modules`.
   */
  async escanearModulos(
    rango: number[] = RANGO_ESCANEO_POR_DEFECTO,
  ): Promise<ModuloDescubierto[]> {
    await this.prepararKwp();
    const encontrados: ModuloDescubierto[] = [];

    for (const address of rango) {
      try {
        const ident = await this.enviarKwp(
          address,
          peticionIdentificacion(),
          KWP_SERVICE.READ_ECU_IDENTIFICATION,
        );
        let codigos = 0;
        try {
          const datos = await this.enviarKwp(address, peticionLeerDtc());
          codigos = parsearDtc(datos).length;
        } catch {
          // Responde a la identificación pero no a los códigos: igual cuenta.
        }
        encontrados.push({ address, identificacion: aHex(ident), codigos });
      } catch {
        // Silencio en esa dirección: no hay centralita o no habla KWP2000.
      }
    }
    return encontrados;
  }

  // ── Internos ──────────────────────────────────────────────────

  /** Deja el adaptador en ISO 14230-4 con inicialización rápida. */
  private async prepararKwp(): Promise<void> {
    for (const comando of ELM_INIT_KWP_RAPIDA) {
      await this.base.raw(comando, this.commandTimeoutMs);
    }
  }

  /** Devuelve el adaptador al OBD-II estándar del provider base. */
  private async restaurarObd(): Promise<void> {
    for (const comando of ELM327_INIT_SEQUENCE) {
      await this.base.raw(comando, this.commandTimeoutMs);
    }
  }

  /**
   * Envía una petición KWP2000 a una centralita y devuelve los datos de su
   * respuesta positiva. Reintenta mientras conteste "respuesta pendiente".
   */
  private async enviarKwp(
    address: number,
    peticion: number[],
    servicio = peticion[0] ?? 0,
  ): Promise<number[]> {
    await this.base.raw(comandoCabecera(address), this.commandTimeoutMs);

    for (let intento = 0; intento <= this.maxReintentos; intento++) {
      const cruda = await this.base.raw(aHex(peticion), this.commandTimeoutMs);
      if (sinRespuesta(cruda)) {
        throw new Error(`Sin respuesta de la centralita 0x${address.toString(16)}`);
      }

      const bytes = quitarCabecera(desdeHex(cruda));
      if (esRespuestaPendiente(bytes)) continue; // la centralita pide tiempo
      return parsearRespuesta(bytes, servicio);
    }
    throw new Error(
      `La centralita 0x${address.toString(16)} sigue ocupada tras ${this.maxReintentos} intentos`,
    );
  }

  /** Lee y traduce los códigos de una centralita. */
  private async leerModulo(modulo: EcuModule): Promise<DiagnosticTroubleCode[]> {
    // Algunas centralitas exigen abrir sesión antes de dar códigos; si no
    // lo necesitan, responden con un rechazo que no debe abortar la lectura.
    await this.enviarKwp(modulo.address, peticionSesion()).catch(() => undefined);

    const datos = await this.enviarKwp(modulo.address, peticionLeerDtc());
    return parsearDtc(datos).map((d) => this.aDtcDeDominio(modulo, d));
  }

  /**
   * Convierte un código propietario al tipo del dominio.
   *
   * Se etiqueta como `PREFIJO-XXXX` y NO se disfraza de código SAE: un
   * "C1234" inventado a partir de un código propietario llevaría al
   * mecánico a buscar una avería que no es la suya.
   */
  private aDtcDeDominio(modulo: EcuModule, d: KwpDtc): DiagnosticTroubleCode {
    return {
      code: `${modulo.prefix}-${d.raw}`,
      status: d.activo ? "stored" : "pending",
      description: `Código propietario de ${modulo.name} (0x${d.raw}, estado 0x${d.estado
        .toString(16)
        .padStart(2, "0")})`,
    };
  }

  /**
   * Marca en la telemetría los subsistemas con averías propietarias
   * activas. Sin esto, los testigos de ABS y ESP no se encenderían nunca en
   * un coche real, por muchos códigos que tuviera la centralita.
   */
  private aplicarEstadoModulos(t: VehicleTelemetry): VehicleTelemetry {
    if (this.extraDtc.length === 0 && this.modulosSinRespuesta.length === 0) return t;

    const systems = { ...t.systems };
    for (const modulo of this.modules) {
      const suyos = this.extraDtc.filter((d) => d.code.startsWith(`${modulo.prefix}-`));
      if (suyos.length === 0) continue;
      const gravedad = suyos.some((d) => d.status === "stored") ? "error" : "warning";
      if (modulo.kind === "abs") systems.abs = gravedad;
      else if (modulo.kind === "esp") systems.esp = gravedad;
      else if (modulo.kind === "airbag") systems.airbag = gravedad;
    }

    // Una centralita muda no es una centralita sana: se marca "unknown" en
    // lugar de "ok" para no dar por buena una lectura que no se ha hecho.
    for (const nombre of this.modulosSinRespuesta) {
      const modulo = this.modules.find((m) => m.name === nombre);
      if (!modulo) continue;
      if (modulo.kind === "abs" && systems.abs === "ok") systems.abs = "unknown";
      else if (modulo.kind === "esp" && systems.esp === "ok") systems.esp = "unknown";
      else if (modulo.kind === "airbag" && systems.airbag === "ok") systems.airbag = "unknown";
    }

    return { ...t, systems };
  }

  /** Deja el adaptador como estaba, por si el provider base sigue en uso. */
  async finalizarDiagnostico(): Promise<void> {
    await this.restaurarObd();
  }
}
