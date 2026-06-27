export type LogoPlate = "light" | "none";

// ─────────────────────────────────────────────────────────────────────────────
// Logo normalization for the dark proposal canvas (deterministic, no AI).
//
// Two jobs: (1) cut the logo out of its background, (2) recolor the mark ONLY
// when it's monochrome AND wouldn't read against the dark page. Multi-colour
// brand logos are never flattened — they keep their colours and, if too dark,
// ride a light "chip" (plate: "light") instead.
//
// Flat / already-transparent backgrounds are handled here with pure image
// processing. A busy/photographic/gradient background (high border variance)
// can't be keyed in-browser, so we skip the cut and fall back to a light chip.
// ─────────────────────────────────────────────────────────────────────────────

export interface NormalizeResult {
  /** Processed (or original, on fallback) PNG data URL. */
  url: string;
  /** Recommended backdrop for the dark deck. */
  plate: LogoPlate;
  /** A monochrome low-contrast mark was repainted to the light target. */
  recolored: boolean;
  /** A connected background was keyed out. */
  cut: boolean;
  /** Background was too busy to key in-browser (kept on a light chip). */
  needsModel: boolean;
}

const lum1 = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** Fraction of pixels that are meaningfully transparent (already-cut sources). */
function transparentShare(d: Uint8ClampedArray): number {
  let t = 0;
  const n = d.length / 4;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 200) t++;
  return n ? t / n : 0;
}

/** Median background colour + luminance std of a 2px border ring. High std means
 *  a busy/gradient background that flood fill can't handle. */
function borderStats(d: Uint8ClampedArray, w: number, h: number, ring = 2) {
  const rs: number[] = [], gs: number[] = [], bs: number[] = [];
  const push = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    if (d[i + 3] < 24) return;
    rs.push(d[i]); gs.push(d[i + 1]); bs.push(d[i + 2]);
  };
  for (let x = 0; x < w; x++) for (let r = 0; r < ring; r++) { push(x, r); push(x, h - 1 - r); }
  for (let y = 0; y < h; y++) for (let r = 0; r < ring; r++) { push(r, y); push(w - 1 - r, y); }
  if (!rs.length) return null;
  const med = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
  const lums = rs.map((_, i) => lum1(rs[i], gs[i], bs[i]));
  const mean = lums.reduce((a, b) => a + b, 0) / lums.length;
  const std = Math.sqrt(lums.reduce((a, b) => a + (b - mean) ** 2, 0) / lums.length);
  return { bg: [med(rs), med(gs), med(bs)] as [number, number, number], std };
}

/** Edge-connected flood fill: clear background that touches a border AND is
 *  within tolerance, with a feathered ramp. Returns kept-pixel count. */
function floodCutout(d: Uint8ClampedArray, w: number, h: number, bg: [number, number, number], tol: number) {
  const TOL_NEAR = tol;
  const TOL_FAR = tol * 2.3;
  const dist = (i: number) => {
    const dr = d[i] - bg[0], dg = d[i + 1] - bg[1], db = d[i + 2] - bg[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
  };
  const isBg = (i: number) => d[i + 3] < 24 || dist(i) < TOL_FAR;
  const mask = new Uint8Array(w * h);
  const stack: number[] = [];
  const pushIf = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (mask[p] || !isBg(p * 4)) return;
    mask[p] = 1; stack.push(p);
  };
  for (let x = 0; x < w; x++) { pushIf(x, 0); pushIf(x, h - 1); }
  for (let y = 0; y < h; y++) { pushIf(0, y); pushIf(w - 1, y); }
  while (stack.length) {
    const p = stack.pop() as number;
    const x = p % w, y = (p - x) / w;
    pushIf(x - 1, y); pushIf(x + 1, y); pushIf(x, y - 1); pushIf(x, y + 1);
  }
  let kept = 0;
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    if (mask[p]) {
      const dd = d[i + 3] < 24 ? 0 : dist(i);
      const t = dd <= TOL_NEAR ? 0 : (dd - TOL_NEAR) / (TOL_FAR - TOL_NEAR);
      d[i + 3] = Math.round(d[i + 3] * Math.min(1, t));
    }
    if (d[i + 3] > 16) kept++;
  }
  return kept;
}

/** Mean HSV saturation + median luminance of the opaque pixels (subsampled). */
function markStats(d: Uint8ClampedArray) {
  let satSum = 0, n = 0;
  const lums: number[] = [];
  const step = Math.max(4, Math.floor(d.length / 4 / 50000)) * 4; // cap samples
  for (let i = 0; i < d.length; i += step) {
    if (d[i + 3] <= 128) continue;
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    satSum += mx === 0 ? 0 : (mx - mn) / mx;
    lums.push(lum1(r, g, b));
    n++;
  }
  if (!n) return { meanSat: 0, medLum: 255, count: 0 };
  lums.sort((a, b) => a - b);
  return { meanSat: satSum / n, medLum: lums[lums.length >> 1], count: n };
}

