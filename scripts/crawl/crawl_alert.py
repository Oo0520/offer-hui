"""crawl 邮件告警模块（2026-09-29 目标1/6）
用途：爬虫失败时发邮件告警。被 crawl-jysd.py / crawl-fjrclh.py 共用。
触发条件（满足任一）：
  - 脚本顶层异常（except 块调用）
  - stats["fail"] > 0
配置：优先读同目录 .env（ALERT_MAIL_TO / ALERT_SMTP_HOST / ALERT_SMTP_PORT /
     ALERT_SMTP_USER / ALERT_SMTP_PASS），其次读环境变量。
     .env 不进入 git（爬虫在仓库外，天然隔离）。
实现：QQ 邮箱 SMTP（SSL 465）。失败静默（不因告警失败影响主流程）。
"""
import os, smtplib, sys
from email.mime.text import MIMEText
from email.header import Header

# 读 .env（KEY=VALUE 每行，忽略 # 注释与空行）——多级查找：脚本同级 -> 仓库根 -> 仓库 apps/worker，再兜底环境变量
def _load_env(paths):
    for p in paths:
        if os.path.isfile(p):
            try:
                with open(p, "r", encoding="utf-8") as _f:
                    for _line in _f:
                        _line = _line.strip()
                        if not _line or _line.startswith("#") or "=" not in _line:
                            continue
                        _k, _v = _line.split("=", 1)
                        os.environ.setdefault(_k.strip(), _v.strip())
                return p
            except Exception:
                pass
    return None

_here = os.path.dirname(os.path.abspath(__file__))
_ENV_PATH = _load_env([
    os.path.join(_here, ".env"),
    os.path.join(os.path.dirname(_here), ".env"),          # 仓库根
    os.path.join(os.path.dirname(_here), "apps", "worker", ".env"),
]) or ""

DEFAULT_TO = os.environ.get("ALERT_MAIL_TO") or "qm0mp@qq.com"

def _send(subject: str, body: str) -> bool:
    host = os.environ.get("ALERT_SMTP_HOST") or "smtp.qq.com"
    port = int(os.environ.get("ALERT_SMTP_PORT") or "465")
    user = os.environ.get("ALERT_SMTP_USER") or ""
    pwd = os.environ.get("ALERT_SMTP_PASS") or ""
    if not (user and pwd):
        print(f"  ⚠ 告警未发送：未配置 ALERT_SMTP_USER/ALERT_SMTP_PASS（收件人 {DEFAULT_TO}，.env 路径 {_ENV_PATH}）")
        return False
    try:
        msg = MIMEText(body, "plain", "utf-8")
        msg["Subject"] = Header(subject, "utf-8")
        msg["From"] = user
        msg["To"] = DEFAULT_TO
        with smtplib.SMTP_SSL(host, port, timeout=15) as s:
            s.login(user, pwd)
            s.sendmail(user, [DEFAULT_TO], msg.as_string())
        print(f"  ✉ 告警邮件已发送 → {DEFAULT_TO}")
        return True
    except Exception as e:
        print(f"  ⚠ 告警邮件发送失败: {e}")
        return False

def alert_crawl_failed(script: str, err: Exception | str, stats: dict | None = None):
    """爬虫失败告警（顶层异常/失败计数>0 时调用）"""
    body = [f"脚本: {script}", f"时间: {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"]
    if stats:
        body.append(f"统计: 新增={stats.get('new',0)} 变更={stats.get('changed',0)} 跳过={stats.get('skipped',0)} 失败={stats.get('fail',0)}")
    body.append(f"错误: {err}")
    body.append("\n请检查源站可用性或爬虫脚本。")
    _send(f"[Offer派] 爬虫失败告警 - {script}", "\n".join(body))

def alert_board_failed(script: str, board: str, err: Exception | str):
    """板块级抓取失败告警"""
    body = [f"脚本: {script}", f"板块: {board}", f"时间: {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"]
    body.append(f"错误: {err}")
    body.append("\n该板块本次未更新，请检查源站。")
    _send(f"[Offer派] 板块抓取失败 - {board}", "\n".join(body))
