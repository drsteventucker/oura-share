export default function Home() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8faf9" }}>
      <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "#0d9488", color: "#fff", fontSize: 16, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>TM</div>
        <p style={{ fontWeight: 600, color: "#374151", marginBottom: 4 }}>Tucker Medical</p>
        <p>Wearable Data Sharing</p>
        <p style={{ marginTop: 16, fontSize: 12 }}>Please use the link sent by your care team.</p>
      </div>
    </div>
  );
}
