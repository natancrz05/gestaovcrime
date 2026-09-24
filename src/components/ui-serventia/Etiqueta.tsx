import { SEVERIDADE_CLASSES, type Severidade } from "@/lib/dominio";
import { cn } from "@/lib/utils";

export function Etiqueta({
  children,
  severidade,
  className,
}: {
  children: React.ReactNode;
  severidade: Severidade;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-5",
        SEVERIDADE_CLASSES[severidade],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
