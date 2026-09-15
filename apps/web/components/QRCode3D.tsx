"use client";

import { useEffect, useRef } from "react";
import QRCodeStyling from "qr-code-styling";

export default function QRCode3D({ url }: { url: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const qrCode = new QRCodeStyling({
      width: 260,
      height: 260,
      data: url,
      margin: 8,
      dotsOptions: {
        color: "#171e19",
        type: "rounded",
      },
      cornersSquareOptions: {
        color: "#171e19",
        type: "extra-rounded",
      },
      cornersDotOptions: {
        color: "#171e19",
        type: "dot",
      },
      backgroundOptions: {
        color: "#ffffff",
      },
      image: "/logo.png",
      imageOptions: {
        crossOrigin: "anonymous",
        margin: 6,
        imageSize: 0.3,
        hideBackgroundDots: true,
      },
    });

    ref.current.innerHTML = "";
    qrCode.append(ref.current);
  }, [url]);

  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      padding: "20px 0",
    }}>
      <div
        ref={ref}
        style={{
          borderRadius: 20,
          boxShadow: "0 20px 50px -15px rgba(0,0,0,0.4)",
        }}
      />
    </div>
  );
}
