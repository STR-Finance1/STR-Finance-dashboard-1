import { NextResponse } from "next/server";

export const runtime = "nodejs";

function reqEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

async function getAccessToken() {
  const client_id = reqEnv("GOOGLE_OAUTH_CLIENT_ID");
  const client_secret = reqEnv("GOOGLE_OAUTH_CLIENT_SECRET");
  const refresh_token = reqEnv("GOOGLE_OAUTH_REFRESH_TOKEN");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id,
      client_secret,
      refresh_token,
      grant_type: "refresh_token",
    }),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(`OAuth token error: ${JSON.stringify(json).slice(0, 300)}`);
  if (!json.access_token) throw new Error("OAuth token error: missing access_token");
  return String(json.access_token);
}

async function fetchJSON(url: string, accessToken: string) {
  const res = await fetch(url, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Google API HTTP ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

export async function GET() {
  try {
    const spreadsheetId = reqEnv("SPREADSHEET_ID");
    const ownerViewGid = Number(reqEnv("OWNER_VIEW_GID"));

    const accessToken = await getAccessToken();

    const metaUrl =
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}` +
      `?fields=sheets(properties(sheetId,title))`;

    const meta = await fetchJSON(metaUrl, accessToken);
    const sheets: { properties: { sheetId: number; title: string } }[] = meta?.sheets ?? [];

    const ownerTitle =
      sheets.find((s) => s?.properties?.sheetId === ownerViewGid)?.properties?.title;

    if (!ownerTitle) throw new Error(`Could not find tab title for gid=${ownerViewGid}`);

    const valuesUrl =
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}` +
      `/values/${encodeURIComponent(ownerTitle)}!A:Z?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE`;

    const data = await fetchJSON(valuesUrl, accessToken);
    const values: any[][] = data?.values ?? [];

    if (values.length < 2) return NextResponse.json({ rows: [] });

    const headers = values[0].map((h) => String(h ?? "").trim());
    const rows = values.slice(1).map((r) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => (obj[h] = String(r[i] ?? "").trim()));
      return obj;
    });

    return NextResponse.json({ rows });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error)?.message ?? String(err) },
      { status: 500 }
    );
  }
}