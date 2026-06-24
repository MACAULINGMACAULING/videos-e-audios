import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { NoirShell } from "@/components/noir-shell";
import { playEject, playInsert, startRewind } from "@/lib/vhs-audio";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Arquivo VHS" },
      { name: "description", content: "Calibragem do sistema." },
    ],
  }),
  component: Settings,
});

function Settings() {
  const [volume, setVolume] = useState(80);

  function testSound(kind: "insert" | "eject" | "rewind" | "ff") {
    if (kind === "insert") playInsert();
    else if (kind === "eject") playEject();
    else {
      const stop = startRewind(kind === "rewind" ? "rew" : "ff");
      setTimeout(stop, 1200);
    }
  }

  return (
    <NoirShell title="Configurações" subtitle="Calibragem do equipamento.">
      <div className="grid gap-10 lg:grid-cols-2">
        <section className="space-y-4">
          <h2 className="text-typewriter text-[11px] uppercase tracking-[0.35em] text-amber-signal/80">
            Áudio do Aparelho
          </h2>
          <div className="border border-border bg-card/30 p-5">
            <div className="mb-3 flex justify-between text-typewriter text-[11px] uppercase tracking-widest text-muted-foreground">
              <span>Volume Mestre</span>
              <span className="text-amber-signal">{volume}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-full accent-amber-signal"
            />
          </div>

          <div className="border border-border bg-card/30 p-5">
            <p className="text-typewriter text-[11px] uppercase tracking-widest text-muted-foreground">
              Testar Sons Mecânicos
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-typewriter text-[10px] uppercase tracking-widest">
              {([
                ["insert", "Inserir"],
                ["eject", "Ejetar"],
                ["rewind", "Retroceder"],
                ["ff", "Avançar"],
              ] as const).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => testSound(k)}
                  className="border border-border px-3 py-2 text-muted-foreground hover:border-amber-signal hover:text-amber-signal"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-typewriter text-[11px] uppercase tracking-[0.35em] text-amber-signal/80">
            Sobre o Arquivo
          </h2>
          <div className="border border-border bg-card/30 p-5 text-typewriter text-xs leading-relaxed text-muted-foreground">
            <p>
              Fitas são guardadas localmente no seu navegador (IndexedDB). Para distribuir
              a um jogador, use <span className="text-amber-signal">Exportar .vhs</span> e
              envie o arquivo. O jogador abre no Visualizador.
            </p>
            <p className="mt-3 text-serif-noir italic text-foreground/70">
              "O arquivo é particular. O que sai por sua mão é responsabilidade sua."
            </p>
          </div>
          <div className="border border-dashed border-border p-5 text-typewriter text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Versão 1.0 — Build experimental
          </div>
        </section>
      </div>
    </NoirShell>
  );
}
