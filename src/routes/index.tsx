import { createFileRoute, Link } from "@tanstack/react-router";
import { useUser, signOut } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Archive WEAVER — Menu Principal" },
      { name: "description", content: "Crie, salve e compartilhe dispositivos investigativos para suas campanhas de RPG." },
      { property: "og:title", content: "Archive WEAVER — Menu Principal" },
      { property: "og:description", content: "Crie, salve e compartilhe dispositivos investigativos para suas campanhas de RPG." },
    ],
  }),
  component: MainMenu,
});

const items = [
  { to: "/criar" as const, title: "Criar Arquivo", code: "01", desc: "Forjar uma nova evidência. Escolha o tipo de arquivo." },
  { to: "/criador/visualizador" as const, title: "Criar Visualizador", code: "02", desc: "Forjar um dispositivo: TV, rádio, computador, projetor." },
  { to: "/biblioteca" as const, title: "Arquivos Salvos", code: "03", desc: "Arquivo completo. Abrir, duplicar, exportar, descartar." },
  { to: "/visualizador" as const, title: "Visualizador", code: "04", desc: "Sala de projeção. Insira um arquivo recebido." },
  { to: "/configuracoes" as const, title: "Configurações", code: "05", desc: "Calibragem do sistema e preferências de áudio." },
];

function MainMenu() {
  const { user } = useUser();

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent 0px, transparent 3px, rgba(0,0,0,0.4) 4px, rgba(0,0,0,0.4) 5px)",
        }}
      />

      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="size-2 animate-pulse rounded-full bg-amber-signal shadow-[0_0_10px_var(--amber-signal)]" />
          <span className="text-typewriter text-[11px] uppercase tracking-[0.4em] text-muted-foreground">
            REC ● {new Date().toLocaleDateString("pt-BR")}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <span className="hidden text-typewriter text-[10px] uppercase tracking-[0.3em] text-muted-foreground sm:inline">
                {user.email}
              </span>
              <button
                onClick={() => signOut()}
                className="text-typewriter text-[11px] uppercase tracking-[0.3em] text-muted-foreground hover:text-amber-signal"
              >
                Sair
              </button>
            </>
          ) : (
            <Link
              to="/auth"
              className="text-typewriter border border-amber-signal/60 px-4 py-1.5 text-[11px] uppercase tracking-[0.3em] text-amber-signal hover:bg-amber-signal/10"
            >
              Entrar / Criar conta
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-16 px-6 pb-16 pt-12 lg:grid-cols-[1.1fr_1fr] lg:items-end">
        <section>
          <p className="text-typewriter text-[10px] uppercase tracking-[0.5em] text-amber-signal/80">
            Dossiê &nbsp;//&nbsp; Arquivo Pessoal
          </p>
          <h1 className="mt-4 text-serif-noir text-7xl font-light leading-[0.95] text-foreground md:text-8xl">
            Archive
            <br />
            <span className="italic text-amber-signal">WEAVER</span>
          </h1>
          <p className="mt-6 max-w-md text-typewriter text-sm leading-relaxed text-muted-foreground">
            Forje dispositivos investigativos. Salve em sua conta. Compartilhe
            com seus jogadores por um link único.
          </p>

          <div className="mt-10 border-l-2 border-amber-signal/40 pl-4">
            <p className="text-typewriter text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
              Manuscrito do Investigador
            </p>
            <p className="mt-2 max-w-md text-serif-noir text-lg italic leading-relaxed text-foreground/80">
              "Não confie no que vê na primeira passagem. Pause. Volte.
              Cada quadro pode ser a confissão que faltava."
            </p>
          </div>
        </section>

        <nav className="space-y-3">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="group block border border-border bg-card/40 p-5 transition-all hover:border-amber-signal hover:bg-card"
            >
              <div className="flex items-baseline justify-between gap-6">
                <div className="flex items-baseline gap-4">
                  <span className="text-typewriter text-[10px] uppercase tracking-[0.35em] text-amber-signal/70">
                    {item.code}
                  </span>
                  <h2 className="text-serif-noir text-2xl font-light text-foreground transition-colors group-hover:text-amber-signal">
                    {item.title}
                  </h2>
                </div>
                <span className="text-typewriter text-[10px] uppercase tracking-[0.3em] text-muted-foreground transition-colors group-hover:text-amber-signal">
                  abrir →
                </span>
              </div>
              <p className="mt-2 pl-10 text-typewriter text-xs text-muted-foreground">
                {item.desc}
              </p>
            </Link>
          ))}
        </nav>
      </main>

      <footer className="mx-auto max-w-6xl border-t border-dashed border-border/60 px-6 py-4">
        <div className="flex justify-between text-typewriter text-[10px] uppercase tracking-[0.4em] text-muted-foreground">
          <span>Sistema Operacional</span>
          <span>{user ? "Sessão Ativa" : "Sinal Aberto"}</span>
          <span>v.1.0 — Não Distribua</span>
        </div>
      </footer>
    </div>
  );
}
