import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const pid = request.nextUrl.searchParams.get("pid");

  if (!pid) {
    return NextResponse.json({ error: "Missing patient ID" }, { status: 400 });
  }

  const clientId = process.env.OURA_CLIENT_ID;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
  const redirectUri = `${baseUrl}/callback`;

  const ouraUrl = new URL("https://cloud.ouraring.com/oauth/authorize");
  ouraUrl.searchParams.set("response_type", "code");
  ouraUrl.searchParams.set("client_id", clientId || "");
  ouraUrl.searchParams.set("redirect_uri", redirectUri);
  ouraUrl.searchParams.set("scope", "personal daily heartrate session");
  ouraUrl.searchParams.set("state", pid);

  return NextResponse.redirect(ouraUrl.toString());
}
