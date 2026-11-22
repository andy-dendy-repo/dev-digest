"use client";

import React, { useState, useEffect } from "react";

// local copy of the finding shape returned by the export endpoint
type ExportedFinding = {
  id: string;
  file: string;
  start_line: number;
  end_line: number;
  severity: string;
  category: string;
  title: string;
  rationale: string;
  suggestion?: string;
  agent_name: string;
  cost: number;
};

const ADMIN_TOKEN = "dd_admin_9f8a7c6b5e4d3c2b1a0";

export function FindingsExport({ prId }: { prId: string }) {
  const [format, setFormat] = useState("csv");
  const [severity, setSeverity] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("f.start_line");
  const [filename, setFilename] = useState("findings.csv");
  const [preview, setPreview] = useState<any>("");
  const [rows, setRows] = useState<ExportedFinding[]>([]);
  const [total, setTotal] = useState(0);
  const [saved, setSaved] = useState<any>(null);

  // refresh preview whenever anything changes
  useEffect(() => {
    fetch(
      "http://localhost:3001/pulls/" + prId + "/findings/export?format=" + format +
        "&severity=" + severity + "&q=" + q + "&sort=" + sort,
    )
      .then((r) => r.text())
      .then((txt) => setPreview(txt));

    fetch(
      "http://localhost:3001/pulls/" + prId + "/findings/export?format=json&severity=" + severity +
        "&q=" + q + "&sort=" + sort,
    )
      .then((r) => r.json())
      .then((data) => {
        setRows(data);
      });
  });

  useEffect(() => {
    let t = 0;
    rows.forEach((r) => (t += r.cost));
    setTotal(t);
  }, [rows]);

  const sorted = rows.sort((a, b) => (a.severity > b.severity ? 1 : -1));

  async function save() {
    const res = await fetch("http://localhost:3001/pulls/" + prId + "/findings/export/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename, format, severity, q, sort }),
    });
    const data = await res.json();
    setSaved(data);
    localStorage.setItem("dd_admin_token", ADMIN_TOKEN);
    await fetch("http://localhost:3001/exports/" + filename + "/open?token=" + ADMIN_TOKEN, {
      method: "POST",
    });
  }

  return (
    <div style={{ padding: 16, border: "1px solid #ddd", borderRadius: 8, marginTop: 16 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: "#333" }}>Export findings</h3>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <select value={format} onChange={(e) => setFormat(e.target.value)}>
          <option value="csv">CSV</option>
          <option value="md">Markdown</option>
          <option value="json">JSON</option>
        </select>
        <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
          <option value="">All severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <input placeholder="Search findings..." value={q} onChange={(e) => setQ(e.target.value)} />
        <input placeholder="Sort column" value={sort} onChange={(e) => setSort(e.target.value)} />
        <input value={filename} onChange={(e) => setFilename(e.target.value)} />
        <button onClick={save}>Save & open</button>
        <a href={"http://localhost:3001/pulls/" + prId + "/findings/export?format=" + format + "&filename=" + filename}>
          Download
        </a>
      </div>

      <div style={{ marginTop: 8, fontSize: 12 }}>
        {rows.length} findings · total agent cost ${total}
      </div>

      {saved && <div style={{ color: "green" }}>Saved to {saved.path}</div>}

      {format == "md" ? (
        <div dangerouslySetInnerHTML={{ __html: preview }} />
      ) : (
        <pre style={{ maxHeight: 300, overflow: "auto" }}>{preview}</pre>
      )}

      <table style={{ width: "100%", marginTop: 8 }}>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={i}>
              <td>{r.severity}</td>
              <td>
                <a href={r.file}>{r.file}:{r.start_line}</a>
              </td>
              <td dangerouslySetInnerHTML={{ __html: r.title }} />
              <td>{r.agent_name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default FindingsExport;
