import React from "react";

/** "+998" prefiksli telefon maydoni — faqat 9 ta raqam kiritish mumkin. */
export function PhoneInput({
  value,
  onChange,
  invalid = false,
  id,
  describedBy,
  className = "mt-1.5",
}: {
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  id?: string;
  describedBy?: string;
  /** Tashqi o'lcham/oraliq (standart — yorliq ostidagi `mt-1.5`). */
  className?: string;
}) {
  const national = (value ?? "").replace(/^\+?998/, "").replace(/\D/g, "").slice(0, 9);

  function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 9);
    onChange(digits ? `+998${digits}` : "");
  }

  return (
    <div
      className={`${className} flex items-stretch overflow-hidden rounded-xl border bg-surface-2 transition-colors focus-within:bg-surface ${
        invalid ? "border-signal" : "border-line focus-within:border-signal"
      }`}
    >
      <span className="flex select-none items-center border-r border-line px-3 text-sm font-medium text-dusk">
        +998
      </span>
      <input
        id={id}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        type="tel"
        inputMode="numeric"
        value={formatNational(national)}
        onChange={handle}
        placeholder="90 123 45 67"
        className="w-full bg-transparent px-3.5 py-2.5 text-sm text-ink placeholder:text-dusk focus:outline-none"
      />
    </div>
  );
}

/** "+998901234567" -> 9 ta raqam to'liq kiritilganini tekshiradi. */
export function isPhoneComplete(value: string): boolean {
  const national = (value ?? "").replace(/^\+?998/, "").replace(/\D/g, "");
  return national.length === 0 || national.length === 9;
}

function formatNational(d: string): string {
  return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(" ");
}
