import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, pullAllData, processData, generateNote, postToPlato } from "@/lib/oura";
import { lookupPatientHash } from "@/lib/plato";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const pid = request.nextUrl.searchParams.get("pid");

  if (!code || !pid) {
    return NextResponse.json({ success: false, error: "Missing code or pid" }, { status: 400 });
  }

  try {
    // Lookup hash ID and patient name from Plato
    let patientHash = pid;
    let patientName = "Patient";
    try {
      const lookup = await lookupPatientHash(pid);
      patientHash = lookup.hash;
      patientName = lookup.name;
      console.log("Plato lookup:", pid, "->", patientHash, patientName);
    } catch (e: any) {
      // If lookup fails, try using pid directly as hash
      console.log("Plato lookup failed, using pid as-is:", e.message);
    }

    const accessToken = await exchangeCode(code);
    const rawData = await pullAllData(accessToken);
    const { records, allDays } = processData(rawData);

    if (allDays.length === 0) {
      return NextResponse.json({ success: false, error: "no_data" });
    }

    const { note } = generateNote(records, allDays, patientName);
    await postToPlato(patientHash, note);

    try { await fetch("https://api.ouraring.com/oauth/revoke?access_token=" + accessToken, { method: "POST" }); } catch {}

    return NextResponse.json({ success: true, days: allDays.length, patientName });
  } catch (err: any) {
    console.error("[" + pid + "] Error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
