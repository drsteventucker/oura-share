import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, pullAllData, processData, generateNote, postToPlato } from "@/lib/oura";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const pid = request.nextUrl.searchParams.get("pid");

  if (!code || !pid) {
    return NextResponse.json({ success: false, error: "Missing code or pid" }, { status: 400 });
  }

  try {
    // 1. Exchange code for access token
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
    const redirectUri = `${baseUrl}/callback`;
    const accessToken = await exchangeCode(code, redirectUri);

    // 2. Pull Oura data
    const rawData = await pullAllData(accessToken);

    // 3. Process
    const { records, allDays } = processData(rawData);

    if (allDays.length === 0) {
      return NextResponse.json({ success: false, error: "no_data" });
    }

    // 4. Get patient name from Plato
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

    // 5. Generate note
    const { note } = generateNote(records, allDays, patientName);

    // 6. Post to Plato
    await postToPlato(pid, note);

    // 7. Revoke token (one-time use)
    try {
      await fetch(`https://api.ouraring.com/oauth/revoke?access_token=${accessToken}`, { method: "POST" });
    } catch { /* non-critical */ }

    return NextResponse.json({
      success: true,
      days: allDays.length,
      patientName,
    });
  } catch (err: any) {
    console.error(`[${pid}] Error:`, err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
