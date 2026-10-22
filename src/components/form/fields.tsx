"use client";

/** 캐릭터 만들기 화면에서 쓰는 입력 부품들 */

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-zinc-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 dark:border-zinc-700 dark:bg-zinc-950";

export function Label({ title, hint, count, max }: { title: string; hint?: string; count?: number; max?: number }) {
  return (
    <div className="mb-1.5 flex items-end justify-between gap-2">
      <div>
        <span className="text-sm font-medium">{title}</span>
        {hint && <p className="text-xs text-zinc-500">{hint}</p>}
      </div>
      {max !== undefined && (
        <span className={`shrink-0 text-xs ${count! > max ? "text-red-500" : "text-zinc-400"}`}>
          {count}/{max}
        </span>
      )}
    </div>
  );
}

export function TextInput({
  title,
  hint,
  value,
  onChange,
  max,
  ...rest
}: {
  title: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  max?: number;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <label className="block">
      <Label title={title} hint={hint} count={value.length} max={max} />
      <input {...rest} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />
    </label>
  );
}

export function TextArea({
  title,
  hint,
  value,
  onChange,
  max,
  rows = 4,
  mono,
  ...rest
}: {
  title: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  max?: number;
  rows?: number;
  mono?: boolean;
} & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange">) {
  return (
    <label className="block">
      <Label title={title} hint={hint} count={value.length} max={max} />
      <textarea
        {...rest}
        rows={rows}
        value={value}
        spellCheck={mono ? false : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} resize-y leading-relaxed ${mono ? "font-mono text-xs" : ""}`}
      />
    </label>
  );
}

export function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>}
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

export function ItemCard({ title, onRemove, children }: { title: string; onRemove?: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{title}</span>
        {onRemove && (
          <button type="button" onClick={onRemove} className="rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40">
            삭제
          </button>
        )}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export function AddButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-xl border border-dashed border-zinc-300 py-3 text-sm font-medium text-zinc-600 transition hover:border-red-400 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
    >
      + {children}
    </button>
  );
}

export { inputClass };
