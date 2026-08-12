#!/usr/bin/env python3
# Prep the proposal templates for runtime filling — v2, single unified source.
#
# The August 2026 deck ("Trace Finance Proposal (BR)") is the design for BOTH
# proposal types. From that one source this script produces:
#
#   brazil-market : all 7 pages (title · 5 product pages · closing), plus an
#                   appended BLANK CANVAS page (the wavy background + header +
#                   lockup, card stripped) that the runtime copies whenever a
#                   product page must be re-rendered (edited / added cards).
#   standard      : 3 pages — title · blank canvas · closing. The pricing page
#                   is ALWAYS live-rendered onto the canvas at build time (the
#                   two standard cards: Pix API + FX spread).
#
# For each output it also emits a manifest JSON with every fill field's exact
# position / font / size / colour, consumed by src/flow-tool/lib/proposal.ts.
# Placeholders and baked-in personal values (the source deck ships with real
# contact details and a literal date) are redacted WITHOUT painting over the
# background (fill omitted, images kept).
#
# Requires PyMuPDF:  python3 -m pip install --user PyMuPDF
# Run:               python3 scripts/prep_proposal_templates.py
#
# Re-run whenever the source deck changes. Source PDF lives in ~/Documents.

import fitz, json, os, re

SRC = "/Users/diogo/Documents/Trace Finance - Unified proposal (BR) - template.pdf"
OUT = "/Users/diogo/trace-flow/public/proposals/templates"
os.makedirs(OUT, exist_ok=True)

LOGO_BOX = [79.2, 14.0, 232.0, 48.0]
CLOSING_SRC_PAGE = 6

def hexcol(c): return "#%06x" % (c & 0xFFFFFF)
def font_kind(f): return "bold" if "Bold" in f else "regular"

# ── classification ───────────────────────────────────────────────────────────
# Maps a span -> (key, template, align) | (key, None, None) = redact only.
# The source bakes REAL values (a date, Diogo's contact block), so matching is
# positional/textual rather than [placeholder]-only.
def classify(text, pno):
    t = text.strip()
    if t.startswith("Confidential"):
        return ("footer", "Confidential — prepared for {company} · {date}", "left")
    if re.match(r"^\[(Representative|Client)\] — \[Company\]$", t):
        return ("repCompany", "{rep} — {company}", "left")
    if pno == 0:
        if t == "Prepared for":
            return ("preparedForLabel", None, None)  # redacted; proposal.ts redraws it
        if re.match(r"^[A-Z][a-z]+ \d{4}$", t):
            return ("date", "{date}", "right")
        if t.startswith("Tier-based pricing"):
            return ("corridor", "{corridorLine}", "left")
    if pno == CLOSING_SRC_PAGE:
        # The baked contact block (the source ships Diogo's real details) ->
        # generic rep fields for the FALLBACK closing (reps with a slidePage
        # get their pre-designed slide instead). Four source rows: EMAIL /
        # WHATSAPP / PHONE (US) / LINKEDIN. The roster has one phone field, so
        # the phone stamps into the WhatsApp row (relabelled "PHONE"), the
        # PHONE (US) row is dropped, and LinkedIn keeps its own row. Labels
        # stamp only when the rep has the value (resolved in proposal.ts).
        if t == "Diogo Cassinelli": return ("repName", "{repName}", "left")
        if t == "Business Development Manager": return ("repTitle", "{repTitle}", "left")
        # section labels become conditional overlays too, so a proposal with NO
        # assigned representative ships a clean closing (no orphan labels)
        if t == "YOUR POINT OF CONTACT": return ("contactLabel", "{contactLabel}", "left")
        if t == "EMAIL": return ("emailLabel", "{repEmailLabel}", "left")
        if "@trace.finance" in t: return ("repEmail", "{repEmail}", "left")
        if t == "WHATSAPP": return ("phoneLabel", "{repPhoneLabel}", "left")
        if re.match(r"^\+55 ", t): return ("repPhone", "{repPhone}", "left")
        if t == "PHONE (US)": return ("phoneUsLabel", None, None)  # redact only
        if re.match(r"^\+1 ", t): return ("phoneUsValue", None, None)  # redact only
        if t == "LINKEDIN": return ("linkedinLabel", "{repLinkedInLabel}", "left")
        if t.startswith("linkedin.com/"): return ("repLinkedIn", "{repLinkedIn}", "left")
    return (None, None, None)

# ── pass 1: common redaction over the whole source ───────────────────────────
doc = fitz.open(SRC)
if doc.page_count != 7:
    raise SystemExit(f"expected the 7-page unified deck, got {doc.page_count} pages")

