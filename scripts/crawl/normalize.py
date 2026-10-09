# -*- coding: utf-8 -*-
"""
Offer派 城市/行业归一化模块（供爬虫与存量清洗脚本共用）。
数据标准：infra/classify/ 下的 pcas.json（民政部行政区划，开源）、city_aliases.json、industries.json。
用法：
    from normalize import normalize_city, normalize_industry
    normalize_city("Shanghai")      -> "上海"
    normalize_industry("Engineering") -> "机械/制造/重工"
"""
import json, os, re

# 数据目录多级查找：仓库内 scripts/crawl/ -> 仓库根 infra/classify；本地仓库外旧布局兜底
def _find_classify_dir():
    here = os.path.dirname(os.path.abspath(__file__))
    d = here
    for _ in range(6):  # 向上找 infra/classify
        cand = os.path.join(d, "infra", "classify")
        if os.path.isdir(cand):
            return cand
        parent = os.path.dirname(d)
        if parent == d:
            break
        d = parent
    # 旧布局兜底（仓库外脚本：E:\AIMemory\DaoBao\normalize.py → 同目录 offer-hui/infra/classify）
    legacy = os.path.join(here, "offer-hui", "infra", "classify")
    return legacy if os.path.isdir(legacy) else here

CLASSIFY_DIR = _find_classify_dir()

# ---------- 载入标准数据 ----------
_city_aliases = {}
try:
    with open(os.path.join(CLASSIFY_DIR, "city_aliases.json"), encoding="utf-8") as f:
        _city_aliases = json.load(f)
except Exception:
    pass

_industries = {}
try:
    with open(os.path.join(CLASSIFY_DIR, "industries.json"), encoding="utf-8") as f:
        raw = json.load(f)
    _industries = {k: v for k, v in raw.items() if not k.startswith("_")}
except Exception:
    pass

# 行政区划索引：市名 -> (省名, 区县集合)；区县名 -> 市名
_prov_city_zone = {}   # 省名 -> {市名: [区县名]}
_city_set = set()
_district_to_city = {}
_district_name_count = {}   # 区县短名 -> 出现次数（用于识别同名多义区县）
_MUNICIPALITIES = {"北京市": "北京", "天津市": "天津", "上海市": "上海", "重庆市": "重庆"}
try:
    with open(os.path.join(CLASSIFY_DIR, "pcas.json"), encoding="utf-8") as f:
        _pcas = json.load(f)
    # 第一遍：统计同名区县数量
    for prov, cities in _pcas.items():
        for city, zones in cities.items():
            for zone in zones:
                zone_short = zone.replace("市", "").replace("区", "").replace("县", "").replace("旗", "")
                _district_name_count[zone_short] = _district_name_count.get(zone_short, 0) + 1
    # 第二遍：构建索引（同名多义区县不索引，避免错误归市）
    for prov, cities in _pcas.items():
        prov_short = prov.replace("省", "").replace("自治区", "").replace("市", "")
        _prov_city_zone[prov] = {}
        for city, zones in cities.items():
            if prov in _MUNICIPALITIES and city == "市辖区":
                # 直辖市：市辖区直接视为直辖市本级
                city_short = _MUNICIPALITIES[prov]
                _city_set.add(city_short)
                _prov_city_zone[prov][city_short] = list(zones.keys())
                for zone in zones:
                    zone_short = zone.replace("市", "").replace("区", "").replace("县", "").replace("旗", "")
                    if _district_name_count.get(zone_short, 0) == 1:
                        _district_to_city[zone_short] = city_short
                continue
            city_short = city.replace("市", "").replace("地区", "").replace("自治州", "").replace("盟", "")
            # 跳过"县/区/旗"等分组键（如重庆市下的"县"类）
            if city_short in ("县", "区", "旗"):
                continue
            _city_set.add(city_short)
            _prov_city_zone[prov][city_short] = list(zones.keys())
            for zone in zones:
                zone_short = zone.replace("市", "").replace("区", "").replace("县", "").replace("旗", "")
                if _district_name_count.get(zone_short, 0) == 1:
                    _district_to_city[zone_short] = city_short
    # 直辖市：省=市
    for prov in ["北京市", "天津市", "上海市", "重庆市"]:
        city = prov.replace("市", "")
        _city_set.add(city)
    # 港澳台与海外（不在地名词库，作为独立城市保留）
    for extra in ["香港", "澳门", "台湾"]:
        _city_set.add(extra)
except Exception:
    pass

