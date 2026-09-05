# -*- coding: utf-8 -*-
"""全局配置：从 .env / 环境变量读取。"""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


class Settings:
    # 存储
    storage_backend = os.getenv("STORAGE_BACKEND", "sqlite")  # sqlite | postgres | supabase
    db_path = os.getenv("DB_PATH", str(BASE_DIR / "data" / "offer.db"))
    database_url = os.getenv("DATABASE_URL", "")              # postgres 直连串
    supabase_url = os.getenv("SUPABASE_URL", "")
    supabase_service_key = os.getenv("SUPABASE_SERVICE_KEY", "")

    # 爬虫
    user_agent = os.getenv(
        "USER_AGENT",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    )
    request_delay = float(os.getenv("REQUEST_DELAY", "1.2"))  # 秒，源间限速
    max_items_per_source = int(os.getenv("MAX_ITEMS_PER_SOURCE", "30"))


settings = Settings()
