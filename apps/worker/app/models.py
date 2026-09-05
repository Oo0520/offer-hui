# -*- coding: utf-8 -*-
"""数据模型：与 Supabase schema 对齐的岗位/公司模型。"""
import hashlib
import json
from dataclasses import asdict, dataclass, field


def compute_hash(payload: dict) -> str:
    """内容哈希：用于检测岗位信息是否变化（去重/增量更新的核心）。"""
    norm = json.dumps(payload, ensure_ascii=False, sort_keys=True, default=str)
    return hashlib.sha1(norm.encode("utf-8")).hexdigest()


@dataclass
class Job:
    """一个招聘信息/岗位。external_id + source 共同构成唯一键。"""
    source: str                 # ncss | hit | pku | ...
    source_url: str             # 原始页面（权威来源）
    external_id: str            # 源站唯一 ID
    title: str                  # 岗位/招聘名称
    company_name: str           # 用人单位
    city: str = ""
    industry: str = ""
    job_type: str = ""          # campus 校招 | intern 实习 | fair 招聘会
    degree: str = ""            # 学历要求
    cohort: str = ""            # 届别，如 2027届
    salary_min: float = 0
    salary_max: float = 0
    salary_text: str = ""
    deadline_at: str = ""       # 截止日期（DDL），ISO 日期
    posted_at: str = ""         # 发布时间
    apply_url: str = ""         # 官方投递入口
    tags: list = field(default_factory=list)
    content_hash: str = ""

    def __post_init__(self):
        if not self.content_hash:
            self.content_hash = self.compute_hash()

    def compute_hash(self) -> str:
        return compute_hash({
            "title": self.title,
            "company": self.company_name,
            "city": self.city,
            "industry": self.industry,
            "degree": self.degree,
            "salary": [self.salary_min, self.salary_max],
            "salary_text": self.salary_text,
            "deadline": self.deadline_at,
            "apply": self.apply_url,
            "tags": self.tags,
        })

    def to_dict(self) -> dict:
        return asdict(self)
