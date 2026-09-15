"use client";

import { useEffect, useRef } from "react";
import QRCodeStyling from "qr-code-styling";

export default function QRCode3D({ url }: { url: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const qrCode = new QRCodeStyling({
      width: 280,
      height: 280,
      data: url,
      dotsOptions: {
        type: "rounded",
        gradient: {
          type: "linear",
          rotation: 0,
          colorStops: [
            { offset: 0, color: "#f472b6" },
            { offset: 0.5, color: "#ec4899" },
            { offset: 1, color: "#be185d" },
          ],
        },
      },
      cornersSquareOptions: {
        type: "extra-rounded",
        gradient: {
          type: "linear",
          rotation: 0,
          colorStops: [
            { offset: 0, color: "#ec4899" },
            { offset: 1, color: "#be185d" },
          ],
        },
      },
      cornersDotOptions: {
        color: "#831843",
        type: "dot",
      },
      backgroundOptions: {
        color: "#fdf2f8",
      },
      image: "/logo.png",
      imageOptions: {
        crossOrigin: "anonymous",
        margin: 8,
        imageSize: 0.38,
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
      perspective: "1000px",
    }}>
      <div
        ref={ref}
        style={{
          borderRadius: 28,
          boxShadow: "0 30px 70px -15px rgba(236,72,153,0.35), 0 0 0 1px rgba(244,114,182,0.15)",
          transform: "rotateX(6deg) rotateY(-4deg)",
          transition: "transform 0.4s ease, box-shadow 0.4s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "rotateX(0deg) rotateY(0deg) scale(1.04)";
          e.currentTarget.style.boxShadow = "0 40px 90px -20px rgba(236,72,153,0.5), 0 0 0 1px rgba(244,114,182,0.25)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "rotateX(6deg) rotateY(-4deg)";
          e.currentTarget.style.boxShadow = "0 30px 70px -15px rgba(236,72,153,0.35), 0 0 0 1px rgba(244,114,182,0.15)";
        }}
      />
    </div>
  );
}
