import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 允许内网穿透域名访问 dev 资源（HMR/脚本），避免手机远程打开时动效失效
  allowedDevOrigins: [
    "*.trycloudflare.com",
    "*.cloudflared.net",
    "localhost",
    "127.0.0.1",
  ],
};

export default nextConfig;
