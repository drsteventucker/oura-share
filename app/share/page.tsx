"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ShareContent() {
  const searchParams = useSearchParams();
  const pid = searchParams.get("pid");

  if (!pid) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.errorIcon}>✕</div>
          <h1 style={styles.title}>Invalid Link</h1>
          <p style={styles.subtitle}>
            This link appears to be incomplete. Please use the link sent to you
            by Tucker Medical.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logo}>TM</div>
        <div style={styles.brand}>Tucker Medical</div>

        {/* Oura ring icon */}
        <div style={styles.ringIcon}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="20" stroke="#0d9488" strokeWidth="3" fill="none" />
            <circle cx="24" cy="24" r="13" stroke="#0d9488" strokeWidth="2" fill="none" opacity="0.4" />
            <circle cx="24" cy="12" r="3" fill="#0d9488" />
          </svg>
        </div>

        <h1 style={styles.title}>Share Your Oura Ring Data</h1>

        <p style={styles.subtitle}>
          Your care team would like to review your recent sleep, heart rate, and
          activity data before your next visit.
        </p>

        {/* What we access */}
        <div style={styles.dataList}>
          {[
            "Sleep duration & quality",
            "Heart rate variability (HRV)",
            "Resting heart rate",
            "Activity & readiness scores",
          ].map((item) => (
            <div key={item} style={styles.dataItem}>
              <span style={styles.checkmark}>✓</span>
              <span>{item}</span>
            </div>
          ))}
        </div>

        {/* Connect button */}
        <a href={`/api/connect?pid=${pid}`} style={styles.button}>
          Connect Oura Ring
        </a>

        {/* Fine print */}
        <div style={styles.finePrint}>
          <p>
            You'll be redirected to Oura to log in and authorise access. Your
            data is used once for this visit and handled in accordance with
            PDPA.
          </p>
          <p style={{ marginTop: 8 }}>
            <strong>Requires active Oura membership.</strong>
          </p>
        </div>
      </div>

      {/* Footer */}
      <div style={styles.footer}>Tucker Medical Pte Ltd · Singapore</div>
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense
      fallback={
        <div style={styles.container}>
          <div style={styles.card}>
            <p>Loading...</p>
          </div>
        </div>
      }
    >
      <ShareContent />
    </Suspense>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    background: "#f8faf9",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px 16px",
  },
  card: {
    background: "#fff",
    borderRadius: 16,
    padding: "40px 32px",
    maxWidth: 420,
    width: "100%",
    textAlign: "center" as const,
    boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.04)",
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: "#0d9488",
    color: "#fff",
    fontSize: 16,
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  brand: {
    fontSize: 13,
    fontWeight: 600,
    color: "#374151",
    marginBottom: 24,
  },
  ringIcon: {
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: "#111827",
    margin: "0 0 8px",
    lineHeight: 1.3,
  },
  subtitle: {
    fontSize: 15,
    color: "#6b7280",
    lineHeight: 1.5,
    margin: "0 0 24px",
  },
  dataList: {
    textAlign: "left" as const,
    background: "#f0fdfa",
    borderRadius: 12,
    padding: "14px 18px",
    marginBottom: 24,
  },
  dataItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 14,
    color: "#374151",
    padding: "5px 0",
  },
  checkmark: {
    color: "#0d9488",
    fontWeight: 700,
    fontSize: 15,
  },
  button: {
    display: "block",
    background: "#0d9488",
    color: "#fff",
    fontSize: 16,
    fontWeight: 600,
    padding: "14px 24px",
    borderRadius: 12,
    textDecoration: "none",
    marginBottom: 20,
    transition: "background 0.15s",
  },
  finePrint: {
    fontSize: 12,
    color: "#9ca3af",
    lineHeight: 1.5,
  },
  footer: {
    marginTop: 24,
    fontSize: 12,
    color: "#9ca3af",
  },
  errorIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    background: "#fef2f2",
    color: "#ef4444",
    fontSize: 24,
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
};
