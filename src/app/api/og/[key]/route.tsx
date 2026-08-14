import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { admin, findShareRow } from "@/flow-tool/lib/supabase-server";
import { nameFromSlug } from "@/flow-tool/lib/share-meta";

// Social-preview card for a shared proposal (WhatsApp / iMessage / Slack
// unfurl): the site's own silk-dark backdrop with the Trace wordmark on top,
// an × divider, and the client's logo beneath — stacked vertically so any
// logo aspect ratio fits its slot untouched (contain, never stretched).
// Anonymous by design, like the link itself: the unguessable code/slug is the
// privacy model, and the card only shows what the opened link already shows
// (client name + logo). Unknown keys render the generic Trace card, so a
// crawler never learns whether a link exists.
export const dynamic = "force-dynamic";

const W = 1200;
const H = 630;

// Rendered by satori, which only follows data:/http(s): image sources. Stored
// logos are data URIs (LogoDrop) or https (logo-fetch); anything else is
// dropped and the card falls back to the client's name.
function safeLogoSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("data:image/")) return url;
  if (url.startsWith("https://")) return url;
  return null;
}

// The client-name fallback must fit one line at any length ("VIX" … "Arqu
// Argentina Holdings"), so the size steps down as the name grows.
function nameFontSize(name: string): number {
  if (name.length <= 12) return 72;
  if (name.length <= 20) return 58;
  if (name.length <= 30) return 46;
  return 36;
}

