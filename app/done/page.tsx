"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function DoneContent() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status") || "error";
  const days = searchParams.get("days");
  const name = searchParams.get("name");
  const msg = searchParams.get("msg");

  if (status === "success") {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.successIcon}>✓</div>
          <h1 style={styles.title}>Data Shared Successfully</h1>
          <p style={styles.subtitle}>
            {days} days of Oura Ring data has been added to
            {name ? ` ${name}'s` : " your"} medical record at Tucker Medical.
          </p>
          <div style={styles.infoBox}>
            <p><strong>What happens next?</strong></p>
            <p style={{ marginTop: 6 }}>
              Your care team will review this data before your next visit. The
              access token has been revoked — Tucker Medical no longer has access
              to your Oura account.
            </p>
          </div>
          <p style={styles.finePrint}>You can close this window.</p>
        </div>
        <div style={styles.footer}>Tucker Medical Pte Ltd · Singapore</div>
      </div>
    );
  }

  if (status === "cancelled") {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.cancelIcon}>—</div>
          <h1 style={styles.title}>Authorisation Cancelled</h1>
          <p style={styles.subtitle}>
            No data was shared. You can close this window or try again using the
            link from Tucker Medical.
          </p>
        </div>
        <div style={styles.footer}>Tucker Medical Pte Ltd · Singapore</div>
      </div>
    );
  }

  // Error
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.errorIcon}>✕</div>
        <h1 style={styles.title}>Something Went Wrong</h1>
        <p style={styles.subtitle}>
          {msg === "no_data"
            ? "No Oura Ring data was found. Please ensure your ring is synced and you have an active Oura membership."
            : "We couldn't complete the data transfer. Please try again using the link from Tucker Medical, or contact the clinic for assistance."}
        </p>
        <div style={styles.contactBox}>
          <p>Need help? Contact us at <strong>info@tuckermedical.com</strong></p>
        </div>
      </div>
      <div style={styles.footer}>Tucker Medical Pte Ltd · Singapore</div>
    </div>
  );
}

export default function DonePage() {
  return (
    <Suspense
      fallback={
        <div style={styles.container}>
          <div style={styles.card}>
            <p>Processing...</p>
          </div>
        </div>
      }
    >
      <DoneContent />
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
  successIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    background: "#ecfdf5",
    color: "#059669",
    fontSize: 28,
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  cancelIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    background: "#f3f4f6",
    color: "#6b7280",
    fontSize: 28,
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  errorIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    background: "#fef2f2",
    color: "#ef4444",
    fontSize: 28,
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: "#111827",
    margin: "0 0 8px",
  },
  subtitle: {
    fontSize: 15,
    color: "#6b7280",
    lineHeight: 1.5,
    margin: "0 0 24px",
  },
  infoBox: {
    background: "#f0fdfa",
    borderRadius: 12,
    padding: "16px 18px",
    fontSize: 13,
    color: "#374151",
    lineHeight: 1.5,
    textAlign: "left" as const,
    marginBottom: 20,
  },
  contactBox: {
    background: "#f9fafb",
    borderRadius: 12,
    padding: "14px 18px",
    fontSize: 13,
    color: "#6b7280",
  },
  finePrint: {
    fontSize: 13,
    color: "#9ca3af",
  },
  footer: {
    marginTop: 24,
    fontSize: 12,
    color: "#9ca3af",
  },
};
