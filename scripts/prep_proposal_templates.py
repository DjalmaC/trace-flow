#!/usr/bin/env python3
# Prep the proposal templates for runtime filling.
#
# For each source template PDF (designed in Gamma, with [Placeholder] tokens),
# this:
#   1. redacts every [...] placeholder + the dashed [company logo] box, WITHOUT
#      painting over the dark background (fill omitted, images kept) — producing
#      a clean "blank" template, and
#   2. emits a manifest JSON capturing each field's exact position / font / size
#      / colour, so the browser can stamp the filled values back in pixel-aligned.
#
# Outputs land in public/proposals/templates/{name}.pdf + {name}.manifest.json,
# consumed by src/flow-tool/lib/proposal.ts.
#
# Requires PyMuPDF:  python3 -m pip install --user PyMuPDF
# Run:               python3 scripts/prep_proposal_templates.py
#
# Re-run whenever a source template changes. Source PDFs live in ~/Documents.

import fitz, json, re, os

OUT = "/Users/diogo/trace-flow/public/proposals/templates"
os.makedirs(OUT, exist_ok=True)
TEMPLATES = {
  "standard": "/Users/diogo/Documents/Trace Finance - Standard proposal (BR) - template.pdf",
  "brazil-market": "/Users/diogo/Documents/Trace Finance - Brazil-market proposal - template.pdf",
}
LOGO_BOX = [79.2, 14.0, 232.0, 48.0]

def hexcol(c): return "#%06x" % (c & 0xFFFFFF)
def font_kind(f): return "bold" if "Bold" in f else "regular"

def classify(text):
    """Map a placeholder span -> (key, template, align). align 'right' anchors at bbox.x1."""
    t = text.strip()
    if t.startswith("Confidential"):
        return ("footer", "Confidential — prepared for {company} · {date}", "left")
    if t == "for [Company]":
        return ("headline", "for {company}", "left")
    if re.match(r"^\[(Representative|Client)\] — \[Company\]$", t):
        return ("repCompany", "{rep} — {company}", "left")
    if t in ("[Month Year]", "[Month, Year]"):
        return ("date", "{date}", "right")
    if t == "[Name]": return ("repName", "{repName}", "left")
    if t == "[Title]": return ("repTitle", "{repTitle}", "left")
    if t == "[Email]": return ("repEmail", "{repEmail}", "left")
    if t == "[Phone]": return ("repPhone", "{repPhone}", "left")
    if t == "[LinkedIn]": return ("repLinkedIn", "{repLinkedIn}", "left")
    if t == "[company logo]": return ("logoLabel", None, None)  # removed; logo image drawn instead
    return (None, None, None)

for name, path in TEMPLATES.items():
    doc = fitz.open(path)
    fields = []
    closing_page = None
    for pno, page in enumerate(doc):
        d = page.get_text("dict")
        for b in d["blocks"]:
            for l in b.get("lines", []):
                for s in l["spans"]:
                    if "[" not in s["text"]: continue
                    key, tmpl, align = classify(s["text"])
                    if key is None:
                        print(f"  !! UNCLASSIFIED p{pno}: {s['text']!r}")
                        continue
                    x0,y0,x1,y1 = s["bbox"]; ox,oy = s["origin"]
                    # redact the glyphs (no fill box, keep background image)
                    page.add_redact_annot(fitz.Rect(x0-1, y0-1, x1+1, y1+1))
                    if key in ("repName","repTitle","repEmail","repPhone","repLinkedIn") and closing_page is None:
                        closing_page = pno
                    if tmpl is not None:
                        fields.append({
                            "key": key, "page": pno, "template": tmpl,
                            "x": round(x1 if align=="right" else ox, 2),
                            "baseline": round(oy, 2),
                            "size": round(s["size"], 2),
                            "color": hexcol(s["color"]),
                            "font": font_kind(s["font"]),
                            "align": align,
                        })
        # remove the dashed logo box on the title page
        if pno == 0:
            page.add_redact_annot(fitz.Rect(*[LOGO_BOX[0]-1, LOGO_BOX[1]-1, LOGO_BOX[2]+1, LOGO_BOX[3]+1]))
        page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE,
                              graphics=fitz.PDF_REDACT_LINE_ART_REMOVE_IF_TOUCHED)
    manifest = {
        "name": name,
        "pageW": 960, "pageH": 540,
        "closingPage": closing_page,
        "flowsInsertAt": closing_page,           # flows inserted right before the closing page
        "logo": {"page": 0, "box": [round(v,2) for v in LOGO_BOX]},
        "fields": fields,
    }
    blank_path = os.path.join(OUT, f"{name}.pdf")
    doc.save(blank_path, garbage=4, deflate=True)
    doc.close()
    with open(os.path.join(OUT, f"{name}.manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"{name}: blanked -> {blank_path} | closing=p{closing_page} flowsInsertAt={closing_page} | {len(fields)} fields")
