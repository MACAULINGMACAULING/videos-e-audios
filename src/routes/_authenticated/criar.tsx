import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { NoirShell } from "@/components/noir-shell";
import { ARCHIVE_TYPES } from "@/lib/archive/registry";

export const Route = createFileRoute("/_authenticated/criar")({
  head: () => ({
    meta: [
      { title: "Criar Arquivo — Archive WEAVER" },
      { name: "description", content: "Selecione o tipo de arquivo a ser criado." },
      { property: "og:title", content: "Criar Arquivo — Archive WEAVER" },
      { property: "og:description", content: "Selecione o tipo de arquivo a ser criado." },
    ],
  }),
  component: CriarArquivo,
});

function CriarArquivo() {
  const navigate = useNavigate();

  return (
    <NoirShell
      title="Criar Arquivo"
      subtitle="Escolha a natureza da evidência. Cada tipo é um objeto narrativo distinto."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {ARCHIVE_TYPES.map((t) => {
          const ready = t.status === "ready" && t.creatorRoute;
          return (
            <button
              key={t.kind}
              type="button"
              disabled={!ready}
              onClick={() => {
                if (ready && t.creatorRoute) navigate({ to: t.creatorRoute });
              }}
              className={`group relative flex flex-col items-start gap-3 border border-border bg-card/40 p-6 text-left transition-all ${
                ready
                  ? "hover:border-amber-signal hover:bg-card cursor-pointer"
                  : "cursor-not-allowed opacity-50"
              }`}
            >
              <div className="flex w-full items-baseline justify-between">
                <div className="flex items-baseline gap-4">
                  <span className="text-typewriter text-[10px] uppercase tracking-[0.35em] text-amber-signal/70">
                    {t.code}
                  </span>
                  <h2 className="text-serif-noir text-3xl font-light text-foreground transition-colors group-hover:text-amber-signal">
                    {t.label}
                  </h2>
                </div>
                <span className="text-serif-noir text-3xl text-amber-signal/60">
                  {t.glyph}
                </span>
              </div>
              <p className="text-typewriter text-xs text-muted-foreground">
                {t.description}
              </p>
              <span className="text-typewriter mt-2 text-[10px] uppercase tracking-[0.35em]">
                {ready ? (
                  <span className="text-amber-signal">abrir criador →</span>
                ) : (
                  <span className="border border-dashed border-amber-signal/40 px-2 py-1 text-amber-signal/70">
                    Em desenvolvimento
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </NoirShell>
  );
}