import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useUser, signOut } from "@/lib/auth";

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
  back?: boolean;
}

export function NoirShell({ title, subtitle, children, back = true }: Props) {
  const { user } = useUser();

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/60 bg-[oklch(0.1_0.012_60)]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="size-2 animate-pulse rounded-full bg-amber-signal shadow-[0_0_8px_var(--amber-signal)]" />
            <span className="text-typewriter text-[11px] uppercase tracking-[0.35em] text-muted-foreground">
              Arquivo VHS — Dossiê {new Date().getFullYear()}
            </span>
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <>
                <span className="hidden text-typewriter text-[10px] uppercase tracking-[0.3em] text-muted-foreground sm:inline">
                  {user.email}
                </span>
                <button
                  onClick={() => signOut()}
                  className="text-typewriter text-[10px] uppercase tracking-[0.3em] text-muted-foreground hover:text-amber-signal"
                >
                  Sair
                </button>
              </>
            )}
            {back && (
              <Link
                to="/"
                className="text-typewriter text-[11px] uppercase tracking-[0.3em] text-muted-foreground transition-colors hover:text-amber-signal"
              >
                ← Menu Principal
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-10 border-b border-dashed border-border/60 pb-6">
          <p className="text-typewriter text-[10px] uppercase tracking-[0.4em] text-amber-signal/80">
            Caso Aberto
          </p>
          <h1 className="mt-2 text-serif-noir text-5xl font-light text-foreground">{title}</h1>
          {subtitle && (
            <p className="mt-2 text-typewriter text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
