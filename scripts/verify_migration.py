# -*- coding: utf-8 -*-
import psycopg2

env = {}
for line in open(r"E:\AIMemory\DaoBao\offer-hui\apps\worker\.env", encoding="utf-8"):
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    env[k.strip()] = v.strip().strip('"').strip("'")

c = psycopg2.connect(env["DATABASE_URL"])
cur = c.cursor()
cur.execute(
    "select table_name from information_schema.tables "
    "where table_schema='public' and table_name in ('user_custom_jobs','jobs') order by 1"
)
print("TABLES:", cur.fetchall())
cur.execute(
    "select column_name from information_schema.columns "
    "where table_name='user_custom_jobs' order by ordinal_position"
)
print("COLS:", [r[0] for r in cur.fetchall()])
cur.execute(
    "select column_name from information_schema.columns "
    "where table_name='jobs' and column_name='submitted_by'"
)
print("jobs.submitted_by:", cur.fetchall())
cur.close()
c.close()
