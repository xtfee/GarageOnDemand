"""
Post-process the pptx written by pptxgenjs to:

1. Fix the XML element order in presentation.xml (pptxgenjs 4.x emits
   <p:notesMasterIdLst> in the wrong position, which makes PowerPoint
   show a "Repair" dialog).

2. Add a Morph slide transition to every slide, with a fade fallback for
   older PowerPoint versions.

3. Rename the G logo oval + text on every slide to "GLogo" / "GLogoText"
   so Morph identifies them as the same element across slides and animates
   their size/position smoothly.

Usage:  python fix_pptx.py GarageOnDemand.pptx
"""
import sys
import re
import shutil
import zipfile
from pathlib import Path


# ── 1) presentation.xml element order ────────────────────────────────
def fix_presentation_xml(xml: str) -> str:
    m = re.search(
        r'(<p:notesMasterIdLst[^>]*/>|<p:notesMasterIdLst>.*?</p:notesMasterIdLst>)',
        xml,
    )
    if not m:
        return xml
    notes_block = m.group(0)
    xml = xml[: m.start()] + xml[m.end():]
    cut = re.search(r'</p:sldMasterIdLst>', xml)
    if not cut:
        return xml
    return xml[: cut.end()] + notes_block + xml[cut.end():]


# ── 2) Slide transition injection ────────────────────────────────────
# Morph transition wrapped in mc:AlternateContent so older PowerPoint
# (no morph support) falls back to a fade.
P14_NS = "http://schemas.microsoft.com/office/powerpoint/2010/main"
P159_NS = "http://schemas.microsoft.com/office/powerpoint/2015/09/main"
MC_NS = "http://schemas.openxmlformats.org/markup-compatibility/2006"

TRANSITION_BLOCK = (
    f'<mc:AlternateContent xmlns:mc="{MC_NS}">'
    f'<mc:Choice xmlns:p159="{P159_NS}" Requires="p159">'
    f'<p:transition xmlns:p14="{P14_NS}" spd="med" p14:dur="1200">'
    f'<p159:morph option="byObject"/>'
    f'</p:transition>'
    f'</mc:Choice>'
    f'<mc:Fallback>'
    f'<p:transition xmlns:p14="{P14_NS}" spd="med" p14:dur="800">'
    f'<p:fade/>'
    f'</p:transition>'
    f'</mc:Fallback>'
    f'</mc:AlternateContent>'
)


# ── 3) G-logo shape tagging ──────────────────────────────────────────
# pptxgenjs emits shapes with generic names ("Oval 5", "TextBox 6"). We
# look for the oval that the build-script positioned at the top-left
# corner (x ≤ 1 inch, y ≤ 1 inch, square within 0.3–1.2 in) — or the bigger
# hero badges on the title / thank-you slides — and rename those shapes
# plus the matching "G" text run that follows.

EMU = 914400  # 1 inch
LOGO_X_MAX = int(1.2 * EMU)
LOGO_Y_MAX = int(1.6 * EMU)
LOGO_SIZE_MIN = int(0.25 * EMU)
LOGO_SIZE_MAX = int(1.4 * EMU)

# Match a complete <p:sp>...</p:sp> shape. pptxgenjs writes both self-closed
# and explicitly-closed <p:cNvPr> forms, so we capture the whole shape body
# and inspect it with separate regexes per attribute.
SP_PATTERN = re.compile(r'<p:sp>(.*?)</p:sp>', re.DOTALL)
NAME_RE = re.compile(r'<p:cNvPr\s+id="\d+"\s+name="([^"]+)"')
OFF_RE = re.compile(r'<a:off x="(-?\d+)" y="(-?\d+)"/>')
EXT_RE = re.compile(r'<a:ext cx="(\d+)" cy="(\d+)"/>')


def rename_logo_shapes(slide_xml: str) -> str:
    """Find the G logo oval (small square in top-left corner with ellipse
    preset geometry) and the "G" text overlay; give both the same name on
    every slide so Morph treats them as the same object."""

    def repl(m: re.Match) -> str:
        body = m.group(1)
        n = NAME_RE.search(body)
        off = OFF_RE.search(body)
        ext = EXT_RE.search(body)
        if not (n and off and ext):
            return m.group(0)

        old_name = n.group(1)
        x, y = int(off.group(1)), int(off.group(2))
        cx, cy = int(ext.group(1)), int(ext.group(2))

        # Filter to top-left, roughly square, in size band
        if abs(cx - cy) > int(0.05 * EMU):
            return m.group(0)
        if cx < LOGO_SIZE_MIN or cx > LOGO_SIZE_MAX:
            return m.group(0)
        if x < 0 or x > LOGO_X_MAX:
            return m.group(0)
        if y < 0 or y > LOGO_Y_MAX:
            return m.group(0)

        is_oval = 'prst="ellipse"' in body
        has_g_text = '<a:t>G</a:t>' in body

        if is_oval and not has_g_text:
            new_name = "GLogo"
        elif has_g_text:
            new_name = "GLogoText"
        else:
            return m.group(0)

        new_body = body.replace(f'name="{old_name}"', f'name="{new_name}"', 1)
        return f'<p:sp>{new_body}</p:sp>'

    return SP_PATTERN.sub(repl, slide_xml)


def add_transition(slide_xml: str) -> str:
    """Inject a Morph (fallback: fade) transition right after </p:cSld>."""
    if '<p:transition' in slide_xml or '<mc:AlternateContent' in slide_xml:
        return slide_xml
    return slide_xml.replace('</p:cSld>', '</p:cSld>' + TRANSITION_BLOCK, 1)


# ── Main ─────────────────────────────────────────────────────────────
def repack(src: Path):
    tmp_path = src.with_suffix(".tmp.pptx")
    with zipfile.ZipFile(src, "r") as zin, zipfile.ZipFile(
        tmp_path, "w", zipfile.ZIP_DEFLATED
    ) as zout:
        for info in zin.infolist():
            data = zin.read(info.filename)
            if info.filename == "ppt/presentation.xml":
                data = fix_presentation_xml(data.decode("utf-8")).encode("utf-8")
            elif info.filename.startswith("ppt/slides/slide") and info.filename.endswith(".xml"):
                xml = data.decode("utf-8")
                xml = rename_logo_shapes(xml)
                xml = add_transition(xml)
                data = xml.encode("utf-8")
            zout.writestr(info, data)
    shutil.move(tmp_path, src)


if __name__ == "__main__":
    target = Path(sys.argv[1] if len(sys.argv) > 1 else "GarageOnDemand.pptx")
    if not target.exists():
        sys.exit(f"File not found: {target}")
    repack(target)
    print(f"Fixed {target}")
