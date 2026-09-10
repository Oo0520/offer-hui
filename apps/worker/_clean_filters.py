import psycopg

conn = psycopg.connect(
    "postgresql://postgres.sqmgjxazzpcfjutzscyu:zxzvbSSDG2741@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require",
    prepare_threshold=None,
)
cur = conn.cursor()

# 1. 城市统一映射
city_map = {
    "Beijing": "北京", "Shanghai": "上海", "Guangzhou": "广州",
    "Suzhou": "苏州", "Shenzhen": "深圳", "Chengdu": "成都",
    "Hangzhou": "杭州", "Nanjing": "南京", "Wuhan": "武汉",
    "Xi'an": "西安", "Tianjin": "天津", "Chongqing": "重庆",
    "Qingdao": "青岛", "Xiamen": "厦门", "Fuzhou": "福州",
    "Quanzhou": "泉州", "Hong Kong": "香港",
    "福州市": "福州", "厦门市": "厦门", "泉州市": "泉州",
    "漳州市": "漳州", "莆田市": "莆田", "宁德市": "宁德",
    "龙岩市": "龙岩", "福清市": "福清",
    "福建莆田": "莆田", "福建福州": "福州", "福建厦门": "厦门", "福建泉州": "泉州",
}
for old, new in city_map.items():
    cur.execute("UPDATE jobs SET city=%s WHERE city=%s", (new, old))
    if cur.rowcount:
        print(f"城市: {old} -> {new} ({cur.rowcount}条)")

# 空城市/中国 -> 全国
cur.execute("UPDATE jobs SET city='全国' WHERE city IS NULL OR city='' OR city='中国'")
print(f"空城市/中国 -> 全国 ({cur.rowcount}条)")

# 2. 学历统一映射
degree_map = {
    "大专": "专科及以上", "专科": "专科及以上", "专科及以上": "专科及以上",
    "本科": "本科及以上", "本科及以上": "本科及以上",
    "硕士": "硕士及以上", "硕士及以上": "硕士及以上",
    "博士": "博士及以上", "博士及以上": "博士及以上", "博士研究生": "博士及以上",
    "学历不限": "不限",
}
for old, new in degree_map.items():
    cur.execute("UPDATE jobs SET degree=%s WHERE degree=%s", (new, old))
    if cur.rowcount:
        print(f"学历: {old} -> {new} ({cur.rowcount}条)")
cur.execute("UPDATE jobs SET degree='不限' WHERE degree IS NULL OR degree=''")
print(f"空学历 -> 不限 ({cur.rowcount}条)")

# 3. 行业合并
industry_map = {
    "外企（中国分部）": "外企/合资",
    "外企": "外企/合资",
    "Engineering": "工程技术",
    "Professional Services": "专业服务",
    "Sales": "销售/市场",
    "Marketing": "销售/市场",
    "Manufacturing": "制造业",
    "Business Consulting": "咨询服务",
    "Strategy": "战略/咨询",
    "Product Management & Alliances": "产品管理",
}
for old, new in industry_map.items():
    cur.execute("UPDATE jobs SET industry=%s WHERE industry=%s", (new, old))
    if cur.rowcount:
        print(f"行业: {old} -> {new} ({cur.rowcount}条)")

conn.commit()
conn.close()
print("数据清洗完成")
