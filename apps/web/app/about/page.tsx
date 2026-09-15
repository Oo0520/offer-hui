export const metadata = { title: "关于 Offer派" };

export default function AboutPage() {
  return (
    <div className="wrap" style={{ maxWidth: 640, margin: "0 auto", padding: "40px 20px" }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <img src="/logo.png" alt="Offer派" style={{ height: 64, borderRadius: 16, marginBottom: 16 }} />
        <h1 style={{ fontSize: 28, fontWeight: 900, color: "#eeebe3", margin: "0 0 8px" }}>关于 Offer派</h1>
        <p style={{ color: "rgba(238,235,227,0.6)", fontSize: 14 }}>
          免费公益的校招信息聚合工具，陪你拿到第一个 Offer
        </p>
      </div>

      <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 24, padding: 32, marginBottom: 32, border: "1px solid rgba(183,198,194,0.15)" }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: "#eeebe3", margin: "0 0 16px" }}>加入 QQ 交流群</h2>
        <p style={{ color: "rgba(238,235,227,0.6)", fontSize: 14, margin: "0 0 24px", lineHeight: 1.6 }}>
          扫码加入 QQ 群，一起交流求职经验、分享内推信息、反馈产品建议。
          <br />群里都是找工作的同学，互帮互助～
        </p>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <iframe
            src="http://caoryn.com/qr-tree/embed/?style=pine#payload=https%3A%2F%2Fqm.qq.com%2Fq%2Fcm28dcceEU"
            title="QQ群二维码"
            width="420"
            height="500"
            loading="lazy"
            style={{ border: 0, borderRadius: 24, overflow: "hidden", maxWidth: "100%" }}
          />
        </div>
      </div>

      <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 24, padding: 32, border: "1px solid rgba(183,198,194,0.15)" }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: "#eeebe3", margin: "0 0 16px" }}>数据来源</h2>
        <p style={{ color: "rgba(238,235,227,0.6)", fontSize: 14, lineHeight: 1.8, margin: 0 }}>
          国家 24365 平台 · 福建理工大学就业网 · 福州大学人才在线 · 福建人才联合网 · 企业官网校招页
          <br /><br />
          所有岗位均跳转官方投递入口，本站不截留简历、不收集投递信息。
        </p>
      </div>
    </div>
  );
}
