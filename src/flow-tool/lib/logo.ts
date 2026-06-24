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
