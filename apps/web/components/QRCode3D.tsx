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
      dotsOptions: {
        color: "#0f5132",
        type: "rounded",
        gradient: {
          type: "linear",
          rotation: 0,
          colorStops: [
            { offset: 0, color: "#1a5c3a" },
            { offset: 1, color: "#0d3b24" },
          ],
        },
      },
      cornersSquareOptions: {
        color: "#0f5132",
        type: "extra-rounded",
      },
      cornersDotOptions: {
        color: "#ca0013",
        type: "dot",
      },
      backgroundOptions: {
        color: "#e8f5e9",
      },
      image: "/logo.png",
      imageOptions: {
        crossOrigin: "anonymous",
        margin: 6,
        imageSize: 0.35,
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
      perspective: "800px",
    }}>
      <div
        ref={ref}
        style={{
          borderRadius: 24,
          boxShadow: "0 25px 60px -15px rgba(15,81,50,0.4), 0 0 0 1px rgba(183,198,194,0.1)",
          transform: "rotateX(5deg) rotateY(-3deg)",
          transition: "transform 0.3s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "rotateX(0deg) rotateY(0deg) scale(1.03)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "rotateX(5deg) rotateY(-3deg)";
        }}
      />
    </div>
  );
}