fields = []
for pno, page in enumerate(doc):
    d = page.get_text("dict")
    for b in d["blocks"]:
        for l in b.get("lines", []):
            for s in l["spans"]:
                key, tmpl, align = classify(s["text"], pno)
                if key is None:
                    if "[" in s["text"]:
                        print(f"  !! UNCLASSIFIED p{pno}: {s['text']!r}")
                    continue
                x0, y0, x1, y1 = s["bbox"]; ox, oy = s["origin"]
                page.add_redact_annot(fitz.Rect(x0 - 1, y0 - 1, x1 + 1, y1 + 1))
                if tmpl is not None:
                    fields.append({
                        "key": key, "page": pno, "template": tmpl,
                        "x": round(x1 if align == "right" else ox, 2),
                        "baseline": round(oy, 2),
                        "size": round(s["size"], 2),
                        "color": hexcol(s["color"]),
                        "font": font_kind(s["font"]),
                        "align": align,
                    })
    page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE,
                          graphics=fitz.PDF_REDACT_LINE_ART_REMOVE_IF_TOUCHED)

for want in ("repCompany", "date", "corridor", "footer", "repName", "repEmail"):
    if not any(f["key"] == want for f in fields):
        raise SystemExit(f"missing expected field {want!r} — source layout changed?")

# ── pass 2: the blank canvas page (from product page 1) ─────────────────────
# Keep: wavy background, top rule, flag, "Brazil", top-right wordmark, lockup.
# Strip: the glass card image, its bullet marks, all card text + vector lines,
# the green product subtitle. Footer is already redacted by pass 1.
blank = fitz.open()
blank.insert_pdf(doc, from_page=1, to_page=1)
bp = blank[0]
CARD_REGION = fitz.Rect(150, 100, 810, 450)
for img in bp.get_images(full=True):
    xref = img[0]
    try:
        bbox = bp.get_image_bbox(img)
    except ValueError:
        continue
    if CARD_REGION.contains(bbox):
        bp.delete_image(xref)
# card text + badge + divider/row lines, and the product subtitle
bp.add_redact_annot(CARD_REGION)
bp.add_redact_annot(fitz.Rect(105, 68, 620, 90))
bp.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE,
                    graphics=fitz.PDF_REDACT_LINE_ART_REMOVE_IF_TOUCHED)
leftover = [s["text"] for b in bp.get_text("dict")["blocks"] for l in b.get("lines", []) for s in l["spans"]]
print("blank canvas keeps:", leftover)

FOOTER_STYLE = next(f for f in fields if f["key"] == "footer")

# ── brazil-market: cleaned 7 pages + the blank canvas appended ──────────────
bm = fitz.open()
bm.insert_pdf(doc)
bm.insert_pdf(blank)
bm_manifest = {
    "name": "brazil-market",
    "pageW": 960, "pageH": 540,
    "closingPage": CLOSING_SRC_PAGE,
    "flowsInsertAt": CLOSING_SRC_PAGE,
    "pricingPage": None,
    "pricingCardPages": {"nonres": 1, "pixinc": 2, "onramp": 3, "offramp": 4, "pixout": 5},
    "blankPage": 7,
    "logo": {"page": 0, "box": [round(v, 2) for v in LOGO_BOX]},
    "fields": fields,
}
bm.save(os.path.join(OUT, "brazil-market.pdf"), garbage=4, deflate=True)
with open(os.path.join(OUT, "brazil-market.manifest.json"), "w") as f:
    json.dump(bm_manifest, f, indent=2)
print(f"brazil-market: {bm.page_count} pages | closing=p6 blank=p7 | {len(fields)} fields")

# ── standard: title · blank canvas · closing ─────────────────────────────────
std = fitz.open()
std.insert_pdf(doc, from_page=0, to_page=0)
std.insert_pdf(blank)
std.insert_pdf(doc, from_page=CLOSING_SRC_PAGE, to_page=CLOSING_SRC_PAGE)
std_fields = [dict(f) for f in fields if f["page"] == 0]
std_fields.append({**FOOTER_STYLE, "page": 1})
std_fields += [{**f, "page": 2} for f in fields if f["page"] == CLOSING_SRC_PAGE]
std_manifest = {
    "name": "standard",
    "pageW": 960, "pageH": 540,
    "closingPage": 2,
    "flowsInsertAt": 2,
    # the canvas the runtime ALWAYS draws the live-rendered pricing page onto
    "pricingPage": 1,
    "logo": {"page": 0, "box": [round(v, 2) for v in LOGO_BOX]},
    "fields": std_fields,
}
std.save(os.path.join(OUT, "standard.pdf"), garbage=4, deflate=True)
with open(os.path.join(OUT, "standard.manifest.json"), "w") as f:
    json.dump(std_manifest, f, indent=2)
print(f"standard: {std.page_count} pages | closing=p2 pricing=p1 | {len(std_fields)} fields")
