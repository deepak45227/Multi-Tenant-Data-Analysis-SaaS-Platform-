import { useState, useEffect, useRef, useMemo } from "react";

const PipelinePage = ({ selectedOrg, token, initialDataset, api, getApiErrorMessage, ui, hooks }) => {
  const { Btn, Input, Card, Badge, Spinner, EmptyState, Modal, Icon } = ui;
  const { useTheme } = hooks;
  const t = useTheme();
  const [datasets, setDatasets] = useState([]);
  const [selectedDs, setSelectedDs] = useState(initialDataset || null);
  const [session, setSession] = useState(null);
  const [steps, setSteps] = useState([]);
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [showPipelinePanel, setShowPipelinePanel] = useState(true);
  const [sidePanelWidth, setSidePanelWidth] = useState(280);
  const [topPanelHeight, setTopPanelHeight] = useState(130);
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState("");
  const [previewLimit, setPreviewLimit] = useState(50);
  const [showMeta, setShowMeta] = useState(true);
  const [columnMenu, setColumnMenu] = useState({ open: false, x: 0, y: 0, column: "" });
  const [secondaryColumns, setSecondaryColumns] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [addingStep, setAddingStep] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [hoveredOp, setHoveredOp] = useState("");
  const [stepForm, setStepForm] = useState({
    type: "visual",
    operation: "remove_nulls",
    columns: "",
    sql: "",
    column: "",
    newType: "INTEGER",
    columnName: "",
    expression: "",
    condition: "",
    splitDelimiter: ",",
    splitIndex: "1",
    secondaryDatasetId: "",
    rightColumn: "",
    joinType: "left",
    mergeDelimiter: "",
  });
  const [showAddStep, setShowAddStep] = useState(false);
  const [notice, setNotice] = useState({ type: "info", text: "" });
  const layoutRef = useRef(null);
  const topLayoutRef = useRef(null);
  const isResizingRef = useRef(false);
  const isResizingTopRef = useRef(false);
  const sideResizeRafRef = useRef(null);
  const topResizeRafRef = useRef(null);

  const visualOps = [
    { key: "remove_nulls", label: "Remove Nulls", icon: "filter" },
    { key: "remove_duplicates", label: "Remove Duplicates", icon: "dataset" },
    { key: "change_type", label: "Change Type", icon: "settings" },
    { key: "add_column", label: "Add Column", icon: "plus" },
    { key: "filter", label: "Filter Rows", icon: "filter" },
    { key: "select_columns", label: "Select Columns", icon: "check" },
    { key: "rename_column", label: "Rename Column", icon: "settings" },
    { key: "fill_nulls", label: "Fill Nulls", icon: "filter" },
    { key: "sort", label: "Sort", icon: "arrow" },
    { key: "limit_rows", label: "Limit Rows", icon: "eye" },
    { key: "split_column", label: "Split Column", icon: "sql" },
    { key: "trim_text", label: "Trim Text", icon: "check" },
    { key: "replace_values", label: "Replace Values", icon: "settings" },
    { key: "delete_columns", label: "Delete Columns", icon: "trash" },
    { key: "merge_columns", label: "Merge Columns", icon: "plus" },
    { key: "merge_datasets", label: "Merge Datasets", icon: "dataset" },
  ];

  useEffect(() => {
    const orgQuery = selectedOrg?.id ? `?organization=${selectedOrg.id}` : "";
    api(`/datasets/list/${orgQuery}`, {}, token)
      .then(d => setDatasets(d.datasets || d || []))
      .catch(() => setDatasets([]));
  }, [token, selectedOrg?.id]);

  useEffect(() => {
    if (initialDataset) {
      setSelectedDs(initialDataset);
    }
  }, [initialDataset]);

  const parseColumns = (value) => value.split(",").map(s => s.trim()).filter(Boolean);

  const syncSteps = (incomingSteps = []) => {
    setSteps(incomingSteps.map((s, idx) => ({ ...s, id: `${Date.now()}-${idx}` })));
  };

  const openAddStepModal = (type, operation = "remove_nulls") => {
    const defaultNewType = operation === "sort" ? "ASC" : "INTEGER";
    const selectedCsv = selectedColumns.join(", ");
    setStepForm({
      type,
      operation,
      columns: selectedCsv,
      sql: "",
      column: selectedColumns[0] || "",
      newType: defaultNewType,
      columnName: "",
      expression: "",
      condition: "",
      splitDelimiter: ",",
      splitIndex: "1",
      secondaryDatasetId: "",
      rightColumn: "",
      joinType: "left",
      mergeDelimiter: "",
    });
    setShowAddStep(true);
  };

  useEffect(() => {
    if (!(showAddStep && stepForm.operation === "merge_datasets" && stepForm.secondaryDatasetId)) {
      setSecondaryColumns([]);
      return;
    }
    api(`/datasets/${stepForm.secondaryDatasetId}/metadata/`, {}, token)
      .then((d) => {
        const cols = d?.columns || [];
        const names = cols.map((c) => c?.name || c?.column_name || c).filter(Boolean);
        setSecondaryColumns(names);
      })
      .catch(() => setSecondaryColumns([]));
  }, [showAddStep, stepForm.operation, stepForm.secondaryDatasetId, token]);

  useEffect(() => {
    const closeMenu = () => setColumnMenu((m) => (m.open ? { ...m, open: false } : m));
    const onKeyDown = (e) => { if (e.key === "Escape") closeMenu(); };
    window.addEventListener("click", closeMenu);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!isResizingRef.current || !layoutRef.current || !showPipelinePanel) return;
      const rect = layoutRef.current.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const min = 220;
      const max = Math.min(560, rect.width - 260);
      const next = Math.max(min, Math.min(max, relativeX));
      if (sideResizeRafRef.current) cancelAnimationFrame(sideResizeRafRef.current);
      sideResizeRafRef.current = requestAnimationFrame(() => {
        setSidePanelWidth(next);
      });
    };
    const onMouseUp = () => {
      if (!isResizingRef.current) return;
      isResizingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      if (sideResizeRafRef.current) {
        cancelAnimationFrame(sideResizeRafRef.current);
        sideResizeRafRef.current = null;
      }
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      if (sideResizeRafRef.current) {
        cancelAnimationFrame(sideResizeRafRef.current);
        sideResizeRafRef.current = null;
      }
    };
  }, [showPipelinePanel]);

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!isResizingTopRef.current || !topLayoutRef.current) return;
      const rect = topLayoutRef.current.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const min = 78;
      const max = 300;
      const next = Math.max(min, Math.min(max, relativeY));
      if (topResizeRafRef.current) cancelAnimationFrame(topResizeRafRef.current);
      topResizeRafRef.current = requestAnimationFrame(() => {
        setTopPanelHeight(next);
      });
    };
    const onMouseUp = () => {
      if (!isResizingTopRef.current) return;
      isResizingTopRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      if (topResizeRafRef.current) {
        cancelAnimationFrame(topResizeRafRef.current);
        topResizeRafRef.current = null;
      }
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      if (topResizeRafRef.current) {
        cancelAnimationFrame(topResizeRafRef.current);
        topResizeRafRef.current = null;
      }
    };
  }, []);

  const startResize = () => {
    if (!showPipelinePanel) return;
    isResizingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const startTopResize = () => {
    isResizingTopRef.current = true;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  };

  const doPreview = async (sessionId = session) => {
    if (!sessionId) return;
    setLoadingPreview(true);
    setPreviewError("");
    const limitInt = Math.max(1, Math.min(parseInt(previewLimit || 50, 10) || 50, 1000));
    if (String(limitInt) !== String(previewLimit)) setPreviewLimit(limitInt);
    try {
      const data = await api(`/datasets/edit/preview/${sessionId}/?limit=${limitInt}`, {}, token);
      setPreview(data);
    } catch (e) {
      setPreview(null);
      setPreviewError(getApiErrorMessage(e, "Preview failed."));
    } finally {
      setLoadingPreview(false);
    }
  };

  const startSession = async () => {
    if (!selectedDs) return;
    try {
      const id = selectedDs.dataset_id || selectedDs.id;
      const data = await api(`/datasets/edit/start/${id}/`, { method: "POST" }, token);
      const sid = data.session_id;
      setSession(sid);
      syncSteps(data.steps || []);
      setResult(null);
      setNotice({ type: "success", text: "Session started. Initial preview loaded." });
      await doPreview(sid);
    } catch (e) {
      setNotice({ type: "error", text: getApiErrorMessage(e, "Failed to start session.") });
    }
  };

  const addStep = async () => {
    if (!session) return;
    setPreviewError("");
    setNotice({ type: "info", text: "" });
    setAddingStep(true);

    let body = null;

    if (stepForm.type === "sql") {
      if (!stepForm.sql.trim()) {
        setNotice({ type: "error", text: "SQL transform cannot be empty." });
        setAddingStep(false);
        return;
      }
      body = { type: "sql", sql: stepForm.sql };
    } else {
      const params = {};
      if (stepForm.operation === "remove_nulls" || stepForm.operation === "remove_duplicates" || stepForm.operation === "select_columns") {
        const cols = parseColumns(stepForm.columns);
        if (cols.length === 0) {
          setNotice({ type: "error", text: "Please enter at least one column." });
          setAddingStep(false);
          return;
        }
        params.columns = cols;
      }
      if (stepForm.operation === "change_type") {
        if (!stepForm.column.trim()) {
          setNotice({ type: "error", text: "Column name is required." });
          setAddingStep(false);
          return;
        }
        params.column = stepForm.column.trim();
        params.new_type = stepForm.newType;
      }
      if (stepForm.operation === "rename_column") {
        if (!stepForm.column.trim() || !stepForm.columnName.trim()) {
          setNotice({ type: "error", text: "Old and new column names are required." });
          setAddingStep(false);
          return;
        }
        params.old_name = stepForm.column.trim();
        params.new_name = stepForm.columnName.trim();
      }
      if (stepForm.operation === "fill_nulls") {
        if (!stepForm.column.trim() || !stepForm.expression.trim()) {
          setNotice({ type: "error", text: "Column and fill value are required." });
          setAddingStep(false);
          return;
        }
        params.column = stepForm.column.trim();
        params.value = stepForm.expression.trim();
      }
      if (stepForm.operation === "sort") {
        if (!stepForm.column.trim()) {
          setNotice({ type: "error", text: "Sort column is required." });
          setAddingStep(false);
          return;
        }
        params.column = stepForm.column.trim();
        params.direction = stepForm.newType === "DESC" ? "desc" : "asc";
      }
      if (stepForm.operation === "limit_rows") {
        const n = parseInt(stepForm.expression, 10);
        if (!Number.isFinite(n) || n <= 0) {
          setNotice({ type: "error", text: "Limit rows must be a positive number." });
          setAddingStep(false);
          return;
        }
        params.limit = n;
      }
      if (stepForm.operation === "split_column") {
        if (!stepForm.column.trim() || !stepForm.columnName.trim()) {
          setNotice({ type: "error", text: "Column and new column name are required." });
          setAddingStep(false);
          return;
        }
        const idx = parseInt(stepForm.splitIndex, 10);
        if (!Number.isFinite(idx) || idx < 1) {
          setNotice({ type: "error", text: "Split part index must be 1 or greater." });
          setAddingStep(false);
          return;
        }
        params.column = stepForm.column.trim();
        params.delimiter = stepForm.splitDelimiter ?? ",";
        params.part_index = idx;
        params.new_column = stepForm.columnName.trim();
      }
      if (stepForm.operation === "trim_text") {
        const cols = parseColumns(stepForm.columns);
        if (cols.length === 0) {
          setNotice({ type: "error", text: "Select at least one column for trim." });
          setAddingStep(false);
          return;
        }
        params.columns = cols;
      }
      if (stepForm.operation === "replace_values") {
        if (!stepForm.column.trim()) {
          setNotice({ type: "error", text: "Column is required for replace." });
          setAddingStep(false);
          return;
        }
        params.column = stepForm.column.trim();
        params.old_value = stepForm.condition;
        params.new_value = stepForm.expression;
      }
      if (stepForm.operation === "delete_columns") {
        const cols = parseColumns(stepForm.columns);
        if (cols.length === 0) {
          setNotice({ type: "error", text: "Select at least one column to delete." });
          setAddingStep(false);
          return;
        }
        params.columns = cols;
      }
      if (stepForm.operation === "merge_columns") {
        const cols = parseColumns(stepForm.columns);
        if (cols.length < 2) {
          setNotice({ type: "error", text: "Select at least two columns to merge." });
          setAddingStep(false);
          return;
        }
        if (!stepForm.columnName.trim()) {
          setNotice({ type: "error", text: "New merged column name is required." });
          setAddingStep(false);
          return;
        }
        params.columns = cols;
        params.delimiter = stepForm.mergeDelimiter ?? "";
        params.new_column = stepForm.columnName.trim();
      }
      if (stepForm.operation === "merge_datasets") {
        if (!stepForm.secondaryDatasetId || !stepForm.column || !stepForm.rightColumn) {
          setNotice({ type: "error", text: "Secondary dataset and join columns are required." });
          setAddingStep(false);
          return;
        }
        params.secondary_dataset_id = stepForm.secondaryDatasetId;
        params.left_on = stepForm.column;
        params.right_on = stepForm.rightColumn;
        params.join_type = stepForm.joinType;
      }
      if (stepForm.operation === "add_column") {
        if (!stepForm.columnName.trim() || !stepForm.expression.trim()) {
          setNotice({ type: "error", text: "Column name and expression are required." });
          setAddingStep(false);
          return;
        }
        params.column_name = stepForm.columnName.trim();
        params.expression = stepForm.expression.trim();
      }
      if (stepForm.operation === "filter") {
        if (!stepForm.condition.trim()) {
          setNotice({ type: "error", text: "Filter condition is required." });
          setAddingStep(false);
          return;
        }
        params.condition = stepForm.condition.trim();
      }
      body = { type: "visual", operation: stepForm.operation, params };
    }

    try {
      const data = await api(`/datasets/edit/add-step/${session}/`, { method: "POST", body }, token);
      syncSteps(data.steps || [...steps, body]);
      setShowAddStep(false);
      setNotice({ type: "success", text: "Step added. Preview refreshed." });
      await doPreview();
    } catch (e) {
      setNotice({ type: "error", text: getApiErrorMessage(e, "Failed to add step.") });
    } finally {
      setAddingStep(false);
    }
  };

  const quickAddColumnStep = async (operation, params) => {
    if (!session) {
      setNotice({ type: "error", text: "Start a session first." });
      return;
    }
    setColumnMenu((m) => ({ ...m, open: false }));
    setAddingStep(true);
    setNotice({ type: "info", text: "" });
    try {
      const body = { type: "visual", operation, params };
      const data = await api(`/datasets/edit/add-step/${session}/`, { method: "POST", body }, token);
      syncSteps(data.steps || [...steps, body]);
      setNotice({ type: "success", text: `${operation.replaceAll("_", " ")} applied.` });
      await doPreview();
    } catch (e) {
      setNotice({ type: "error", text: getApiErrorMessage(e, "Quick transform failed.") });
    } finally {
      setAddingStep(false);
    }
  };

  const openColumnMenu = (e, col) => {
    e.preventDefault();
    e.stopPropagation();
    const menuWidth = 220;
    const menuHeight = 280;
    const x = Math.max(8, Math.min(e.clientX, window.innerWidth - menuWidth - 8));
    const y = Math.max(8, Math.min(e.clientY, window.innerHeight - menuHeight - 8));
    setColumnMenu({ open: true, x, y, column: col });
  };

  const doUndo = async () => {
    if (!session) return;
    try {
      const data = await api(`/datasets/edit/undo/${session}/`, { method: "POST" }, token);
      syncSteps(data.steps || []);
      setNotice({ type: "success", text: "Last step removed. Preview refreshed." });
      await doPreview();
    } catch (e) {
      setNotice({ type: "error", text: getApiErrorMessage(e, "Undo failed.") });
    }
  };

  const doApply = async () => {
    if (!session) return;
    setApplyLoading(true);
    try {
      const data = await api(`/datasets/edit/apply/${session}/`, { method: "POST" }, token);
      setResult(data);
      setSession(null);
      setSteps([]);
      setPreview(null);
      setNotice({ type: "success", text: "Pipeline applied successfully. New version created." });
    } catch (e) {
      setNotice({ type: "error", text: getApiErrorMessage(e, "Apply failed.") });
    } finally {
      setApplyLoading(false);
    }
  };

  const stepLabels = {
    remove_nulls: { label: "Remove Nulls", icon: "filter" },
    remove_duplicates: { label: "Remove Duplicates", icon: "dataset" },
    change_type: { label: "Change Type", icon: "settings" },
    add_column: { label: "Add Column", icon: "plus" },
    filter: { label: "Filter Rows", icon: "filter" },
    select_columns: { label: "Select Columns", icon: "check" },
    rename_column: { label: "Rename Column", icon: "settings" },
    fill_nulls: { label: "Fill Nulls", icon: "filter" },
    sort: { label: "Sort", icon: "arrow" },
    limit_rows: { label: "Limit Rows", icon: "eye" },
    split_column: { label: "Split Column", icon: "sql" },
    trim_text: { label: "Trim Text", icon: "check" },
    replace_values: { label: "Replace Values", icon: "settings" },
    delete_columns: { label: "Delete Columns", icon: "trash" },
    merge_columns: { label: "Merge Columns", icon: "plus" },
    merge_datasets: { label: "Merge Datasets", icon: "dataset" },
    sql: { label: "SQL Transform", icon: "sql" },
  };

  const cols = useMemo(() => (preview?.columns || (preview?.rows?.[0] ? Object.keys(preview.rows[0]) : [])), [preview]);
  const rows = useMemo(() => (preview?.rows || (Array.isArray(preview) ? preview : [])), [preview]);
  const availableColumns = cols;
  const compactRibbon = topPanelHeight < 140;
  const typeByColumn = useMemo(
    () => Object.fromEntries((preview?.column_info || []).map(c => [c.name, String(c.type || "")])),
    [preview?.column_info]
  );
  const columnProfiles = useMemo(() => (
    availableColumns.map((col) => {
      const type = typeByColumn[col] || "UNKNOWN";
      const values = rows.map((r) => (Array.isArray(r) ? r[cols.indexOf(col)] : r[col]));
      const total = values.length || 1;
      const emptyCount = values.filter(v => v === null || v === undefined || String(v).trim() === "").length;
      const nonEmpty = values.filter(v => !(v === null || v === undefined || String(v).trim() === ""));
      const errorCount = nonEmpty.filter((v) => {
        const t = type.toUpperCase();
        if (t.includes("INT") || t.includes("DECIMAL") || t.includes("DOUBLE") || t.includes("FLOAT") || t.includes("REAL")) {
          return Number.isNaN(Number(v));
        }
        if (t.includes("DATE") || t.includes("TIME")) {
          return Number.isNaN(Date.parse(String(v)));
        }
        if (t.includes("BOOL")) {
          return !["true", "false", "1", "0"].includes(String(v).toLowerCase());
        }
        return false;
      }).length;
      const validCount = Math.max(0, nonEmpty.length - errorCount);
      const distinct = new Set(values.map(v => String(v ?? ""))).size;
      return {
        name: col,
        type,
        validPct: Math.round((validCount / total) * 100),
        errorPct: Math.round((errorCount / total) * 100),
        emptyPct: Math.round((emptyCount / total) * 100),
        distinct,
      };
    })
  ), [availableColumns, cols, rows, typeByColumn]);

  return (
    <div ref={topLayoutRef} className="fade-in" style={{ padding: "0.6rem", height: "100%", display: "flex", flexDirection: "column", gap: "0.55rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.6rem", flexWrap: "nowrap", overflowX: "auto" }}>
        <div>
          <h1 className="heading" style={{ fontSize: "1.8rem", fontWeight: 800 }}>Pipeline Editor</h1>
          <p style={{ color: t.textMuted, fontSize: "0.875rem" }}>Build transformation pipelines with live preview</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexShrink: 0 }}>
          <Btn variant="secondary" size="sm" onClick={() => setShowPipelinePanel(v => !v)}>
            {showPipelinePanel ? "Hide Side Panel" : "Show Side Panel"}
          </Btn>
          {session && (
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Btn variant="secondary" icon="undo" onClick={doUndo} disabled={steps.length === 0}>Undo</Btn>
            <Btn variant="secondary" icon="eye" onClick={() => doPreview()}>Refresh Preview</Btn>
            <Btn variant="success" icon="check" onClick={doApply} loading={applyLoading}>Apply All Steps</Btn>
          </div>
          )}
        </div>
      </div>

      {!!notice.text && (
        <div
          style={{
            padding: "0.65rem 1rem",
            borderRadius: "8px",
            background: notice.type === "error" ? `${t.danger}15` : notice.type === "success" ? `${t.success}15` : t.accentGlow,
            border: `1px solid ${notice.type === "error" ? `${t.danger}40` : notice.type === "success" ? `${t.success}40` : `${t.accent}40`}`,
            color: notice.type === "error" ? t.danger : notice.type === "success" ? t.success : t.accent,
            fontSize: "0.855rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <Icon name={notice.type === "error" ? "close" : "check"} size={14} />
          {notice.text}
        </div>
      )}

      {result && (
        <Card style={{ background: `${t.success}10`, border: `1px solid ${t.success}40` }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <Icon name="check" size={22} style={{ color: t.success }} />
            <div>
              <p className="heading" style={{ fontWeight: 700, color: t.success }}>Pipeline Applied Successfully</p>
              <p style={{ fontSize: "0.82rem", color: t.textMuted, fontFamily: "DM Mono" }}>New version ID: {result.version_id}</p>
            </div>
          </div>
        </Card>
      )}

      <div style={{ height: topPanelHeight, minHeight: 78, maxHeight: 300, display: "flex" }}>
      <Card style={{ padding: "0.75rem 0.85rem", height: "100%", width: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.6rem", marginBottom: "0.6rem" }}>
          <h3 className="heading" style={{ fontSize: "0.9rem", fontWeight: 700 }}>Transform</h3>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
            {session ? <Badge color="green">Session Active</Badge> : <Badge color="orange">Start Session First</Badge>}
            <Btn
              variant="primary"
              size="sm"
              icon="sql"
              onClick={() => openAddStepModal("sql")}
              disabled={!session}
            >
              SQL Transform
            </Btn>
          </div>
        </div>
        <div style={{ marginBottom: "0.45rem", minHeight: 18, fontSize: "0.77rem", color: hoveredOp ? t.text : t.textMuted, fontWeight: hoveredOp ? 600 : 500 }}>
          {hoveredOp || "Hover a transform action to see its name"}
        </div>
        <div
          style={
            compactRibbon
              ? {
                  display: "flex",
                  gap: "0.5rem",
                  overflowX: "auto",
                  overflowY: "hidden",
                  paddingBottom: "0.2rem",
                  flex: 1,
                  alignItems: "flex-start",
                  flexWrap: "nowrap",
                }
              : {
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))",
                  gap: "0.5rem",
                  overflowY: "auto",
                  overflowX: "hidden",
                  paddingBottom: "0.2rem",
                  flex: 1,
                  alignItems: "start",
                }
          }
        >
          {visualOps.map((op) => (
            <button
              key={op.key}
              type="button"
              title={op.label}
              onMouseEnter={() => setHoveredOp(op.label)}
              onMouseLeave={() => setHoveredOp("")}
              onClick={() => openAddStepModal("visual", op.key)}
              style={{
                border: `1px solid ${t.border}`,
                background: t.surfaceAlt,
                color: t.text,
                borderRadius: "10px",
                width: compactRibbon ? 48 : "100%",
                minWidth: compactRibbon ? 48 : 0,
                height: 46,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: !session ? "not-allowed" : "pointer",
                opacity: !session ? 0.55 : 1,
                transition: "all 0.15s ease",
                fontSize: "0.76rem",
                fontWeight: 600,
                gap: "0.35rem",
              }}
              disabled={!session}
            >
              <Icon name={op.icon} size={16} />
              {!compactRibbon && <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{op.label}</span>}
            </button>
          ))}
        </div>
      </Card>
      </div>
      <div
        onMouseDown={startTopResize}
        style={{
          height: 8,
          cursor: "row-resize",
          borderRadius: "6px",
          background: t.surfaceAlt,
          border: `1px solid ${t.border}`
        }}
      />

      <div
        ref={layoutRef}
        style={{
          display: "grid",
          gridTemplateColumns: showPipelinePanel ? `${sidePanelWidth}px 8px minmax(0,1fr)` : "minmax(0,1fr)",
          gap: showPipelinePanel ? "0.35rem" : "0.75rem",
          flex: 1,
          minHeight: 0
        }}
      >
        {showPipelinePanel && <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <Card style={{ padding: "0.75rem 0.85rem" }}>
            <h3 className="heading" style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: "0.75rem" }}>Dataset</h3>
            {datasets.length > 0 ? (
              <select
                value={selectedDs?.dataset_id || selectedDs?.id || ""}
                onChange={e => {
                  const d = datasets.find(ds => (ds.dataset_id || ds.id) == e.target.value);
                  setSelectedDs(d);
                  setSession(null);
                  setSteps([]);
                  setSelectedColumns([]);
                  setPreview(null);
                  setPreviewError("");
                }}
                style={{ width: "100%", padding: "0.55rem 0.7rem", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.surfaceAlt, color: t.text, fontSize: "0.855rem", fontFamily: "DM Sans, sans-serif", marginBottom: "0.75rem" }}
              >
                <option value="">Select dataset...</option>
                {datasets.map(d => <option key={d.dataset_id || d.id} value={d.dataset_id || d.id}>{d.name || d.dataset_name}</option>)}
              </select>
            ) : <p style={{ fontSize: "0.82rem", color: t.textMuted, marginBottom: "0.75rem" }}>No datasets found</p>}
            {!session ? (
              <Btn variant="primary" style={{ width: "100%", justifyContent: "center" }} icon="play" onClick={startSession} disabled={!selectedDs}>Start Session</Btn>
            ) : (
              <div style={{ padding: "0.5rem 0.75rem", borderRadius: "8px", background: `${t.success}15`, border: `1px solid ${t.success}40`, display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem", color: t.success }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: t.success }} />
                Session active
              </div>
            )}
          </Card>

          <Card style={{ flex: 1, padding: "0.75rem 0.85rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <h3 className="heading" style={{ fontSize: "0.9rem", fontWeight: 700 }}>Pipeline Steps</h3>
              {session && <Btn variant="secondary" size="sm" icon="plus" onClick={() => openAddStepModal("visual", "remove_nulls")}>Add</Btn>}
            </div>
            {steps.length === 0 ? (
              <div style={{ textAlign: "center", padding: "1.5rem 0", color: t.textMuted }}>
                <Icon name="pipeline" size={28} style={{ marginBottom: "0.5rem", opacity: 0.4 }} />
                <p style={{ fontSize: "0.8rem" }}>{session ? "Add your first step" : "Start a session first"}</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {steps.map((s, i) => {
                  const meta = stepLabels[s.operation || s.type] || { label: s.type, icon: "settings" };
                  return (
                    <div key={s.id} className="slide-in" style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.6rem 0.75rem", borderRadius: "8px", background: t.surfaceAlt, border: `1px solid ${t.border}` }}>
                      <div style={{ width: 24, height: 24, borderRadius: "6px", background: t.accentGlow, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Icon name={meta.icon} size={13} style={{ color: t.accent }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: "0.78rem", fontWeight: 600 }}>{i + 1}. {meta.label}</p>
                        <p style={{ fontSize: "0.7rem", color: t.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {s.type === "sql" ? s.sql : JSON.stringify(s.params || {})}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>}
        {showPipelinePanel && (
          <div
            onMouseDown={startResize}
            style={{
              width: 8,
              cursor: "col-resize",
              borderRadius: "6px",
              background: t.surfaceAlt,
              border: `1px solid ${t.border}`,
              transition: "background 0.15s ease"
            }}
          />
        )}

        <Card style={{ overflow: "hidden", display: "flex", flexDirection: "column", padding: "0.75rem 0.85rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexShrink: 0 }}>
            <h3 className="heading" style={{ fontSize: "0.9rem", fontWeight: 700 }}>Live Preview</h3>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Btn variant="secondary" size="sm" onClick={() => setShowMeta(v => !v)}>{showMeta ? "Hide Meta" : "Show Meta"}</Btn>
              <Input label="" type="number" value={String(previewLimit)} onChange={v => setPreviewLimit(v)} placeholder="50" style={{ width: 100 }} />
              {loadingPreview && <Spinner />}
            </div>
          </div>
          {previewError && (
            <div style={{ marginBottom: "0.8rem", padding: "0.55rem 0.75rem", borderRadius: "8px", border: `1px solid ${t.danger}40`, background: `${t.danger}15`, color: t.danger, fontSize: "0.8rem" }}>
              {previewError}
            </div>
          )}
          {!preview ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <EmptyState icon="eye" title="No preview yet" desc={session ? "Add a transformation to see updated preview instantly." : "Start a session to load initial preview."} />
            </div>
          ) : (
            <div style={{ overflowX: "auto", overflowY: "auto", flex: 1 }}>
              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.7rem" }}>
                <Badge color="blue">Started From: {preview.started_from || "N/A"}</Badge>
                <Badge color="green">Steps: {preview.steps ?? steps.length}</Badge>
                <Badge color="orange">Rows: {preview.limit || previewLimit}</Badge>
                {selectedColumns.length > 0 && <Badge color="blue">Selected: {selectedColumns.length}</Badge>}
              </div>
              <table style={{ fontSize: "0.78rem", minWidth: "max-content" }}>
                <thead style={{ position: "sticky", top: 0, background: t.card }}>
                  <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                    {cols.map((col, i) => {
                      const p = columnProfiles.find(x => x.name === col);
                      return (
                      <th key={i}
                        onContextMenu={(e) => openColumnMenu(e, col)}
                        onDoubleClick={(e) => openColumnMenu(e, col)}
                        onClick={() => setSelectedColumns(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col])}
                        style={{ padding: "0.45rem 0.7rem", color: selectedColumns.includes(col) ? t.accent : t.textMuted, fontWeight: 700, whiteSpace: "nowrap", fontFamily: "DM Mono", cursor: "pointer", background: selectedColumns.includes(col) ? t.accentGlow : "transparent", verticalAlign: "top" }}>
                        <div>{col}</div>
                        {showMeta && p && (
                          <div style={{ marginTop: "0.2rem", fontSize: "0.63rem", lineHeight: 1.35, fontWeight: 500, color: t.textSubtle }}>
                            <div>{p.type}</div>
                            <div>Valid {p.validPct}% | Err {p.errorPct}%</div>
                            <div>Empty {p.emptyPct}% | Distinct {p.distinct}</div>
                          </div>
                        )}
                      </th>
                    )})}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${t.border}`, background: i % 2 === 0 ? "transparent" : t.surfaceAlt }}>
                      {(Array.isArray(row) ? row : Object.values(row)).map((cell, j) => (
                        <td key={j} style={{ padding: "0.45rem 0.8rem", whiteSpace: "nowrap", fontFamily: "DM Mono" }}>{String(cell ?? "")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Modal open={showAddStep} onClose={() => setShowAddStep(false)} title={stepForm.type === "sql" ? "Add SQL Transform" : "Add Visual Transform"}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {stepForm.type === "visual" && (
            <>
              <div>
                <label style={{ fontSize: "0.78rem", fontWeight: 600, color: t.textMuted, display: "block", marginBottom: "0.4rem", textTransform: "uppercase" }}>Operation</label>
                <select value={stepForm.operation} onChange={e => setStepForm(p => ({ ...p, operation: e.target.value }))}
                  style={{ width: "100%", padding: "0.65rem 0.9rem", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.surfaceAlt, color: t.text, fontSize: "0.875rem", fontFamily: "DM Sans" }}>
                  <option value="remove_nulls">Remove Nulls</option>
                  <option value="remove_duplicates">Remove Duplicates</option>
                  <option value="change_type">Change Column Type</option>
                  <option value="add_column">Add Computed Column</option>
                  <option value="filter">Filter Rows</option>
                  <option value="select_columns">Select Columns</option>
                  <option value="rename_column">Rename Column</option>
                  <option value="fill_nulls">Fill Nulls</option>
                  <option value="sort">Sort Rows</option>
                  <option value="limit_rows">Limit Rows</option>
                  <option value="split_column">Split Column</option>
                  <option value="trim_text">Trim Text</option>
                  <option value="replace_values">Replace Values</option>
                  <option value="delete_columns">Delete Columns</option>
                  <option value="merge_columns">Merge Columns</option>
                  <option value="merge_datasets">Merge Datasets</option>
                </select>
              </div>
              {(stepForm.operation === "remove_nulls" || stepForm.operation === "remove_duplicates" || stepForm.operation === "select_columns" || stepForm.operation === "trim_text" || stepForm.operation === "delete_columns" || stepForm.operation === "merge_columns") && (
                <>
                  <div>
                    <label style={{ fontSize: "0.78rem", fontWeight: 600, color: t.textMuted, display: "block", marginBottom: "0.4rem", textTransform: "uppercase" }}>Columns</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginBottom: "0.45rem" }}>
                      {availableColumns.map((c) => {
                        const active = parseColumns(stepForm.columns).includes(c);
                        return (
                          <button key={c} type="button" onClick={() => {
                            const curr = parseColumns(stepForm.columns);
                            const next = active ? curr.filter(x => x !== c) : [...curr, c];
                            setStepForm(p => ({ ...p, columns: next.join(", ") }));
                          }}
                            style={{ border: `1px solid ${active ? t.accent : t.border}`, background: active ? t.accentGlow : t.surfaceAlt, color: active ? t.accent : t.textMuted, borderRadius: "999px", fontSize: "0.72rem", padding: "0.22rem 0.5rem", cursor: "pointer" }}>
                            {c}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <Input label="Columns (comma-separated)" value={stepForm.columns} onChange={v => setStepForm(p => ({ ...p, columns: v }))} placeholder="e.g. name, email" mono />
                </>
              )}
              {stepForm.operation === "change_type" && (
                <>
                  <div>
                    <label style={{ fontSize: "0.78rem", fontWeight: 600, color: t.textMuted, display: "block", marginBottom: "0.4rem", textTransform: "uppercase" }}>Column Name</label>
                    <select value={stepForm.column} onChange={e => setStepForm(p => ({ ...p, column: e.target.value }))}
                      style={{ width: "100%", padding: "0.65rem 0.9rem", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.surfaceAlt, color: t.text, fontSize: "0.875rem", fontFamily: "DM Sans" }}>
                      <option value="">Select column...</option>
                      {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: "0.78rem", fontWeight: 600, color: t.textMuted, display: "block", marginBottom: "0.4rem", textTransform: "uppercase" }}>New Type</label>
                    <select value={stepForm.newType} onChange={e => setStepForm(p => ({ ...p, newType: e.target.value }))}
                      style={{ width: "100%", padding: "0.65rem 0.9rem", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.surfaceAlt, color: t.text, fontSize: "0.875rem", fontFamily: "DM Sans" }}>
                      { ["INTEGER","FLOAT","TEXT","DATE","BOOLEAN"].map(tp => <option key={tp} value={tp}>{tp}</option>) }
                    </select>
                  </div>
                </>
              )}
              {stepForm.operation === "rename_column" && (
                <>
                  <div>
                    <label style={{ fontSize: "0.78rem", fontWeight: 600, color: t.textMuted, display: "block", marginBottom: "0.4rem", textTransform: "uppercase" }}>Old Column Name</label>
                    <select value={stepForm.column} onChange={e => setStepForm(p => ({ ...p, column: e.target.value }))}
                      style={{ width: "100%", padding: "0.65rem 0.9rem", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.surfaceAlt, color: t.text, fontSize: "0.875rem", fontFamily: "DM Sans" }}>
                      <option value="">Select column...</option>
                      {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <Input label="New Column Name" value={stepForm.columnName} onChange={v => setStepForm(p => ({ ...p, columnName: v }))} placeholder="e.g. new_name" />
                </>
              )}
              {stepForm.operation === "fill_nulls" && (
                <>
                  <div>
                    <label style={{ fontSize: "0.78rem", fontWeight: 600, color: t.textMuted, display: "block", marginBottom: "0.4rem", textTransform: "uppercase" }}>Column Name</label>
                    <select value={stepForm.column} onChange={e => setStepForm(p => ({ ...p, column: e.target.value }))}
                      style={{ width: "100%", padding: "0.65rem 0.9rem", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.surfaceAlt, color: t.text, fontSize: "0.875rem", fontFamily: "DM Sans" }}>
                      <option value="">Select column...</option>
                      {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <Input label="Fill Value" value={stepForm.expression} onChange={v => setStepForm(p => ({ ...p, expression: v }))} placeholder="e.g. Unknown or 0" />
                </>
              )}
              {stepForm.operation === "sort" && (
                <>
                  <div>
                    <label style={{ fontSize: "0.78rem", fontWeight: 600, color: t.textMuted, display: "block", marginBottom: "0.4rem", textTransform: "uppercase" }}>Sort Column</label>
                    <select value={stepForm.column} onChange={e => setStepForm(p => ({ ...p, column: e.target.value }))}
                      style={{ width: "100%", padding: "0.65rem 0.9rem", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.surfaceAlt, color: t.text, fontSize: "0.875rem", fontFamily: "DM Sans" }}>
                      <option value="">Select column...</option>
                      {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: "0.78rem", fontWeight: 600, color: t.textMuted, display: "block", marginBottom: "0.4rem", textTransform: "uppercase" }}>Direction</label>
                    <select value={stepForm.newType} onChange={e => setStepForm(p => ({ ...p, newType: e.target.value }))}
                      style={{ width: "100%", padding: "0.65rem 0.9rem", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.surfaceAlt, color: t.text, fontSize: "0.875rem", fontFamily: "DM Sans" }}>
                      {["ASC", "DESC"].map(tp => <option key={tp} value={tp}>{tp}</option>)}
                    </select>
                  </div>
                </>
              )}
              {stepForm.operation === "limit_rows" && (
                <Input label="Limit Rows" type="number" value={stepForm.expression} onChange={v => setStepForm(p => ({ ...p, expression: v }))} placeholder="e.g. 100" />
              )}
              {stepForm.operation === "split_column" && (
                <>
                  <div>
                    <label style={{ fontSize: "0.78rem", fontWeight: 600, color: t.textMuted, display: "block", marginBottom: "0.4rem", textTransform: "uppercase" }}>Column Name</label>
                    <select value={stepForm.column} onChange={e => setStepForm(p => ({ ...p, column: e.target.value }))}
                      style={{ width: "100%", padding: "0.65rem 0.9rem", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.surfaceAlt, color: t.text, fontSize: "0.875rem", fontFamily: "DM Sans" }}>
                      <option value="">Select column...</option>
                      {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <Input label="Delimiter" value={stepForm.splitDelimiter} onChange={v => setStepForm(p => ({ ...p, splitDelimiter: v }))} placeholder="e.g. ," mono />
                  <Input label="Part Index (1-based)" type="number" value={stepForm.splitIndex} onChange={v => setStepForm(p => ({ ...p, splitIndex: v }))} placeholder="1" />
                  <Input label="New Column Name" value={stepForm.columnName} onChange={v => setStepForm(p => ({ ...p, columnName: v }))} placeholder="e.g. first_part" />
                </>
              )}
              {stepForm.operation === "replace_values" && (
                <>
                  <div>
                    <label style={{ fontSize: "0.78rem", fontWeight: 600, color: t.textMuted, display: "block", marginBottom: "0.4rem", textTransform: "uppercase" }}>Column Name</label>
                    <select value={stepForm.column} onChange={e => setStepForm(p => ({ ...p, column: e.target.value }))}
                      style={{ width: "100%", padding: "0.65rem 0.9rem", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.surfaceAlt, color: t.text, fontSize: "0.875rem", fontFamily: "DM Sans" }}>
                      <option value="">Select column...</option>
                      {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <Input label="Old Value" value={stepForm.condition} onChange={v => setStepForm(p => ({ ...p, condition: v }))} placeholder="value to replace" />
                  <Input label="New Value" value={stepForm.expression} onChange={v => setStepForm(p => ({ ...p, expression: v }))} placeholder="replacement value" />
                </>
              )}
              {stepForm.operation === "merge_columns" && (
                <>
                  <Input label="Delimiter" value={stepForm.mergeDelimiter} onChange={v => setStepForm(p => ({ ...p, mergeDelimiter: v }))} placeholder="e.g. space or -" />
                  <Input label="New Merged Column Name" value={stepForm.columnName} onChange={v => setStepForm(p => ({ ...p, columnName: v }))} placeholder="e.g. full_name" />
                </>
              )}
              {stepForm.operation === "merge_datasets" && (
                <>
                  <div>
                    <label style={{ fontSize: "0.78rem", fontWeight: 600, color: t.textMuted, display: "block", marginBottom: "0.4rem", textTransform: "uppercase" }}>Secondary Dataset</label>
                    <select value={stepForm.secondaryDatasetId} onChange={e => setStepForm(p => ({ ...p, secondaryDatasetId: e.target.value, rightColumn: "" }))}
                      style={{ width: "100%", padding: "0.65rem 0.9rem", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.surfaceAlt, color: t.text, fontSize: "0.875rem", fontFamily: "DM Sans" }}>
                      <option value="">Select dataset...</option>
                      {datasets.filter(d => (d.dataset_id || d.id) !== (selectedDs?.dataset_id || selectedDs?.id)).map(d => <option key={d.dataset_id || d.id} value={d.dataset_id || d.id}>{d.name || d.dataset_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: "0.78rem", fontWeight: 600, color: t.textMuted, display: "block", marginBottom: "0.4rem", textTransform: "uppercase" }}>Primary Join Column</label>
                    <select value={stepForm.column} onChange={e => setStepForm(p => ({ ...p, column: e.target.value }))}
                      style={{ width: "100%", padding: "0.65rem 0.9rem", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.surfaceAlt, color: t.text, fontSize: "0.875rem", fontFamily: "DM Sans" }}>
                      <option value="">Select column...</option>
                      {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: "0.78rem", fontWeight: 600, color: t.textMuted, display: "block", marginBottom: "0.4rem", textTransform: "uppercase" }}>Secondary Join Column</label>
                    <select value={stepForm.rightColumn} onChange={e => setStepForm(p => ({ ...p, rightColumn: e.target.value }))}
                      style={{ width: "100%", padding: "0.65rem 0.9rem", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.surfaceAlt, color: t.text, fontSize: "0.875rem", fontFamily: "DM Sans" }}>
                      <option value="">Select column...</option>
                      {secondaryColumns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: "0.78rem", fontWeight: 600, color: t.textMuted, display: "block", marginBottom: "0.4rem", textTransform: "uppercase" }}>Join Type</label>
                    <select value={stepForm.joinType} onChange={e => setStepForm(p => ({ ...p, joinType: e.target.value }))}
                      style={{ width: "100%", padding: "0.65rem 0.9rem", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.surfaceAlt, color: t.text, fontSize: "0.875rem", fontFamily: "DM Sans" }}>
                      {["left", "inner", "right", "full"].map(j => <option key={j} value={j}>{j.toUpperCase()}</option>)}
                    </select>
                  </div>
                </>
              )}
              {stepForm.operation === "add_column" && (
                <>
                  <Input label="New Column Name" value={stepForm.columnName} onChange={v => setStepForm(p => ({ ...p, columnName: v }))} placeholder="e.g. revenue_bucket" />
                  <Input label="Expression" value={stepForm.expression} onChange={v => setStepForm(p => ({ ...p, expression: v }))} placeholder="e.g. amount * 1.18" mono />
                </>
              )}
              {stepForm.operation === "filter" && (
                <Input label="Condition" value={stepForm.condition} onChange={v => setStepForm(p => ({ ...p, condition: v }))} placeholder="e.g. amount > 100 AND country = 'US'" mono />
              )}
            </>
          )}

          {stepForm.type === "sql" && (
            <div>
              <label style={{ fontSize: "0.78rem", fontWeight: 600, color: t.textMuted, display: "block", marginBottom: "0.4rem", textTransform: "uppercase" }}>SQL Query</label>
              <textarea value={stepForm.sql} onChange={e => setStepForm(p => ({ ...p, sql: e.target.value }))}
                placeholder="SELECT * FROM data WHERE amount > 100"
                rows={5}
                style={{ width: "100%", padding: "0.65rem 0.9rem", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.surfaceAlt, color: t.text, fontSize: "0.855rem", fontFamily: "DM Mono, monospace", resize: "vertical", outline: "none" }} />
            </div>
          )}

          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
            <Btn variant="secondary" onClick={() => setShowAddStep(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={addStep} loading={addingStep}>Add Step</Btn>
          </div>
        </div>
      </Modal>
      {columnMenu.open && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            top: columnMenu.y,
            left: columnMenu.x,
            zIndex: 1200,
            width: 220,
            background: t.surface,
            border: `1px solid ${t.border}`,
            borderRadius: "10px",
            boxShadow: t.shadowLg,
            padding: "0.35rem",
          }}
        >
          <div style={{ padding: "0.45rem 0.55rem", borderBottom: `1px solid ${t.border}`, marginBottom: "0.35rem" }}>
            <p style={{ fontSize: "0.72rem", color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>Column</p>
            <p style={{ fontSize: "0.8rem", fontWeight: 700, fontFamily: "DM Mono, monospace", color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {columnMenu.column}
            </p>
          </div>
          <button
            type="button"
            onClick={() => quickAddColumnStep("remove_nulls", { columns: [columnMenu.column] })}
            style={{ width: "100%", textAlign: "left", border: "none", background: "transparent", color: t.text, padding: "0.45rem 0.55rem", borderRadius: "7px", cursor: "pointer", fontSize: "0.82rem" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = t.surfaceAlt; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            Remove Nulls
          </button>
          <button
            type="button"
            onClick={() => quickAddColumnStep("trim_text", { columns: [columnMenu.column] })}
            style={{ width: "100%", textAlign: "left", border: "none", background: "transparent", color: t.text, padding: "0.45rem 0.55rem", borderRadius: "7px", cursor: "pointer", fontSize: "0.82rem" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = t.surfaceAlt; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            Trim Text
          </button>
          <button
            type="button"
            onClick={() => quickAddColumnStep("sort", { column: columnMenu.column, direction: "asc" })}
            style={{ width: "100%", textAlign: "left", border: "none", background: "transparent", color: t.text, padding: "0.45rem 0.55rem", borderRadius: "7px", cursor: "pointer", fontSize: "0.82rem" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = t.surfaceAlt; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            Sort Ascending
          </button>
          <button
            type="button"
            onClick={() => quickAddColumnStep("sort", { column: columnMenu.column, direction: "desc" })}
            style={{ width: "100%", textAlign: "left", border: "none", background: "transparent", color: t.text, padding: "0.45rem 0.55rem", borderRadius: "7px", cursor: "pointer", fontSize: "0.82rem" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = t.surfaceAlt; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            Sort Descending
          </button>
          <button
            type="button"
            onClick={() => quickAddColumnStep("select_columns", { columns: [columnMenu.column] })}
            style={{ width: "100%", textAlign: "left", border: "none", background: "transparent", color: t.text, padding: "0.45rem 0.55rem", borderRadius: "7px", cursor: "pointer", fontSize: "0.82rem" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = t.surfaceAlt; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            Keep Only This Column
          </button>
          <button
            type="button"
            onClick={() => quickAddColumnStep("delete_columns", { columns: [columnMenu.column] })}
            style={{ width: "100%", textAlign: "left", border: "none", background: "transparent", color: t.danger, padding: "0.45rem 0.55rem", borderRadius: "7px", cursor: "pointer", fontSize: "0.82rem" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = `${t.danger}15`; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            Delete Column
          </button>
        </div>
      )}
    </div>
  );
};

export default PipelinePage;

