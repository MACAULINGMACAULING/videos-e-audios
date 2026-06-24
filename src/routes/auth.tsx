import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/auth";

interface AuthSearch { redirect?: string }

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): AuthSearch => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Acesso — Archive WEAVER" },
      { name: "description", content: "Entre na sua conta para abrir o arquivo." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/auth" });
  const { user } = useUser();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) navigate({ to: redirect ?? "/biblioteca", replace: true });
  }, [user, redirect, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (err) throw err;
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha na autenticação.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent 0px, transparent 3px, rgba(0,0,0,0.4) 4px, rgba(0,0,0,0.4) 5px)",
        }}
      />
      <div className="relative w-full max-w-md border border-border bg-card/40 p-8 backdrop-blur">
        <p className="text-typewriter text-[10px] uppercase tracking-[0.5em] text-amber-signal/80">
          Acesso ao Arquivo
        </p>
        <h1 className="mt-3 text-serif-noir text-5xl font-light text-foreground">
          {mode === "signin" ? "Entrar" : <>Criar <span className="italic">conta</span></>}
        </h1>
        <p className="mt-2 text-typewriter text-xs text-muted-foreground">
          {mode === "signin"
            ? "Continue de onde parou. Seu arquivo está esperando."
            : "Crie uma identidade e comece a forjar evidências."}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-typewriter text-[10px] uppercase tracking-[0.35em] text-muted-foreground">E-mail</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full border border-border bg-background/60 px-3 py-2 text-typewriter text-sm text-foreground focus:border-amber-signal focus:outline-none"
              autoComplete="email"
            />
          </label>
          <label className="block">
            <span className="text-typewriter text-[10px] uppercase tracking-[0.35em] text-muted-foreground">Senha</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full border border-border bg-background/60 px-3 py-2 text-typewriter text-sm text-foreground focus:border-amber-signal focus:outline-none"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </label>

          {error && (
            <p className="text-typewriter text-[11px] uppercase tracking-widest text-destructive">{error}</p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full text-typewriter border border-amber-signal bg-amber-signal py-2.5 text-xs uppercase tracking-[0.3em] text-primary-foreground hover:opacity-90 disabled:opacity-40"
          >
            {busy ? "Processando..." : mode === "signin" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); }}
          className="mt-5 w-full text-typewriter text-[11px] uppercase tracking-[0.3em] text-muted-foreground hover:text-amber-signal"
        >
          {mode === "signin" ? "Não tem conta? Criar uma →" : "Já tem conta? Entrar →"}
        </button>

        <div className="mt-6 border-t border-dashed border-border pt-4 text-center">
          <Link to="/" className="text-typewriter text-[10px] uppercase tracking-[0.3em] text-muted-foreground hover:text-amber-signal">
            ← Voltar ao menu
          </Link>
        </div>
      </div>
    </div>
  );
}
