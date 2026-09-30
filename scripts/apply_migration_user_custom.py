# -*- coding: utf-8 -*-
"""应用 202609300001_user_custom_jobs.sql 迁移到 Supabase 生产库（幂等）。"""
import os, re, sys

BASE = r"E:\AIMemory\DaoBao\offer-hui"
ENV_PATH = os.path.join(BASE, "apps", "worker", ".env")

def load_env(path):
    env = {}
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env

env = load_env(ENV_PATH)
dsn = env.get("DATABASE_URL")
if not dsn:
    print("ERROR: DATABASE_URL not found in", ENV_PATH)
    sys.exit(1)

import psycopg2

mig_path = os.path.join(BASE, "infra", "supabase", "migrations", "202609300001_user_custom_jobs.sql")
with open(mig_path, "r", encoding="utf-8") as f:
    sql = f.read()

# 按分号拆分执行（迁移内无函数体，无分号冲突）
statements = [s.strip() for s in re.split(r";\s*\n", sql) if s.strip()]

conn = psycopg2.connect(dsn)
conn.autocommit = True
cur = conn.cursor()
ok, fail = 0, []
for st in statements:
    try:
        cur.execute(st)
        ok += 1
        print("OK:", st.splitlines()[0][:80])
    except Exception as e:
        conn.rollback()
        fail.append((st[:80], str(e)[:200]))
        print("FAIL:", st.splitlines()[0][:80], "->", str(e)[:200])

cur.close()
conn.close()
print(f"\nDONE: {ok} ok, {len(fail)} failed")
for f in fail:
    print(" ", f)
sys.exit(1 if fail else 0)