# 海外/境外城市与国家：解析失败但保留原值的白名单
_OVERSEAS = {"新加坡", "墨西哥城", "开罗", "圣地亚哥", "慕尼黑", "莫斯科", "印度尼西亚", "乌兹别克斯坦",
             "约翰内斯堡", "圣何塞", "罗安达", "阿比让", "巴黎", "胡志明市", "米兰", "伦敦", "纽约",
             "东京", "首尔", "悉尼", "迪拜", "曼谷", "吉隆坡", "多伦多", "温哥华", "柏林", "马德里",
             "罗马", "苏黎世", "日内瓦", "华盛顿", "旧金山", "洛杉矶", "芝加哥", "西雅图", "波士顿"}

_SEP_RE = re.compile(r"[、，,;/／\s]+")


def _clean_suffix(s: str) -> str:
    """去省市前后缀的常规化：广东广州->广州，北京市->北京，广州（市）->广州"""
    s = s.strip().strip("）").strip(")").strip()
    # 去"省/市/自治区"等后缀
    s = s.replace("省", "").replace("市", "").replace("自治区", "").replace("特别行政区", "").replace("地区", "")
    return s


def _clean_district(s: str) -> str:
    """去掉区/县/旗后缀，用于区县名匹配：鼓楼区->鼓楼，闽侯县->闽侯"""
    return s.replace("区", "").replace("县", "").replace("旗", "")


def normalize_city(raw):
    """返回标准城市名（或 None）。多城市取第一个；场地地址尝试定位城市；无法解析返回原值清洗版。"""
    if not raw:
        return None
    s = str(raw).strip()
    if not s:
        return None
    if s in ("(null)", "None", "null", "未分类"):
        return None
    # 1) 精确别名
    if s in _city_aliases:
        v = _city_aliases[s]
        return None if v == "(null)" else v
    # 2) 多城市拆分（、 ， / 等分隔符，取第一个）
    parts = re.split(r"[、，,;/／]+", s)
    if len(parts) > 1:
        return normalize_city(parts[0].strip()) or None
    # 3) 市名直接命中
    if s in _city_set:
        return s
    cleaned = _clean_suffix(s)
    if cleaned in _city_set:
        return cleaned
    # 4) 省名 -> 保留省名（如"广东""湖北"），供省层级筛选
    for prov, cities in _prov_city_zone.items():
        if s == prov or cleaned == prov.replace("省", "").replace("自治区", "").replace("市", ""):
            return prov.replace("省", "").replace("自治区", "").replace("市", "")
    # 5) 区县 -> 所属市
    if cleaned in _district_to_city:
        return _district_to_city[cleaned]
    cleaned_dist = _clean_district(cleaned)
    if cleaned_dist in _district_to_city:
        return _district_to_city[cleaned_dist]
    # 6) 省前缀 + 市/区县（广东广州、四川邛崃、安徽马鞍山）
    for prov, cities in _prov_city_zone.items():
        prov_short = prov.replace("省", "").replace("自治区", "").replace("市", "")
        if s.startswith(prov_short) and len(s) > len(prov_short):
            rest = s[len(prov_short):]
            rest_clean = _clean_suffix(rest)
            if rest_clean in _city_set:
                return rest_clean
            rest_dist = _clean_district(rest_clean)
            if rest_dist in _district_to_city:
                return _district_to_city[rest_dist]
    # 7) 场地/地址：含已知市名或学校（福州大学/福建理工均在福州）
    for city in sorted(_city_set, key=len, reverse=True):
        if city in s:
            return city
    if "福建理工" in s or "福州大学" in s:
        return "福州"
    # 8) 海外
    if cleaned in _OVERSEAS or s in _OVERSEAS:
        return cleaned
    # 9) 无法归市的区县级残值（如"新兴县""新疆若羌县"）归 None，避免无意义选项
    if cleaned.endswith(("县", "区", "旗")):
        return None
    # 10) 兜底：疑似整段自由文本（招聘标题/场地描述/公司名，不是城市名）→ None，
    #     避免脏值进入城市维度（2026-10-07：曾有 403 条 >8 字脏 city，如
    #     "线下\n…\n中国农业发展银行2027年度校园招聘宣讲"）。
    #     标准城市名最长 4 字（石家庄/乌鲁木齐/秦皇岛/喀什/阿勒泰），设 5 字上限；
    #     含 ASCII 字母的数字串（"未知XYZ"）一律视为非城市。
    norm = re.sub(r"\s+", "", cleaned)
    if not norm or len(norm) > 5:
        return None
    if re.search(r"[A-Za-z]", norm):
        return None
    return norm


# 市名 -> 省简称（惰性构建；province 列反推用）
_city_to_prov = None


# 民族自治区「简称 -> cityTree 口径全名」：库里两种写法都存在，需归一
_PROV_SHORT_ALIAS = {"新疆": "新疆维吾尔", "广西": "广西壮族", "宁夏": "宁夏回族"}


