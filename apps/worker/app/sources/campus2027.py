# -*- coding: utf-8 -*-
"""Campus2027 · 社区维护的 2027 届校招汇总（namewyf/Campus2027，GitHub 共创）。

数据通道：raw.githubusercontent.com/namewyf/Campus2027/main/README.md
形态：Markdown 表格（公司 | 招聘状态&&投递链接 | 更新日期 | 地点 | 备注），
      按 `### 批次` + `### 行业` 分节。投递链接为各公司官方校招入口。
注意：README 开头含广告 <script> 标签，解析时忽略非表格行即可。
"""
import re
from datetime import datetime

import httpx

from ..models import Job
from .base import BaseSource

README_URL = "https://raw.githubusercontent.com/namewyf/Campus2027/main/README.md"

# 批次标题 → 标签
_BATCH = {
    "提前批": "提前批",
    "正式批": "正式批",
    "实习": "实习",
    "日常实习": "实习",
    "暑期实习": "实习",
}
# 行业标题清洗：去掉 "&&" 为 &，去多余空格
_RE_LINK = re.compile(r"\[([^\]]*)\]\(([^)]+)\)")


class Campus2027Source(BaseSource):
    name = "campus2027"
    label = "Campus2027 社区汇总"

    async def fetch(self) -> list:
        resp = await self._get(README_URL)
        return self._parse(resp.text)

    def _parse(self, text: str) -> list:
        jobs: dict[str, Job] = {}   # url → Job，同 URL 合并（多分类同入口）
        batch = ""          # 提前批 / 正式批 / 实习 ...
        industry = ""       # 互联网&&AI / 游戏 / 车企 ...
        for raw in text.splitlines():
            line = raw.strip()
            # 分节标题：### 校招提前批 / ### 互联网 && AI
            if line.startswith("### "):
                head = line[4:].strip()
                for kw, tag in _BATCH.items():
                    if kw in head:
                        batch = tag
                        break
                else:
                    if "校招" in head:
                        batch = "校招"
                    else:
                        batch = ""
                industry = head.replace("&&", "&").strip()
                continue
            if not line.startswith("|"):
                continue
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            # 表头或分隔行
            if len(cells) < 5 or cells[0] in ("公司", "公司名") or set(cells[0]) <= {"-", ":"}:
                continue
            company, status_link, updated, city, note = cells[:5]
            if not company:
                continue
            m = _RE_LINK.search(status_link)
            status = m.group(1) if m else status_link
            url = m.group(2) if m else ""
            if not url:
                continue
            # 更新日期 2026/7/20 → ISO
            posted = ""
            try:
                posted = datetime.strptime(updated.strip(), "%Y/%m/%d").date().isoformat()
            except ValueError:
                try:
                    posted = datetime.strptime(updated.strip(), "%Y-%m-%d").date().isoformat()
                except ValueError:
                    posted = ""
            tags = [t for t in (batch, note[:24]) if t]
            title = f"{company}·2027届{status}" if status else f"{company}·2027届校招"
            # 同一 URL 已在其他分类出现 → 合并行业/标签，避免 source_url 唯一冲突
            if url in jobs:
                old = jobs[url]
                if industry and industry not in old.industry:
                    old.industry = f"{old.industry} / {industry}" if old.industry else industry
                old.tags = list(dict.fromkeys(old.tags + tags))
                if posted and posted > (old.posted_at or ""):
                    old.posted_at = posted
                continue
            jobs[url] = Job(
                source=self.name,
                source_url=url,          # 权威来源=官方投递入口
                external_id=f"{company}:{status}",
                title=title,
                company_name=company,
                city=city if city != "全国" else "全国",
                industry=industry or "",
                job_type="intern" if batch == "实习" else "campus",
                degree="",
                cohort="2027届",
                posted_at=posted,
                apply_url=url,
                tags=tags,
            )
        return list(jobs.values())
