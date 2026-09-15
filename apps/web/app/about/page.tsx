export const metadata = { title: "关于 Offer派" };

export default function AboutPage() {
  return (
    <div className="wrap" style={{ maxWidth: 560, margin: "0 auto", padding: "40px 20px 80px" }}>
      {/* Hero */}
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <img src="/logo.png" alt="Offer派" style={{ height: 72, borderRadius: 18, marginBottom: 20, boxShadow: "0 20px 50px -12px rgba(202,0,19,0.3)" }} />
        <h1 style={{ fontSize: 32, fontWeight: 900, color: "#eeebe3", margin: "0 0 10px", letterSpacing: "-0.02em" }}>
          Offer派
        </h1>
        <p style={{ color: "rgba(238,235,227,0.55)", fontSize: 15, margin: 0, lineHeight: 1.6 }}>
          免费公益的校招信息聚合工具
          <br />
          陪你拿到第一个 Offer
        </p>
      </div>

      {/* QQ 群卡片 */}
      <div style={{
        background: "rgba(255,255,255,0.02)",
        borderRadius: 32,
        padding: 36,
        marginBottom: 24,
        border: "1px solid rgba(183,198,194,0.15)",
        backdropFilter: "blur(20px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#06b6d4", boxShadow: "0 0 12px #06b6d4" }} />
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "#eeebe3", margin: 0 }}>加入交流群</h2>
        </div>
        <p style={{ color: "rgba(238,235,227,0.55)", fontSize: 14, margin: "0 0 24px", lineHeight: 1.6 }}>
          扫码进群，一起交流求职、分享内推、反馈建议
        </p>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <iframe
            src="http://caoryn.com/qr-tree/embed/?style=pine#payload=https%3A%2F%2Fqm.qq.com%2Fq%2Fcm28dcceEU"
            title="QQ群二维码"
            width="360"
            height="430"
            loading="lazy"
            style={{ border: 0, borderRadius: 24, overflow: "hidden", maxWidth: "100%" }}
          />
        </div>
      </div>

      {/* 数据来源卡片 */}
      <div style={{
        background: "rgba(255,255,255,0.02)",
        borderRadius: 32,
        padding: 32,
        border: "1px solid rgba(183,198,194,0.15)",
        backdropFilter: "blur(20px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ca0013", boxShadow: "0 0 12px #ca0013" }} />
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "#eeebe3", margin: 0 }}>数据来源</h2>
        </div>
        <p style={{ color: "rgba(238,235,227,0.55)", fontSize: 14, lineHeight: 1.8, margin: 0 }}>
          国家 24365 平台 · 福建理工大学就业网 · 福州大学人才在线 · 福建人才联合网 · 企业官网校招页
          <br /><br />
          所有岗位均跳转官方投递入口，本站不截留简历、不收集投递信息。
        </p>
      </div>
    </div>
  );
}
