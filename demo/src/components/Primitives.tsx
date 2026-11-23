/** Hairline-bordered surface. Every card in the studio is one of these. */
export const Panel: React.FC<
  {
    children: React.ReactNode;
    className?: string;
  } & React.HTMLAttributes<HTMLDivElement>
> = ({ children, className, ...rest }) => (
  <div
    className={`rounded-panel border border-line bg-ink-2 ${className}`}
    {...rest}
  >
    {children}
  </div>
);
/** Small caps rule that titles a panel or a page section. */
export const Label: React.FC<{
  children: React.ReactNode;
  className?: string;
  tone?: "dim" | "signal";
}> = ({ children, className, tone = "dim" }) => (
  <span
    className={`font-mono text-[10px] uppercase tracking-[0.18em] ${tone === "signal" ? "text-signal" : "text-dim"} ${className}`}
  >
    {children}
  </span>
);
export const PanelHead: React.FC<{
  title: string;
  meta?: React.ReactNode;
  children?: React.ReactNode;
}> = ({ title, meta, children }) => (
  <div className="flex min-h-11 items-center justify-between gap-3 border-b border-line px-4 py-2.5">
    <Label>{title}</Label>
    {children ??
      (meta ? (
        <span className="font-mono text-[10px] text-dim">{meta}</span>
      ) : null)}
  </div>
);
/** Inset field row used inside the controls panel. */
export const Field: React.FC<{
  label: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ label, meta, children, className }) => (
  <div
    className={`border-b border-line px-4 py-4 last:border-b-0 ${className}`}
  >
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <Label>{label}</Label>
      {meta ? (
        <span className="font-mono text-[10px] text-dim">{meta}</span>
      ) : null}
    </div>
    {children}
  </div>
);
/* ----------------------------------------------------------------- controls */
type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";
const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "border-signal bg-signal text-[#140a06] hover:bg-[#f2653c]",
  secondary:
    "border-line-2 bg-ink-3 text-paper hover:border-dim hover:bg-[#221e19]",
  quiet: "border-transparent bg-transparent text-muted hover:text-paper",
  danger:
    "border-signal/50 bg-signal/10 text-signal hover:bg-signal/20 hover:text-[#ff8f70]",
};
export const Button: React.FC<
  {
    variant?: ButtonVariant;
    className?: string;
  } & React.ButtonHTMLAttributes<HTMLButtonElement>
> = ({ variant = "secondary", className, type = "button", ...rest }) => (
  <button
    type={type}
    className={`inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-control border px-3 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors duration-150 cursor-pointer disabled:pointer-events-none disabled:opacity-40 ${BUTTON_VARIANTS[variant]} ${className}`}
    {...rest}
  />
);
export interface SegmentedOption<T> {
  value: T;
  label: React.ReactNode;
  title?: string;
}
/**
 * Chip group with a pressed state. `inverse` is the toolbar look (paper on ink);
 * `accent` marks a numeric value that drives the encoder.
 */
export function Segmented<T extends string | number | undefined>({
  label,
  value,
  options,
  onChange,
  tone = "inverse",
  className,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<SegmentedOption<T>>;
  // NoInfer: T comes from `value`/`options`, so a state setter (which also
  // accepts SetStateAction) still matches `(value: T) => void`.
  onChange: (value: NoInfer<T>) => void;
  tone?: "inverse" | "accent";
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`flex flex-wrap items-center gap-1.5 ${className}`}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={selected}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-control border px-2.5 font-mono text-[10px] uppercase tracking-widest transition-colors duration-150 ${
              selected
                ? tone === "inverse"
                  ? "border-paper bg-paper text-ink"
                  : "border-signal/70 bg-signal/15 text-signal"
                : "border-line bg-transparent text-muted hover:border-line-2 hover:text-paper"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
/** Native checkbox row: one control, no hand-rolled switch markup. */
export const Toggle: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description: string;
  disabled?: boolean;
  icon: React.ReactNode;
}> = ({ checked, onChange, label, description, disabled, icon }) => (
  <label
    className={`flex items-start gap-3 px-4 py-3 transition-colors duration-150 ${
      disabled
        ? "cursor-not-allowed opacity-45"
        : "cursor-pointer hover:bg-ink-3"
    }`}
  >
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      className="mt-0.5 size-4 shrink-0 cursor-[inherit] rounded-xs"
    />
    <span className="min-w-0 flex-1">
      <span className="flex items-center gap-2 text-[12.5px] font-medium text-paper">
        <span aria-hidden="true" className="text-dim">
          {icon}
        </span>
        {label}
      </span>
      <span className="mt-0.5 block text-[11px] leading-snug text-dim">
        {description}
      </span>
    </span>
  </label>
);
/* ------------------------------------------------------------------- readout */
export const Readout: React.FC<{
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
  tone?: "paper" | "good" | "warn" | "signal";
  icon?: React.ReactNode;
}> = ({ label, value, note, tone = "paper", icon }) => (
  <div className="min-w-0 px-4 py-3">
    <div className="flex items-center gap-1.5">
      {icon ? (
        <span aria-hidden="true" className="text-dim">
          {icon}
        </span>
      ) : null}
      <Label className="truncate">{label}</Label>
    </div>
    <div
      className={`mt-1.5 truncate font-mono text-[15px] tabular-nums tracking-tight ${tone === "good" && "text-good"} ${tone === "warn" && "text-warn"} ${tone === "signal" && "text-signal"} ${tone === "paper" && "text-paper"}`}
    >
      {value}
    </div>
    {note ? (
      <div className="mt-0.5 truncate font-mono text-[10px] text-dim">
        {note}
      </div>
    ) : null}
  </div>
);
const NOTE_TONES = {
  neutral: "border-line-2 bg-ink-3 text-muted",
  warn: "border-warn/60 bg-warn/[0.06] text-warn",
  good: "border-good/60 bg-good/[0.06] text-good",
} as const;
/** Margin note: a left rule instead of a rounded alert bubble. */
export const Note: React.FC<
  {
    children: React.ReactNode;
    tone?: keyof typeof NOTE_TONES;
  } & React.HTMLAttributes<HTMLDivElement>
> = ({ children, tone = "neutral", className, ...rest }) => (
  <div
    className={`border-l-2 px-3 py-2 text-[11px] leading-relaxed ${NOTE_TONES[tone]} ${className}`}
    {...rest}
  >
    {children}
  </div>
);
