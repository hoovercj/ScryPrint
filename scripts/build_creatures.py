"""Build creatures.json from AtomicCards.json for the web app.

Usage:
    python scripts/build_creatures.py                     # downloads + builds
    python scripts/build_creatures.py --input local.json  # use local file

Downloads AtomicCards.json from https://mtgjson.com/api/v5/AtomicCards.json
if no --input is specified and the file doesn't exist locally.
"""

import argparse
import json
import os
import urllib.request
from collections import defaultdict
from pathlib import Path

MTGJSON_URL = "https://mtgjson.com/api/v5/AtomicCards.json"
CACHE_PATH = Path(__file__).resolve().parent / "AtomicCards.json"

# Formats that exist in paper Magic
PAPER_FORMATS = {
    "standard", "modern", "legacy", "vintage", "commander", "pauper",
    "pioneer", "penny", "oathbreaker", "oldschool", "premodern", "duel",
    "predh",
}

# Digital-only set codes (non-Y-prefix)
DIGITAL_ONLY_SETS = {"HBG", "J21"}


def download_atomic_cards(dest: Path) -> None:
    if dest.exists():
        size_mb = dest.stat().st_size / 1024 / 1024
        print(f"Using cached {dest} ({size_mb:.0f} MB)")
        return
    print(f"Downloading AtomicCards.json from MTGJSON (~130 MB)...")
    req = urllib.request.Request(MTGJSON_URL, headers={"User-Agent": "ScryPrint/1.0"})
    with urllib.request.urlopen(req) as resp, open(str(dest), "wb") as out:
        while True:
            chunk = resp.read(1024 * 1024)
            if not chunk:
                break
            out.write(chunk)
    size_mb = dest.stat().st_size / 1024 / 1024
    print(f"Downloaded {size_mb:.0f} MB")


def build_creatures(input_path: str, output_path: str) -> dict:
    with open(input_path, encoding="utf-8") as f:
        raw = json.load(f)

    creatures = defaultdict(list)
    skipped_alchemy = 0

    for name, printings in raw["data"].items():
        # Skip Alchemy rebalanced cards (prefixed with "A-")
        if name.startswith("A-"):
            skipped_alchemy += 1
            continue

        card = printings[0]

        # Skip digital-only cards: either legalities are exclusively digital
        # formats, or all printings are from digital-only sets (Y-prefix, HBG, J21)
        legalities = set(card.get("legalities", {}).keys())
        if legalities and not legalities.intersection(PAPER_FORMATS):
            skipped_alchemy += 1
            continue
        card_sets = card.get("printings", [])
        if card_sets and all(
            s.startswith("Y") or s in DIGITAL_ONLY_SETS for s in card_sets
        ):
            skipped_alchemy += 1
            continue
        if "Creature" not in card.get("types", []):
            continue
        mv = int(card.get("manaValue", 0))
        creatures[mv].append({
            "n": card["name"],
            "t": card.get("type", ""),
            "p": card.get("power", ""),
            "h": card.get("toughness", ""),
            "x": card.get("text", ""),
            "m": card.get("manaCost", ""),
            "f": card.get("isFunny", False),
        })

    output = {str(mv): cards for mv, cards in sorted(creatures.items())}

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, separators=(",", ":"), ensure_ascii=False)

    total = sum(len(v) for v in output.values())
    file_size = Path(output_path).stat().st_size
    mv_dist = {mv: len(cards) for mv, cards in sorted(creatures.items())}

    return {
        "total": total,
        "file_size": file_size,
        "mv_distribution": mv_dist,
        "skipped_alchemy": skipped_alchemy,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build creatures.json for the web app")
    parser.add_argument("--input", default=None,
                        help="Path to AtomicCards.json (auto-downloads if omitted)")
    parser.add_argument("--output",
                        default=str(Path(__file__).resolve().parent.parent / "public" / "data" / "creatures.json"),
                        help="Output path for creatures.json")
    args = parser.parse_args()

    input_path = args.input
    if not input_path:
        download_atomic_cards(CACHE_PATH)
        input_path = str(CACHE_PATH)

    print(f"Reading {input_path}...")
    stats = build_creatures(input_path, args.output)
    print(f"Wrote {stats['total']} creatures to {args.output}")
    print(f"File size: {stats['file_size']:,} bytes ({stats['file_size']/1024/1024:.1f} MB)")
    print(f"Skipped {stats['skipped_alchemy']} Alchemy cards")
    print(f"MV distribution: {stats['mv_distribution']}")
    print("MV distribution:")
    for mv, count in stats["mv_distribution"].items():
        print(f"  MV {mv}: {count}")
