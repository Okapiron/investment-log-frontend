import csv
import json
import re
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
SP500 = HERE / "constituents_sp500.csv"
OUT = HERE.parents[1] / "public" / "us_instruments.json"
META = HERE.parents[1] / "public" / "us_instruments.meta.json"

def norm(s):
    return re.sub(r"\s+", " ", str(s or "").strip())

def read_csv(path: Path):
    if not path.exists():
        raise SystemExit(f"Missing file: {path}")
    with path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    if not rows:
        raise SystemExit(f"No rows: {path}")
    return rows, reader.fieldnames or []

def pick_col(fieldnames, candidates):
    for c in candidates:
        for f in fieldnames:
            if f and f.strip().lower() == c.lower():
                return f
    for c in candidates:
        for f in fieldnames:
            if c.lower() in (f or "").lower():
                return f
    return None

def sanitize_symbol(sym: str) -> str:
    s = norm(sym).upper()
    s = re.sub(r"[^0-9A-Z\\.]", "", s)
    return s

def make_item(symbol, name):
    symbol = sanitize_symbol(symbol)
    name = norm(name)
    if not symbol or not name:
        return None
    aliases = [symbol, name]
    return {
        "market": "US",
        "symbol": symbol,
        "name": name,
        "aliases": aliases,
    }

def main():
    rows, cols = read_csv(SP500)

    col_sym = pick_col(cols, ["Symbol", "Ticker", "symbol", "ticker"])
    col_name = pick_col(cols, ["Security", "Name", "Company", "security"])

    if not (col_sym and col_name):
        raise SystemExit(f"SP500 columns not detected. cols={cols}")

    merged = {}
    for r in rows:
        item = make_item(r.get(col_sym), r.get(col_name))
        if not item:
            continue
        key = item["symbol"]
        if key not in merged:
            merged[key] = item
        else:
            prev = merged[key]
            prev["aliases"] = list(dict.fromkeys(prev["aliases"] + item["aliases"]))
            if len(item["name"]) > len(prev["name"]):
                prev["name"] = item["name"]

    out = sorted(merged.values(), key=lambda x: x["symbol"])

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")

    meta = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "count": len(out),
        "source": SP500.name,
    }
    META.write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")

    print("wrote", OUT, "count=", len(out))
    print("wrote", META, meta)

if __name__ == "__main__":
    main()
