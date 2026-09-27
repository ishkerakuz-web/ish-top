import React, { useRef, useState } from "react";
import { useT } from "../../lib/i18n/index.js";
import { deleteResumeFile, uploadResumeFile } from "../../lib/api.js";
import { openProtectedFile, ownResumeFileUrl } from "../../lib/files/resume.js";
import { Button, Spinner } from "./ui.js";
import { IconEye, IconFile, IconRefresh, IconTrash, IconUpload } from "./icons.js";

const MAX_BYTES = 5 * 1024 * 1024;

/** PDF rezyume biriktirish (`POST/DELETE /api/profile/resume`). Sudrab tashlash ham ishlaydi. */
export function ResumeFile({
  token,
  resumeUrl,
  onChange,
}: {
  token: string;
  resumeUrl: string | null;
  onChange: (url: string | null) => void;
}) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "remove" | "open" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  async function upload(file: File | undefined) {
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError(t.profile.onlyPdf);
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(t.profileHub.resume.fileTooBig);
      return;
    }
    setError(null);
    setBusy("upload");
    try {
      onChange(await uploadResumeFile(token, file));
    } catch (err) {
      setError(err instanceof Error && err.message !== "Xatolik" ? err.message : t.profile.uploadError);
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  /**
   * Fayl endi ochiq `/uploads/...` manzilida emas — Bearer token bilan olinadi
   * va yangi oynada ochiladi (audit R3, D-058).
   */
  async function openFile() {
    setError(null);
    setBusy("open");
    try {
      await openProtectedFile(ownResumeFileUrl(), token);
    } catch {
      setError(t.profileHub.states.loadError);
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setError(null);
    setBusy("remove");
    try {
      await deleteResumeFile(token);
      onChange(null);
    } catch {
      setError(t.profileHub.states.saveError);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <p className="text-[13px] font-semibold text-ink">{t.profileHub.resume.fileTitle}</p>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => void upload(e.target.files?.[0])}
      />

      {resumeUrl ? (
        <div className="mt-2 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-danger/10 text-danger" aria-hidden>
            <IconFile size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold text-ink">{t.profile.resumeSection} · PDF</p>
            <p className="text-xs text-dusk">{t.profile.resumeHint}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => void openFile()}
              disabled={busy !== null}
              aria-busy={busy === "open" || undefined}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold text-signal transition-colors hover:bg-signal-soft disabled:opacity-60"
            >
              {busy === "open" ? <Spinner className="h-[15px] w-[15px]" /> : <IconEye size={15} />} {t.profile.view}
            </button>
            <Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()} loading={busy === "upload"}>
              {busy !== "upload" && <IconRefresh size={15} />} {t.profile.replace}
            </Button>
            <Button variant="danger" size="sm" onClick={() => void remove()} loading={busy === "remove"} aria-label={t.profile.remove}>
              {busy !== "remove" && <IconTrash size={15} />}
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void upload(e.dataTransfer.files?.[0]);
          }}
          disabled={busy !== null}
          className={`mt-2 flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-5 py-6 text-center transition-colors ${
            dragging ? "border-signal bg-signal-soft" : "border-line bg-surface-2/40 hover:border-signal/50 hover:bg-signal-soft/50"
          }`}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface text-signal shadow-xs ring-1 ring-line">
            {busy === "upload" ? <Spinner className="h-5 w-5" /> : <IconUpload size={20} />}
          </span>
          <span className="text-[14px] font-semibold text-ink">{busy === "upload" ? t.profile.uploading : t.profile.upload}</span>
          <span className="text-xs text-dusk">
            {t.profileHub.resume.fileEmpty} {t.profile.resumeHint}
          </span>
        </button>
      )}

      {error && (
        <p className="mt-2 text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
