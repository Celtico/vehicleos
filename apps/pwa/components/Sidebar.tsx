"use client";

/**
 * Barra lateral de navegación del cockpit: iconos SVG inline, indicador
 * de página activa con acento cian y glow.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Cuadro",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" {...stroke}>
        <path d="M4.5 17 a 8.5 8.5 0 1 1 15 0" />
        <line x1="12" y1="13.5" x2="15.5" y2="9" />
        <circle cx="12" cy="14" r="1.3" />
      </svg>
    ),
  },
  {
    href: "/diagnostics",
    label: "Diagnóstico",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" {...stroke}>
        <path d="M12 3 2.8 19.5 h18.4 z" />
        <line x1="12" y1="9.5" x2="12" y2="14" />
        <circle cx="12" cy="16.8" r="0.4" />
      </svg>
    ),
  },
  {
    href: "/maintenance",
    label: "Mantenimiento",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" {...stroke}>
        <path d="M14.5 6.5 a4.5 4.5 0 0 0 -6 5.6 L4 16.6 a1.8 1.8 0 0 0 2.5 2.5 l4.5 -4.5 a4.5 4.5 0 0 0 5.6 -6 l-2.8 2.8 -2.5 -0.7 -0.7 -2.5 z" />
      </svg>
    ),
  },
  {
    href: "/trips",
    label: "Viajes",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" {...stroke}>
        <circle cx="6" cy="18" r="2" />
        <circle cx="18" cy="6" r="2" />
        <path
          d="M8 18 h6 a3.5 3.5 0 0 0 0 -7 h-4 a3.5 3.5 0 0 1 0 -7 h6"
          transform="rotate(180 12 12)"
        />
      </svg>
    ),
  },
  {
    href: "/map",
    label: "Mapa",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" {...stroke}>
        <path d="M12 21 s-6.5 -6 -6.5 -11 a6.5 6.5 0 0 1 13 0 c0 5 -6.5 11 -6.5 11 z" />
        <circle cx="12" cy="10" r="2.2" />
      </svg>
    ),
  },
  {
    href: "/ai",
    label: "Asistente",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" {...stroke}>
        <path d="M4 6 a2 2 0 0 1 2 -2 h12 a2 2 0 0 1 2 2 v8 a2 2 0 0 1 -2 2 h-9 l-4 4 v-4 h-1 a2 2 0 0 1 -2 -2 z" />
        <circle cx="9" cy="10" r="0.5" />
        <circle cx="12.5" cy="10" r="0.5" />
        <circle cx="16" cy="10" r="0.5" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Ajustes",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" {...stroke}>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 4.5 v-2 M12 21.5 v-2 M19.5 12 h2 M2.5 12 h2 M17.3 6.7 l1.4 -1.4 M5.3 18.7 l1.4 -1.4 M17.3 17.3 l1.4 1.4 M5.3 5.3 l1.4 1.4" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex h-full w-[86px] shrink-0 flex-col items-center gap-2 border-r border-white/5 bg-black/40 py-5">
      {/*
        Emblema propio de VehicleOS: arco de instrumento abierto (como los
        gauges del cuadro) con la "V" de Vehicle inscrita. Deliberadamente no
        reproduce el logotipo de ningún fabricante real: la inspiración
        Mercedes de esta interfaz es estética (tipografía fina, negro con
        acentos turquesa), nunca de marca.
      */}
      <Link href="/" className="mb-4" aria-label="VehicleOS">
        <svg viewBox="0 0 32 32" className="h-9 w-9 text-accent">
          <path
            d="M6.6 24.5 a13 13 0 1 1 18.8 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity="0.45"
          />
          <path
            d="M10 11.5 L16 22 L22 11.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Link>

      {ITEMS.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            className={`group flex w-full flex-col items-center gap-1 rounded-xl py-2.5 transition-colors ${
              active ? "text-accent" : "text-muted hover:text-silver"
            }`}
          >
            <span
              className="rounded-lg p-1"
              style={
                active ? { filter: "drop-shadow(0 0 6px rgba(0,210,190,0.6))" } : undefined
              }
            >
              {item.icon}
            </span>
            <span className="text-[8.5px] uppercase tracking-[0.15em]">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
