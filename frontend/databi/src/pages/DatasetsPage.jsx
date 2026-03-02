import { useState, useEffect, useRef, useCallback, useMemo } from "react";

const DatasetsPage = ({ selectedOrg, token, setActive, setPipelineDataset, api, ui, hooks }) => {
  const { Btn, Input, Card, Badge, Spinner, EmptyState, Modal, Icon } = ui;
  const { useTheme } = hooks;
  const t = useTheme();
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({ name: "", file: null });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const fileRef = useRef();

  const load = () => {
    setLoading(true);
    api("/datasets/list/", {}, token).then(d => setDatasets(d.datasets || d || [])).catch(() => setDatasets([])).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [token]);

  const doUpload = async () => {
    if (!uploadForm.file || !uploadForm.name) { setUploadError("Name and file are required."); return; }
    setUploading(true); setUploadError("");
    const fd = new FormData();
    fd.append("name", uploadForm.name);
    fd.append("organization_id", selectedOrg?.id || "");
    fd.append("file", uploadForm.file);
    try {
      await api("/datasets/upload/", { method: "POST", body: fd }, token);
      setShowUpload(false); setUploadForm({ name: "", file: null }); load();
    } catch (e) {
      setUploadError(e.data?.error || e.data?.detail || "Upload failed.");
    } finally { setUploading(false); }
  };

  const doPreview = async (d) => {
    setPreviewLoading(true);
    try {
      const vId = d.latest_version_id || d.version_id;
      const data = await api(`/datasets/preview/${vId}/`, {}, token);
      setPreview({ dataset: d, data });
    } catch (e) { setPreview({ dataset: d, data: null, error: "Could not load preview." }); }
    finally { setPreviewLoading(false); }
  };

  const openPipeline = (d) => {
    setPipelineDataset(d);
    setActive("pipeline");
  };

  return (
    <div className="fade-in" style={{ padding: "2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h1 className="heading" style={{ fontSize: "1.8rem", fontWeight: 800 }}>Datasets</h1>
          <p style={{ color: t.textMuted, fontSize: "0.875rem" }}>Upload and manage your data</p>
        </div>
        <Btn variant="primary" icon="upload" onClick={() => setShowUpload(true)}>Upload Dataset</Btn>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "4rem" }}><Spinner /></div>
      ) : datasets.length === 0 ? (
        <EmptyState icon="dataset" title="No datasets yet" desc="Upload a CSV file to start analyzing your data."
          action={<Btn variant="primary" icon="upload" onClick={() => setShowUpload(true)}>Upload Dataset</Btn>} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1rem" }}>
          {datasets.map((d, i) => (
            <Card key={i} hover style={{ cursor: "default" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                <div style={{ width: 40, height: 40, borderRadius: "10px", background: t.accentGlow, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name="dataset" size={20} style={{ color: t.accent }} />
                </div>
                <Badge color="green">v{d.version_count || 1}</Badge>
              </div>
              <h3 className="heading" style={{ fontWeight: 700, marginBottom: "0.35rem" }}>{d.name || d.dataset_name}</h3>
              <p style={{ fontSize: "0.78rem", color: t.textMuted, marginBottom: "1.25rem" }} className="mono">{(d.dataset_id || d.id || "").toString().substring(0, 16)}…</p>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <Btn variant="secondary" size="sm" icon="eye" onClick={() => doPreview(d)}>Preview</Btn>
                <Btn variant="primary" size="sm" icon="pipeline" onClick={() => openPipeline(d)}>Edit Pipeline</Btn>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <Modal open={showUpload} onClose={() => { setShowUpload(false); setUploadError(""); }} title="Upload Dataset">
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <Input label="Dataset Name" value={uploadForm.name} onChange={v => setUploadForm(p => ({ ...p, name: v }))} placeholder="e.g. Sales Q4 2024" required />
          <div>
            <label style={{ fontSize: "0.78rem", fontWeight: 600, color: t.textMuted, display: "block", marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>CSV File <span style={{ color: t.accent }}>*</span></label>
            <div onClick={() => fileRef.current?.click()} style={{ border: `2px dashed ${uploadForm.file ? t.accent : t.border}`, borderRadius: "10px", padding: "2rem", textAlign: "center", cursor: "pointer", transition: "all 0.15s", background: uploadForm.file ? t.accentGlow : "transparent" }}>
              {uploadForm.file ? (
                <><Icon name="check" size={24} style={{ color: t.success, margin: "0 auto 0.5rem" }} /><p style={{ fontWeight: 600, fontSize: "0.875rem" }}>{uploadForm.file.name}</p></>
              ) : (
                <><Icon name="upload" size={24} style={{ color: t.textMuted, margin: "0 auto 0.5rem" }} /><p style={{ color: t.textMuted, fontSize: "0.875rem" }}>Click to select a CSV file</p></>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={e => setUploadForm(p => ({ ...p, file: e.target.files[0] }))} />
          </div>
          {uploadError && <div style={{ padding: "0.65rem", borderRadius: "8px", background: `${t.danger}15`, border: `1px solid ${t.danger}40`, color: t.danger, fontSize: "0.82rem" }}>{uploadError}</div>}
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
            <Btn variant="secondary" onClick={() => setShowUpload(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={doUpload} loading={uploading}>Upload</Btn>
          </div>
        </div>
      </Modal>

      {/* Preview Modal */}
      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.dataset?.name || "Preview"} width={780}>
        {previewLoading ? <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}><Spinner /></div> : preview?.error ? (
          <p style={{ color: t.danger }}>{preview.error}</p>
        ) : preview?.data && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ fontSize: "0.8rem" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                  {(preview.data.columns || Object.keys(preview.data?.[0] || {})).map((col, i) => (
                    <th key={i} style={{ padding: "0.6rem 0.8rem", color: t.textMuted, fontWeight: 600, whiteSpace: "nowrap", textAlign: "left", fontFamily: "DM Mono, monospace" }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(preview.data.rows || preview.data || []).slice(0, 20).map((row, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${t.border}`, background: i % 2 === 0 ? "transparent" : t.surfaceAlt }}>
                    {(Array.isArray(row) ? row : Object.values(row)).map((cell, j) => (
                      <td key={j} style={{ padding: "0.55rem 0.8rem", color: t.text, fontFamily: "DM Mono, monospace", whiteSpace: "nowrap" }}>{String(cell ?? "")}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {(preview.data.total_rows) && <p style={{ fontSize: "0.75rem", color: t.textMuted, marginTop: "0.75rem" }}>Showing first 20 of {preview.data.total_rows} rows</p>}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DatasetsPage;

// ── PIPELINE EDITOR ───────────────────────────────────────────────────────────

