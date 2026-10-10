"""每日一键：跑两个爬虫 → 刷新线上缓存。供 Windows 计划任务 / 手动执行调用。

用法：
    python run-daily.py            # 顺序跑 crawl-jysd.py + crawl-fjrclh.py，然后调 /api/revalidate

退出码：
    0 = 全部成功
    1 = 有步骤失败（计划任务的「上次运行结果」会反映出来，便于发现静默失败）

为什么用一个大脚本而不是计划任务的三个 Action：
    计划任务多个 Action 之间**不保证**等到上一步进程结束再启动下一步，
    可能缓存刷新先于入库完成 → 线上仍是旧数据。这里显式串行。

为什么是 .py 而不是 .ps1：
    本机 LocalMachine 执行策略为 Restricted，.ps1 需要 -ExecutionPolicy Bypass 才能跑；
    直接调 python.exe 则完全绕开该问题。
"""
import io
import json
import os
import pathlib
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

HERE = pathlib.Path(__file__).resolve().parent
TZ = timezone(timedelta(hours=8))
LOG = HERE / "run-daily.log"
SCRIPTS = ("crawl-jysd.py", "crawl-fjrclh.py")
REVALIDATE = "https://www.offerpiai.cn/api/revalidate?secret={token}"


def log(msg: str):
    line = f"[{datetime.now(TZ).strftime('%Y-%m-%d %H:%M:%S')}] {msg}"
    print(line, flush=True)
    try:
        with io.open(LOG, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except OSError as e:  # 日志写不了不能影响抓取
        print(f"  (日志写入失败: {e})", file=sys.stderr)


def _read_env_file(p: pathlib.Path) -> dict:
    out = {}
    try:
        for line in p.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                out[k.strip()] = v.strip().strip('"').strip("'")
    except OSError:
        pass
    return out


def find_admin_token() -> str:
    """在脚本同级 .env 与仓库 apps/web/.env(.local) 中找 ADMIN_TOKEN。

    兼容两种部署位置（脚本所在目录 HERE 决定）：
      - 仓库内权威版本  <repo>/scripts/crawl/run-daily.py
            → HERE.parent.parent/apps/web/.env.local = <repo>/apps/web/.env.local
      - 仓库外执行副本  E:\\...\\DaoBao\\run-daily.py（仓库位于 DaoBao\\offer-hui）
            → HERE/offer-hui/apps/web/.env.local
    """
    import os
    if os.environ.get("ADMIN_TOKEN"):
        return os.environ["ADMIN_TOKEN"]
    cands = [
        HERE / ".env",
        HERE / "offer-hui" / "apps" / "web" / ".env.local",       # 仓库外副本
        HERE / "offer-hui" / "apps" / "web" / ".env",
        HERE.parent.parent / "apps" / "web" / ".env.local",       # 仓库内
        HERE.parent.parent / "apps" / "web" / ".env",
        HERE.parent / ".env",
    ]
    for c in cands:
        tok = _read_env_file(c).get("ADMIN_TOKEN")
        if tok:
            log(f"  ADMIN_TOKEN 来源: {c}")
            return tok
    return ""


def run_script(name: str) -> bool:
    path = HERE / name
    if not path.is_file():
        log(f"!! 脚本不存在: {path}")
        return False
    log(f"--- 开始 {name} ---")
    t0 = time.time()
    try:
        # -u（无缓冲）：否则子进程 stdout 重定向到文件时是块缓冲，写库阶段的 print
        #   会滞留在缓冲区，外部看到「日志冻结」而误判为卡死（2026-10-10 实际踩过）。
        # PYTHONIOENCODING=utf-8：子进程日志走管道时默认用 locale(GBK)，脚本里的
        #   ✓/⚠/✗ 会抛 UnicodeEncodeError 直接终止脚本（crawl-fjrclh.py 曾因此崩）。
        env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
        p = subprocess.run([sys.executable, "-u", str(path)], cwd=str(HERE), env=env,
                           capture_output=True, text=True, encoding="utf-8",
                           errors="replace", timeout=5400)
    except subprocess.TimeoutExpired:
        log(f"!! {name} 超时（>90 分钟）")
        return False
    dur = round(time.time() - t0, 1)
    tail = [l for l in (p.stdout or "").strip().splitlines() if l.strip()][-6:]
    for l in tail:
        log(f"    {l}")
    if p.returncode != 0:
        log(f"!! {name} 退出码 {p.returncode}（{dur}s）")
        for l in (p.stderr or "").strip().splitlines()[-5:]:
            log(f"    STDERR {l}")
        return False
    log(f"OK  {name} 完成（{dur}s）")
    return True


def revalidate() -> bool:
    token = find_admin_token()
    if not token:
        log("!! 未找到 ADMIN_TOKEN，跳过缓存刷新（线上可能仍显示旧数据）")
        return False
    url = REVALIDATE.format(token=token)
    try:
        with urllib.request.urlopen(url, timeout=180) as r:
            log(f"OK  缓存已刷新: {r.read().decode('utf-8', 'replace')[:160]}")
        return True
    except (urllib.error.URLError, OSError) as e:
        log(f"!! 缓存刷新失败: {type(e).__name__}: {str(e)[:160]}")
        return False


def main() -> int:
    log("=" * 56)
    log(f"每日抓取开始（python: {sys.executable}）")
    ok = True
    for s in SCRIPTS:
        if not run_script(s):
            ok = False
    if not revalidate():
        ok = False
    log("每日抓取结束：" + ("全部成功" if ok else "存在失败步骤"))
    log("=" * 56)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
