import { React, useEffect, useMemo, useRef, useState, useApp, useTheme, useToast } from "./_shared.js";
import { fetchFiles, uploadFiles, deleteFile, getSignedUrl, formatFileSize, fileIcon } from "../lib/fileStorage.js";
import { isSupabaseConfigured } from "../lib/supabaseClient.js";
import { btnPrimary, mkBtnSecondary } from "../styles/formStyles.js";
import { ConfirmModal, Modal, FormField } from "../components/common.jsx";

const CATEGORIES = ["general", "brief", "creative", "strategy", "report", "contract", "media", "other"];

// ─── FILE ROW ─────────────────────────────────────────────────────────────────
function FileRow({ file, onDelete, theme: t }) {
  const { isMobile } = useApp();
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const url = await getSignedUrl(file.storage_path);
      if (url) {
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
      }
    } catch {
      // silent
    } finally {
      setDownloading(false);
    }
  };

  if (isMobile) {
    return (
      <div style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"12px 14px", borderBottom:`1px solid ${t.border}`, background:t.statBg }}>
        <span style={{ fontSize:24, flexShrink:0 }}>{fileIcon(file.mime_type)}</span>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:600, color:t.text, fontSize:13, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{file.name}</div>
          {file.description && <div style={{ fontSize:11, color:t.textFaint, marginTop:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{file.description}</div>}
          <div style={{ fontSize:11, color:t.textGhost, marginTop:2, display:"flex", gap:8, flexWrap:"wrap" }}>
            <span>{formatFileSize(file.file_size)}</span>
            <span style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:5, padding:"1px 6px" }}>{file.category}</span>
            <span>{new Date(file.created_at).toLocaleDateString("en-GB", { day:"numeric", month:"short" })}</span>
          </div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:6, flexShrink:0 }}>
          <button
            onClick={handleDownload}
            disabled={downloading}
            style={{ background:t.accent, color:"#fff", border:"none", borderRadius:7, padding:"6px 12px", fontSize:12, fontWeight:700, cursor:"pointer" }}
          >
            {downloading ? "…" : "↓ Download"}
          </button>
          <button
            onClick={() => onDelete(file)}
            style={{ background:"transparent", border:"1px solid #EF444466", borderRadius:7, padding:"5px 10px", fontSize:12, color:"#EF4444", cursor:"pointer" }}
          >
            Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display:"grid", gridTemplateColumns:"32px 1fr 100px 120px 90px 90px", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:8, background:t.statBg, marginBottom:6, fontSize:13 }}>
      <span style={{ fontSize:20, textAlign:"center" }}>{fileIcon(file.mime_type)}</span>
      <div style={{ minWidth:0 }}>
        <div style={{ fontWeight:600, color:t.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{file.name}</div>
        {file.description && <div style={{ fontSize:11, color:t.textFaint, marginTop:1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{file.description}</div>}
        <div style={{ fontSize:10, color:t.textGhost, marginTop:2 }}>by {file.uploaded_by_name || "Unknown"}</div>
      </div>
      <span style={{ fontSize:11, color:t.textMuted, textAlign:"right" }}>{formatFileSize(file.file_size)}</span>
      <span style={{ fontSize:11, color:t.textMuted, textAlign:"center", background:t.card, border:`1px solid ${t.border}`, borderRadius:6, padding:"2px 8px" }}>{file.category}</span>
      <span style={{ fontSize:11, color:t.textFaint, textAlign:"right" }}>{new Date(file.created_at).toLocaleDateString("en-GB", { day:"numeric", month:"short" })}</span>
      <div style={{ display:"flex", gap:6, justifyContent:"flex-end" }}>
        <button
          onClick={handleDownload}
          disabled={downloading}
          title="Download"
          style={{ background:"transparent", border:`1px solid ${t.border2}`, borderRadius:6, padding:"4px 8px", fontSize:12, cursor:"pointer", color:t.textMuted }}
        >
          {downloading ? "…" : "↓"}
        </button>
        <button
          onClick={() => onDelete(file)}
          title="Delete"
          style={{ background:"transparent", border:`1px solid ${t.border2}`, borderRadius:6, padding:"4px 8px", fontSize:12, cursor:"pointer", color:"#EF4444" }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ─── FOLDER ───────────────────────────────────────────────────────────────────
function Folder({ label, files, onDelete, theme: t, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const totalSize = files.reduce((s, f) => s + (f.file_size || 0), 0);
  return (
    <div style={{ marginBottom:10 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width:"100%", display:"flex", alignItems:"center", gap:8, background:"transparent", border:`1px solid ${t.border2}`, borderRadius:10, padding:"10px 14px", cursor:"pointer", textAlign:"left" }}
      >
        <span style={{ fontSize:16 }}>{open ? "📂" : "📁"}</span>
        <span style={{ fontWeight:700, fontSize:13, color:t.text, flex:1 }}>{label}</span>
        <span style={{ fontSize:11, color:t.textMuted }}>{files.length} file{files.length !== 1 ? "s" : ""} · {formatFileSize(totalSize)}</span>
        <span style={{ fontSize:12, color:t.textGhost, marginLeft:4 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ marginTop:6, paddingLeft:8 }}>
          {files.length === 0 ? (
            <div style={{ fontSize:12, color:t.textFaint, padding:"10px 12px" }}>No files in this folder.</div>
          ) : (
            files.map(f => <FileRow key={f.id} file={f} onDelete={onDelete} theme={t} />)
          )}
        </div>
      )}
    </div>
  );
}

// ─── UPLOAD MODAL ─────────────────────────────────────────────────────────────
function UploadModal({ open, onClose, onUpload, projects, departments, theme: t }) {
  const [pending, setPending] = useState([]);
  const [category, setCategory] = useState("general");
  const [deptName, setDeptName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const addFiles = (fileList) => {
    const next = Array.from(fileList).filter(f => f.size <= 52428800);
    setPending(prev => {
      const names = new Set(prev.map(p => p.name));
      return [...prev, ...next.filter(f => !names.has(f.name))];
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  const handleSubmit = async () => {
    if (!pending.length) return;
    setUploading(true);
    try {
      await onUpload({ files: pending, category, departmentName: deptName || null, projectId: projectId || null, description });
      setPending([]);
      setCategory("general");
      setDeptName("");
      setProjectId("");
      setDescription("");
      onClose();
    } finally {
      setUploading(false);
    }
  };

  const iS = { width:"100%", background:t.input, border:`1px solid ${t.inputBorder}`, borderRadius:8, padding:"9px 12px", color:t.textSub, fontSize:13, outline:"none", boxSizing:"border-box" };
  const sS = { ...iS, cursor:"pointer" };

  return (
    <Modal open={open} onClose={onClose} title="Upload Files" width={520}>
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{ border:`2px dashed ${dragOver ? t.accent : t.border2}`, borderRadius:12, padding:"28px 20px", textAlign:"center", cursor:"pointer", background:dragOver ? `${t.accent}11` : t.statBg, marginBottom:16, transition:"border-color 0.15s, background 0.15s" }}
      >
        <div style={{ fontSize:28, marginBottom:6 }}>📂</div>
        <div style={{ fontSize:13, fontWeight:600, color:t.textSub }}>Drop files here or click to browse</div>
        <div style={{ fontSize:11, color:t.textFaint, marginTop:4 }}>Max 50 MB per file</div>
        <input ref={inputRef} type="file" multiple style={{ display:"none" }} onChange={e => addFiles(e.target.files)} />
      </div>

      {/* Pending list */}
      {pending.length > 0 && (
        <div style={{ maxHeight:140, overflowY:"auto", marginBottom:14, background:t.statBg, borderRadius:8, padding:"8px 10px" }}>
          {pending.map((f, i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, fontSize:12 }}>
              <span>{fileIcon(f.type)}</span>
              <span style={{ flex:1, color:t.textSub, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.name}</span>
              <span style={{ color:t.textFaint, flexShrink:0 }}>{formatFileSize(f.size)}</span>
              <button onClick={() => setPending(p => p.filter((_, j) => j !== i))} style={{ background:"none", border:"none", cursor:"pointer", color:"#EF4444", fontSize:14, padding:0 }}>✕</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
        <FormField label="Category">
          <select style={sS} value={category} onChange={e => setCategory(e.target.value)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
          </select>
        </FormField>
        <FormField label="Department (optional)">
          <select style={sS} value={deptName} onChange={e => setDeptName(e.target.value)}>
            <option value="">None</option>
            {(departments || []).map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
          </select>
        </FormField>
      </div>
      <FormField label="Project (optional)">
        <select style={sS} value={projectId} onChange={e => setProjectId(e.target.value)}>
          <option value="">None</option>
          {(projects || []).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      </FormField>
      <FormField label="Description (optional)">
        <input style={iS} value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description for all selected files" />
      </FormField>
      <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:4 }}>
        <button style={mkBtnSecondary(t)} onClick={onClose}>Cancel</button>
        <button style={btnPrimary} disabled={!pending.length || uploading} onClick={handleSubmit}>
          {uploading ? "Uploading…" : `Upload ${pending.length || ""} File${pending.length !== 1 ? "s" : ""}`}
        </button>
      </div>
    </Modal>
  );
}

// ─── DRIVE PAGE ───────────────────────────────────────────────────────────────
export function Drive() {
  const { theme: t } = useTheme();
  const toast = useToast();
  const { currentUser, projects, departments, isMobile } = useApp();
  const bs = mkBtnSecondary(t);

  const [files, setFiles]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState("all");
  const [search, setSearch]       = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [toDelete, setToDelete]   = useState(null);
  const [deleting, setDeleting]   = useState(false);

  const agencyId = currentUser?.agency_id;

  const load = async () => {
    if (!agencyId) return;
    setLoading(true);
    try {
      const data = await fetchFiles(agencyId);
      setFiles(data);
    } catch (e) {
      toast({ message: `Failed to load files: ${e.message}`, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [agencyId]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q
      ? files.filter(f =>
          f.name.toLowerCase().includes(q) ||
          (f.description || "").toLowerCase().includes(q) ||
          (f.uploaded_by_name || "").toLowerCase().includes(q) ||
          (f.category || "").toLowerCase().includes(q)
        )
      : files;
  }, [files, search]);

  const totalSize = files.reduce((s, f) => s + (f.file_size || 0), 0);

  const handleUpload = async ({ files: fileList, category, departmentName, projectId, description }) => {
    try {
      const newFiles = await uploadFiles({
        files: fileList,
        agencyId,
        category,
        departmentName,
        projectId,
        description,
        currentUser,
      });
      setFiles(prev => [...newFiles, ...prev]);
      toast({ message: `${newFiles.length} file${newFiles.length !== 1 ? "s" : ""} uploaded`, type: "success" });
    } catch (e) {
      toast({ message: `Upload failed: ${e.message}`, type: "error" });
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteFile(toDelete);
      setFiles(prev => prev.filter(f => f.id !== toDelete.id));
      toast({ message: `"${toDelete.name}" deleted`, type: "success" });
      setToDelete(null);
    } catch (e) {
      toast({ message: `Delete failed: ${e.message}`, type: "error" });
    } finally {
      setDeleting(false);
    }
  };

  // ── Tab content ─────────────────────────────────────────────────────────────
  const AllTab = () => (
    <div>
      {filtered.length === 0 ? (
        <div style={{ padding:"48px 0", textAlign:"center", color:t.textFaint, fontSize:13 }}>
          {search ? "No files match your search." : "No files uploaded yet. Click \"Upload Files\" to get started."}
        </div>
      ) : (
        <>
          {!isMobile && (
            <div style={{ display:"grid", gridTemplateColumns:"32px 1fr 100px 120px 90px 90px", gap:10, padding:"6px 12px", marginBottom:4 }}>
              {["", "Name", "Size", "Category", "Date", ""].map((h, i) => (
                <span key={i} style={{ fontSize:10, fontWeight:700, color:t.textGhost, textAlign: i >= 2 ? "center" : "left", letterSpacing:"0.06em" }}>{h.toUpperCase()}</span>
              ))}
            </div>
          )}
          {filtered.map(f => <FileRow key={f.id} file={f} onDelete={setToDelete} theme={t} />)}
        </>
      )}
    </div>
  );

  const DeptTab = () => {
    const byDept = useMemo(() => {
      const map = {};
      filtered.forEach(f => {
        const key = f.department_name || "General";
        if (!map[key]) map[key] = [];
        map[key].push(f);
      });
      return map;
    }, [filtered]);
    const keys = Object.keys(byDept).sort();
    return keys.length === 0 ? (
      <div style={{ padding:"48px 0", textAlign:"center", color:t.textFaint, fontSize:13 }}>No files yet.</div>
    ) : (
      <div>{keys.map(k => <Folder key={k} label={k} files={byDept[k]} onDelete={setToDelete} theme={t} defaultOpen={keys.length === 1} />)}</div>
    );
  };

  const ProjectTab = () => {
    const byProject = useMemo(() => {
      const map = {};
      filtered.forEach(f => {
        const proj = projects.find(p => p.id === f.project_id);
        const key = proj ? proj.title : "No Project";
        if (!map[key]) map[key] = [];
        map[key].push(f);
      });
      return map;
    }, [filtered]);
    const keys = Object.keys(byProject).sort();
    return keys.length === 0 ? (
      <div style={{ padding:"48px 0", textAlign:"center", color:t.textFaint, fontSize:13 }}>No files yet.</div>
    ) : (
      <div>{keys.map(k => <Folder key={k} label={k} files={byProject[k]} onDelete={setToDelete} theme={t} defaultOpen={keys.length === 1} />)}</div>
    );
  };

  if (!isSupabaseConfigured) {
    return (
      <div style={{ padding:32, textAlign:"center", color:t.textFaint, fontSize:14 }}>
        <div style={{ fontSize:32, marginBottom:12 }}>☁️</div>
        <div style={{ fontWeight:700, color:t.text, marginBottom:8 }}>Drive requires Supabase</div>
        <div>Configure <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to enable file storage.</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24, flexWrap:"wrap", gap:12 }}>
        <div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:t.text }}>Drive</h1>
          <div style={{ fontSize:12, color:t.textFaint, marginTop:3 }}>
            {files.length} file{files.length !== 1 ? "s" : ""} · {formatFileSize(totalSize)} used
          </div>
        </div>
        <button style={btnPrimary} onClick={() => setUploadOpen(true)}>+ Upload Files</button>
      </div>

      {/* Search + tabs */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20, flexWrap:"wrap" }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search files…"
          style={{ flex:1, minWidth:180, background:t.input, border:`1px solid ${t.inputBorder}`, borderRadius:8, padding:"8px 12px", color:t.textSub, fontSize:13, outline:"none" }}
        />
        <div style={{ display:"flex", gap:4, background:t.statBg, borderRadius:8, padding:3, flexShrink:0 }}>
          {[["all","🗂 All"],["departments","🏢 Departments"],["projects","📁 Projects"]].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{ ...bs, padding:"5px 14px", fontSize:12, fontWeight:700, background:tab===id?t.card:"transparent", color:tab===id?t.text:t.textMuted, border:`1px solid ${tab===id?t.border2:"transparent"}`, borderRadius:6, boxShadow:tab===id?"0 1px 4px rgba(0,0,0,0.07)":"none" }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20, minHeight:200 }}>
        {loading ? (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:"48px 0", gap:10, color:t.textMuted, fontSize:13 }}>
            <div style={{ width:18, height:18, border:`2px solid ${t.border2}`, borderTopColor:t.accent, borderRadius:"50%", animation:"spin 0.7s linear infinite" }} />
            Loading files…
          </div>
        ) : tab === "departments" ? <DeptTab /> : tab === "projects" ? <ProjectTab /> : <AllTab />}
      </div>

      {/* Upload modal */}
      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUpload={handleUpload}
        projects={projects}
        departments={departments}
        theme={t}
      />

      {/* Delete confirm */}
      <ConfirmModal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={handleDelete}
        title={`Delete "${toDelete?.name || "this file"}"?`}
        message="The file will be permanently removed from storage and cannot be recovered."
        confirmLabel={deleting ? "Deleting…" : "Delete File"}
      />
    </div>
  );
}
