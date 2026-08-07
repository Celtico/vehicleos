"use client";

/**
 * Asistente: chat de diagnóstico. Envía la pregunta + telemetría actual +
 * DTCs al backend vía AssistantClient; si el backend no responde, genera
 * una respuesta local degradada desde DTC_KNOWLEDGE (buildLocalAnswer).
 */
import { useEffect, useRef, useState } from "react";
import { AssistantClient, buildLocalAnswer } from "@vehicleos/ai";
import { Card } from "@vehicleos/ui";
import { useVehicleStore } from "../../store/vehicle-store";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  local?: boolean;
}

const SUGGESTED = [
  "¿Por qué está encendido el testigo?",
  "¿Cuánto puedo conducir así?",
  "¿Qué debería revisar primero?",
];

export default function AiPage() {
  const apiUrl = useVehicleStore((s) => s.apiUrl);
  const telemetry = useVehicleStore((s) => s.telemetry);
  const dtc = useVehicleStore((s) => s.dtc);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { role: "user", text: q }]);

    const request = { question: q, telemetry, dtc };
    try {
      const client = new AssistantClient({ apiUrl, timeoutMs: 6000 });
      const res = await client.ask(request);
      setMessages((m) => [...m, { role: "assistant", text: res.answer, local: false }]);
    } catch {
      // Backend caído: respuesta local degradada desde DTC_KNOWLEDGE.
      const local = buildLocalAnswer(request);
      setMessages((m) => [...m, { role: "assistant", text: local.answer, local: true }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <h1 className="text-xl font-medium tracking-[0.2em] text-silver">ASISTENTE</h1>

      {/* Contexto actual */}
      <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-widest text-muted">
        <span className="rounded-full bg-linea/5 px-3 py-1">
          {dtc.length === 0 ? "Sin averías activas" : `${dtc.length} DTC activos`}
        </span>
        {dtc.map((d) => (
          <span
            key={d.code}
            className="rounded-full bg-danger/15 px-3 py-1 font-mono text-danger"
          >
            {d.code}
          </span>
        ))}
      </div>

      {/* Conversación */}
      <Card style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <div
          ref={scrollRef}
          className="flex min-h-[240px] flex-1 flex-col gap-3 overflow-y-auto pr-1"
        >
          {messages.length === 0 ? (
            <p className="m-auto max-w-md text-center text-sm text-muted">
              Pregunta lo que quieras sobre el estado del vehículo. La pregunta viaja al backend
              junto con la telemetría y los códigos de avería actuales; si no hay backend, la
              respuesta se genera localmente.
            </p>
          ) : (
            messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "self-end bg-accent/15 text-silver"
                    : "self-start border border-linea/10 bg-linea/[0.04] text-silver/95"
                }`}
              >
                {m.text}
                {m.role === "assistant" && m.local ? (
                  <div className="mt-2 text-[10px] uppercase tracking-widest text-warn">
                    Respuesta local (backend no disponible)
                  </div>
                ) : null}
              </div>
            ))
          )}
          {busy ? (
            <div className="self-start rounded-2xl border border-linea/10 bg-linea/[0.04] px-4 py-3 text-sm text-muted">
              Pensando…
            </div>
          ) : null}
        </div>
      </Card>

      {/* Preguntas sugeridas */}
      <div className="flex flex-wrap gap-2">
        {SUGGESTED.map((q) => (
          <button
            key={q}
            onClick={() => void ask(q)}
            disabled={busy}
            className="rounded-full border border-accent/30 px-4 py-1.5 text-xs text-accent transition-colors hover:bg-accent/10 disabled:opacity-40"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Entrada */}
      <form
        className="flex gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
      >
        <input
          className="cockpit-input flex-1"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe tu pregunta…"
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || input.trim().length === 0}
          className="rounded-lg border border-accent/40 px-5 text-xs uppercase tracking-widest text-accent transition-colors hover:bg-accent/10 disabled:opacity-30"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
