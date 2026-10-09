#!/usr/bin/env python3
"""Prepare Midjourney prompts and import browser-downloaded originals.

No credentials or unofficial API: generation stays in Midjourney's browser UI.
Usage:
  python3 scripts/midjourney-references.py prepare references/batches/example.json
  python3 scripts/midjourney-references.py import references/batches/example.json

Manifest: {"date": "YYYY-MM-DD", "sets": [{"folder": "Category/Name",
"prompt": "...", "job": "Midjourney job UUID", "downloads": [four local paths]}]}.
The downloads array is ordered by Midjourney image index 0, 1, 2, 3.
Optional selected: [1, 4] imports only visually reviewed images (one-based).
Optional review: text records accepted uses and rejected defects.
Use a new folder for revisions. Existing different files are never overwritten.
"""
import argparse
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "references"


def write_once(path, content):
    if path.exists():
        if path.read_text() != content:
            raise ValueError(f"Refusing to overwrite {path}; use a new revision folder")
    else:
        path.write_text(content)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["prepare", "import"])
    parser.add_argument("manifest", type=Path)
    args = parser.parse_args()
    data = json.loads(args.manifest.read_text())
    for item in data["sets"]:
        dest = (ROOT / item["folder"]).resolve()
        if not dest.is_relative_to(ROOT.resolve()) or dest == ROOT.resolve():
            raise ValueError("Reference folders must be below references/")
        dest.mkdir(parents=True, exist_ok=True)
        write_once(dest / "prompt.txt", item["prompt"].strip() + "\n")
        if args.action == "prepare":
            print(f"\n{item['folder']}\n{item['prompt']}\n")
            continue
        sources = [Path(p).expanduser() for p in item["downloads"]]
        if len(sources) != 4:
            raise ValueError(f"Expected four originals for {item['folder']}")
        selected = item.get("selected", [1, 2, 3, 4])
        if not selected or len(set(selected)) != len(selected) or any(type(n) is not int or n not in range(1, 5) for n in selected):
            raise ValueError("selected must contain unique image numbers from 1 to 4")
        for n, source in enumerate(sources, 1):
            if n not in selected:
                continue
            if not source.is_file() or source.read_bytes()[:3] != b"\xff\xd8\xff":
                raise ValueError(f"Not a JPEG original: {source}")
            target = dest / f"reference-{n}.jpeg"
            if target.exists():
                if target.read_bytes() != source.read_bytes():
                    raise ValueError(f"Refusing to overwrite {target}")
            else:
                shutil.copyfile(source, target)
        write_once(dest / "source.txt", f"https://www.midjourney.com/jobs/{item['job']}\n")
        if item.get("review"):
            write_once(dest / "review.txt", item["review"].strip() + "\n")
        print(f"Imported {len(selected)} reviewed originals: {dest.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
