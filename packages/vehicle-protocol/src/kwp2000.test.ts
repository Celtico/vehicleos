import { describe, expect, it } from "vitest";
import {
  aHex,
  comandoCabecera,
  desdeHex,
  esRespuestaPendiente,
  KwpNegativeResponse,
  parsearDtc,
  parsearRespuesta,
  peticionBorrarDtc,
  peticionLeerDtc,
  quitarCabecera,
  sinRespuesta,
} from "./kwp2000";

describe("KWP2000 · codificación", () => {
  it("convierte bytes a hexadecimal en mayúsculas y con relleno", () => {
    expect(aHex([0x01, 0xab, 0x0f])).toBe("01AB0F");
  });

  it("parsea hexadecimal ignorando espacios y el prompt del ELM327", () => {
    expect(desdeHex("58 02 C1 23 \r\n>")).toEqual([0x58, 0x02, 0xc1, 0x23]);
  });

  it("construye la cabecera dirigida a una centralita concreta", () => {
    // formato 0x81, destino 0x28, origen 0xF1 (equipo de diagnosis)
    expect(comandoCabecera(0x28)).toBe("ATSH8128F1");
  });
});

describe("KWP2000 · peticiones", () => {
  it("pide todos los códigos de todos los grupos", () => {
    expect(peticionLeerDtc()).toEqual([0x18, 0x00, 0xff, 0x00]);
  });

  it("permite filtrar por estado y grupo", () => {
    expect(peticionLeerDtc(0x02, 0x0100)).toEqual([0x18, 0x02, 0x01, 0x00]);
  });

  it("construye el borrado de todos los códigos", () => {
    expect(peticionBorrarDtc()).toEqual([0x14, 0xff, 0x00]);
  });
});

describe("KWP2000 · respuestas", () => {
  it("acepta una respuesta positiva y devuelve solo los datos", () => {
    // 0x18 + 0x40 = 0x58
    expect(parsearRespuesta([0x58, 0x01, 0xc1, 0x23, 0x60], 0x18)).toEqual([
      0x01, 0xc1, 0x23, 0x60,
    ]);
  });

  it("lanza un error legible ante una respuesta negativa", () => {
    // 0x7F, servicio 0x18, NRC 0x11 (servicio no soportado)
    try {
      parsearRespuesta([0x7f, 0x18, 0x11], 0x18);
      throw new Error("debería haber lanzado");
    } catch (e) {
      expect(e).toBeInstanceOf(KwpNegativeResponse);
      expect((e as KwpNegativeResponse).nrc).toBe(0x11);
      expect((e as Error).message).toContain("no soportado");
    }
  });

  it("detecta el 'respuesta pendiente' para reintentar en vez de fallar", () => {
    expect(esRespuestaPendiente([0x7f, 0x18, 0x78])).toBe(true);
    expect(esRespuestaPendiente([0x7f, 0x18, 0x11])).toBe(false);
  });

  it("rechaza una respuesta de otro servicio", () => {
    expect(() => parsearRespuesta([0x54, 0x00], 0x18)).toThrow(/inesperada/);
  });

  it("rechaza una respuesta vacía", () => {
    expect(() => parsearRespuesta([], 0x18)).toThrow(/vacía/);
  });
});

describe("KWP2000 · cabecera del bus", () => {
  it("quita formato, destino, origen y suma de comprobación", () => {
    // 0x81 lleva longitud 1 en los bits bajos → cabecera de 3 bytes
    const trama = [0x81, 0xf1, 0x28, 0x58, 0x00, 0xaa];
    expect(quitarCabecera(trama)).toEqual([0x58, 0x00]);
  });

  it("usa el byte de longitud adicional cuando el formato lleva 0", () => {
    const trama = [0x80, 0xf1, 0x28, 0x02, 0x58, 0x00, 0xaa];
    expect(quitarCabecera(trama)).toEqual([0x58, 0x00]);
  });
});

describe("KWP2000 · códigos de avería", () => {
  it("parsea la lista devuelta por el servicio 0x18", () => {
    // 2 códigos: C123 activo+almacenado, 4501 solo almacenado
    const dtc = parsearDtc([0x02, 0xc1, 0x23, 0x60, 0x45, 0x01, 0x40]);
    expect(dtc).toHaveLength(2);
    expect(dtc[0]?.raw).toBe("C123");
    expect(dtc[0]?.numero).toBe(0xc123);
    expect(dtc[0]?.activo).toBe(true);
    expect(dtc[0]?.almacenado).toBe(true);
    expect(dtc[1]?.activo).toBe(false);
    expect(dtc[1]?.almacenado).toBe(true);
  });

  it("devuelve lista vacía cuando no hay códigos", () => {
    expect(parsearDtc([0x00])).toEqual([]);
    expect(parsearDtc([])).toEqual([]);
  });

  it("ignora el relleno a cero", () => {
    expect(parsearDtc([0x02, 0xc1, 0x23, 0x60, 0x00, 0x00, 0x00])).toHaveLength(1);
  });

  it("no se sale del array si la trama viene truncada", () => {
    // Dice que hay 3 códigos pero solo llegan los bytes de uno.
    expect(parsearDtc([0x03, 0xc1, 0x23, 0x60])).toHaveLength(1);
  });
});

describe("KWP2000 · detección de centralita ausente", () => {
  it("reconoce las respuestas de un ELM327 sin interlocutor", () => {
    for (const r of ["NO DATA", "UNABLE TO CONNECT", "BUS INIT: ...ERROR", "STOPPED", "  "]) {
      expect(sinRespuesta(r)).toBe(true);
    }
  });

  it("no confunde una respuesta válida con ausencia", () => {
    expect(sinRespuesta("81 F1 28 58 00 AA")).toBe(false);
  });
});
