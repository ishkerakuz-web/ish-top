import React, { useRef, useState } from "react";
import { useLocale, useT } from "../../../lib/i18n/index.js";
import { COVER_MAX_BYTES, COVER_TYPES } from "../../../lib/articles/editing.js";
import { articleCoverUrl } from "../../../lib/articles/adapter.js";
import { uploadArticleCover } from "../../../lib/admin/articles.js";
import { errorText } from "../../../lib/admin/useNotice.js";
import { ADMIN_SECONDARY } from "../AdminStates.js";
import { IconUpload, Spinner } from "../icons.js";

/**
 * Muqova (ixtiyoriy): mavjud yuklash tizimi (`/uploads`) orqali. Fayl bazaga
 * base64 bo'lib yozilmaydi — maqolada faqat manzil saqlanadi.
 */
export function CoverField({
  value,
  onChange,
  disabled,
  token,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  disabled: boolean;
  token: string | null;
}) {
  const e = useT().contentAdmin.editor;
  const f = e.fields;
  const { locale } = useLocale();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const src = articleCoverUrl(value);

  const onFile = async (file: File) => {
    if (!COVER_TYPES.includes(file.type)) return setError(e.errors.coverType);
    if (file.size > COVER_MAX_BYTES) return setError(e.errors.coverSize);
    setError(null);
    setUploading(true);
    try {
      const { url } = await uploadArticleCover(token ?? "", file);
      onChange(url);
    } catch (err) {
      setError(errorText(err, e.errors.generic, locale));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div>
      {src ? (
        <div className="overflow-hidden rounded-xl border border-line bg-surface-2">
          <img src={src} alt={f.cover} data-testid="cover-preview" className="aspect-[16/10] w-full object-cover" />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled || uploading || !token}
          className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line bg-surface-2 text-sm font-semibold text-dusk transition-colors hover:border-signal/40 hover:text-signal disabled:cursor-not-allowed disabled:opacity-60"
        >
          {uploading ? <Spinner size={20} /> : <IconUpload size={22} />}
          {uploading ? f.coverUploading : f.coverUpload}
        </button>
      )}
      {src && !disabled && (
        <div className="mt-2.5 flex gap-2">
          <button type="button" className={`${ADMIN_SECONDARY} h-9 flex-1`} onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading && <Spinner size={14} />}
            {uploading ? f.coverUploading : f.coverReplace}
          </button>
          <button type="button" className={`${ADMIN_SECONDARY} h-9`} onClick={() => onChange(null)} disabled={uploading}>
            {f.coverRemove}
          </button>
        </div>
      )}
      <p className="mt-2 text-xs text-dusk">{f.coverHint}</p>
      {error && (
        <p role="alert" className="mt-1 text-xs font-medium text-danger">
          {error}
        </p>
      )}
      <input
        ref={fileRef}
        type="file"
        accept={COVER_TYPES.join(",")}
        className="hidden"
        tabIndex={-1}
        aria-hidden
        data-testid="cover-input"
        onChange={(ev) => {
          const file = ev.target.files?.[0];
          if (file) void onFile(file);
        }}
      />
    </div>
  );
}
