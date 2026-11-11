"use client";

/**
 * Registra el service worker propio (public/sw.js).
 * Solo en producción para no interferir con el HMR de desarrollo.
 */
import { useEffect } from "react";
import { conBase } from "../lib/base";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register(conBase("/sw.js")).catch(() => {
      // Sin service worker la app sigue funcionando (solo pierde offline).
    });
  }, []);
  return null;
}
