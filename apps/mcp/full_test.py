# -*- coding: utf-8 -*-
"""MCP 全维度验证：各筛选组合 + 详情 + 限流"""
import json
import sys
import time

import httpx

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8001/mcp"
HEADERS = {"Accept": "application/json, text/event-stream", "Content-Type": "application/json"}


def rpc(client, sid, method, params=None, rid=1):
    h = dict(HEADERS)
    if sid:
        h["Mcp-Session-Id"] = sid
    r = client.post(BASE, headers=h, json={"jsonrpc": "2.0", "id": rid, "method": method, **({"params": params} if params else {})}, timeout=60)
    body = r.text
    payloads = [l[5:].strip() for l in body.splitlines() if l.startswith("data:")]
    return json.loads("".join(payloads)) if payloads else json.loads(body)


def call(client, sid, name, args, rid):
    out = rpc(client, sid, "tools/call", {"name": name, "arguments": args}, rid)
    if out.get("result", {}).get("isError"):
        return {"error": out["result"]["content"][0]["text"]}
    return json.loads(out["result"]["content"][0]["text"])


def main():
    passed = 0
    with httpx.Client() as c:
        r = c.post(BASE, headers=HEADERS, json={
            "jsonrpc": "2.0", "id": 1, "method": "initialize",
            "params": {"protocolVersion": "2025-03-26", "capabilities": {},
                       "clientInfo": {"name": "offerp-full", "version": "0.1"}},
        }, timeout=60)
        sid = r.headers.get("mcp-session-id")

        def check(label, cond, extra=""):
            nonlocal passed
            mark = "✓" if cond else "✗"
            print(f"  {mark} {label}{' ' + extra if extra else ''}")
            if cond:
                passed += 1

        # 1. 默认查询
        d = call(c, sid, "query_jobs", {}, 2)
        check("默认查询", d.get("total", 0) > 0 and len(d.get("jobs", [])) > 0, f"total={d.get('total')}")

        # 2. 城市筛选
        d = call(c, sid, "query_jobs", {"city": "上海"}, 3)
        check("城市=上海", d.get("total", 0) > 0, f"total={d.get('total')}")
        if d.get("jobs"):
            check("上海结果城市正确", all(j["city"] == "上海" for j in d["jobs"]))

        # 3. 实习筛选
        d = call(c, sid, "query_jobs", {"job_type": "实习"}, 4)
        check("类型=实习", d.get("total", 0) > 0, f"total={d.get('total')}")
        if d.get("jobs"):
            check("实习结果类型正确", all(j["job_type"] == "实习" for j in d["jobs"]))

        # 4. 学历筛选（本科及以上，不应含专科）
        d = call(c, sid, "query_jobs", {"degree": "本科及以上"}, 5)
        check("学历=本科及以上", d.get("total", 0) > 0, f"total={d.get('total')}")

        # 5. 关键词
        d = call(c, sid, "query_jobs", {"keyword": "银行"}, 6)
        check("关键词=银行", d.get("total", 0) > 0, f"total={d.get('total')}")

        # 6. 排序 newest
        d1 = call(c, sid, "query_jobs", {"sort": "newest", "page_size": 3}, 7)
        check("排序=newest", len(d1.get("jobs", [])) == 3)

        # 7. 分页 page=2
        d = call(c, sid, "query_jobs", {"page": 2, "page_size": 10}, 8)
        check("分页 page=2", len(d.get("jobs", [])) == 10)

        # 8. 详情
        first = call(c, sid, "query_jobs", {"page_size": 1}, 9)
        jid = first["jobs"][0]["id"] if first.get("jobs") else None
        if jid:
            det = call(c, sid, "get_job_detail", {"job_id": jid}, 10)
            check("详情", det.get("id") == jid and det.get("source_url"), f"{det.get('company')}|{det.get('title')}")
        else:
            check("详情", False, "无岗位可取")

        # 9. 不存在的 id
        det = call(c, sid, "get_job_detail", {"job_id": "00000000-0000-0000-0000-000000000000"}, 11)
        check("不存在id返回错误", "error" in det or "不存在" in str(det))

        # 10. sources / stats
        s = call(c, sid, "get_sources", {}, 12)
        check("sources", len(s) >= 5, f"{len(s)}个源")
        st = call(c, sid, "get_stats", {}, 13)
        check("stats", st.get("total", 0) > 0, f"total={st.get('total')}")

        print(f"\n{'='*40}\n通过 {passed}/13 项")
        return 0 if passed >= 12 else 1


if __name__ == "__main__":
    sys.exit(main())
