# -*- coding: utf-8 -*-
"""MCP Server 冒烟测试：initialize → tools/list → tools/call(query_jobs/get_sources/get_stats)"""
import json
import sys

import httpx

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8001/mcp"
HEADERS = {"Accept": "application/json, text/event-stream", "Content-Type": "application/json"}


def rpc(client, session_id, method, params=None, req_id=1):
    body = {"jsonrpc": "2.0", "id": req_id, "method": method}
    if params:
        body["params"] = params
    h = dict(HEADERS)
    if session_id:
        h["Mcp-Session-Id"] = session_id
    resp = client.post(BASE, headers=h, json=body, timeout=30)
    return resp


def parse(content):
    """解析 SSE（event: message + data: ...）或纯 JSON 响应"""
    if "data:" in content:
        payloads = [
            l[5:].strip()
            for l in content.splitlines()
            if l.startswith("data:")
        ]
        if payloads:
            return json.loads("".join(payloads))
    return json.loads(content)


def main():
    with httpx.Client() as c:
        # 1. initialize
        r = rpc(c, None, "initialize", {
            "protocolVersion": "2025-03-26",
            "capabilities": {},
            "clientInfo": {"name": "offerp-smoke", "version": "0.1"},
        }, req_id=1)
        sid = r.headers.get("mcp-session-id")
        print(f"[initialize] status={r.status_code} session={sid}")
        init = parse(r.text)
        assert init.get("result"), f"initialize 失败: {init}"

        # 2. tools/list
        r = rpc(c, sid, "tools/list", req_id=2)
        tools = parse(r.text)["result"]["tools"]
        print(f"[tools/list] {len(tools)} 个工具: {[t['name'] for t in tools]}")

        # 3. call query_jobs
        r = rpc(c, sid, "tools/call", {"name": "query_jobs", "arguments": {"city": "北京", "cohort": "2027届", "page_size": 5}}, req_id=3)
        out = parse(r.text)["result"]["content"][0]["text"]
        data = json.loads(out)
        print(f"[query_jobs 北京/2027届] total={data['total']} 返回={len(data['jobs'])} 条")
        if data["jobs"]:
            j = data["jobs"][0]
            print(f"  样例: {j['company']} | {j['title']} | {j['city']} | 截止 {j['deadline_at']} | {j['apply_url'][:60]}")

        # 4. call get_sources
        r = rpc(c, sid, "tools/call", {"name": "get_sources", "arguments": {}}, req_id=4)
        out = parse(r.text)["result"]["content"][0]["text"]
        srcs = json.loads(out)
        print(f"[get_sources] {len(srcs)} 个数据源: " + ", ".join(f"{s['name']}({s['count']})" for s in srcs[:6]))

        # 5. call get_stats
        r = rpc(c, sid, "tools/call", {"name": "get_stats", "arguments": {}}, req_id=5)
        out = parse(r.text)["result"]["content"][0]["text"]
        print(f"[get_stats] {json.loads(out)}")

        print("\n✅ MCP 冒烟测试全部通过")


if __name__ == "__main__":
    main()
