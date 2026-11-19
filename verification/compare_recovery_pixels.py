"""Compare photographs of c8e5db2 and the recovery candidate at matched poses."""
import json
import sys
from pathlib import Path
from PIL import Image, ImageChops, ImageStat

root = Path(sys.argv[1])
captures = json.loads((root / "captures.json").read_text())
results = {}
issues = []
for key, original in captures["shots"]["base"].items():
    candidate = captures["shots"]["candidate"][key]
    before = Image.open(root / original["file"]).convert("RGB")
    after = Image.open(root / candidate["file"]).convert("RGB")
    assert before.size == after.size
    diff = ImageChops.difference(before, after)
    channels = diff.split()
    peak = ImageChops.lighter(ImageChops.lighter(channels[0], channels[1]), channels[2])
    hist = peak.histogram()
    mean = sum(ImageStat.Stat(diff).mean) / 3
    strong = sum(hist[9:]) / (before.width * before.height)
    box = peak.getbbox()
    results[key] = {"exact": box is None, "mean_absolute_rgb_0_255": mean,
                    "fraction_over_8": strong, "difference_box": box}
    # Only small rasterization roundoff is admissible in completed-board frames.
    # Require bit-identical rendering in placement teaching and before the first deposit.
    if ((key.startswith("placement-") or original["simulationSeconds"] < 42) and box is not None
            or mean > 0.03 or strong > 0.0005):
        issues.append(key)
    if key.startswith("terminal-"):
        # Bound large isolated changes, e.g. a missing chip, that could be diluted by the floor.
        local = max((ImageStat.Stat(peak.crop((x, y, min(x+24,before.width), min(y+24,before.height)))).mean[0]
                     for y in range(0,before.height,24) for x in range(0,before.width,24)), default=0)
        results[key]["max_tile_mean_max_channel_24px"] = local
        if local > 2:
            issues.append(key)
report = {"width": captures["width"], "shots": results, "exact":sum(row["exact"] for row in results.values()),
          "total":len(results), "violations": sorted(set(issues))}
(root / "pixel-comparison.json").write_text(json.dumps(report,indent=2)+"\n")
print("Matched screenshots", report["exact"], "exact /", report["total"], "violations", report["violations"])
assert not issues
