"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginClient() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMsg("");

    try {
      if (mode === "register") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        });
        if (error) throw error;
        setMsg("注册成功！请检查邮箱验证后登录。");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push("/");
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || "操作失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
      background: "#171e19",
    }}>
      <div style={{
        width: "100%",
        maxWidth: "400px",
        background: "rgba(255,255,255,0.03)",
        borderRadius: "24px",
        padding: "40px 32px",
        border: "1px solid rgba(255,255,255,0.06)",
      }}>
        <h1 style={{
          fontSize: "28px",
          fontWeight: 900,
          color: "#eeebe3",
          marginBottom: "8px",
        }}>
          {mode === "login" ? "欢迎回来" : "加入 Offer派"}
        </h1>
        <p style={{
          fontSize: "14px",
          color: "rgba(238,235,227,0.5)",
          marginBottom: "32px",
        }}>
          {mode === "login" ? "登录后同步你的待投和收藏" : "免费公益 · 陪你拿到第一个 Offer"}
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {mode === "register" && (
            <div>
              <label style={{ fontSize: "12px", color: "rgba(238,235,227,0.6)", display: "block", marginBottom: "6px" }}>昵称</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="你的名字"
                style={inputStyle}
              />
            </div>
          )}
          <div>
            <label style={{ fontSize: "12px", color: "rgba(238,235,227,0.6)", display: "block", marginBottom: "6px" }}>邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ fontSize: "12px", color: "rgba(238,235,227,0.6)", display: "block", marginBottom: "6px" }}>密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 6 位"
              required
              minLength={6}
              style={inputStyle}
            />
          </div>

          {error && <p style={{ color: "#ef4444", fontSize: "13px" }}>{error}</p>}
          {msg && <p style={{ color: "#22c55e", fontSize: "13px" }}>{msg}</p>}

          <button
            type="submit"
            disabled={loading}
            style={{
              ...buttonStyle,
              opacity: loading ? 0.6 : 1,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "处理中..." : mode === "login" ? "登录" : "注册"}
          </button>
        </form>

        <p style={{
          marginTop: "24px",
          textAlign: "center",
          fontSize: "14px",
          color: "rgba(238,235,227,0.5)",
        }}>
          {mode === "login" ? "还没有账号？" : "已有账号？"}
          <button
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setMsg(""); }}
            style={{
              background: "none",
              border: "none",
              color: "#ca0013",
              cursor: "pointer",
              fontWeight: 700,
              marginLeft: "4px",
            }}
          >
            {mode === "login" ? "注册" : "登录"}
          </button>
        </p>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 16px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "12px",
  color: "#eeebe3",
  fontSize: "14px",
  outline: "none",
};

const buttonStyle: React.CSSProperties = {
  padding: "14px",
  background: "#ca0013",
  color: "#fff",
  border: "none",
  borderRadius: "12px",
  fontSize: "15px",
  fontWeight: 700,
  cursor: "pointer",
  marginTop: "8px",
};
