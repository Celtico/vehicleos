"use client";

/**
 * Reloj del cockpit (hh:mm). Se actualiza cada segundo.
 */
import { useEffect, useState } from "react";

export function Clock() {
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    const update = () =>
      setTime(new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span suppressHydrationWarning className="text-lg font-medium tracking-widest text-silver">
      {time}
    </span>
  );
}
