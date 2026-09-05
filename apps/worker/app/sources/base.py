# -*- coding: utf-8 -*-
"""数据源基类：统一 UA、限速、来源 Referer。"""
import asyncio

import httpx

from ..config import settings


class BaseSource:
    name = "base"
    label = "基础源"

    def __init__(self, client: httpx.AsyncClient):
        self.client = client
        self.s = settings

    async def _get(self, url: str, *, params: dict | None = None, referer: str | None = None):
        await asyncio.sleep(self.s.request_delay)  # 源间限速，遵守克制原则
        resp = await self.client.get(
            url,
            params=params,
            headers={
                "User-Agent": self.s.user_agent,
                "Referer": referer or url,
            },
        )
        resp.raise_for_status()
        return resp

    async def _post(
        self,
        url: str,
        *,
        data: dict | None = None,
        referer: str | None = None,
    ):
        await asyncio.sleep(self.s.request_delay)
        resp = await self.client.post(
            url,
            data=data,
            headers={
                "User-Agent": self.s.user_agent,
                "Referer": referer or url,
                "X-Requested-With": "XMLHttpRequest",
                "Content-Type": "application/x-www-form-urlencoded",
            },
        )
        resp.raise_for_status()
        return resp

    async def fetch(self) -> list:
        """返回 Job 列表。子类实现。"""
        raise NotImplementedError
