import { NextRequest, NextResponse } from "next/server";
import { pullAllData, processData, generateNote, postToPlato } from "@/lib/oura";
import { exchangeCode } from "@/lib/exchange";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const pid = request.nextUrl.searchParams.get("pid");

  if (!code || !pid) {
    return NextResponse.json({ success: false, error: "Missing code or pid" }, { status: 400 });
  }

  try {
    const redirectUri = "https://oura-share-cgnyd4tp3-stucker-3869s-projects.vercel.app/callback";
    const accessToken = await exchangeCode(code, redirectUri);

    const rawData = await pullAllData(accessToken);
    const { records, allDays } = processData(rawData);

    if (allDays.length === 0) {
      return NextResponse.json({ success: false, error: "no_data" });
    }

    let patientName = "Patient";
    try {
      const resp = await fetch(
        `https://clinic.platomedical.com/api/${process.env.PLATO_DB}/patient/${pid}`,
        { headers: { Authorization: `Bearer ${process.env.PLATO_API_KEY}` } }
      );
      if (resp.ok) {
        const pt = await resp.json();
        patientName = pt.name || "Patient";
      }
    } catch { /* use default */ }

    const { note } = generateNote(records, allDays, patientName);
    await postToPlato(pid, note);

    try {
      await fetch(`https://api.ouraring.com/oauth/revoke?access_token=${accessToken}`, { method: "POST" });
    } catch { /* non-critical */ }

    return NextResponse.json({ success: true, days: allDays.length, patientName });
  } catch (err: any) {
    console.error(`[${pid}] Error:`, err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
