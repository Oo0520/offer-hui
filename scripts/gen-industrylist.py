# -*- coding: utf-8 -*-
"""从 industries.json 生成前端 lib/industryList.ts（完整行业类目）
用法（仓库根目录）：python scripts/gen-industrylist.py
输出：apps/web/lib/industryList.ts"""
import json, os, io

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..", "infra", "classify", "industries.json")
OUT = os.path.join(HERE, "..", "apps", "web", "lib", "industryList.ts")

with io.open(SRC, "r", encoding="utf-8") as f:
    data = json.load(f)

cats = [k for k in data.keys() if not k.startswith("_")]
# 保持文件里的顺序（其他放最后）
cats = [c for c in cats if c != "其他"] + ["其他"] if "其他" in cats else cats

lines = [
    "// 行业标准类目（源：infra/classify/industries.json，GB/T 4754 骨架）",
    "// 由 scripts/gen-industrylist.py 生成，勿手改。筛选面板显示完整列表，无岗位的类目计数为 0。",
    "export const INDUSTRY_LIST: string[] = [",
]
for c in cats:
    lines.append(f'  "{c}",')
lines.append("];")
lines.append("")

with io.open(OUT, "w", encoding="utf-8", newline="\n") as f:
    f.write("\n".join(lines))
print("生成", OUT, "类目数:", len(cats))
print(cats)
