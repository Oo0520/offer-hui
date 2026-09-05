# -*- coding: utf-8 -*-
"""数据清洗：届别补全 + 城市归一化 + 行业补全"""
import os
import sys
import re
from pathlib import Path
import httpx

sys.path.insert(0, str(Path(__file__).parent))


def load_env():
    env_path = Path(__file__).parent / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())


# 区县 → 地级市映射（福建为主）
DISTRICT_TO_CITY = {
    # 福州
    "闽侯县": "福州", "仓山区": "福州", "鼓楼区": "福州", "台江区": "福州",
    "晋安区": "福州", "马尾区": "福州", "长乐区": "福州", "福清市": "福州",
    "连江县": "福州", "罗源县": "福州", "闽清县": "福州", "永泰县": "福州",
    "平潭县": "福州",
    # 厦门
    "思明区": "厦门", "湖里区": "厦门", "集美区": "厦门", "海沧区": "厦门",
    "同安区": "厦门", "翔安区": "厦门",
    # 泉州
    "丰泽区": "泉州", "鲤城区": "泉州", "洛江区": "泉州", "泉港区": "泉州",
    "晋江市": "泉州", "石狮市": "泉州", "南安市": "泉州", "惠安县": "泉州",
    "安溪县": "泉州", "永春县": "泉州", "德化县": "泉州", "金门县": "泉州",
    # 莆田
    "荔城区": "莆田", "城厢区": "莆田", "涵江区": "莆田", "秀屿区": "莆田",
    "仙游县": "莆田",
    # 漳州
    "芗城区": "漳州", "龙文区": "漳州", "龙海市": "漳州", "云霄县": "漳州",
    "漳浦县": "漳州", "诏安县": "漳州", "长泰县": "漳州", "东山县": "漳州",
    "南靖县": "漳州", "平和县": "漳州", "华安县": "漳州",
    # 宁德
    "蕉城区": "宁德", "福安市": "宁德", "福鼎市": "宁德", "霞浦县": "宁德",
    "古田县": "宁德", "屏南县": "宁德", "寿宁县": "宁德", "周宁县": "宁德",
    "柘荣县": "宁德",
    # 三明
    "梅列区": "三明", "三元区": "三明", "永安市": "三明", "明溪县": "三明",
    "清流县": "三明", "宁化县": "三明", "大田县": "三明", "尤溪县": "三明",
    "沙县": "三明", "将乐县": "三明", "泰宁县": "三明", "建宁县": "三明",
    # 南平
    "延平区": "南平", "建阳区": "南平", "邵武市": "南平", "武夷山市": "南平",
    "建瓯市": "南平", "顺昌县": "南平", "浦城县": "南平", "光泽县": "南平",
    "松溪县": "南平", "政和县": "南平",
    # 龙岩
    "新罗区": "龙岩", "漳平市": "龙岩", "长汀县": "龙岩", "上杭县": "龙岩",
    "武平县": "龙岩", "连城县": "龙岩",
}


def normalize_city(city: str) -> str:
    if not city:
        return ""
    c = city.strip()
    # 区县映射
    if c in DISTRICT_TO_CITY:
        return DISTRICT_TO_CITY[c]
    # 带省份前缀：江苏苏州 → 苏州，福建厦门 → 厦门
    m = re.match(r"^(?:江苏|浙江|广东|福建|山东|河南|河北|湖北|湖南|四川|安徽|江西|陕西|辽宁|吉林|黑龙江)(.+)$", c)
    if m:
        c = m.group(1)
    # 去"市""省""区""县"后缀（但保留区县映射后的结果）
    c = re.sub(r"[市省]$", "", c)
    # 北京市 → 北京，上海市 → 上海
    return c


def main():
    load_env()
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("缺少 Supabase 凭据")
        return

    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }

    # 拉取所有数据
    r = httpx.get(
        f"{url}/rest/v1/jobs",
        headers=headers,
        params={"select": "id,cohort,city,industry,job_type,source", "limit": 2000},
    )
    jobs = r.json()
    print(f"总岗位: {len(jobs)}")

    cohort_fixed = 0
    city_fixed = 0
    industry_fixed = 0

    for job in jobs:
        updates = {}

        # 1. 届别补全：校招岗位空 cohort → 2027届
        if not job.get("cohort") and job.get("job_type") == "campus":
            updates["cohort"] = "2027届"
            cohort_fixed += 1

        # 2. 城市归一化
        old_city = job.get("city") or ""
        new_city = normalize_city(old_city)
        if new_city != old_city:
            updates["city"] = new_city
            city_fixed += 1

        # 3. 行业补全：空 → 未分类
        if not job.get("industry"):
            updates["industry"] = "未分类"
            industry_fixed += 1

        if updates:
            httpx.patch(
                f"{url}/rest/v1/jobs",
                headers=headers,
                params={"id": f"eq.{job['id']}"},
                json=updates,
            )

    print(f"届别补全: {cohort_fixed} 条")
    print(f"城市归一化: {city_fixed} 条")
    print(f"行业补全: {industry_fixed} 条")

    # 验证
    r2 = httpx.get(
        f"{url}/rest/v1/jobs",
        headers=headers,
        params={"select": "cohort,city,industry", "limit": 2000},
    )
    data = r2.json()
    from collections import Counter
    print("\n=== 清洗后届别 ===")
    for k, v in Counter(j["cohort"] or "(空)" for j in data).most_common():
        print(f"  {k}: {v}")
    print("\n=== 清洗后城市(前15) ===")
    for k, v in Counter(j["city"] or "(空)" for j in data).most_common(15):
        print(f"  {k}: {v}")
    print("\n=== 清洗后行业 ===")
    for k, v in Counter(j["industry"] or "(空)" for j in data).most_common(10):
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
