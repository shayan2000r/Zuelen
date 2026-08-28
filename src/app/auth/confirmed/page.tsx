"use client";

import { CheckCircle2, LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { safeInternalDestination } from "@/lib/safe-navigation";

export default function AuthConfirmedPage() {
  const router = useRouter();
  const [seconds, setSeconds] = useState(2);

  const destination = useMemo(() => {
    if (typeof window === "undefined") return "/setup";
    const value = new URLSearchParams(window.location.search).get("next");
    return safeInternalDestination(value) ?? "/setup";
  }, []);

  const destinationLabel = destination.startsWith("/professional")
    ? "your professional setup"
    : destination.startsWith("/setup")
      ? "your Zuelen setup"
      : "Zuelen";

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSeconds((value) => Math.max(0, value - 1));
    }, 1000);

    const timeout = window.setTimeout(() => {
      router.replace(destination);
      router.refresh();
    }, 1800);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [destination, router]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background:
          "radial-gradient(circle at top, rgba(93, 121, 73, 0.08), transparent 35%), #fafafa",
        color: "#22251f",
        fontFamily: "Inter, Arial, sans-serif",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 520,
          padding: "44px 36px",
          borderRadius: 24,
          border: "1px solid #e4e8df",
          background: "rgba(255,255,255,0.96)",
          boxShadow: "0 24px 70px rgba(35, 43, 30, 0.08)",
          textAlign: "center",
        }}
      >
        <img
          src="/zuelen-icon.png"
          alt="Zuelen"
          width={52}
          height={52}
          style={{ display: "block", margin: "0 auto 24px", objectFit: "contain" }}
        />

        <div
          style={{
            width: 58,
            height: 58,
            margin: "0 auto 20px",
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            background: "#eef5e9",
            color: "#526b43",
          }}
        >
          <CheckCircle2 size={30} strokeWidth={1.9} />
        </div>

        <p
          style={{
            margin: "0 0 10px",
            color: "#607255",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: ".08em",
            textTransform: "uppercase",
          }}
        >
          Email verified
        </p>
        <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.15, letterSpacing: "-.03em" }}>
          Your Zuelen account is ready.
        </h1>
        <p style={{ margin: "16px auto 0", maxWidth: 390, color: "#71776d", fontSize: 15, lineHeight: 1.65 }}>
          Let&apos;s configure how you&apos;ll use Zuelen. We&apos;re taking you to {destinationLabel} now.
        </p>

        <div
          style={{
            marginTop: 28,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            color: "#526b43",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <LoaderCircle size={15} style={{ animation: "spin 1s linear infinite" }} />
          Redirecting{seconds > 0 ? ` in ${seconds}s` : "…"}
        </div>

        <style jsx>{`
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </section>
    </main>
  );
}
