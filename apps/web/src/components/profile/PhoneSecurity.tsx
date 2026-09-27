import React, { useState } from "react";
import { useT } from "../../lib/i18n/index.js";
import { ApiError } from "../../lib/api.js";
import {
  minutesUntil,
  removeBackupPhone,
  startBackupPhone,
  startPhoneChange,
  unlinkTelegram,
} from "../../lib/auth/recovery.js";
import type { TelegramLink, TelegramStatus } from "../../lib/types.js";
import { PasswordPrompt } from "../auth/PasswordPrompt.js";
import { Button } from "./ui.js";
import { IconPhone, IconRefresh, IconShield, IconTelegram, IconTrash } from "./icons.js";

type Action = "change" | "backup" | "removeBackup" | "unlink";

/**
 * Telefon xavfsizligi bloki — profil Telegram bo'limining ichida (audit R3, D-047, D-048, D-063).
 *
 * Har amal joriy parol bilan tasdiqlanadi; raqam esa faqat Telegram bot orqali
 * tasdiqlanadi — sayt raqamni o'zi o'rnatmaydi. Yangi sahifa yaratilmaydi.
 */
export function PhoneSecurity({
  status,
  token,
  available,
  onChanged,
  onDeepLink,
}: {
  status: TelegramStatus;
  token: string;
  available: boolean;
  onChanged: () => void;
  /** Deep-link ochilganda: foydalanuvchi Telegramdan qaytgach holat yangilansin. */
  onDeepLink?: () => void;
}) {
  const t = useT();
  const s = t.telegram.security;
  const [action, setAction] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<TelegramLink | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /** Server kodini uch tildagi matnga aylantiradi — xom server matni ko'rsatilmaydi. */
  function messageFor(err: unknown): string {
    if (!(err instanceof ApiError)) return t.profileHub.states.saveError;
    // Faqat aniq kod "parol noto'g'ri" deydi: seans tugagan 401 (`UNAUTHORIZED`) ni
    // parol xatosi deb ko'rsatish foydalanuvchini chalg'itadi (audit R3, api-errors-3)
    if (err.code === "INVALID_PASSWORD") return s.wrongPassword;
    if (err.code === "USE_PHONE_CHANGE") return s.usePhoneChange;
    if (err.code === "PHONE_NOT_VERIFIED") return s.needPrimary;
    if (err.code === "TELEGRAM_UNAVAILABLE" || err.status === 503) return t.telegram.unavailable;
    if (err.status === 429) return t.recovery.tooMany;
    return t.profileHub.states.saveError;
  }

  function open(next: Action) {
    setAction(next);
    setError(null);
    setLink(null);
    setNotice(null);
  }

  async function run(password: string) {
    if (!action) return;
    setBusy(true);
    setError(null);
    try {
      if (action === "change") {
        setLink(await startPhoneChange(token, password));
        onDeepLink?.();
      } else if (action === "backup") {
        setLink(await startBackupPhone(token, password));
        onDeepLink?.();
      } else if (action === "removeBackup") {
        await removeBackupPhone(token, password);
        setNotice(s.removed);
        onChanged();
      } else {
        await unlinkTelegram(token, password);
        setNotice(s.unlinked);
        onChanged();
      }
      setAction(null);
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  const hasPrimary = Boolean(status.phoneVerified && status.phone);
  const backup = status.backupPhone ?? null;
  const promptTitle = action === "unlink" ? s.unlink : action === "removeBackup" ? s.removeBackup : s.passwordTitle;

  return (
    <section className="mt-6 rounded-2xl border border-line bg-surface-2/40 p-4 sm:p-5">
      <h3 className="flex items-center gap-2 font-display text-[15px] font-bold text-ink">
        <IconShield size={16} className="text-signal" />
        {s.title}
      </h3>
      <p className="mt-1 text-[13px] leading-relaxed text-dusk">{s.subtitle}</p>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <Row
          icon={<IconPhone size={16} />}
          label={s.primaryLabel}
          value={hasPrimary ? (status.phone as string) : s.primaryNone}
          ok={hasPrimary}
        />
        <Row
          icon={<IconPhone size={16} />}
          label={s.backupLabel}
          value={backup ?? s.backupNone}
          ok={Boolean(backup)}
        />
      </dl>

      <div className="mt-4 flex flex-wrap gap-2.5">
        <Button variant="secondary" size="sm" onClick={() => open("change")} disabled={!hasPrimary || !available}>
          <IconPhone size={15} /> {s.changePhone}
        </Button>
        {backup ? (
          <Button variant="secondary" size="sm" onClick={() => open("removeBackup")}>
            <IconTrash size={15} /> {s.removeBackup}
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => open("backup")}
            disabled={!hasPrimary || !status.linked || !available}
          >
            <IconPhone size={15} /> {s.addBackup}
          </Button>
        )}
        {status.linked && (
          <Button variant="secondary" size="sm" onClick={() => open("unlink")}>
            <IconTelegram size={15} /> {s.unlink}
          </Button>
        )}
      </div>

      <p className="mt-2 text-[12.5px] leading-relaxed text-dusk">
        {!hasPrimary ? s.needPrimary : action === "unlink" ? s.unlinkHint : s.changeHint}
      </p>
      {!backup && hasPrimary && <p className="mt-1 text-[12.5px] leading-relaxed text-dusk">{s.backupHint}</p>}

      {!available && (
        <p role="status" className="mt-3 rounded-xl border border-gold/40 bg-gold/10 px-3.5 py-2.5 text-[13px] text-ink">
          {t.telegram.unavailable}
        </p>
      )}

      {action && (
        <PasswordPrompt
          // Amal almashsa forma qaytadan chiziladi: oldingi amal uchun yozilgan parol
          // qolib ketmaydi va fokus yangi formaga ko'chadi (audit R3, a11y-ui-3)
          key={action}
          title={promptTitle}
          description={action === "change" ? s.changeHint : action === "unlink" ? s.unlinkHint : undefined}
          busy={busy}
          error={error}
          onSubmit={(password) => void run(password)}
          onCancel={() => {
            setAction(null);
            setError(null);
          }}
        />
      )}

      {/* Amal tugadi: natija ekran o'quvchiga ham e'lon qilinadi */}
      {notice && (
        <p role="status" className="mt-3 rounded-xl border border-growth/30 bg-growth/10 px-3.5 py-2.5 text-[13px] font-medium text-growth">
          {notice}
        </p>
      )}
      {!action && error && (
        <p role="alert" className="mt-3 text-[13px] text-danger">
          {error}
        </p>
      )}

      {link && (
        <div role="status" className="mt-3 rounded-2xl border border-line bg-signal-soft px-4 py-3">
          <p className="text-[13px] leading-relaxed text-ink">{s.linkHint}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
            <a
              href={link.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-signal px-4 text-[13.5px] font-semibold text-white transition-colors hover:bg-signal-dark"
            >
              <IconTelegram size={16} /> {s.openTelegram}
            </a>
            {/* Matn «Yangilash»ni bosishni aytadi — tugma shu yerda bo'lsin, aks holda
                bog'langan hisobda u umuman chizilmasdi (audit R3, telegram-5) */}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setLink(null);
                onChanged();
              }}
            >
              <IconRefresh size={15} /> {t.telegram.refresh}
            </Button>
          </div>
          {minutesUntil(link.expiresAt) !== null && (
            <p className="mt-2 text-[12.5px] text-ink/70">
              {t.recovery.expiresIn(minutesUntil(link.expiresAt) as number)}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function Row({
  icon,
  label,
  value,
  ok,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3.5 py-2.5">
      <dt className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-dusk">
        <span className="text-dusk" aria-hidden>
          {icon}
        </span>
        {label}
      </dt>
      <dd className={`mt-1 text-[14px] font-semibold ${ok ? "text-ink" : "text-dusk"}`}>{value}</dd>
    </div>
  );
}
