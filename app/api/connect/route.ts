import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const pid = request.nextUrl.searchParams.get("pid");

  if (!pid) {
    return NextResponse.json({ error: "Missing patient ID" }, { status: 400 });
  }

  const clientId = process.env.OURA_CLIENT_ID;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
  const redirectUri = `${baseUrl}/callback`;

  const scopes = [
    "personal",
    "daily",
    "heartrate",
    "session",
    "spo2",
    "stress",
  ].join("+");

  // State carries the patient ID through OAuth
  const state = pid;

  const ouraUrl =
    `https://cloud.ouraring.com/oauth/authorize` +
    `?response_type=code` +
    `&client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${scopes}` +
    `&state=${state}`;

  return NextResponse.redirect(ouraUrl);
}
