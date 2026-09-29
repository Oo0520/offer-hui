# -*- coding: utf-8 -*-
"""从 pcas.json 生成前端 cityTree.ts（省→市映射 + 城市→省映射）
用法（仓库根目录）：python scripts/gen-citytree.py
输出：apps/web/lib/cityTree.ts（民政部行政区划，modood/Administrative-divisions-of-China）"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
PCAS = os.path.join(HERE, "..", "infra", "classify", "pcas.json")
OUT = os.path.join(HERE, "..", "apps", "web", "lib", "cityTree.ts")
MUNICIPALITIES = {"北京市": "北京", "天津市": "天津", "上海市": "上海", "重庆市": "重庆"}

data = json.load(open(PCAS, encoding="utf-8"))
prov_to_cities = {}
city_to_prov = {}
for prov, cities in data.items():
    prov_short = prov.replace("省", "").replace("自治区", "").replace("市", "")
    for city, zones in cities.items():
        if prov in MUNICIPALITIES and city == "市辖区":
            c = MUNICIPALITIES[prov]
        else:
            c = city.replace("市", "").replace("地区", "").replace("自治州", "").replace("盟", "")
            if c in ("县", "区", "旗"):
                continue
        prov_to_cities.setdefault(prov_short, [])
        if c not in prov_to_cities[prov_short]:
            prov_to_cities[prov_short].append(c)
        city_to_prov[c] = prov_short

# 港澳台特殊（pcas 里可能没有或作为省）
for c, p in [("香港", "港澳台"), ("澳门", "港澳台"), ("台湾", "港澳台")]:
    prov_to_cities.setdefault("港澳台", [])
    if c not in prov_to_cities["港澳台"]:
        prov_to_cities["港澳台"].append(c)
    city_to_prov[c] = "港澳台"

# 生成 TS 源码（中文键，JSON 序列化保证 UTF-8）
ts = """// 城市三级数据：省→市映射（源：民政部行政区划 pcas.json，见 infra/classify/pcas.json）
// 由 scripts/gen-citytree.py 生成，勿手改。渲染时按库内实际城市过滤。
export const CITY_PROVINCES: Record<string, string[]> = %s;

export const PROVINCE_OF_CITY: Record<string, string> = %s;

// 热门城市（BOSS 风格置顶）
export const HOT_CITIES = ["北京", "上海", "广州", "深圳", "杭州", "南京", "苏州", "武汉", "成都", "西安", "福州", "厦门", "重庆", "长沙", "天津"];

// 省份展示顺序：热门省份优先（按库内岗位量在组件内动态排序，这里给兜底顺序）
export const PROVINCE_ORDER = ["全国", "热门", "福建", "广东", "浙江", "江苏", "上海", "北京", "山东", "湖北", "湖南", "四川", "重庆", "河南", "安徽", "江西", "陕西", "河北", "天津", "辽宁", "广西", "云南", "贵州", "海南", "山西", "吉林", "黑龙江", "内蒙古", "甘肃", "新疆", "青海", "宁夏", "西藏", "港澳台", "海外"];
"""
ts = ts % (json.dumps(prov_to_cities, ensure_ascii=False, indent=1), json.dumps(city_to_prov, ensure_ascii=False, indent=1))
with open(OUT, "w", encoding="utf-8") as f:
    f.write(ts)
print("生成:", OUT, os.path.getsize(OUT), "bytes")
print("省份数:", len(prov_to_cities), "城市数:", len(city_to_prov))
