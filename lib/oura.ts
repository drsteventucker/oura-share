// lib/oura.ts — Oura data pull + processing + Plato POST

// ── Types ──
interface DailyRecord {
  date: string;
  sleep_h: number | null;
  deep_min: number | null;
  rem_min: number | null;
  efficiency: number | null;
  avg_hrv: number | null;
  avg_hr_sleep: number | null;
  lowest_hr: number | null;
  readiness_score: number | null;
  sleep_score: number | null;
  steps: number | null;
  active_cal: number | null;
  activity_score: number | null;
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

// ── Exchange OAuth code for access token ──
export async function exchangeCode(code: string, redirectUri: string): Promise<string> {
  const resp = await fetch("https://api.ouraring.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: process.env.OURA_CLIENT_ID!,
      client_secret: process.env.OURA_CLIENT_SECRET!,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Token exchange failed: ${resp.status} ${err}`);
  }

  const data = await resp.json();
  return data.access_token;
}

// ── Pull data from Oura API ──
async function pullEndpoint(token: string, endpoint: string, start: string, end: string): Promise<any[]> {
  const records: any[] = [];
  // Pull in 6-month chunks to avoid timeouts
  const chunks = getDateChunks(start, end);

  for (const [s, e] of chunks) {
    const url = `https://api.ouraring.com/v2/usercollection/${endpoint}?start_date=${s}&end_date=${e}`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (resp.ok) {
      const data = await resp.json();
      records.push(...(data.data || []));
    }
  }

  // Deduplicate by id
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
  const startDate = new Date(start);
  const endDate = new Date(end);

  let current = new Date(startDate);
  while (current < endDate) {
    const chunkEnd = new Date(current);
    chunkEnd.setMonth(chunkEnd.getMonth() + 6);
    if (chunkEnd > endDate) chunkEnd.setTime(endDate.getTime());

    chunks.push([fmt_date(current), fmt_date(chunkEnd)]);
    current = new Date(chunkEnd);
    current.setDate(current.getDate() + 1);
  }
  return chunks;
}

function fmt_date(d: Date): string {
  return d.toISOString().split("T")[0];
}

export async function pullAllData(token: string) {
  const end = fmt_date(new Date());
  const start = "2024-01-01"; // Pull all available

  console.log(`Pulling Oura data: ${start} → ${end}`);

  const [dailySleep, sleep, readiness, activity] = await Promise.all([
    pullEndpoint(token, "daily_sleep", start, end),
    pullEndpoint(token, "sleep", start, end),
    pullEndpoint(token, "daily_readiness", start, end),
    pullEndpoint(token, "daily_activity", start, end),
  ]);

  console.log(`Records: sleep=${dailySleep.length} detail=${sleep.length} readiness=${readiness.length} activity=${activity.length}`);

  return { dailySleep, sleep, readiness, activity };
}

// ── Process into daily records ──
export function processData(raw: {
  dailySleep: any[];
  sleep: any[];
  readiness: any[];
  activity: any[];
}): { records: Map<string, DailyRecord>; allDays: string[] } {
  // Index by day
  const dailySleepMap = new Map(raw.dailySleep.filter((r) => r.day).map((r) => [r.day, r]));

  // Sleep detail: long_sleep only, pick longest per day
  const sleepDetail = new Map<string, any>();
  for (const r of raw.sleep) {
    if (r.type === "long_sleep" && r.day) {
      const existing = sleepDetail.get(r.day);
      if (!existing || (r.total_sleep_duration || 0) > (existing.total_sleep_duration || 0)) {
        sleepDetail.set(r.day, r);
      }
    }
  }

  const readinessMap = new Map(raw.readiness.filter((r) => r.day).map((r) => [r.day, r]));
  const activityMap = new Map(raw.activity.filter((r) => r.day).map((r) => [r.day, r]));

  // All unique days
  const allDaysSet = new Set([
    ...dailySleepMap.keys(),
    ...sleepDetail.keys(),
    ...readinessMap.keys(),
    ...activityMap.keys(),
  ]);
  const allDays = [...allDaysSet].sort();

  // Build records
  const records = new Map<string, DailyRecord>();
  for (const day of allDays) {
    const rec: DailyRecord = {
      date: day,
      sleep_h: null, deep_min: null, rem_min: null, efficiency: null,
      avg_hrv: null, avg_hr_sleep: null, lowest_hr: null,
      readiness_score: null, sleep_score: null,
      steps: null, active_cal: null, activity_score: null,
    };

    const sd = sleepDetail.get(day);
    if (sd) {
      rec.sleep_h = sd.total_sleep_duration ? round(sd.total_sleep_duration / 3600, 2) : null;
      rec.deep_min = sd.deep_sleep_duration ? Math.round(sd.deep_sleep_duration / 60) : null;
      rec.rem_min = sd.rem_sleep_duration ? Math.round(sd.rem_sleep_duration / 60) : null;
      rec.efficiency = sd.efficiency ?? null;
      rec.avg_hr_sleep = sd.average_heart_rate ?? null;
      rec.lowest_hr = sd.lowest_heart_rate ?? null;
      rec.avg_hrv = sd.average_hrv ?? null;
    }

    const ds = dailySleepMap.get(day);
    if (ds) rec.sleep_score = ds.score ?? null;

    const rd = readinessMap.get(day);
    if (rd) rec.readiness_score = rd.score ?? null;

    const ac = activityMap.get(day);
    if (ac) {
      rec.steps = ac.steps ?? null;
      rec.active_cal = ac.active_calories ?? null;
      rec.activity_score = ac.score ?? null;
    }

    records.set(day, rec);
  }

  return { records, allDays };
}

