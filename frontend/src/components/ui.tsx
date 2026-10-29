import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "soft" | "ghost";
const variants: Record<Variant, string> = {
  primary: "bg-deep text-white hover:bg-[#2b475c] disabled:bg-[#7d93a3]",
  soft: "bg-mist text-deep border border-line hover:bg-[#e1edf4]",
  ghost: "text-deep hover:bg-mist",
};

export function Button({ variant = "primary", className = "", ...rest }: ComponentProps<"button"> & { variant?: Variant }) {
  return (
    <button
      {...rest}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-[0.95rem] font-medium transition-colors disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    />
  );
}

export function Card({ children, className = "", as: Tag = "section", ...rest }: { children: ReactNode; className?: string; as?: "section" | "div" | "article"; "aria-label"?: string; "aria-labelledby"?: string }) {
  return <Tag {...rest} className={`rounded-card border border-line bg-white p-5 shadow-soft sm:p-6 ${className}`}>{children}</Tag>;
}

export function PageTitle({ title, intro }: { title: string; intro?: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight text-deep sm:text-3xl">{title}</h1>
      {intro && <p className="mt-2 max-w-prose text-muted">{intro}</p>}
    </header>
  );
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "care" }) {
  const cls = tone === "care" ? "border-[#e7cfb4] bg-care-bg text-care" : "border-line bg-mist text-ink";
  return <div role={tone === "care" ? "alert" : "note"} className={`rounded-2xl border px-4 py-3 text-sm leading-relaxed ${cls}`}>{children}</div>;
}

/** Choice chip used for single- and multi-select answers. Real buttons so keyboard + screen readers work. */
export function Chip({ selected, onClick, children, role }: { selected: boolean; onClick: () => void; children: ReactNode; role?: "radio" | "checkbox" }) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={role ? selected : undefined}
      aria-pressed={role ? undefined : selected}
      onClick={onClick}
      className={`min-h-11 rounded-full border px-4 py-2 text-left text-[0.95rem] transition-colors ${
        selected ? "border-deep bg-deep text-white" : "border-line bg-white text-ink hover:bg-mist"
      }`}
    >
      {children}
    </button>
  );
}

export function ErrorLine({ message }: { message: string | null }) {
  return message ? <p role="alert" className="mt-3 text-sm font-medium text-care">{message}</p> : null;
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return <p role="status" className="py-8 text-center text-muted">{label}…</p>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-sm text-muted">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-ink placeholder:text-[#7b8b94] focus:border-deep";