function bbox(d: Uint8ClampedArray, w: number, h: number) {
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let p = 0; p < w * h; p++) {
    if (d[p * 4 + 3] > 16) {
      const x = p % w, y = (p - (p % w)) / w;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  return maxX < 0 ? null : { minX, minY, maxX, maxY };
}

/**
 * Normalize an uploaded logo for the dark deck: cut its background (when flat or
 * already transparent) and repaint it to a light target only when it's a
 * monochrome mark that would otherwise vanish on the page. Returns the processed
 * PNG + the recommended plate. On any failure it returns the original untouched.
 */
export async function normalizeLogo(
  src: string,
  opts: { recolor?: [number, number, number]; pageBg?: [number, number, number] } = {},
): Promise<NormalizeResult> {
  const orig = (extra?: Partial<NormalizeResult>): NormalizeResult => ({
    url: src, plate: "none", recolored: false, cut: false, needsModel: false, ...extra,
  });
  if (typeof document === "undefined") return orig();
  const recolor = opts.recolor ?? [255, 255, 255];
  const pageBg = opts.pageBg ?? [13, 24, 20]; // dark-green proposal canvas

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const MAX = 1400;
        const scale = Math.min(1, MAX / Math.max(img.width || 1, img.height || 1));
        const w = Math.max(1, Math.round((img.width || 1) * scale));
        const h = Math.max(1, Math.round((img.height || 1) * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve(orig());
        ctx.drawImage(img, 0, 0, w, h);
        const image = ctx.getImageData(0, 0, w, h);
        const d = image.data;

        // 1) background ----------------------------------------------------
        let cut = false, needsModel = false;
        if (transparentShare(d) < 0.02) {
          const stats = borderStats(d, w, h);
          if (stats && stats.std <= 22) {
            const before = d.slice(); // so we can revert a degenerate cut
            const kept = floodCutout(d, w, h, stats.bg, 48);
            const total = w * h;
            if (kept === 0 || kept > total * 0.985 || kept < total * 0.004) {
              d.set(before); // ate the whole logo or did nothing → keep pixels
            } else {
              cut = true;
            }
          } else {
            needsModel = true; // busy/gradient bg — can't key in-browser
          }
        }

        // 2) recolor decision (opaque pixels only) -------------------------
        const { meanSat, medLum, count } = markStats(d);
        let recolored = false;
        let plate: LogoPlate = "none";
        if (count > 0) {
          const mono = meanSat < 0.15;
          const lowContrast = Math.abs(medLum - lum1(pageBg[0], pageBg[1], pageBg[2])) < 55;
          if (needsModel) {
            // couldn't isolate the mark → don't repaint; ride a chip if dark
            plate = medLum < 110 ? "light" : "none";
          } else if (mono && lowContrast) {
            for (let i = 0; i < d.length; i += 4) {
              if (d[i + 3] > 0) { d[i] = recolor[0]; d[i + 1] = recolor[1]; d[i + 2] = recolor[2]; }
            }
            recolored = true; // keep alpha → crisp anti-aliased edges
          } else if (!mono && medLum < 90) {
            plate = "light"; // dark multi-colour brand mark → light chip
          }
        }

        // 3) trim + export -------------------------------------------------
        ctx.putImageData(image, 0, 0);
        const box = (cut || transparentShare(d) > 0.02) ? bbox(d, w, h) : null;
        if (box) {
          const pad = Math.round(Math.max(w, h) * 0.02);
          const minX = Math.max(0, box.minX - pad), minY = Math.max(0, box.minY - pad);
          const maxX = Math.min(w - 1, box.maxX + pad), maxY = Math.min(h - 1, box.maxY + pad);
          const cw = maxX - minX + 1, ch = maxY - minY + 1;
          const out = document.createElement("canvas");
          out.width = cw; out.height = ch;
          const octx = out.getContext("2d");
          if (!octx) return resolve(orig({ plate, recolored, cut, needsModel }));
          octx.drawImage(canvas, minX, minY, cw, ch, 0, 0, cw, ch);
          return resolve({ url: out.toDataURL("image/png"), plate, recolored, cut, needsModel });
        }
        resolve({ url: canvas.toDataURL("image/png"), plate, recolored, cut, needsModel });
      } catch {
        resolve(orig());
      }
    };
    img.onerror = () => resolve(orig());
    img.src = src;
  });
}

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