// ── Compute window stats ──
const METRIC_KEYS = [
  "sleep_h", "deep_min", "rem_min", "efficiency", "avg_hrv",
  "avg_hr_sleep", "lowest_hr", "readiness_score", "sleep_score",
  "steps", "active_cal", "activity_score",
];

function windowStats(records: Map<string, DailyRecord>, days: string[]): WindowStats {
  const recs = days.map((d) => records.get(d)).filter(Boolean) as DailyRecord[];
  const st: WindowStats = { n: recs.length };

  for (const k of METRIC_KEYS) {
    const vals = recs.map((r) => (r as any)[k]).filter((v: any) => v != null) as number[];
    st[k] = vals.length > 0 ? round(mean(vals), 1) : null;
  }
  return st;
}

function daysInRange(allDays: string[], start: Date, end: Date): string[] {
  const s = fmt_date(start);
  const e = fmt_date(end);
  return allDays.filter((d) => d >= s && d <= e);
}

// ── Generate clinical note + findings ──
export function generateNote(
  records: Map<string, DailyRecord>,
  allDays: string[],
  patientName: string
): { note: string; findings: Finding[]; anomalies: string[] } {
  const today = new Date(allDays[allDays.length - 1]);

  // Comparison windows
  const cur2End = today;
  const cur2Start = addDays(today, -13);
  const pri2End = addDays(cur2Start, -1);
  const pri2Start = addDays(pri2End, -13);
  const b90Start = addDays(today, -89);

  const cur2 = daysInRange(allDays, cur2Start, cur2End);
  const pri2 = daysInRange(allDays, pri2Start, pri2End);
  const d90 = daysInRange(allDays, b90Start, cur2End);

  const sc = windowStats(records, cur2);
  const sp = windowStats(records, pri2);
  const s90 = windowStats(records, d90);

  // Year-ago windows (try/catch for date issues)
  let ya2Start, ya2End, ya_days: string[] = [];
  try {
    ya2Start = new Date(cur2Start);
    ya2Start.setFullYear(ya2Start.getFullYear() - 1);
    ya2End = new Date(cur2End);
    ya2End.setFullYear(ya2End.getFullYear() - 1);
    ya_days = daysInRange(allDays, ya2Start, ya2End);
  } catch { /* no year-ago data */ }
  const sya = ya_days.length > 0 ? windowStats(records, ya_days) : null;

  // Anomalies
  const anomalies: string[] = [];
  for (const d of cur2) {
    const r = records.get(d);
    if (!r) continue;
    if (r.sleep_h && r.sleep_h < 5) anomalies.push(`${d}: Sleep ${r.sleep_h}h (<5h)`);
    if (r.avg_hrv && r.avg_hrv < 10) anomalies.push(`${d}: HRV ${r.avg_hrv}ms (<10)`);
    if (r.readiness_score && r.readiness_score < 50) anomalies.push(`${d}: Readiness ${r.readiness_score} (<50)`);
  }

  // Monthly stats for trend detection
  const months = new Map<string, string[]>();
  for (const d of allDays) {
    const m = d.substring(0, 7);
    if (!months.has(m)) months.set(m, []);
    months.get(m)!.push(d);
  }
  const monthlyEntries = [...months.entries()].sort();
  const monthlyStats = monthlyEntries.map(([m, days]) => ({
    m,
    ...windowStats(records, days),
  }));

  // Auto-detect findings
  const findings: Finding[] = [];
  if (monthlyStats.length >= 6) {
    const early = monthlyStats.slice(0, 6);
    const late = monthlyStats.slice(-3);

    const check = (key: string, label: string, upBad: boolean, threshold: number) => {
      const earlyVals = early.map((m) => m[key]).filter((v) => v != null) as number[];
      const lateVals = late.map((m) => m[key]).filter((v) => v != null) as number[];
      if (earlyVals.length < 3 || lateVals.length < 2) return;
      const earlyAvg = round(mean(earlyVals), 1);
      const lateAvg = round(mean(lateVals), 1);
      const pct = ((lateAvg - earlyAvg) / earlyAvg) * 100;
      if (Math.abs(pct) > threshold) {
        const declining = pct < 0;
        const bad = upBad ? !declining : declining;
        findings.push({
          color: bad ? "#ef4444" : "#34d399",
          arrow: declining ? "↓" : "↑",
          label: `${label} ${declining ? "declining" : upBad ? "rising" : "improving"}`,
          detail: `${earlyAvg} (early) → ${lateAvg} (recent). ${pct > 0 ? "+" : ""}${round(pct, 0)}%`,
        });
      }
    };

    check("avg_hrv", "HRV", false, 10);
    check("avg_hr_sleep", "RHR", true, 5);
    check("steps", "Steps", false, 15);
    check("readiness_score", "Readiness", false, 8);
  }

  // Format note
  const fv = (v: number | null, u = "") => (v == null ? "—" : `${round(v, 1)}${u}`);
  const delta = (c: number | null, b: number | null) => {
    if (c == null || b == null || b === 0) return "—";
    const d = c - b;
    const pct = (d / b) * 100;
    const arr = d > 0 ? "+" : "";
    return `${arr}${round(d, 1)} (${pct > 0 ? "+" : ""}${round(pct, 0)}%)`;
  };

  let note = `WEARABLE DATA — LONGITUDINAL CLINICAL REVIEW\n`;
  note += `${"=".repeat(66)}\n`;
  note += `Patient: ${patientName}\n`;
  note += `Device: Oura Ring Gen4\n`;
  note += `Data range: ${allDays[0]} → ${allDays[allDays.length - 1]} (${allDays.length} days)\n`;
  note += `Generated: ${new Date().toISOString().replace("T", " ").substring(0, 16)} SGT\n`;
  note += `Tucker Medical Pte Ltd\n\n`;

  note += `--- CURRENT 2WK vs PRIOR 2WK ---\n`;
  note += `Current: ${fmt_date(cur2Start)} → ${fmt_date(cur2End)} (${cur2.length} days)\n`;
  note += `Prior:   ${fmt_date(pri2Start)} → ${fmt_date(pri2End)} (${pri2.length} days)\n\n`;

  const metrics = [
    ["sleep_h", "Sleep", "h"], ["deep_min", "Deep", "min"], ["rem_min", "REM", "min"],
    ["efficiency", "Eff", "%"], ["avg_hrv", "HRV", "ms"], ["avg_hr_sleep", "RHR", "bpm"],
    ["lowest_hr", "LowHR", "bpm"], ["readiness_score", "Readiness", ""],
    ["sleep_score", "Sleep Sc", ""], ["steps", "Steps", ""],
    ["active_cal", "Active Cal", "kcal"], ["activity_score", "Act Sc", ""],
  ];

  note += `${"Metric".padEnd(14)}${"Cur 2wk".padStart(10)}${"Prior 2wk".padStart(12)}${"Delta".padStart(14)}${"90-day".padStart(10)}`;
  if (sya) note += `${"1yr ago".padStart(10)}`;
  note += `\n${"-".repeat(sya ? 70 : 60)}\n`;

  for (const [k, l, u] of metrics) {
    const c = sc[k] as number | null;
    const p = sp[k] as number | null;
    const b9 = s90[k] as number | null;
    let line = `${(l as string).padEnd(14)}${fv(c, u as string).padStart(10)}${fv(p, u as string).padStart(12)}${delta(c, p).padStart(14)}${fv(b9, u as string).padStart(10)}`;
    if (sya) line += `${fv(sya[k] as number | null, u as string).padStart(10)}`;
    note += line + "\n";
  }

  if (anomalies.length > 0) {
    note += `\n--- ALERTS (current 2wk) ---\n`;
    for (const a of anomalies) note += `  ! ${a}\n`;
  }

  if (findings.length > 0) {
    note += `\n--- KEY TRENDS ---\n`;
    findings.forEach((f, i) => {
      note += `  ${i + 1}. ${f.label}: ${f.detail}\n`;
    });
  }

  note += `\nFor clinical review — not a diagnostic assessment.\nData source: Oura Ring Gen4 via REST API v2.\n`;

  return { note, findings, anomalies };
}

