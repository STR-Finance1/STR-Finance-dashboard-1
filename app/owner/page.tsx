"use client";

import { useEffect, useState } from "react";

type OwnerRow = {
  month?: string;
  property?: string;
  net_profit?: string;
  projected_month_end_profit?: string;
  occupancy_rate?: string;
  health_score?: string;
  recommendation?: string;
  exec_summary?: string;
};

export default function OwnerPage() {
  const [rows, setRows] = useState<OwnerRow[]>([]);
  const [status, setStatus] = useState("Loading...");

  useEffect(() => {
    fetch("/api/owner-view")
      .then((r) => r.json())
      .then((data) => {
        setRows(data?.rows ?? []);
        setStatus("Loaded ✓");
      })
      .catch((e) => setStatus(`Error: ${e?.message ?? String(e)}`));
  }, []);

  const r = rows[0];

  return (
    <main style={{ padding: 40, color: "white", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 12 }}>Owner View</h1>

      {!r ? (
        <div>{status}</div>
      ) : (
        <>
          <p><b>Property:</b> {r.property}</p>
          <p><b>Month:</b> {r.month}</p>
          <p><b>Net Profit:</b> {r.net_profit}</p>
          <p><b>Projected Month End:</b> {r.projected_month_end_profit}</p>
          <p><b>Occupancy:</b> {r.occupancy_rate}</p>
          <p><b>Health Score:</b> {r.health_score}</p>

          <hr style={{ margin: "18px 0", borderColor: "#333" }} />

          <p><b>Recommendation:</b></p>
          <p>{r.recommendation}</p>

          <hr style={{ margin: "18px 0", borderColor: "#333" }} />

          <p><b>Executive Summary:</b></p>
          <p>{r.exec_summary}</p>
        </>
      )}
    </main>
  );
}