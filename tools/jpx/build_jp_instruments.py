import json
import re
from pathlib import Path
import pandas as pd

HERE = Path(__file__).resolve().parent
SRC = HERE / "東証上場銘柄202602.xls"
OUT = HERE.parents[1] / "public" / "jp_instruments.json"

def norm(s):
    s = "" if s is None else str(s)
    s = s.replace("\u3000", " ").strip()
    s = re.sub(r"\s+", " ", s)
    return s

def strip_company_suffix(name):
    if not name:
        return name
    n = name
    for x in ["株式会社", "（株）", "(株)"]:
        n = n.replace(x, "")
    return n.strip()

def build_aliases(code, name):
    a = []
    if code:
        a.append(code)
        a.append(code.replace("-", ""))
    if name:
        a.append(name)
        a.append(strip_company_suffix(name))
    seen = set()
    out = []
    for x in a:
        x = norm(x)
        if x and x not in seen:
            seen.add(x)
            out.append(x)
    return out

def pick_col(cols, keywords):
    for k in keywords:
        for c in cols:
            if k in str(c):
                return c
    return None

def main():
    if not SRC.exists():
        raise SystemExit(f"Source file not found: {SRC}")

    df = pd.read_excel(SRC)

    cols = list(df.columns)
    col_code = pick_col(cols, ["コード", "銘柄コード", "証券コード"])
    col_name = pick_col(cols, ["銘柄名", "会社名", "名称"])
    col_section = pick_col(cols, ["市場・商品区分", "市場区分", "市場"])

    if col_code is None or col_name is None:
        raise SystemExit(f"Could not detect columns. columns={cols}")

    records = []
    for _, row in df.iterrows():
        code = norm(row.get(col_code))
        name = norm(row.get(col_name))
        if not code or not name:
            continue

        code = str(code).replace(".0", "").upper()
        code = re.sub(r"[^0-9A-Z]", "", code)[:5]

        section = norm(row.get(col_section)) if col_section else ""

        records.append({
            "market": "JP",
            "symbol": code,
            "name": name,
            "aliases": build_aliases(code, name),
            "market_section": section or None,
        })

    uniq = {}
    for r in records:
        if r["symbol"] not in uniq:
            uniq[r["symbol"]] = r

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(list(uniq.values()), ensure_ascii=False), encoding="utf-8")
    print(f"Wrote: {OUT}  count={len(uniq)}")
    print(f"Detected columns: code={col_code} name={col_name} section={col_section}")

if __name__ == "__main__":
    main()
