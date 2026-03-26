import { NextResponse } from "next/server";

export const runtime = "nodejs";

function reqEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

async function getAccessToken() {
    console.log("TOKEN:", process.env.GOOGLE_REFRESH_TOKEN);
    
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

function toCSV(values: any[][]) {
  const esc = (s: string) => {
    const needs = /[",\n]/.test(s);
    const v = s.replace(/"/g, '""');
    return needs ? `"${v}"` : v;
  };
  return values.map((row) => row.map((c) => esc(String(c ?? ""))).join(",")).join("\n");
}

export async function GET() {
  try {
    const spreadsheetId = reqEnv("SPREADSHEET_ID");
    const bookingsGid = Number(reqEnv("BOOKINGS_GID"));
    const expensesGid = Number(reqEnv("EXPENSES_GID"));

    const accessToken = await getAccessToken();

    const metaUrl =
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}` +
      `?fields=sheets(properties(sheetId,title))`;

    const meta = await fetchJSON(metaUrl, accessToken);
    const sheets: { properties: { sheetId: number; title: string } }[] = meta?.sheets ?? [];

    const titleFor = (gid: number) => {
      const found = sheets.find((s) => s?.properties?.sheetId === gid)?.properties?.title;
      if (!found) throw new Error(`Could not find tab title for gid=${gid}`);
      return found;
    };

    const bookingsTitle = titleFor(bookingsGid);
    const expensesTitle = titleFor(expensesGid);

    const valuesUrl = (title: string) =>
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}/values/${encodeURIComponent(title)}!A:Z?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE`;

    const [bVals, eVals] = await Promise.all([
      fetchJSON(valuesUrl(bookingsTitle), accessToken),
      fetchJSON(valuesUrl(expensesTitle), accessToken),
    ]);

    const bookingsCSV = toCSV(bVals?.values ?? []);
    const expensesCSV = toCSV(eVals?.values ?? []);

    return NextResponse.json({ bookingsCSV, expensesCSV });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error)?.message ?? String(err) },
      { status: 500 }
    );
  }
}