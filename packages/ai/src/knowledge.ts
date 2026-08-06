/**
 * Base de conocimiento local de códigos de avería (DTC).
 *
 * Permite explicar las averías más comunes sin backend: causa probable
 * con probabilidad estimada, causas ordenadas de más a menos probable,
 * soluciones posibles y cuánto se puede circular en ese estado.
 */

/** Severidad de la avería. */
export type DtcSeverity = "low" | "medium" | "high" | "critical";

/** Entrada de la base de conocimiento de un DTC. */
export interface DtcKnowledgeEntry {
  /** Código normalizado, p. ej. "P0401". */
  code: string;
  /** Título corto legible. */
  title: string;
  /** Sistema afectado (EGR, encendido, refrigeración…). */
  system: string;
  /** Causa más probable en lenguaje llano. */
  probableCause: string;
  /** Probabilidad estimada de la causa probable (0-100). */
  probability: number;
  /** Causas ordenadas de más a menos probable. */
  causes: string[];
  /** Soluciones posibles, de la más barata/simple a la más cara. */
  solutions: string[];
  /** Severidad de la avería. */
  severity: DtcSeverity;
  /** Cuánto se puede circular así (texto orientativo). */
  canDrive: string;
}

export const DTC_KNOWLEDGE: Record<string, DtcKnowledgeEntry> = {
  P0300: {
    code: "P0300",
    title: "Fallos de encendido aleatorios en varios cilindros",
    system: "Encendido",
    probableCause: "Bujías o bobinas de encendido desgastadas",
    probability: 65,
    causes: [
      "Bujías desgastadas o con la separación incorrecta",
      "Bobinas de encendido deterioradas",
      "Inyectores sucios o con caudal irregular",
      "Mezcla pobre por fuga de vacío",
      "Baja compresión en algún cilindro",
    ],
    solutions: [
      "Sustituir las bujías",
      "Comprobar y sustituir bobinas defectuosas",
      "Limpiar los inyectores",
      "Buscar fugas de vacío y repararlas",
    ],
    severity: "high",
    canDrive:
      "Evita conducir más de lo imprescindible: los fallos de encendido pueden dañar el catalizador. Acude al taller en pocos días y no exijas al motor.",
  },
  P0171: {
    code: "P0171",
    title: "Mezcla demasiado pobre (banco 1)",
    system: "Alimentación / admisión",
    probableCause: "Fuga de vacío en la admisión o caudalímetro sucio",
    probability: 70,
    causes: [
      "Fuga de vacío en manguitos o junta de admisión",
      "Caudalímetro (MAF) sucio o defectuoso",
      "Presión de combustible baja (bomba o filtro)",
      "Inyectores obstruidos",
      "Sonda lambda envejecida",
    ],
    solutions: [
      "Limpiar el caudalímetro con limpiador específico",
      "Revisar manguitos y juntas de admisión",
      "Sustituir el filtro de combustible",
      "Comprobar la presión de la bomba de combustible",
    ],
    severity: "medium",
    canDrive:
      "Puedes circular unos días con prudencia, pero el consumo subirá y a la larga puede dañar el catalizador. Revísalo en 1-2 semanas.",
  },
  P0401: {
    code: "P0401",
    title: "Flujo insuficiente de recirculación de gases (EGR)",
    system: "EGR",
    probableCause: "Problema probable en EGR: válvula obstruida por carbonilla",
    probability: 80,
    causes: [
      "Válvula EGR obstruida por carbonilla",
      "Conductos EGR parcialmente taponados",
      "Sensor DPFE / de posición de EGR defectuoso",
      "Electroválvula de vacío de la EGR sin señal",
    ],
    solutions: [
      "Limpiar la válvula EGR y sus conductos",
      "Sustituir la válvula EGR si no responde",
      "Comprobar el sensor de posición / DPFE",
      "Hacer trayectos largos ocasionales para reducir la carbonilla",
    ],
    severity: "medium",
    canDrive:
      "Se puede circular varias semanas: el motor puede dar tirones y contaminar más, pero no hay riesgo inmediato. Planifica la limpieza de la EGR pronto.",
  },
  P0420: {
    code: "P0420",
    title: "Eficiencia del catalizador por debajo del umbral",
    system: "Escape",
    probableCause: "Catalizador envejecido con eficiencia degradada",
    probability: 60,
    causes: [
      "Catalizador desgastado o contaminado",
      "Sonda lambda posterior deteriorada",
      "Fugas en el escape antes del catalizador",
      "Fallos de encendido previos que dañaron el catalizador",
    ],
    solutions: [
      "Verificar las sondas lambda antes de tocar el catalizador",
      "Reparar fugas de escape",
      "Sustituir el catalizador si está agotado",
    ],
    severity: "low",
    canDrive:
      "Puedes circular con normalidad semanas o meses; contaminarás más y no pasarás la inspección de emisiones. No es urgente pero conviene revisarlo.",
  },
  P0128: {
    code: "P0128",
    title: "Temperatura de refrigerante por debajo de regulación",
    system: "Refrigeración",
    probableCause: "Termostato abierto o que abre antes de tiempo",
    probability: 85,
    causes: [
      "Termostato atascado en posición abierta",
      "Sensor de temperatura de refrigerante impreciso",
      "Nivel de refrigerante bajo",
    ],
    solutions: [
      "Sustituir el termostato",
      "Comprobar el nivel de refrigerante",
      "Verificar el sensor de temperatura",
    ],
    severity: "low",
    canDrive:
      "Se puede circular sin riesgo mecánico inmediato, pero el motor trabaja frío: más consumo y desgaste. Cámbialo en el próximo mantenimiento.",
  },
  P0217: {
    code: "P0217",
    title: "Sobretemperatura del motor",
    system: "Refrigeración",
    probableCause: "Fallo de refrigeración: nivel bajo, ventilador o bomba",
    probability: 75,
    causes: [
      "Nivel de refrigerante bajo o fuga",
      "Electroventilador que no arranca",
      "Termostato atascado cerrado",
      "Bomba de agua defectuosa",
      "Radiador obstruido",
    ],
    solutions: [
      "Detener el vehículo y dejar enfriar el motor",
      "Comprobar nivel y fugas de refrigerante",
      "Verificar el funcionamiento del electroventilador",
      "Sustituir termostato o bomba de agua según diagnóstico",
    ],
    severity: "critical",
    canDrive:
      "NO sigas circulando: detén el vehículo en cuanto sea seguro y deja enfriar el motor. Conducir sobrecalentado puede destruir la junta de culata o gripar el motor.",
  },
  P0299: {
    code: "P0299",
    title: "Presión de sobrealimentación insuficiente (turbo)",
    system: "Sobrealimentación",
    probableCause: "Fuga en el circuito de presión o geometría del turbo agarrotada",
    probability: 70,
    causes: [
      "Manguito de presión roto o abrazadera floja",
      "Geometría variable del turbo agarrotada por carbonilla",
      "Válvula wastegate o de descarga defectuosa",
      "Sensor de presión de admisión impreciso",
      "Turbo con desgaste interno",
    ],
    solutions: [
      "Inspeccionar manguitos e intercooler en busca de fugas",
      "Limpiar/desbloquear la geometría variable",
      "Comprobar la válvula reguladora de presión",
      "Reparar o sustituir el turbo si tiene holguras",
    ],
    severity: "high",
    canDrive:
      "El coche suele entrar en modo emergencia con potencia limitada. Puedes llegar a casa o al taller con suavidad, pero no hagas viajes largos ni exijas potencia.",
  },
  P0442: {
    code: "P0442",
    title: "Fuga pequeña en el sistema de evaporación (EVAP)",
    system: "Control de emisiones",
    probableCause: "Tapón de combustible mal cerrado o junta deteriorada",
    probability: 65,
    causes: [
      "Tapón del depósito mal apretado o con junta gastada",
      "Manguera del EVAP agrietada",
      "Válvula de purga del cánister con fuga leve",
    ],
    solutions: [
      "Apretar o sustituir el tapón del depósito",
      "Borrar el código y comprobar si reaparece",
      "Prueba de humo del circuito EVAP en taller",
    ],
    severity: "low",
    canDrive:
      "Puedes circular con total normalidad; es un fallo de emisiones sin riesgo mecánico. Revisa el tapón y acude al taller si el testigo reaparece.",
  },
  P0455: {
    code: "P0455",
    title: "Fuga grande en el sistema de evaporación (EVAP)",
    system: "Control de emisiones",
    probableCause: "Tapón de combustible ausente o manguera EVAP desconectada",
    probability: 70,
    causes: [
      "Tapón del depósito ausente o mal cerrado",
      "Manguera del EVAP desconectada o rota",
      "Cánister de carbón activo dañado",
      "Válvula de purga atascada abierta",
    ],
    solutions: [
      "Comprobar/instalar correctamente el tapón del depósito",
      "Inspeccionar mangueras del circuito EVAP",
      "Prueba de humo en taller para localizar la fuga",
    ],
    severity: "low",
    canDrive:
      "Sin riesgo mecánico: puedes circular con normalidad, aunque olerás a combustible y contaminarás más. Revísalo cuando puedas.",
  },
  P0562: {
    code: "P0562",
    title: "Tensión del sistema baja",
    system: "Carga eléctrica",
    probableCause: "Alternador que no carga o correa auxiliar patinando",
    probability: 75,
    causes: [
      "Alternador defectuoso (regulador o diodos)",
      "Correa auxiliar floja o rota",
      "Batería agotada que no retiene carga",
      "Masa o cableado de carga con resistencia alta",
    ],
    solutions: [
      "Medir la tensión de carga (13,5-14,7 V con motor en marcha)",
      "Revisar el estado y tensado de la correa auxiliar",
      "Probar la batería y sustituirla si no retiene carga",
      "Reparar o sustituir el alternador",
    ],
    severity: "high",
    canDrive:
      "Con el alternador sin cargar tienes 30-60 minutos de marcha con lo que quede de batería. Ve directo al taller y apaga todo consumo innecesario.",
  },
  P2263: {
    code: "P2263",
    title: "Rendimiento del sistema de turbo/supercargador",
    system: "Sobrealimentación",
    probableCause: "Turbo con rendimiento degradado o control de presión defectuoso",
    probability: 60,
    causes: [
      "Geometría variable agarrotada",
      "Fugas de presión entre turbo y admisión",
      "Actuador de control del turbo defectuoso",
      "Turbo con desgaste u holgura axial",
    ],
    solutions: [
      "Diagnosis del actuador y de la presión real de soplado",
      "Limpiar la geometría variable",
      "Reparar fugas del circuito de presión",
      "Sustituir el turbo si está desgastado",
    ],
    severity: "high",
    canDrive:
      "Conduce con suavidad y evita cargas altas; probablemente notarás falta de potencia. Diagnóstico en taller esta misma semana.",
  },
  C0035: {
    code: "C0035",
    title: "Sensor de velocidad de rueda delantera izquierda",
    system: "ABS / frenos",
    probableCause: "Sensor de rueda sucio, dañado o con cableado roto",
    probability: 75,
    causes: [
      "Sensor de velocidad de rueda sucio o dañado",
      "Cableado o conector del sensor deteriorado",
      "Corona fónica (anillo ABS) rota o sucia",
      "Rodamiento de rueda con holgura",
    ],
    solutions: [
      "Limpiar el sensor y su alojamiento",
      "Revisar cableado y conector",
      "Sustituir el sensor de rueda",
      "Comprobar la corona fónica y el rodamiento",
    ],
    severity: "high",
    canDrive:
      "El coche frena, pero SIN ABS ni control de estabilidad: distancia de frenado mayor y riesgo de bloqueo. Conduce con mucha prudencia y repáralo en días, no semanas.",
  },
  C1234: {
    code: "C1234",
    title: "Fallo del sistema de control de estabilidad (ESP)",
    system: "Estabilidad / frenos",
    probableCause: "Sensor de ángulo de dirección o de guiñada sin señal válida",
    probability: 60,
    causes: [
      "Sensor de ángulo de volante descalibrado",
      "Sensor de guiñada/aceleración lateral defectuoso",
      "Fallo de comunicación con el módulo ABS/ESP",
      "Tensión de alimentación inestable",
    ],
    solutions: [
      "Calibrar el sensor de ángulo de dirección",
      "Leer los códigos del módulo ABS/ESP con diagnosis",
      "Revisar conectores y masas del módulo",
    ],
    severity: "medium",
    canDrive:
      "Puedes circular: frenos y ABS suelen seguir operativos, pero sin ESP el coche no corrige derrapes. Evita suelo mojado o maniobras bruscas y pasa por el taller pronto.",
  },
  B0001: {
    code: "B0001",
    title: "Fallo en el circuito de despliegue del airbag del conductor",
    system: "Airbag / seguridad pasiva",
    probableCause: "Conector del airbag o cinta del volante (muelle espiral) con mal contacto",
    probability: 65,
    causes: [
      "Cinta espiral del volante desgastada",
      "Conector bajo el asiento o del volante flojo/oxidado",
      "Cableado del sistema SRS dañado",
      "Unidad de control de airbag defectuosa",
    ],
    solutions: [
      "Diagnosis del módulo SRS para localizar el circuito",
      "Revisar conectores del volante y bajo los asientos",
      "Sustituir la cinta espiral si está desgastada",
    ],
    severity: "critical",
    canDrive:
      "El coche circula con normalidad, pero el airbag puede NO desplegarse en un accidente. Es un fallo de seguridad: acude al taller de inmediato.",
  },
  U0100: {
    code: "U0100",
    title: "Sin comunicación con la centralita del motor (ECM)",
    system: "Red CAN / comunicación",
    probableCause: "Fallo de alimentación o de bus CAN hacia la ECU del motor",
    probability: 55,
    causes: [
      "Fusible o relé de alimentación de la ECU fundido",
      "Bus CAN cortado o en cortocircuito",
      "Masas de la ECU flojas u oxidadas",
      "ECU del motor defectuosa",
    ],
    solutions: [
      "Comprobar fusibles y relés de la ECU",
      "Verificar continuidad y resistencias del bus CAN (60 Ω)",
      "Limpiar y apretar las masas del motor",
      "Diagnosis avanzada de la ECU",
    ],
    severity: "critical",
    canDrive:
      "Si el motor funciona, hazlo solo para llegar al taller: puede pararse en cualquier momento o no volver a arrancar. No planifiques viajes.",
  },
  P0301: {
    code: "P0301",
    title: "Fallo de encendido en el cilindro 1",
    system: "Encendido",
    probableCause: "Bujía o bobina del cilindro 1 defectuosa",
    probability: 70,
    causes: [
      "Bujía del cilindro 1 desgastada",
      "Bobina de encendido del cilindro 1 defectuosa",
      "Inyector del cilindro 1 sucio",
      "Compresión baja en el cilindro 1",
    ],
    solutions: [
      "Intercambiar bobina/bujía con otro cilindro para confirmar",
      "Sustituir bujía y/o bobina",
      "Limpiar o probar el inyector",
    ],
    severity: "high",
    canDrive:
      "Conduce lo mínimo y sin acelerones: el combustible sin quemar daña el catalizador. Taller en pocos días.",
  },
};

/** Lista completa de entradas conocidas. */
export function allKnowledge(): DtcKnowledgeEntry[] {
  return Object.values(DTC_KNOWLEDGE);
}
