import json
import re
from pathlib import Path
from datetime import datetime

import pandas as pd

try:
    from fugashi import Tagger
    _TAGGER = Tagger()
except Exception:
    _TAGGER = None

HERE = Path(__file__).resolve().parent
SRC = HERE / "東証上場銘柄202602.xls"
OUT = HERE.parents[1] / "public" / "jp_instruments.json"
META = HERE.parents[1] / "public" / "jp_instruments.meta.json"

def norm(s):
    s = "" if s is None else str(s)
    s = s.replace("\u3000", " ").strip()
    s = re.sub(r"\s+", " ", s)
    return s

def strip_company_suffix(name: str) -> str:
    if not name:
        return name
    n = name
    for x in ["株式会社", "（株）", "(株)"]:
        n = n.replace(x, "")
    return n.strip()

def kata_to_hira(kata: str) -> str:
    s = kata or ""
    res = []
    for ch in s:
        code = ord(ch)
        if 0x30A1 <= code <= 0x30F6:
            res.append(chr(code - 0x60))
        else:
            res.append(ch)
    return "".join(res)

def kana_reading(text: str) -> str:
    if not text or _TAGGER is None:
        return ""
    try:
        parts = []
        for tok in _TAGGER(text):
            yomi = ""
            feat = getattr(tok, "feature", None)

            if feat is not None:
                for attr in ("kana", "pron", "reading"):
                    if hasattr(feat, attr):
                        val = getattr(feat, attr)
                        if val and val != "*":
                            yomi = str(val)
                            break
                if not yomi:
                    try:
                        if isinstance(feat, (list, tuple)) and len(feat) > 7 and feat[7] and feat[7] != "*":
                            yomi = str(feat[7])
                    except Exception:
                        pass

            if not yomi:
                yomi = tok.surface

            parts.append(str(yomi))

        out = "".join(parts)
        out = re.sub(r"\s+", "", out)
        return out
    except Exception:
        return ""

def pick_col(cols, keywords):
    for k in keywords:
        for c in cols:
            if k in str(c):
                return c
    return None

def build_aliases(code: str, name: str):
    a = []
    if code:
        a.append(code)
        a.append(code.replace("-", ""))
    if name:
        a.append(name)
        base_name = strip_company_suffix(name)
        a.append(base_name)

        yomi_kata = kana_reading(base_name)
        if yomi_kata:
            a.append(yomi_kata)
            a.append(kata_to_hira(yomi_kata))

    seen = set()
    out = []
    for x in a:
        x = norm(x)
        if x and x not in seen:
            seen.add(x)
            out.append(x)
    return out

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

    meta = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "count": len(uniq),
        "source": SRC.name,
    }
    META.write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")

    print(f"Wrote: {OUT}  count={len(uniq)}")
    print(f"Wrote: {META}")
    print(f"Detected columns: code={col_code} name={col_name} section={col_section}")
    print(f"Fugashi enabled: {bool(_TAGGER)}")

if __name__ == "__main__":
    main()
