# -*- coding: utf-8 -*-
"""福建就业网（省大中专毕业生就业工作中心，www.fj99.org.cn/bys）。

数据通道（已逆向确认，无需登录）：
- POST /bys/pc/service/business/ecosystem/job/Cb01/queryPost
- 签名：header sign = md5(JSON.stringify(body) + "&queryPost")
- 分页：body.page / body.size；响应 data.total / data.records（160 字段）
- 岗位详情页：https://www.fj99.org.cn/bys/#/jobDetails?postId={postId}
- channelName 字段标注数据来源渠道（国聘网 / 中国海峡人才网 等），用于来源标注
"""
import asyncio
import hashlib
import json
import re

from ..models import Job
from .base import BaseSource

API = "https://www.fj99.org.cn/bys/pc/service/business/ecosystem/job/Cb01/queryPost"

# 学历编码（AAC011 字典：10=博士 11=硕士 12=本科 13=专科 14=中专…）
_DEGREE_MAP = {
    "10": "博士及以上",
    "11": "硕士及以上",
    "12": "本科及以上",
    "13": "专科及以上",
    "14": "中专及以上",
}

# 薪资单位（SALARY_UNIT 字典）
_SALARY_UNIT = {"1": "元/天", "2": "元/小时", "3": "元/次", "4": "元/单", "5": "元/月", "6": "元/周", "7": "元/年"}
# 薪资类型（SALARY_TYPE 字典）
_SALARY_TYPE = {"1": "月薪", "2": "年薪", "3": "日薪", "4": "周薪", "5": "面议"}

# 招聘性质：postType 0=社会招聘? settleType 3=校招? 常见值见注释
_JOB_TYPE_HINT = ("实习", "见习", "勤工俭学")


class Fj99Source(BaseSource):
    name = "fj99"
    label = "福建就业网"
    _REFERER = "https://www.fj99.org.cn/bys/"

    def _base_body(self, page: int = 1, size: int = 50) -> dict:
        return {
            "page": page, "size": size, "keyword": "", "defaultFlag": "1",
            "postWorkType": [], "area": [], "publishZone": [], "educationRequire": [],
            "companyIndustry": [], "workEducation": [], "graduationRequire": [],
            "economicType": [], "companyScale": [], "jobKeywords": [],
            "majorRequire": "", "postWelfare": [], "positionQueryType": "RECOMMEND",
            "salaryOrder": "", "monthSalaryMin": "", "monthSalaryMax": "",
            "positionSearchLimit": "POST", "isMustKeyword": True, "isMustWorkArea": True,
            "isMustCompanyIndustry": True, "isMustPostWorkType": True, "isMustSalaryRange": True,
            "postType": [], "settleType": [], "isA": "", "postEconomyType": "",
            "isUrgentNeed": "", "isSpecializedNew": "", "isTop100Private": "",
            "isWorkStudyProgram": "", "channelName": "", "isFrontLine": "",
            "isBysFlag": "1", "expectationSalary": "", "intentionId": "",
        }

    def _sign(self, body: dict) -> str:
        raw = json.dumps(body, ensure_ascii=False, separators=(",", ":")) + "&queryPost"
        return hashlib.md5(raw.encode("utf-8")).hexdigest()

    async def _query_page(self, page: int, size: int = 50) -> tuple[list[dict], int]:
        body = self._base_body(page, size)
        await asyncio.sleep(self.s.request_delay)  # 限速
        resp = await self.client.post(
            API,
            data=json.dumps(body, ensure_ascii=False, separators=(",", ":")),
            headers={
                "User-Agent": self.s.user_agent,
                "Referer": self._REFERER,
                "Content-Type": "application/json;charset=UTF-8",
                "sign": self._sign(body),
            },
        )
        resp.raise_for_status()
        data = resp.json().get("data") or {}
        records = data.get("records") or []
        total = data.get("total") or 0
        return records, total

    async def fetch(self) -> list:
        jobs: list[Job] = []
        # MVP：抓最新 4 页（约 200 条），控制请求量与入库量
        for page in range(1, 5):
            try:
                records, _total = await self._query_page(page, 50)
            except Exception as e:
                print(f"[fj99] 第 {page} 页失败: {e}")
                break
            if not records:
                break
            for r in records:
                job = self._parse(r)
                if job:
                    jobs.append(job)
        return jobs

    def _parse(self, r: dict) -> Job | None:
        pid = r.get("postId")
        name = (r.get("postName") or "").strip()
        if not pid or not name:
            return None
        company = (r.get("unitName") or "").strip()
        # 薪资：monthSalary（千元/月 口径）× 单位/类型字典
        month = self._num(r.get("monthSalary"))
        salary_unit = str(r.get("salaryUnit") or "")
        salary_type = str(r.get("salaryType") or "")
        if _SALARY_TYPE.get(salary_type) == "面议" or month <= 0:
            salary_text = "面议"
        else:
            unit_name = _SALARY_UNIT.get(salary_unit, "")
            if salary_unit == "5":  # 元/月 → 千元口径
                salary_text = f"{month:.0f}K/月"
            elif salary_unit == "7" and month <= 200:  # 元/年 → 万/年 口径
                salary_text = f"{month:.0f}万/年"
            else:
                salary_text = f"{month:.0f}{unit_name}" if unit_name else ""
        deadline = (r.get("recruitEndtime") or "").strip()[:10]
        posted = (r.get("releaseTime") or "").strip()[:10]
        degree = _DEGREE_MAP.get(str(r.get("educationRequire") or ""), "")
        channel = (r.get("channelName") or "").strip()
        desc = (r.get("postDuty") or r.get("jobDescription") or "").strip()[:500]
        city = (r.get("workAreaName") or "").strip()
        tags = []
        if channel:
            tags.append(f"来源:{channel}")
        crowd = (r.get("recruitCrowd") or "").strip()
        if crowd:
            tags.append(crowd[:20])
        job_type = "intern" if any(k in name for k in _JOB_TYPE_HINT) else "campus"
        return Job(
            source=self.name,
            source_url=f"https://www.fj99.org.cn/bys/#/jobDetails?postId={pid}",
            external_id=f"post_{pid}",
            title=name,
            company_name=company,
            city=city,
            job_type=job_type,
            degree=degree,
            salary_min=month,
            salary_max=0.0,
            salary_text=salary_text,
            deadline_at=deadline,
            posted_at=posted,
            apply_url=f"https://www.fj99.org.cn/bys/#/jobDetails?postId={pid}",
            tags=tags,
        )

    @staticmethod
    def _num(v) -> float:
        try:
            f = float(v)
            return f if f > 0 else 0.0
        except (TypeError, ValueError):
            return 0.0
