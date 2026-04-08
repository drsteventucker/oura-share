import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const pid = request.nextUrl.searchParams.get("pid");

  if (!pid) {
    return NextResponse.json({ error: "Missing patient ID" }, { status: 400 });
  }

  const clientId = "36e8de69-ce5f-44dc-bc0b-5bdc144c8e5f";
  const redirectUri = "https://oura-share-cgnyd4tp3-stucker-3869s-projects.vercel.app/callback";

  const ouraUrl = "https://cloud.ouraring.com/oauth/authorize"
    + "?response_type=code"
    + "&client_id=" + clientId
    + "&redirect_uri=" + encodeURIComponent(redirectUri)
    + "&scope=personal+daily+heartrate+session"
    + "&state=" + pid;

  return NextResponse.redirect(ouraUrl);
}
