"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** One file input styled as a button; posts the file through a server action and refreshes on success. */
export function FileUploadButton({ label, action, accept = ".pdf,.png,.jpg,.jpeg,.webp,.zip" }: { label: string; action: (form: FormData) => Promise<{ ok: true } | { ok: false; error: string }>; accept?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-start gap-2">
      <label className="inline-flex h-9 cursor-pointer items-center rounded-md border border-input bg-card px-3 text-sm font-medium focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring [@media(hover:hover)]:hover:border-muted-foreground [@media(hover:hover)]:hover:bg-muted">
        {busy ? "Uploading" : label}
        <input
          type="file"
          aria-label={label}
          className="sr-only"
          accept={accept}
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            setError(null);
            const form = new FormData();
            form.set("file", file);
            const r = await action(form).catch(() => ({ ok: false as const, error: "Upload failed. Check your connection and try again." }));
            setBusy(false);
            if (r.ok) router.refresh();
            else setError(r.error);
          }}
        />
      </label>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
