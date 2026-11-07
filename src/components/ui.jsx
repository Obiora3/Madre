// Small shared UI kit. Every screen builds from these so styling lives in one place.

const cx = (...parts) => parts.filter(Boolean).join(" ");

const buttonVariants = {
  primary: "bg-accent text-accent-ink hover:opacity-90",
  secondary: "bg-surface text-ink border border-line hover:bg-surface-2",
  ghost: "text-muted hover:bg-surface-2 hover:text-ink",
  danger: "bg-danger text-white hover:opacity-90",
};

export function Button({ variant = "primary", size = "md", className, loading, disabled, children, ...props }) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4",
        buttonVariants[variant],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}

export function Field({ label, hint, error, children }) {
  return (
    <label className="block space-y-1.5">
      {label && <span className="block text-xs font-medium text-muted">{label}</span>}
      {children}
      {hint && !error && <span className="block text-xs text-faint">{hint}</span>}
      {error && <span className="block text-xs text-danger">{error}</span>}
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-line bg-surface px-3 text-ink placeholder:text-faint focus:border-accent focus:outline-none";

export function Input({ className, ...props }) {
  return <input className={cx(inputClass, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }) {
  return <textarea className={cx(inputClass, "py-2", className)} rows={3} {...props} />;
}

export function Select({ className, children, ...props }) {
  return (
    <select className={cx(inputClass, "h-10", className)} {...props}>
      {children}
    </select>
  );
}

export function Card({ className, children }) {
  return <div className={cx("rounded-xl border border-line bg-surface", className)}>{children}</div>;
}

export function Spinner({ className = "size-5" }) {
  return (
    <svg className={cx("animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function FullPageSpinner() {
  return (
    <div className="flex h-full items-center justify-center text-muted">
      <Spinner className="size-6" />
    </div>
  );
}

export function ErrorText({ error }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
      {error.message ?? String(error)}
    </p>
  );
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line px-6 py-16 text-center">
      <p className="font-semibold">{title}</p>
      {children && <p className="mt-1 max-w-sm text-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

const avatarColours = ["#4f46e5", "#0891b2", "#d97706", "#db2777", "#059669", "#7c3aed", "#dc2626"];

export function Avatar({ name = "?", src, size = 28 }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";
  const colour = avatarColours[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % avatarColours.length];
  const style = { width: size, height: size, fontSize: size * 0.4 };
  if (src) return <img src={src} alt={name} title={name} style={style} className="shrink-0 rounded-full object-cover" />;
  return (
    <span
      title={name}
      style={{ ...style, background: colour }}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
    >
      {initials}
    </span>
  );
}

// The Madre mark: an "M" with three connected nodes.
export function Logo({ withWordmark = true, className }) {
  return (
    <span className={cx("inline-flex items-center gap-2 text-brand", className)}>
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden="true">
        <path
          d="M5 25V10a4 4 0 0 1 6.9-2.8L16 12l4.1-4.8A4 4 0 0 1 27 10v15"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M10.5 19.5 16 24l5.5-4.5" fill="none" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.5" />
        <circle cx="10.5" cy="19.5" r="2.4" fill="#7c5cff" />
        <circle cx="16" cy="24" r="2.4" fill="#f59e0b" />
        <circle cx="21.5" cy="19.5" r="2.4" fill="#06b6d4" />
      </svg>
      {withWordmark && <span className="text-lg font-bold tracking-tight">Madre</span>}
    </span>
  );
}
