/**
 * Perfil del vehículo.
 *
 * Describe las características físicas del coche concreto para que la
 * instrumentación y el simulador no usen valores genéricos: un diésel de
 * 4.750 rpm no puede mostrarse en un cuentarrevoluciones de 7.000, ni un
 * depósito de 62 litros calcularse como si fuera de 50.
 */

export type FuelType = "diesel" | "gasolina" | "híbrido" | "eléctrico";

export interface VehicleProfile {
  /** Identificador estable del perfil. */
  id: string;
  /** Nombre comercial completo. */
  name: string;
  /** Designación de plataforma/carrocería, p. ej. "W209". */
  chassis?: string;
  /** Código interno del motor, p. ej. "OM612". */
  engineCode?: string;
  fuel: FuelType;
  /** Cilindrada en centímetros cúbicos. */
  displacementCc?: number;
  cylinders?: number;
  /** Potencia máxima en CV. */
  powerHp?: number;
  /** Par máximo en Nm. */
  torqueNm?: number;
  /** Régimen máximo del cuentarrevoluciones (fondo de escala). */
  maxRpm: number;
  /** Régimen a partir del cual empieza la zona roja. */
  redlineRpm: number;
  /** Ralentí nominal en rpm. */
  idleRpm: number;
  /** Fondo de escala del velocímetro en km/h. */
  maxSpeed: number;
  /** Capacidad del depósito en litros. */
  tankLiters: number;
  /** Consumo homologado aproximado en L/100km (para comparar). */
  referenceConsumption?: number;
  /** ¿Lleva turbo? Determina si el indicador de sobrealimentación aplica. */
  turbo: boolean;
  /** Presión máxima de sobrealimentación esperada en bar. */
  maxBoostBar?: number;
  /** Relaciones de cambio expresadas en rpm por km/h en cada marcha. */
  gearRatios?: number[];
  /**
   * Sistemas cuyos códigos de avería NO expone el OBD-II estándar en este
   * coche y que requieren protocolo del fabricante. Sirve para que la UI
   * pueda avisar en vez de mostrar "sin averías" engañosamente.
   */
  requiresOemProtocolFor?: ("abs" | "esp" | "airbag" | "confort")[];
}

/**
 * Mercedes-Benz CLK 270 CDI (W209), 2002-2005.
 *
 * Motor OM612 de 5 cilindros en línea, 2.685 cc, 170 CV a 4.200 rpm y
 * 400 Nm entre 1.600 y 2.600 rpm.
 *
 * Nota importante sobre diagnóstico: el OBD-II genérico de este coche solo
 * expone los códigos del grupo motopropulsor (P). Los de ABS, ESP y airbag
 * viven en centralitas a las que se accede con el protocolo propietario de
 * Mercedes, no con un ELM327 corriente. Ver `requiresOemProtocolFor`.
 */
export const CLK_270_CDI: VehicleProfile = {
  id: "clk-270-cdi-w209",
  name: "Mercedes-Benz CLK 270 CDI",
  chassis: "W209",
  engineCode: "OM612",
  fuel: "diesel",
  displacementCc: 2685,
  cylinders: 5,
  powerHp: 170,
  torqueNm: 400,
  maxRpm: 5000,
  redlineRpm: 4300,
  idleRpm: 720,
  maxSpeed: 240,
  tankLiters: 62,
  referenceConsumption: 7.0,
  turbo: true,
  maxBoostBar: 1.3,
  // Cambio de 6 marchas: rpm por cada km/h en cada relación.
  gearRatios: [78, 44, 30, 22, 17.5, 14.5],
  requiresOemProtocolFor: ["abs", "esp", "airbag", "confort"],
};

/** Perfil genérico de referencia (gasolina) para vehículos sin perfil propio. */
export const GENERIC_PETROL: VehicleProfile = {
  id: "generic-petrol",
  name: "Vehículo genérico (gasolina)",
  fuel: "gasolina",
  maxRpm: 7000,
  redlineRpm: 6000,
  idleRpm: 800,
  maxSpeed: 240,
  tankLiters: 55,
  turbo: false,
  gearRatios: [95, 55, 38, 28, 22, 18],
};

export const VEHICLE_PROFILES: Record<string, VehicleProfile> = {
  [CLK_270_CDI.id]: CLK_270_CDI,
  [GENERIC_PETROL.id]: GENERIC_PETROL,
};

/** Perfil activo por defecto de esta instalación de VehicleOS. */
export const DEFAULT_PROFILE = CLK_270_CDI;