def _build_city_to_prov():
    global _city_to_prov
    if _city_to_prov is None:
        m = {}
        for prov, cities in _prov_city_zone.items():
            # 与前端 cityTree 的 CITY_PROVINCES / PROVINCE_OF_CITY 口径保持一致：
            # 保留民族部分（新疆维吾尔 / 广西壮族 / 宁夏回族），勿裁成简称
            short = prov.replace("省", "").replace("自治区", "").replace("市", "")
            # 库里存在「省名被当作城市值」的行（如 city="福建"），此时省份即自身
            m.setdefault(short, short)
            for city in cities.keys():
                m.setdefault(city, short)
        for alias, full in _PROV_SHORT_ALIAS.items():
            m.setdefault(alias, full)
        for d in ("北京", "上海", "天津", "重庆"):
            m.setdefault(d, d)
        for extra in ("香港", "澳门", "台湾"):
            m.setdefault(extra, "港澳台")
        _city_to_prov = m
    return _city_to_prov


def normalize_province(city):
    """由城市名反推省级名（厦门->福建、乌鲁木齐->新疆维吾尔、香港->港澳台）。

    用途：填充 jobs.province（此前该列从未被写入，是死列）。
    口径对齐前端 lib/cityTree.ts 的 PROVINCE_OF_CITY，避免出现第二套省名。
    先过一遍 normalize_city，以覆盖「省+市」拼接值（如 广东鹤山 -> 鹤山 -> 广东）。
    未收录者（海外城市、脏值）返回 None —— 不猜测。
    """
    if not city:
        return None
    s = str(city).strip()
    if not s:
        return None
    if s in _MUNICIPALITIES.values():
        return s
    table = _build_city_to_prov()
    hit = table.get(s)
    if hit:
        return hit
    # 拼接值/带后缀值：先归一到标准城市再查
    c = normalize_city(s)
    if c and c != s:
        return table.get(c)
    return None


def normalize_industry(raw):
    """返回标准行业类目名；未命中返回「其他」；(null)/未分类 返回 None。
    注意：公司性质（外企/合资 等）不再归行业，走 normalize_company_type。"""
    if not raw:
        return None
    s = str(raw).strip()
    if not s:
        return None
    if s in ("(null)", "None", "null", "未分类"):
        return None
    # 公司性质词先拦截（避免误入"其他"）
    if normalize_company_type(s):
        return None
    # 精确匹配关键词（先整体试）
    for cat, kws in _industries.items():
        for kw in kws:
            if s == kw:
                return cat
    # 拼接值（& / 空格 / 、）拆段逐段匹配，取第一个命中
    segs = re.split(r"[&\s、，,;/／]+", s)
    for seg in segs:
        seg = seg.strip()
        if not seg:
            continue
        for cat, kws in _industries.items():
            for kw in kws:
                if kw and kw in seg:
                    return cat
    # 未命中
    return "其他"


# 公司性质维度（独立于行业）：源数据可能把"外企/合资"当行业写，现路由到 company_type
_COMPANY_TYPES = {
    "外企/合资": ["外企", "合资", "外资", "外商", "Foreign"],
    "国企/央企": ["国企", "央企", "国有", "国营"],
    "民企/私企": ["民企", "私企", "民营", "私营"],
    "上市公司/500强": ["上市公司", "500强", "世界500强", "上市"],
}

def normalize_company_type(raw):
    """返回标准公司性质；未命中返回 None（普通公司/无标注）。"""
    if not raw:
        return None
    s = str(raw).strip()
    if not s or s in ("(null)", "None", "null", "未分类"):
        return None
    for k, kws in _COMPANY_TYPES.items():
        for kw in kws:
            if kw and (kw in s or s == kw):
                return k
    return None


# 公司性质（按公司名映射）：company_types.json 为人工抽查确认的高置信映射（2026-09-29 建立）
_COMPANY_MAP = None
_COMPANY_MAP_PATH = os.path.join(CLASSIFY_DIR, "company_types.json")

def _load_company_map():
    global _COMPANY_MAP
    if _COMPANY_MAP is None:
        try:
            with open(_COMPANY_MAP_PATH, "r", encoding="utf-8") as f:
                _COMPANY_MAP = json.load(f)
        except Exception:
            _COMPANY_MAP = {}
    return _COMPANY_MAP

def normalize_company_by_name(name):
    """按公司名查映射返回公司性质；未命中返回 None（由 normalize_company_type 原文兜底）。"""
    if not name:
        return None
    s = str(name).strip()
    if not s:
        return None
    return _load_company_map().get(s)


if __name__ == "__main__":
    import collections
    cities = collections.Counter()
    inds = collections.Counter()
    lines = open(os.path.join(os.path.dirname(__file__), "_dim_probe.out"), encoding="utf-8").read().splitlines() if os.path.exists(os.path.join(os.path.dirname(__file__), "_dim_probe.out")) else []
    print("module ready. city_set:", len(_city_set), "districts:", len(_district_to_city), "industry cats:", len(_industries))
