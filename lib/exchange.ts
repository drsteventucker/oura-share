export async function exchangeCode(code: string, redirectUri: string): Promise<string> {
  const clientId = "36e8de69-ce5f-44dc-bc0b-5bdc144c8e5f";
  const clientSecret = process.env.OURA_CLIENT_SECRET!;
  
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  
  console.log("Token exchange request:");
  console.log("  redirect_uri:", redirectUri);
  console.log("  code length:", code.length);
  console.log("  secret length:", clientSecret?.length || "MISSING");

  const resp = await fetch("https://api.ouraring.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });

  const text = await resp.text();
  console.log("Token exchange response:", resp.status, text);

  if (!resp.ok) {
    throw new Error(`Token exchange failed: ${resp.status} ${text}`);
  }

  const data = JSON.parse(text);
  return data.access_token;
}
