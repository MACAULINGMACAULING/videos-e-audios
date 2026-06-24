import { useEffect, useMemo } from "react";

interface InspectionOverlayProps {
  tokenBlob: Blob;
  name: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Tela de Inspeção de Arquivo.
 *
 * Regra fundamental: o token é exibido EXATAMENTE como o criador o enviou.
 * Nenhuma moldura, etiqueta, caixa ou texto sobreposto é adicionado pelo sistema.
 * A interface existe apenas para dar nome, descrição e ação à evidência.
 */
export function InspectionOverlay({
  tokenBlob,
  name,
  description,
  onConfirm,
  onCancel,
}: InspectionOverlayProps) {
  const url = useMemo(() => URL.createObjectURL(tokenBlob), [tokenBlob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/90 px-4 py-10 backdrop-blur-md animate-fade-in"
      onClick={onCancel}
    >
      <div
        className="flex w-full max-w-3xl flex-col items-center gap-8 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* TOKEN — imagem pura, sem decoração */}
        <img
          src={url}
          alt={name || "evidência"}
          draggable={false}
          className="max-h-[58vh] w-auto max-w-full select-none object-contain drop-shadow-[0_30px_60px_rgba(0,0,0,0.85)] animate-scale-in"
        />

        {/* Área de Informações — começa apenas no título */}
        {(name || description) && (
          <div className="flex w-full max-w-xl flex-col items-center gap-3">
            {name && (
              <h2 className="text-serif-noir text-3xl font-light leading-tight text-foreground md:text-4xl">
                {name}
              </h2>
            )}
            {description && (
              <p className="text-typewriter whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        )}

        {/* Ações */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="text-typewriter border border-border bg-transparent px-7 py-3 text-xs uppercase tracking-[0.35em] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
          >
            Melhor Não
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="text-typewriter border border-amber-signal bg-amber-signal px-9 py-3 text-xs uppercase tracking-[0.35em] text-primary-foreground transition-opacity hover:opacity-90"
          >
            Inserir
          </button>
        </div>
      </div>
    </div>
  );
}
