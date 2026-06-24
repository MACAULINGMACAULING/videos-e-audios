import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { NoirShell } from "@/components/noir-shell";
import { formatLabel, newArchiveId, type ArchiveMeta } from "@/lib/archive/types";
import { deleteArchive, getArchive, listArchives, saveArchive } from "@/lib/archive/db";
import { downloadArchive, exportArchive } from "@/lib/archive/export";
import { getArchiveType } from "@/lib/archive/registry";
import { deleteViewer, listViewers, saveViewer } from "@/lib/archive/viewer-db";
import { readViewerFile } from "@/lib/archive/viewer-export";
import type { CustomViewerMeta } from "@/lib/archive/viewer-types";

export const Route = createFileRoute("/_authenticated/biblioteca")({
  head: () => ({
    meta: [
      { title: "Biblioteca — Archive WEAVER" },
      { name: "description", content: "Gerencie seus arquivos." },
    ],
  }),
  component: Biblioteca,
});

type ViewerListItem = CustomViewerMeta & { publicId: string };

function Biblioteca() {
  const [archives, setArchives] = useState<ArchiveMeta[]>([]);
  const [viewers, setViewers] = useState<ViewerListItem[]>([]);
  const [query, setQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const navigate = useNavigate();
  const viewerImportRef = useRef<HTMLInputElement | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  async function refresh() {
    setArchives(await listArchives());
    setViewers(await listViewers());
  }
  useEffect(() => { void refresh(); }, []);

  async function copyShareLink(publicId: string, id: string) {
    const url = `${window.location.origin}/v/${publicId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1800);
    } catch {
      window.prompt("Copie o link:", url);
    }
  }

  async function handleDeleteViewer(id: string) {
    if (!confirm("Descartar este visualizador permanentemente?")) return;
    await deleteViewer(id);
    await refresh();
  }

  async function handleImportViewer(file: File) {
    setImportError(null);
    try {
      const v = await readViewerFile(file);
      await saveViewer(v);
      await refresh();
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Falha ao importar.");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Descartar este arquivo permanentemente?")) return;
    await deleteArchive(id);
    await refresh();
  }

  async function handleExport(id: string) {
    const t = await getArchive(id);
    if (!t) return;
    const blob = await exportArchive(t);
    downloadArchive(t, blob);
  }

  async function handleDuplicate(id: string) {
    const a = await getArchive(id);
    if (!a) return;
    const copy = { ...a, id: newArchiveId(), name: `${a.name} (cópia)`, createdAt: Date.now(), updatedAt: Date.now() };
    await saveArchive(copy);
    await refresh();
  }

  function editorRouteFor(meta: ArchiveMeta): string | undefined {
    return getArchiveType(meta.kind)?.creatorRoute;
  }

  const filtered = archives.filter((t) =>
    !query || t.name.toLowerCase().includes(query.toLowerCase()) ||
    t.description.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <NoirShell title="Biblioteca" subtitle="Arquivo de todas as evidências registradas.">
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar arquivo..."
          className="flex-1 min-w-[200px] border border-border bg-card/40 px-3 py-2 text-typewriter text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-amber-signal focus:outline-none"
        />
        <Link
          to="/criar"
          className="text-typewriter border border-amber-signal bg-amber-signal px-5 py-2 text-xs uppercase tracking-[0.3em] text-primary-foreground hover:opacity-90"
        >
          + Novo Arquivo
        </Link>
        <Link
          to="/criador/visualizador"
          className="text-typewriter border border-amber-signal/60 px-5 py-2 text-xs uppercase tracking-[0.3em] text-amber-signal hover:bg-amber-signal/10"
        >
          + Novo Visualizador
        </Link>
        <button
          onClick={() => viewerImportRef.current?.click()}
          className="text-typewriter border border-border px-5 py-2 text-xs uppercase tracking-[0.3em] text-muted-foreground hover:border-amber-signal hover:text-amber-signal"
        >
          Importar .viewer
        </button>
        <input
          ref={viewerImportRef}
          type="file"
          accept=".viewer,application/x-archive-weaver-viewer,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleImportViewer(f);
            e.target.value = "";
          }}
        />
      </div>
      {importError && (
        <p className="mb-4 text-typewriter text-xs uppercase tracking-widest text-destructive">{importError}</p>
      )}

      {viewers.length > 0 && (
        <div className="mb-10">
          <h2 className="mb-3 text-typewriter text-[10px] uppercase tracking-[0.4em] text-amber-signal/80">
            Visualizadores
          </h2>
          <div className="grid gap-3">
            {viewers.map((v) => (
              <div
                key={v.id}
                className="group flex flex-wrap items-center justify-between gap-4 border-l-2 border-border bg-card/30 p-4 transition-colors hover:border-amber-signal hover:bg-card/60"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-3">
                    <span className="text-typewriter rounded-sm border border-amber-signal/40 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.25em] text-amber-signal/80">
                      viewer
                    </span>
                    <span className="text-typewriter text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                      {v.accepts.join(" · ")} · {v.resolution}
                    </span>
                    <h3 className="text-serif-noir text-2xl font-light text-foreground">{v.name}</h3>
                  </div>
                  <p className="mt-1 text-typewriter text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                    /v/{v.slug}
                  </p>
                </div>
                <div className="flex gap-2 text-typewriter text-[10px] uppercase tracking-[0.25em]">
                  <button
                    onClick={() => navigate({ to: "/visualizador", search: { viewer: v.id } })}
                    className="border border-amber-signal/60 px-3 py-1.5 text-amber-signal hover:bg-amber-signal/10"
                  >
                    Abrir
                  </button>
                  <button
                    onClick={() => copyShareLink(v.publicId, v.id)}
                    className="border border-border px-3 py-1.5 text-muted-foreground hover:border-amber-signal hover:text-amber-signal"
                    title={`${window.location.origin}/v/${v.publicId}`}
                  >
                    {copiedId === v.id ? "Link copiado ✓" : "Copiar link"}
                  </button>
                  <button
                    onClick={() => navigate({ to: "/criador/visualizador", search: { id: v.id } })}
                    className="border border-border px-3 py-1.5 text-muted-foreground hover:border-amber-signal hover:text-amber-signal"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDeleteViewer(v.id)}
                    className="border border-border px-3 py-1.5 text-muted-foreground hover:border-destructive hover:text-destructive"
                  >
                    Descartar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="border border-dashed border-border bg-card/20 p-12 text-center">
          <p className="text-typewriter text-xs uppercase tracking-[0.4em] text-muted-foreground">
            Nenhum arquivo encontrado
          </p>
          <p className="mt-2 text-serif-noir italic text-muted-foreground">
            O arquivo está vazio. Comece criando uma evidência.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((t) => (
            <div
              key={t.id}
              className="group flex flex-wrap items-center justify-between gap-4 border-l-2 border-border bg-card/30 p-4 transition-colors hover:border-amber-signal hover:bg-card/60"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-3">
                  <span className="text-typewriter rounded-sm border border-amber-signal/40 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.25em] text-amber-signal/80">
                    {t.kind}
                  </span>
                  <span className="text-typewriter text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                    {formatLabel(t.format)} · {new Date(t.updatedAt).toLocaleDateString("pt-BR")}
                  </span>
                  <h3 className="text-serif-noir text-2xl font-light text-foreground">{t.name}</h3>
                </div>
                {t.description && (
                  <p className="mt-1 truncate text-typewriter text-xs text-muted-foreground">
                    {t.description}
                  </p>
                )}
              </div>
              <div className="flex gap-2 text-typewriter text-[10px] uppercase tracking-[0.25em]">
                {editorRouteFor(t) && (
                  <button
                    onClick={() => navigate({ to: editorRouteFor(t)!, search: { id: t.id } })}
                    className="border border-border px-3 py-1.5 text-muted-foreground hover:border-amber-signal hover:text-amber-signal"
                  >
                    Editar
                  </button>
                )}
                <button
                  onClick={() => handleDuplicate(t.id)}
                  className="border border-border px-3 py-1.5 text-muted-foreground hover:border-amber-signal hover:text-amber-signal"
                >
                  Duplicar
                </button>
                <button
                  onClick={() => handleExport(t.id)}
                  className="border border-border px-3 py-1.5 text-muted-foreground hover:border-amber-signal hover:text-amber-signal"
                >
                  Exportar
                </button>
                <button
                  onClick={() => handleDelete(t.id)}
                  className="border border-border px-3 py-1.5 text-muted-foreground hover:border-destructive hover:text-destructive"
                >
                  Descartar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </NoirShell>
  );
}
