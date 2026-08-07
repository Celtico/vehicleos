"use client";

/**
 * Barra de navegación inferior.
 *
 * Sustituye al rail lateral. En una pantalla de 1280 px de ancho, quitar
 * los 94 px de la barra izquierda deja sitio para dos relojes grandes de
 * verdad, que es donde hace falta el espacio; y abajo los iconos quedan
 * más a mano del conductor.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Cuadro",
    icon: (
      <svg viewBox="0 0 24 24" className="h-[34px] w-[34px]" {...stroke}>
        <circle cx="12" cy="12" r="8.6" />
        <path d="M12 12l4.2-3.4" />
        <path d="M12 3.4v1.6M20.6 12H19M12 20.6V19M3.4 12H5M5.9 5.9l1.1 1.1M18.1 5.9l-1.1 1.1" />
        <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    href: "/diagnostics",
    label: "Diagnóstico",
    icon: (
      <svg viewBox="0 0 24 24" className="h-[34px] w-[34px]" {...stroke}>
        <path d="M3 14.5v-3.2h1.9V9.1h2.4V6.8h4.6v2.3h2.3l2.3 2.2H21v4.6h-1.9v2.3h-2.4v-2.3h-6.1l-2.3 2.3H6v-2.3H3z" />
        <path d="M9.6 6.8V5.2h3.9v1.6" />
      </svg>
    ),
  },
  {
    href: "/maintenance",
    label: "Mantenimiento",
    icon: (
      <svg viewBox="0 0 24 24" className="h-[34px] w-[34px]" {...stroke}>
        <path d="M15.4 5.6a4.9 4.9 0 0 0-6.6 6.1L3.6 16.9a2 2 0 0 0 2.8 2.8l5.2-5.2a4.9 4.9 0 0 0 6.1-6.6l-3.1 3.1-2.7-.7-.7-2.7z" />
      </svg>
    ),
  },
  {
    href: "/trips",
    label: "Viajes",
    icon: (
      <svg viewBox="0 0 24 24" className="h-[34px] w-[34px]" {...stroke}>
        <path d="M4.5 19.5V13M9.8 19.5V6.5M15.1 19.5v-9.2M20.4 19.5v-4.8" strokeWidth="2.4" />
      </svg>
    ),
  },
  {
    href: "/map",
    label: "Mapa",
    icon: (
      <svg viewBox="0 0 24 24" className="h-[34px] w-[34px]" {...stroke}>
        <path d="M12 21.2s-6.9-6.4-6.9-11.6a6.9 6.9 0 0 1 13.8 0c0 5.2-6.9 11.6-6.9 11.6z" />
        <circle cx="12" cy="9.5" r="2.5" />
      </svg>
    ),
  },
  {
    href: "/ai",
    label: "Asistente",
    icon: (
      <svg viewBox="0 0 24 24" className="h-[34px] w-[34px]" {...stroke}>
        <path d="M3.6 6.3a2.3 2.3 0 0 1 2.3-2.3h12.2a2.3 2.3 0 0 1 2.3 2.3v7.6a2.3 2.3 0 0 1-2.3 2.3H10l-4.3 3.8v-3.8a2.3 2.3 0 0 1-2.1-2.3z" />
        <circle cx="9.3" cy="9.6" r="1" fill="currentColor" stroke="none" />
        <circle cx="14.7" cy="9.6" r="1" fill="currentColor" stroke="none" />
        <path d="M9.4 12.4a3.4 3.4 0 0 0 5.2 0" />
      </svg>
    ),
  },
  {
    href: "/panel",
    label: "Flota",
    icon: (
      <svg viewBox="0 0 24 24" className="h-[34px] w-[34px]" {...stroke}>
        <path d="M2.4 6.2h11.2v10.4H2.4z" />
        <path d="M13.6 9.6h3.6l3.4 3.4v3.6h-7z" />
        <circle cx="7" cy="18.4" r="1.9" />
        <circle cx="17.4" cy="18.4" r="1.9" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Ajustes",
    icon: (
      <svg viewBox="0 0 24 24" className="h-[34px] w-[34px]" {...stroke}>
        <circle cx="12" cy="12" r="3.1" />
        <path d="M19.1 14.6a1.6 1.6 0 0 0 .3 1.8l.1.1a1.9 1.9 0 1 1-2.7 2.7l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a1.9 1.9 0 1 1-3.8 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a1.9 1.9 0 1 1-2.7-2.7l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1h-.2a1.9 1.9 0 1 1 0-3.8h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a1.9 1.9 0 1 1 2.7-2.7l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5v-.2a1.9 1.9 0 1 1 3.8 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a1.9 1.9 0 1 1 2.7 2.7l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1h.2a1.9 1.9 0 1 1 0 3.8h-.1a1.6 1.6 0 0 0-1.5 1z" />
      </svg>
    ),
  },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación principal"
      className="mx-4 mb-1 flex shrink-0 items-center justify-between px-2 pb-0.5 pt-1.5"
    >
      {ITEMS.map((item) => {
        const activa = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            aria-current={activa ? "page" : undefined}
            className={`relative flex flex-1 items-center justify-center gap-2 px-2 py-1.5 transition-colors ${
              activa ? "text-accent" : "text-muted hover:text-silver"
            }`}
          >
            {item.icon}
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em]">
              {item.label}
            </span>
            {activa ? (
              <span className="absolute inset-x-3 -bottom-0.5 h-[2px] rounded-full bg-accent" />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
