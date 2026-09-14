import re
import requests
from bs4 import BeautifulSoup

url = "https://fjut.jysd.com/teachin"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
r = requests.get(url, headers=HEADERS, timeout=15)
r.encoding = "utf-8"
soup = BeautifulSoup(r.text, "html.parser")

# 找含"飞毛腿"的元素
for tag in soup.find_all(string=re.compile("飞毛腿")):
    parent = tag.parent
    print("TAG:", parent.name, "class:", parent.get("class"))
    print("TEXT:", parent.get_text(" ", strip=True)[:200])
    print("PARENT:", parent.parent.name, parent.parent.get("class"))
    print("PARENT TEXT:", parent.parent.get_text(" ", strip=True)[:300])
    print("---")
