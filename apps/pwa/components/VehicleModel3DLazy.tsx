"use client";

/**
 * Envoltorio perezoso de VehicleModel3D.
 *
 * three.js pesa cerca de medio megabyte de JavaScript y solo hace falta si el
 * conductor elige la vista 3D, que no es la de por defecto. Con `next/dynamic`
 * y `ssr: false` el bundle inicial del cockpit no lo arrastra: se descarga en
 * un chunk aparte la primera vez que se conmuta la vista.
 *
 * `ssr: false` además es obligatorio: el componente toca `window`, `document`
 * y WebGL en el montaje.
 */
import dynamic from "next/dynamic";
import type { VehicleModel3DProps } from "./VehicleModel3D";

/**
 * Esqueleto mientras se descarga el chunk de three.js. Ocupa todo el hueco
 * que le reserva el envoltorio, así no hay salto de layout al aparecer el
 * lienzo (en una pantalla de coche sin scroll, un salto se nota).
 */
function Esqueleto() {
  return (
    <div
      className="flex h-full w-full items-center justify-center"
      role="img"
      aria-label="Cargando la vista 3D del vehículo"
    >
      <div className="flex flex-col items-center gap-2">
        <div className="h-14 w-32 animate-pulse rounded-xl border border-white/10 bg-white/[0.04]" />
        <span className="text-[10px] uppercase tracking-[0.25em] text-muted">
          Preparando 3D
        </span>
      </div>
    </div>
  );
}

const VehicleModel3D = dynamic(() => import("./VehicleModel3D").then((m) => m.VehicleModel3D), {
  ssr: false,
  loading: () => <Esqueleto />,
});

export type { VehicleModel3DProps };

export function VehicleModel3DLazy(props: VehicleModel3DProps) {
  return (
    <div className="w-full" style={{ height: props.height ?? 300 }}>
      <VehicleModel3D {...props} />
    </div>
  );
}