// Intrinsic pixel size of a stored logo (PNG / JPEG / SVG data URIs — what
// LogoDrop and logo-fetch produce), so the logo's slot can match its true
// aspect ratio: wide wordmarks fill the width, square marks stay square, and
// the white plate hugs the logo instead of letterboxing it. Unknown formats
// return null and fall back to a generic contain box.
function imageDims(url: string): { w: number; h: number } | null {
  const m = url.match(/^data:image\/([a-z0-9+.-]+);base64,(.+)$/i);
  if (!m) return null;
  try {
    const kind = m[1].toLowerCase();
    const buf = Buffer.from(m[2], "base64");
    if (kind === "png" && buf.length > 24) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    if (kind === "jpeg" || kind === "jpg") {
      let i = 2;
      while (i + 9 < buf.length) {
        if (buf[i] !== 0xff) break;
        const marker = buf[i + 1];
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc)
          return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
        i += 2 + buf.readUInt16BE(i + 2);
      }
      return null;
    }
    if (kind === "svg+xml") {
      const svg = buf.toString("utf8");
      const vb = svg.match(/viewBox\s*=\s*["']\s*[\d.-]+[\s,]+[\d.-]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
      if (vb) return { w: parseFloat(vb[1]), h: parseFloat(vb[2]) };
      const wm = svg.match(/\bwidth\s*=\s*["']([\d.]+)/i);
      const hm = svg.match(/\bheight\s*=\s*["']([\d.]+)/i);
      if (wm && hm) return { w: parseFloat(wm[1]), h: parseFloat(hm[1]) };
    }
  } catch {
    /* fall through */
  }
  return null;
}

// Scale intrinsic dims to fit a max box, never upscaling past 2.5× (a tiny
// favicon-sized logo blown up to 700px would only showcase its pixels).
function fitBox(dims: { w: number; h: number } | null, maxW: number, maxH: number): { w: number; h: number } {
  if (!dims || dims.w <= 0 || dims.h <= 0) return { w: maxW, h: maxH };
  const scale = Math.min(maxW / dims.w, maxH / dims.h, 2.5);
  return { w: Math.round(dims.w * scale), h: Math.round(dims.h * scale) };
}

export async function GET(req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;

  let clientName: string | null = null;
  let logoUrl: string | null = null;
  let logoPlate: "light" | "none" | null = null;
  try {
    const sb = admin();
    if (sb) {
      const { data } = await findShareRow(
        sb,
        "client_name, slug:config->>slug, logo:config->>clientLogoUrl, plate:config->>clientLogoPlate",
        key,
      );
      if (data) {
        const row = data as { client_name?: string | null; slug?: string | null; logo?: string | null; plate?: string | null };
        clientName = row.client_name?.trim() || nameFromSlug(row.slug ?? key) || nameFromSlug(key);
        logoUrl = safeLogoSrc(row.logo);
        logoPlate = row.plate === "light" ? "light" : "none";
      }
    }
  } catch {
    /* generic card */
  }

  const pub = (...p: string[]) => readFile(path.join(process.cwd(), "public", ...p));
  const [silk, traceLogo, inter600, inter700] = await Promise.all([
    pub("assets", "bg", "silk.jpg"),
    pub("assets", "trace-logo-white.svg"),
    pub("fonts", "inter-600.ttf"),
    pub("fonts", "inter-700.ttf"),
  ]);
  const silkSrc = `data:image/jpeg;base64,${silk.toString("base64")}`;
  const traceSrc = `data:image/svg+xml;base64,${traceLogo.toString("base64")}`;

  const hasClient = !!(logoUrl || clientName);

  const card = (
    <div style={{ width: W, height: H, display: "flex", position: "relative", backgroundColor: "#07090b", fontFamily: "Inter" }}>
      {/* the site's own backdrop: silk plate + dark wash + green glow (Glass.tsx) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={silkSrc} width={W} height={H} style={{ position: "absolute", top: 0, left: 0, objectFit: "cover" }} alt="" />
      <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, background: "linear-gradient(rgba(2,4,7,.38), rgba(2,4,7,.6))" }} />
      <div
        style={{
          position: "absolute",
          right: -140,
          top: -100,
          width: 760,
          height: 640,
          background: "radial-gradient(circle at center, rgba(21,57,45,.55) 0%, rgba(21,57,45,0) 62%)",
        }}
      />
      {/* the 3px mint→cyan strip every page carries (scaled for the card) */}
      <div style={{ position: "absolute", top: 0, left: 0, width: W, height: 6, background: "linear-gradient(90deg,#2be8d6,#00f2b1)" }} />

      {/* stacked lockup: Trace on top, client beneath — each in a fixed slot */}
      <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingBottom: 26 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={traceSrc} width={322} height={42} alt="" />

        {hasClient && (
          <div style={{ display: "flex", alignItems: "center", marginTop: 44, marginBottom: 40 }}>
            <div style={{ width: 72, height: 1, background: "rgba(255,255,255,.14)" }} />
            <div style={{ display: "flex", fontSize: 34, fontWeight: 600, color: "#5f7a6e", margin: "0 26px", lineHeight: 1 }}>×</div>
            <div style={{ width: 72, height: 1, background: "rgba(255,255,255,.14)" }} />
          </div>
        )}

        {hasClient && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 760, height: 190 }}>
            {logoUrl && logoPlate === "light" ? (
              // dark-on-light logo: the same white plate the deck uses,
              // hugging the logo's true aspect ratio
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "#ffffff", borderRadius: 20, padding: "24px 40px" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} {...fitBox(imageDims(logoUrl), 540, 116)} style={{ objectFit: "contain" }} alt="" />
              </div>
            ) : logoUrl ? (
              // treated (white / transparent) logo straight on the silk
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} {...fitBox(imageDims(logoUrl), 680, 180)} style={{ objectFit: "contain" }} alt="" />
            ) : (
              <div style={{ display: "flex", fontSize: nameFontSize(clientName!), fontWeight: 700, color: "#eef1ee", letterSpacing: "-0.01em", textAlign: "center" }}>
                {clientName}
              </div>
            )}
          </div>
        )}

        {!hasClient && (
          <div style={{ display: "flex", marginTop: 46, fontSize: 17, fontWeight: 600, letterSpacing: "0.34em", color: "#6f8a7f" }}>
            FUNDS FLOW PRESENTATION
          </div>
        )}
      </div>

      {hasClient && (
        <div style={{ position: "absolute", bottom: 40, left: 0, width: W, display: "flex", justifyContent: "center", fontSize: 15, fontWeight: 600, letterSpacing: "0.34em", color: "#6f8a7f" }}>
          FUNDS FLOW PRESENTATION
        </div>
      )}
    </div>
  );

  const png = new ImageResponse(card, {
    width: W,
    height: H,
    fonts: [
      { name: "Inter", data: inter600, weight: 600, style: "normal" },
      { name: "Inter", data: inter700, weight: 700, style: "normal" },
    ],
  });

  // WhatsApp is picky about preview weight (~300KB guidance); the satori PNG
  // of the silk backdrop runs 350-470KB, so recompress to JPEG (~10× smaller,
  // and the card is opaque anyway). If sharp ever fails, ship the PNG.
  const cache = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";
  try {
    const { default: sharp } = await import("sharp");
    const jpeg = await sharp(Buffer.from(await png.arrayBuffer())).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
    return new Response(new Uint8Array(jpeg), {
      headers: { "content-type": "image/jpeg", "cache-control": cache },
    });
  } catch {
    return new Response(await png.arrayBuffer(), {
      headers: { "content-type": "image/png", "cache-control": cache },
    });
  }
}
