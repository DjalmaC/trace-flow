"use client";
import { useRef, useState } from "react";
import { loadRepKey } from "@/flow-tool/lib/rep-session";

// Logo drop zone. Four ways in, all landing as a data URL (so the logo travels
// with the shared link): click to browse, drop a local file, PASTE an image or
// image URL, and — the workflow win — drag an image straight from another
// website tab (the browser hands us its URL; /api/logo-fetch proxies the bytes
// past CORS with the rep key).

export function LogoDrop({
  onImage,
  hasLogo,
  inputTestId,
  compact,
}: {
  onImage: (dataUrl: string) => void | Promise<void>;
  hasLogo?: boolean;
  /** Keeps automation contracts (e.g. logo-lab's [data-testid=logo-file]). */
  inputTestId?: string;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function readFile(file: File) {
    setErr(null);
    const reader = new FileReader();
    reader.onload = () => void onImage(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function fromUrl(url: string) {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/logo-fetch?url=${encodeURIComponent(url)}`, {
        headers: { "x-tf-key": loadRepKey() ?? "" },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `fetch failed (${res.status})`);
      }
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onload = () => void onImage(String(reader.result));
      reader.readAsDataURL(blob);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not fetch that image.");
    } finally {
      setBusy(false);
    }
  }

  /** An image dragged from another tab arrives as a URL, not a file. */
  function urlFromDataTransfer(dt: DataTransfer): string | null {
    const uri = dt.getData("text/uri-list").split("\n").find((l) => l && !l.startsWith("#"));
    if (uri && /^https?:\/\//i.test(uri.trim())) return uri.trim();
    const html = dt.getData("text/html");
    const src = html?.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
    if (src && /^https?:\/\//i.test(src)) return src.replace(/&amp;/g, "&");
    const text = dt.getData("text/plain").trim();
    if (/^https?:\/\/\S+$/i.test(text)) return text;
    return null;
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) return readFile(file);
    const url = urlFromDataTransfer(e.dataTransfer);
    if (url) return void fromUrl(url);
    setErr("Drop an image or an image link.");
  }

  function onPaste(e: React.ClipboardEvent) {
    const item = [...e.clipboardData.items].find((i) => i.type.startsWith("image/"));
    const file = item?.getAsFile();
    if (file) return readFile(file);
    const text = e.clipboardData.getData("text/plain").trim();
    if (/^https?:\/\/\S+$/i.test(text)) return void fromUrl(text);
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Add company logo"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        onPaste={onPaste}
        data-testid="logo-drop"
        className={`flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed text-center outline-none transition duration-150 ease-ds ${
          compact ? "px-3 py-3" : "px-4 py-5"
        } ${over ? "border-mint bg-mint/10" : "border-node-stroke bg-node-fill/40 hover:border-mint/50"}`}
      >
        <span className={`font-medium ${compact ? "text-[11.5px]" : "text-xs"} ${over ? "text-mint" : "text-subtitle"}`}>
          {busy ? "Fetching image…" : hasLogo ? "Drop to replace the logo" : "Drop the company logo here"}
        </span>
        <span className={`mt-0.5 ${compact ? "text-[10px]" : "text-[10.5px]"} text-muted`}>
          drag it straight from their site, paste, or click to browse
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          data-testid={inputTestId}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) readFile(f);
            e.target.value = "";
          }}
          className="hidden"
        />
      </div>
      {err && (
        <p className="mt-1.5 text-[10.5px] text-[#d99a9a]" role="alert">
          {err}
        </p>
      )}
    </div>
  );
}