// ── Post note to Plato ──
export async function postToPlato(patientId: string, noteText: string): Promise<boolean> {
  const platoKey = process.env.PLATO_API_KEY;
  const platoDb = process.env.PLATO_DB;

  if (!platoKey || !platoDb) {
    console.error("Missing PLATO_API_KEY or PLATO_DB");
    return false;
  }

  const escaped = noteText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<div style="font-family:monospace;font-size:12px;line-height:1.6;">` +
    `<div style="background:#f0f7ff;border-left:4px solid #2563eb;padding:12px 16px;margin-bottom:16px;">` +
    `<strong style="color:#1e40af;font-size:14px;">WEARABLE DATA — LONGITUDINAL CLINICAL REVIEW</strong><br>` +
    `<span style="color:#64748b;">Tucker Medical · Oura Ring Gen4</span></div>` +
    `<pre style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:16px;font-size:11px;line-height:1.7;white-space:pre-wrap;">` +
    escaped + `</pre></div>`;

  const payload = {
    patient_id: patientId,
    note: html,
    folder_name: "Clinic Notes",
    author: "DrTucker",
    draft: 1,
  };

  const resp = await fetch(`https://clinic.platomedical.com/api/${platoDb}/patient/note`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${platoKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  console.log(`Plato POST: ${resp.status}`);
  return resp.ok;
}

// ── Helpers ──
function round(n: number, d: number): number {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}

function mean(vals: number[]): number {
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
