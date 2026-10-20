"""Create a small visual review sheet from synthetic browser-test captures."""
from pathlib import Path
from PIL import Image, ImageDraw
import base64
files=[("Light / racing","dreamspec-home-light.png"),("Dark / racing","dreamspec-home-dark.png"),("Goals","dreamspec-goals.png"),("Mobile","dreamspec-home-mobile.png")]
sheet=Image.new("RGB",(1280,1040),"#cbd3dc")
draw=ImageDraw.Draw(sheet)
for i,(label,name) in enumerate(files):
    x=(i%2)*640
    y=(i//2)*520
    draw.text((x+16,y+10),label,fill="#102035")
    p=Path("/tmp")/name
    if not p.exists(): continue
    im=Image.open(p).convert("RGB")
    im.thumbnail((616,476))
    sheet.paste(im,(x+12,y+32))
out=Path("/tmp/dreamspec-review.webp")
sheet.save(out,format="WEBP",quality=70)
print("DS_VISUAL_PREVIEW:"+base64.b64encode(out.read_bytes()).decode())
