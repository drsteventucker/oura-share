// lib/oura.ts — Oura data pull + processing + Plato POST

const CLIENT_ID = "36e8de69-ce5f-44dc-bc0b-5bdc144c8e5f";
const CALLBACK = "https://oura-share-git-main-stucker-3869s-projects.vercel.app/callback";

interface DailyRecord {
  date: string;
  [key: string]: any;
}

interface WindowStats {
  n: number;
  [key: string]: number | null;
}

interface Finding {
  color: string;
  arrow: string;
  label: string;
  detail: string;
}

export async function exchangeCode(code: string): Promise<string> {
  const secret = process.env.OURA_CLIENT_SECRET || "";

  console.log("Exchange attempt:", {
    code_length: code.length,
    secret_length: secret.length,
    redirect_uri: CALLBACK,
    client_id: CLIENT_ID,
  });

  const body = new URLSearchParams();
  body.append("grant_type", "authorization_code");
  body.append("code", code);
  body.append("redirect_uri", CALLBACK);
  body.append("client_id", CLIENT_ID);
  body.append("client_secret", secret);

  const resp = await fetch("https://api.ouraring.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const text = await resp.text();
  console.log("Exchange response:", resp.status, text.substring(0, 200));

  if (!resp.ok) {
    throw new Error("Token exchange failed: " + resp.status + " " + text);
  }

  return JSON.parse(text).access_token;
}

async function pullEndpoint(token: string, endpoint: string, start: string, end: string): Promise<any[]> {
  const records: any[] = [];
  const chunks = getDateChunks(start, end);
  for (const [s, e] of chunks) {
    const url = "https://api.ouraring.com/v2/usercollection/" + endpoint + "?start_date=" + s + "&end_date=" + e;
    const resp = await fetch(url, { headers: { Authorization: "Bearer " + token } });
    if (resp.ok) {
      const data = await resp.json();
      records.push(...(data.data || []));
    }
  }
  const seen = new Set<string>();
  return records.filter((r) => {
    const id = r.id || JSON.stringify(r);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function getDateChunks(start: string, end: string): [string, string][] {
  const chunks: [string, string][] = [];
  const s = new Date(start);
  const e = new Date(end);
  let cur = new Date(s);
  while (cur < e) {
    const ce = new Date(cur);
    ce.setMonth(ce.getMonth() + 6);
    if (ce > e) ce.setTime(e.getTime());
    chunks.push([fmtd(cur), fmtd(ce)]);
    cur = new Date(ce);
    cur.setDate(cur.getDate() + 1);
  }
  return chunks;
}

function fmtd(d: Date): string { return d.toISOString().split("T")[0]; }

export async function pullAllData(token: string) {
  const end = fmtd(new Date());
  const start = "2024-01-01";
  const [dailySleep, sleep, readiness, activity] = await Promise.all([
    pullEndpoint(token, "daily_sleep", start, end),
    pullEndpoint(token, "sleep", start, end),
    pullEndpoint(token, "daily_readiness", start, end),
    pullEndpoint(token, "daily_activity", start, end),
  ]);
  console.log("Pulled:", dailySleep.length, sleep.length, readiness.length, activity.length);
  return { dailySleep, sleep, readiness, activity };
}

export function processData(raw: any): { records: Map<string, DailyRecord>; allDays: string[] } {
  const dailySleepMap = new Map(raw.dailySleep.filter((r: any) => r.day).map((r: any) => [r.day, r]));
  const sleepDetail = new Map<string, any>();
  for (const r of raw.sleep) {
    if (r.type === "long_sleep" && r.day) {
      const ex = sleepDetail.get(r.day);
      if (!ex || (r.total_sleep_duration || 0) > (ex.total_sleep_duration || 0)) sleepDetail.set(r.day, r);
    }
  }
  const readinessMap = new Map(raw.readiness.filter((r: any) => r.day).map((r: any) => [r.day, r]));
  const activityMap = new Map(raw.activity.filter((r: any) => r.day).map((r: any) => [r.day, r]));

  const allDaysSet = new Set([...dailySleepMap.keys(), ...sleepDetail.keys(), ...readinessMap.keys(), ...activityMap.keys()]);
  const allDays = [...allDaysSet].sort() as string[];

  const records = new Map<string, DailyRecord>();
  for (const day of allDays) {
    const rec: DailyRecord = { date: day };
    const sd: any = sleepDetail.get(day);
    if (sd) {
      rec.sleep_h = sd.total_sleep_duration ? Math.round(sd.total_sleep_duration / 3600 * 100) / 100 : null;
      rec.deep_min = sd.deep_sleep_duration ? Math.round(sd.deep_sleep_duration / 60) : null;
      rec.rem_min = sd.rem_sleep_duration ? Math.round(sd.rem_sleep_duration / 60) : null;
      rec.efficiency = sd.efficiency ?? null;
      rec.avg_hr_sleep = sd.average_heart_rate ?? null;
      rec.lowest_hr = sd.lowest_heart_rate ?? null;
      rec.avg_hrv = sd.average_hrv ?? null;
    }
    const ds: any = dailySleepMap.get(day);
    if (ds) rec.sleep_score = ds.score ?? null;
    const rd: any = readinessMap.get(day);
    if (rd) rec.readiness_score = rd.score ?? null;
    const ac: any = activityMap.get(day);
    if (ac) { rec.steps = ac.steps ?? null; rec.active_cal = ac.active_calories ?? null; rec.activity_score = ac.score ?? null; }
    records.set(day, rec);
  }
  return { records, allDays };
}

const KEYS = ["sleep_h","deep_min","rem_min","efficiency","avg_hrv","avg_hr_sleep","lowest_hr","readiness_score","sleep_score","steps","active_cal","activity_score"];

function wstats(records: Map<string, DailyRecord>, days: string[]): WindowStats {
  const recs = days.map(d => records.get(d)).filter(Boolean) as DailyRecord[];
  const st: WindowStats = { n: recs.length };
  for (const k of KEYS) {
    const vals = recs.map(r => r[k]).filter((v: any) => v != null) as number[];
    st[k] = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10 : null;
  }
  return st;
}

function drange(allDays: string[], s: Date, e: Date): string[] {
  const ss = fmtd(s), ee = fmtd(e);
  return allDays.filter(d => d >= ss && d <= ee);
}

function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function mean(v: number[]): number { return v.reduce((a, b) => a + b, 0) / v.length; }
function rnd(n: number, d: number): number { const f = Math.pow(10, d); return Math.round(n * f) / f; }

export function generateNote(records: Map<string, DailyRecord>, allDays: string[], patientName: string) {
  const today = new Date(allDays[allDays.length - 1]);
  const c2e = today, c2s = addDays(today, -13);
  const p2e = addDays(c2s, -1), p2s = addDays(p2e, -13);
  const b90s = addDays(today, -89);

  const cur2 = drange(allDays, c2s, c2e);
  const pri2 = drange(allDays, p2s, p2e);
  const d90 = drange(allDays, b90s, c2e);

  const sc = wstats(records, cur2), sp = wstats(records, pri2), s90 = wstats(records, d90);

  const anomalies: string[] = [];
  for (const d of cur2) {
    const r = records.get(d);
    if (!r) continue;
    if (r.sleep_h && r.sleep_h < 5) anomalies.push(d + ": Sleep " + r.sleep_h + "h (<5h)");
    if (r.avg_hrv && r.avg_hrv < 10) anomalies.push(d + ": HRV " + r.avg_hrv + "ms (<10)");
    if (r.readiness_score && r.readiness_score < 50) anomalies.push(d + ": Readiness " + r.readiness_score + " (<50)");
  }

  const findings: Finding[] = [];
  const months = new Map<string, string[]>();
  for (const d of allDays) { const m = d.substring(0, 7); if (!months.has(m)) months.set(m, []); months.get(m)!.push(d); }
  const ms = [...months.entries()].sort().map(([m, days]) => ({ m, ...wstats(records, days) }));
  if (ms.length >= 6) {
    const early = ms.slice(0, 6), late = ms.slice(-3);
    const chk = (key: string, label: string, upBad: boolean, thr: number) => {
      const ev = early.map(m => (m as any)[key]).filter((v: any) => v != null) as number[];
      const lv = late.map(m => (m as any)[key]).filter((v: any) => v != null) as number[];
      if (ev.length < 3 || lv.length < 2) return;
      const ea = rnd(mean(ev), 1), la = rnd(mean(lv), 1), pct = ((la - ea) / ea) * 100;
      if (Math.abs(pct) > thr) {
        const dec = pct < 0, bad = upBad ? !dec : dec;
        findings.push({ color: bad ? "#ef4444" : "#34d399", arrow: dec ? "↓" : "↑",
          label: label + " " + (dec ? "declining" : upBad ? "rising" : "improving"),
          detail: ea + " (early) → " + la + " (recent). " + (pct > 0 ? "+" : "") + rnd(pct, 0) + "%" });
      }
    };
    chk("avg_hrv", "HRV", false, 10); chk("avg_hr_sleep", "RHR", true, 5);
    chk("steps", "Steps", false, 15); chk("readiness_score", "Readiness", false, 8);
  }

  const fv = (v: number | null, u = "") => v == null ? "—" : rnd(v, 1) + u;
  const delta = (c: number | null, b: number | null) => {
    if (c == null || b == null || b === 0) return "—";
    const d = c - b, pct = (d / b) * 100;
    return (d > 0 ? "+" : "") + rnd(d, 1) + " (" + (pct > 0 ? "+" : "") + rnd(pct, 0) + "%)";
  };

  let note = "WEARABLE DATA — LONGITUDINAL CLINICAL REVIEW\n" + "=".repeat(66) + "\n";
  note += "Patient: " + patientName + "\nDevice: Oura Ring Gen4\n";
  note += "Data range: " + allDays[0] + " → " + allDays[allDays.length - 1] + " (" + allDays.length + " days)\n";
  note += "Generated: " + new Date().toISOString().replace("T", " ").substring(0, 16) + " SGT\nTucker Medical Pte Ltd\n\n";
  note += "--- CURRENT 2WK vs PRIOR 2WK ---\n";
  note += "Current: " + fmtd(c2s) + " → " + fmtd(c2e) + " (" + cur2.length + " days)\n";
  note += "Prior:   " + fmtd(p2s) + " → " + fmtd(p2e) + " (" + pri2.length + " days)\n\n";

  const metrics = [["sleep_h","Sleep","h"],["deep_min","Deep","min"],["rem_min","REM","min"],["efficiency","Eff","%"],
    ["avg_hrv","HRV","ms"],["avg_hr_sleep","RHR","bpm"],["lowest_hr","LowHR","bpm"],["readiness_score","Readiness",""],
    ["sleep_score","Sleep Sc",""],["steps","Steps",""],["active_cal","Active Cal","kcal"],["activity_score","Act Sc",""]];

  note += "Metric".padEnd(14) + "Cur 2wk".padStart(10) + "Prior 2wk".padStart(12) + "Delta".padStart(14) + "90-day".padStart(10) + "\n" + "-".repeat(60) + "\n";
  for (const [k, l, u] of metrics) {
    note += (l as string).padEnd(14) + fv(sc[k], u as string).padStart(10) + fv(sp[k], u as string).padStart(12) + delta(sc[k], sp[k]).padStart(14) + fv(s90[k], u as string).padStart(10) + "\n";
  }
  if (anomalies.length) { note += "\n--- ALERTS ---\n"; anomalies.forEach(a => note += "  ! " + a + "\n"); }
  if (findings.length) { note += "\n--- KEY TRENDS ---\n"; findings.forEach((f, i) => note += "  " + (i + 1) + ". " + f.label + ": " + f.detail + "\n"); }
  note += "\nFor clinical review. Oura Ring Gen4 via REST API v2.\n";

  return { note, findings, anomalies };
}

export async function postToPlato(patientId: string, noteText: string): Promise<boolean> {
  const key = process.env.PLATO_API_KEY, db = process.env.PLATO_DB;
  if (!key || !db) { console.error("Missing Plato creds"); return false; }

  const escaped = noteText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = '<div style="font-family:monospace;font-size:12px;line-height:1.6;"><div style="background:#f0f7ff;border-left:4px solid #2563eb;padding:12px 16px;margin-bottom:16px;"><strong style="color:#1e40af;font-size:14px;">WEARABLE DATA — LONGITUDINAL CLINICAL REVIEW</strong><br><span style="color:#64748b;">Tucker Medical · Oura Ring Gen4</span></div><pre style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:16px;font-size:11px;line-height:1.7;white-space:pre-wrap;">' + escaped + '</pre></div>';

  const resp = await fetch("https://clinic.platomedical.com/api/" + db + "/patient/note", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({ patient_id: patientId, note: html, folder_name: "Clinic Notes", author: "DrTucker", draft: 1 }),
  });
  console.log("Plato POST:", resp.status);
  return resp.ok;
}
