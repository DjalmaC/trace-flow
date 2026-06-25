export type LogoPlate = "light" | "none";

// Decide whether an uploaded logo needs a light backing card to be legible on
// the dark deck. We sample the opaque pixels' mean luminance: a dark logo
// (low luminance) gets a "light" card; a light/white logo stays on the deck.
export async function detectLogoPlate(src: string): Promise<LogoPlate> {
  if (typeof document === "undefined") return "none";
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const max = 96;
        const scale = Math.min(1, max / Math.max(img.width || 1, img.height || 1));
        const w = Math.max(1, Math.round((img.width || 1) * scale));
        const h = Math.max(1, Math.round((img.height || 1) * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve("none");
        ctx.drawImage(img, 0, 0, w, h);
        const { data } = ctx.getImageData(0, 0, w, h);
        let lum = 0;
        let n = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 24) continue; // ignore (near-)transparent pixels
          lum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
          n++;
        }
        if (n === 0) return resolve("none");
        resolve(lum / n < 0.5 ? "light" : "none");
      } catch {
        resolve("none"); // tainted/other failure → leave as-is
      }
    };
    img.onerror = () => resolve("none");
    img.src = src;
  });
}

// Strip a solid/near-solid background from an uploaded logo, in-browser.
// We seed the background colour from the image's opaque corners, then flood-fill
// inward from the borders, clearing every connected pixel within tolerance. A
// ramp between TOL_NEAR..TOL_FAR anti-aliases the cut edge so it isn't jagged.
// Finally we trim to the remaining opaque bounding box so the cutout fills its
// block. Returns a transparent PNG data URL, or null if there's no clear
// background to remove (so the caller can keep the original).
export async function removeBackground(src: string): Promise<string | null> {
  if (typeof document === "undefined") return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const MAX = 1400;
        const scale = Math.min(1, MAX / Math.max(img.width || 1, img.height || 1));
        const w = Math.max(1, Math.round((img.width || 1) * scale));
        const h = Math.max(1, Math.round((img.height || 1) * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, w, h);
        const image = ctx.getImageData(0, 0, w, h);
        const d = image.data;

        // seed the background colour from the four opaque corners
        const corners = [
          [0, 0],
          [w - 1, 0],
          [0, h - 1],
          [w - 1, h - 1],
        ];
        let sr = 0, sg = 0, sb = 0, sc = 0;
        for (const [cx, cy] of corners) {
          const i = (cy * w + cx) * 4;
          if (d[i + 3] < 24) continue;
          sr += d[i]; sg += d[i + 1]; sb += d[i + 2]; sc++;
        }
        const br = sc ? sr / sc : 255;
        const bgc = sc ? sg / sc : 255;
        const bb = sc ? sb / sc : 255;

        const TOL_NEAR = 46; // < this from bg → fully transparent
        const TOL_FAR = 112; // > this → kept (part of the logo)
        const dist = (i: number) => {
          const dr = d[i] - br, dg = d[i + 1] - bgc, db = d[i + 2] - bb;
          return Math.sqrt(dr * dr + dg * dg + db * db);
        };
        const isBg = (i: number) => d[i + 3] < 24 || dist(i) < TOL_FAR;

        // flood-fill the connected background inward from every border pixel
        const mask = new Uint8Array(w * h);
        const stack: number[] = [];
        const pushIf = (x: number, y: number) => {
          if (x < 0 || y < 0 || x >= w || y >= h) return;
          const p = y * w + x;
          if (mask[p] || !isBg(p * 4)) return;
          mask[p] = 1;
          stack.push(p);
        };
        for (let x = 0; x < w; x++) { pushIf(x, 0); pushIf(x, h - 1); }
        for (let y = 0; y < h; y++) { pushIf(0, y); pushIf(w - 1, y); }
        while (stack.length) {
          const p = stack.pop() as number;
          const x = p % w, y = (p - x) / w;
          pushIf(x - 1, y); pushIf(x + 1, y); pushIf(x, y - 1); pushIf(x, y + 1);
        }

        // clear the flooded background with a soft edge; track the kept bounds
        let kept = 0;
        let minX = w, minY = h, maxX = -1, maxY = -1;
        for (let p = 0; p < w * h; p++) {
          const i = p * 4;
          if (mask[p]) {
            const dd = d[i + 3] < 24 ? 0 : dist(i);
            const t = dd <= TOL_NEAR ? 0 : (dd - TOL_NEAR) / (TOL_FAR - TOL_NEAR);
            d[i + 3] = Math.round(d[i + 3] * Math.min(1, t));
          }
          if (d[i + 3] > 16) {
            kept++;
            const x = p % w, y = (p - (p % w)) / w;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }

        // bail if there was no clear background (nothing removed) or it ate the
        // whole image (logo ~ same colour as background) → keep the original
        const total = w * h;
        if (kept === 0 || kept > total * 0.985 || kept < total * 0.002) return resolve(null);

        // trim to the opaque bounding box (+ a little padding)
        const pad = Math.round(Math.max(w, h) * 0.02);
        minX = Math.max(0, minX - pad);
        minY = Math.max(0, minY - pad);
        maxX = Math.min(w - 1, maxX + pad);
        maxY = Math.min(h - 1, maxY + pad);
        const cw = maxX - minX + 1, ch = maxY - minY + 1;
        ctx.putImageData(image, 0, 0);
        const out = document.createElement("canvas");
        out.width = cw;
        out.height = ch;
        const octx = out.getContext("2d");
        if (!octx) return resolve(null);
        octx.drawImage(canvas, minX, minY, cw, ch, 0, 0, cw, ch);
        resolve(out.toDataURL("image/png"));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
