# MercedesProvider — leer ABS, ESP y airbag

## Por qué existe

El modo 03 del OBD-II estándar **solo devuelve códigos del grupo
motopropulsor** (los que empiezan por `P`). En un Mercedes de la época del
W209, los códigos de ABS, ESP y airbag viven en centralitas independientes a
las que se llega por la línea K del conector de diagnosis, hablando KWP2000
(ISO 14230) y direccionando cada módulo por separado.

Sin esto, la pantalla de diagnóstico dice "sin averías activas" mientras el
testigo del ABS está encendido en el salpicadero. Es la peor mentira que
puede contar una herramienta de diagnóstico, y por eso el provider marca los
subsistemas que **no ha podido consultar** como `unknown` en vez de `ok`.

## Qué está verificado y qué no

**Verificado con tests (48 en total):** la mecánica del protocolo. Es norma
pública ISO 14230 y está en `@vehicleos/vehicle-protocol/kwp2000`:
construcción de peticiones, parseo de respuestas, respuestas negativas,
reintento ante "respuesta pendiente" (NRC 0x78), decodificación de códigos de
2 bytes con su byte de estado, y detección de centralita ausente.

**No verificado, y no puede estarlo desde aquí:** qué dirección tiene cada
centralita de tu coche y qué significa cada código propietario. Esa
información es del fabricante y no es pública. **Por eso este provider no
trae ninguna dirección de fábrica**: prefiero que no funcione a que funcione
mal y te mande a revisar la pieza equivocada.

## Puesta en marcha sobre el coche real

### 1. Descubrir qué centralitas responden

Con el **contacto dado y el motor parado**, ejecuta el escaneo una vez:

```ts
import { AndroidBridgeProvider, MercedesProvider } from "@vehicleos/vehicle-sdk";

const base = new AndroidBridgeProvider();
await base.connect();

const mercedes = new MercedesProvider({ base });
const encontradas = await mercedes.escanearModulos();
console.table(encontradas);
```

Devuelve las direcciones que contestaron, su identificación en crudo y
cuántos códigos tenía cada una en ese momento. El escaneo recorre 0x00-0x5F
por defecto; puedes pasarle otro rango.

### 2. Fijar el mapa de módulos

Con esas direcciones, configura el provider. Los nombres y el `kind` los
eliges tú según qué testigo debe encender cada una:

```ts
const mercedes = new MercedesProvider({
  base,
  modules: [
    { address: 0x28, name: "ABS/ESP", kind: "abs", prefix: "ABS" },
    { address: 0x38, name: "Airbag", kind: "airbag", prefix: "SRS" },
  ],
});
```

Para saber cuál es cuál: provoca una condición conocida (por ejemplo,
desconecta un conector de sensor de rueda con el coche parado y en seguro) y
mira qué centralita cambia sus códigos. Es artesanal, pero es honesto.

### 3. Comprobar

```ts
const codigos = await mercedes.dtc();
// [{ code: "P0401", ... }, { code: "ABS-C123", ... }]
console.log(mercedes.getModulosSinRespuesta()); // las que no contestaron
```

## Decisiones de diseño

**Los códigos propietarios no se disfrazan de códigos SAE.** Un código
`0xC123` de una centralita Mercedes **no es** el `C0123` de la norma. Se
etiqueta como `ABS-C123`, con el prefijo del módulo, para que nadie lo busque
en una tabla que no le corresponde.

**Una centralita muda deja su testigo en `unknown`.** Si el módulo del airbag
no contesta, el sistema no dice que esté bien: dice que no lo sabe. Es la
diferencia entre una herramienta en la que se puede confiar y una que da
falsa tranquilidad.

**Un módulo que falla no aborta la lectura de los demás.** Media lectura vale
más que ninguna, y los módulos que fallaron quedan listados en
`getModulosSinRespuesta()`.

**Los datos de motor los sigue dando el provider base.** Este provider solo
añade lo que aquel no puede ver, y comparte con él el mismo adaptador.

**La regla de oro se mantiene.** Los comandos viajan al Vehicle Bridge por el
método `raw` del contrato JSON-RPC; el hardware lo sigue tocando únicamente
el servicio Android.

## Limitaciones conocidas

- El adaptador queda en ISO 14230 tras consultar las centralitas. Llama a
  `finalizarDiagnostico()` para devolverlo al OBD-II estándar si el provider
  base va a seguir usándose.
- Algunas centralitas exigen desbloqueo de seguridad (servicio 0x27) para dar
  ciertos datos. El provider no lo implementa: la secuencia de clave es
  específica del fabricante.
- No todos los clones de ELM327 implementan bien los protocolos 4 y 5. Si el
  escaneo no encuentra nada, prueba con otro adaptador antes de dar por hecho
  que el coche no responde.
