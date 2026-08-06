"use client";

/**
 * Envoltorio de carga diferida de `VehicleModel3D`.
 *
 * three.js pesa bastante y solo hace falta cuando el conductor elige la vista
 * 3D del cuadro, así que se carga con `next/dynamic` y `ssr: false`: el resto
 * de pantallas (diagnóstico, viajes, mapa, ajustes) no lo arrastran en su
 * bundle inicial. La importación del tipo es `import type`, que se borra en
 * compilación y por tanto no crea dependencia real con el módulo.
 */
import dynamic from "next/dynamic";
import { MBUX } from "@vehicleos/ui";
import type { VehicleModel3DProps } from "./VehicleModel3D";

/** Alto por defecto, igual que el del propio componente 3D. */
const ALTO_POR_DEFECTO = 320;

/** Esqueleto mientras se descarga y compila la escena. */
function Esqueleto() {
  return (
    <div
      className="flex h-full w-full items-center justify-center rounded-2xl border border-white/5"
      role="status"
      aria-label="Cargando la vista 3D del vehículo"
    >
      <div className="flex flex-col items-center gap-3">
        <div
          className="h-9 w-9 animate-spin rounded-full border-2 border-white/10"
          style={{ borderTopColor: MBUX.accent }}
        />
        <span className="text-[10px] uppercase tracking-[0.3em] text-muted">
          Cargando modelo 3D
        </span>
      </div>
    </div>
  );
}

const VehicleModel3D = dynamic(() => import("./VehicleModel3D"), {
  ssr: false,
  loading: () => <Esqueleto />,
});

/** Misma API que `VehicleModel3D`, pero sin entrar en el bundle inicial. */
export function VehicleModel3DLazy(props: VehicleModel3DProps) {
  return (
    <div style={{ height: props.height ?? ALTO_POR_DEFECTO, width: "100%" }}>
      <VehicleModel3D {...props} height={props.height ?? ALTO_POR_DEFECTO} />
    </div>
  );
}
