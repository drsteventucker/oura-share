"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";

function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState("processing");
  const [step, setStep] = useState("Connecting to Oura...");

  const code = searchParams.get("code");
  const state = searchParams.get("state"); // patient_id
  const error = searchParams.get("error");

  useEffect(() => {
    if (error) {
      router.replace("/done?status=cancelled");
      return;
    }
    if (!code || !state) {
      router.replace("/done?status=error&msg=missing_params");
      return;
    }

    // Call processing API
    async function process() {
      try {
        setStep("Exchanging authorisation...");
        await new Promise((r) => setTimeout(r, 500));

        setStep("Pulling your Oura data...");
        const resp = await fetch(`/api/process?code=${code}&pid=${state}`);
        const result = await resp.json();

        if (result.success) {
          setStep("Done!");
          setStatus("success");
          await new Promise((r) => setTimeout(r, 500));
          router.replace(
            `/done?status=success&days=${result.days}&name=${encodeURIComponent(result.patientName || "")}`
          );
        } else {
          router.replace(
            `/done?status=error&msg=${encodeURIComponent(result.error || "unknown")}`
          );
        }
      } catch (err: any) {
        router.replace(`/done?status=error&msg=${encodeURIComponent(err.message)}`);
      }
    }

    process();
  }, [code, state, error, router]);

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logo}>TM</div>

        {/* Spinner */}
        <div style={styles.spinnerWrap}>
          <div style={styles.spinner} />
        </div>

        <h1 style={styles.title}>Processing Your Data</h1>
        <p style={styles.step}>{step}</p>
        <p style={styles.subtitle}>
          This takes 15–30 seconds. Please don't close this window.
        </p>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default function CallbackPage() {
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
      <CallbackContent />
    </Suspense>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    background: "#f8faf9",
    display: "flex",
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
    marginBottom: 24,
  },
  spinnerWrap: {
    marginBottom: 20,
  },
  spinner: {
    width: 40,
    height: 40,
    border: "3px solid #e5e7eb",
    borderTopColor: "#0d9488",
    borderRadius: "50%",
    display: "inline-block",
    animation: "spin 0.8s linear infinite",
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    color: "#111827",
    margin: "0 0 8px",
  },
  step: {
    fontSize: 14,
    fontWeight: 500,
    color: "#0d9488",
    margin: "0 0 8px",
  },
  subtitle: {
    fontSize: 13,
    color: "#9ca3af",
    lineHeight: 1.5,
    margin: 0,
  },
};
