# -*- coding: utf-8 -*-
"""验证 user_custom_jobs 迁移后的列结构。"""
import os
import psycopg2

BASE = r"E:\AIMemory\DaoBao\offer-hui"
env = {}
with open(os.path.join(BASE, "apps", "worker", ".env"), "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")

conn = psycopg2.connect(env["DATABASE_URL"])
cur = conn.cursor()
cur.execute(
    "select column_name from information_schema.columns "
    "where table_name='user_custom_jobs' order by ordinal_position"
)
cols = [r[0] for r in cur.fetchall()]
print("COLUMNS:", cols)
assert "industry" in cols, "industry 列缺失"
assert "degree" in cols, "degree 列缺失"
conn.close()
print("VERIFY OK")
