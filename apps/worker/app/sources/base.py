# -*- coding: utf-8 -*-
"""数据源基类：统一 UA、限速、来源 Referer、失败重试。"""
import asyncio

import httpx

from ..config import settings


class BaseSource:
    name = "base"
    label = "基础源"
    retries = 3          # 网络失败重试次数
    retry_delay = 4      # 重试间隔（秒，指数退避基数）

    def __init__(self, client: httpx.AsyncClient):
        self.client = client
        self.s = settings

    async def _request(self, method: str, url: str, *, params=None, data=None, referer=None):
        """带重试的请求。重试仅针对连接/超时类错误，4xx/5xx 不重试。"""
        last_exc: Exception | None = None
        for attempt in range(self.retries):
            await asyncio.sleep(self.s.request_delay * (attempt + 1))
            try:
                headers = {
                    "User-Agent": self.s.user_agent,
                    "Referer": referer or url,
                }
                if method == "POST":
                    headers.update({
                        "X-Requested-With": "XMLHttpRequest",
                        "Content-Type": "application/x-www-form-urlencoded",
                    })
                resp = await self.client.request(
                    method, url, params=params, data=data, headers=headers
                )
                resp.raise_for_status()
                return resp
            except (httpx.ConnectError, httpx.ReadError, httpx.ReadTimeout,
                    httpx.ConnectTimeout, httpx.RemoteProtocolError) as e:
                last_exc = e
                if attempt < self.retries - 1:
                    await asyncio.sleep(self.retry_delay * (2 ** attempt))
                continue
            except httpx.HTTPStatusError as e:
                raise  # 4xx/5xx 不重试，直接抛
        raise last_exc

    async def _get(self, url: str, *, params: dict | None = None, referer: str | None = None):
        return await self._request("GET", url, params=params, referer=referer)

    async def _post(
        self,
        url: str,
        *,
        data: dict | None = None,
        referer: str | None = None,
    ):
        return await self._request("POST", url, data=data, referer=referer)

    async def fetch(self) -> list:
        """返回 Job 列表。子类实现。"""
        raise NotImplementedError
