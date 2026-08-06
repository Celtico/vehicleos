import { describe, expect, it } from "vitest";
import { decodeDtcBytes, isValidDtcCode, parseDtcResponse } from "./dtc";
import { buildPidCommand, parseDtcRawResponse, parsePidResponse } from "./elm327";
import { PIDS, boostFromMap } from "./pids";

describe("PIDs", () => {
  it("convierte RPM según SAE J1979: ((A*256)+B)/4", () => {
    expect(PIDS.RPM.parse([0x1a, 0xf8])).toBe(1726);
  });

  it("convierte velocidad (A directo en km/h)", () => {
    expect(PIDS.SPEED.parse([0x78])).toBe(120);
  });

  it("convierte temperatura de refrigerante (A-40)", () => {
    expect(PIDS.COOLANT_TEMP.parse([0x83])).toBe(91);
  });

  it("convierte tensión del módulo (((A*256)+B)/1000)", () => {
    expect(PIDS.CONTROL_MODULE_VOLTAGE.parse([0x37, 0x66])).toBeCloseTo(14.182);
  });

  it("calcula boost relativo a partir de MAP y barométrica", () => {
    expect(boostFromMap(181, 101)).toBeCloseTo(0.8);
    expect(boostFromMap(80, 101)).toBe(0); // vacío → sin sobrepresión
  });
});

describe("ELM327", () => {
  it("construye comandos de PID", () => {
    expect(buildPidCommand(PIDS.RPM)).toBe("010C");
    expect(buildPidCommand(PIDS.COOLANT_TEMP)).toBe("0105");
  });

  it("parsea una respuesta válida con espacios y prompt", () => {
    expect(parsePidResponse("41 0C 1A F8\r\n>", PIDS.RPM)).toEqual([0x1a, 0xf8]);
  });

  it("devuelve null ante NO DATA", () => {
    expect(parsePidResponse("NO DATA\r>", PIDS.RPM)).toBeNull();
  });

  it("extrae bytes de una respuesta de modo 03", () => {
    expect(parseDtcRawResponse("43 04 01 C1 23\r>")).toEqual([0x04, 0x01, 0xc1, 0x23]);
  });
});

describe("DTC", () => {
  it("decodifica P0401", () => {
    expect(decodeDtcBytes(0x04, 0x01)).toBe("P0401");
  });

  it("decodifica códigos de chasis (C)", () => {
    expect(decodeDtcBytes(0x41, 0x23)).toBe("C0123");
  });

  it("parsea una lista de DTC ignorando el relleno a cero", () => {
    const codes = parseDtcResponse([0x04, 0x01, 0x00, 0x00]);
    expect(codes).toHaveLength(1);
    expect(codes[0]?.code).toBe("P0401");
    expect(codes[0]?.status).toBe("stored");
  });

  it("valida el formato de códigos escritos a mano", () => {
    expect(isValidDtcCode("P0401")).toBe(true);
    expect(isValidDtcCode("X9999")).toBe(false);
  });
});
