/**
 * Animación a 60 FPS sin re-render de React.
 *
 * Los componentes de instrumentación reciben el último valor de telemetría
 * (20 Hz aprox. desde el provider) como prop, pero NO se re-renderizan por
 * frame: un bucle requestAnimationFrame interpola hacia el objetivo con un
 * decaimiento exponencial (lerp independiente del framerate) y muta los
 * atributos SVG directamente a través de refs.
 */
import { useEffect, useRef } from "react";

/**
 * Interpola suavemente hacia `target` y llama a `apply(valor)` en cada frame.
 *
 * @param target     Último valor recibido (puede cambiar en cada render).
 * @param apply      Callback que muta el DOM/SVG con el valor interpolado.
 * @param halfLifeMs Semivida del decaimiento: ms que tarda en recorrer la
 *                   mitad de la distancia al objetivo (menor = más rápido).
 */
export function useAnimatedNumber(
  target: number,
  apply: (value: number) => void,
  halfLifeMs = 140,
): void {
  const targetRef = useRef(target);
  targetRef.current = target;
  const applyRef = useRef(apply);
  applyRef.current = apply;

  useEffect(() => {
    let raf = 0;
    let value = targetRef.current;
    let last = performance.now();

    const frame = (now: number) => {
      // dt acotado para evitar saltos tras pestañas en segundo plano.
      const dt = Math.min(100, now - last);
      last = now;
      // Factor de lerp exponencial independiente del framerate.
      const k = 1 - Math.pow(0.5, dt / halfLifeMs);
      value += (targetRef.current - value) * k;
      if (Math.abs(targetRef.current - value) < 1e-3) {
        value = targetRef.current;
      }
      applyRef.current(value);
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [halfLifeMs]);
}

/** Acota `v` al intervalo [min, max]. */
export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
