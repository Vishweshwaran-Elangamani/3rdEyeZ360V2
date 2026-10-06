import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";

const API = "http://localhost:3000";
const uid = (user) => user?.user_id || user?.userid || "";
const upper = (value) =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9 _-]/g, "")
    .slice(0, 20);

function Icon({ type, size = 18 }) {
  const paths = {
    folder: (
      <>
        <path d="M3 7h6l2 2h10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <path d="M3 7V5a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v2" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14M5 12h14" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    edit: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z" />
      </>
    ),
    trash: (
      <>
        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="M6 6l12 12M18 6 6 18" />,
    warning: (
      <>
        <path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0z" />
        <path d="M12 9v4M12 17h.01" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[type]}
    </svg>
  );
}

function Modal({
  open,
  title,
  description,
  icon = "folder",
  tone = "primary",
  children,
  confirmText,
  cancelText = "Cancel",
  onConfirm,
  onClose,
  busy,
  confirmDisabled,
  t,
}) {
  if (!open) return null;
  const accent =
    tone === "danger" ? t.danger : tone === "success" ? t.success : t.accent;
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "grid",
        placeItems: "center",
        padding: 20,
        background: "rgba(3,7,18,.74)",
        backdropFilter: "blur(8px)",
      }}
      onMouseDown={(event) =>
        event.target === event.currentTarget && !busy && onClose?.()
      }
    >
      <div
        style={{
          width: "min(520px,100%)",
          maxHeight: "min(720px,90vh)",
          overflowY: "auto",
          borderRadius: 20,
          background: t.cardSurface,
          border: `1px solid ${t.borderStrong || t.border}`,
          boxShadow: "0 28px 90px rgba(0,0,0,.48)",
        }}
      >
        <div
          style={{
            padding: "22px 24px 17px",
            display: "flex",
            gap: 14,
            borderBottom: `1px solid ${t.border}`,
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 13,
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              color: accent,
              background: `${accent}18`,
              border: `1px solid ${accent}45`,
            }}
          >
            <Icon type={icon} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0, color: t.textPrimary, fontSize: 18 }}>
              {title}
            </h3>
            {description && (
              <p
                style={{
                  margin: "6px 0 0",
                  color: t.textMuted,
                  fontSize: 12.5,
                  lineHeight: 1.55,
                }}
              >
                {description}
              </p>
            )}
          </div>
          <button
            disabled={busy}
            onClick={onClose}
            aria-label="Close"
            style={{
              alignSelf: "start",
              border: 0,
              background: "transparent",
              color: t.textMuted,
              cursor: "pointer",
              padding: 4,
            }}
          >
            <Icon type="close" />
          </button>
        </div>
        {children && <div style={{ padding: "20px 24px" }}>{children}</div>}
        <div
          style={{
            padding: "16px 24px 22px",
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            borderTop: `1px solid ${t.border}`,
          }}
        >
          {onConfirm && (
            <>
              <button
                disabled={busy}
                onClick={onClose}
                style={{
                  minHeight: 40,
                  padding: "0 16px",
                  borderRadius: 10,
                  border: `1px solid ${t.border}`,
                  background: t.surfaceGlass,
                  color: t.textSecondary,
                  fontWeight: 800,
                  cursor: busy ? "not-allowed" : "pointer",
                }}
              >
                {cancelText}
              </button>
              <button
                disabled={busy || confirmDisabled}
                onClick={onConfirm}
                style={{
                  minHeight: 40,
                  padding: "0 18px",
                  borderRadius: 10,
                  border: `1px solid ${accent}66`,
                  background:
                    tone === "danger" ? `${accent}20` : t.accentGradient,
                  color: tone === "danger" ? accent : "#fff",
                  fontWeight: 900,
                  cursor: busy || confirmDisabled ? "not-allowed" : "pointer",
                  opacity: busy || confirmDisabled ? 0.65 : 1,
                }}
              >
                {busy ? "Processing..." : confirmText}
              </button>
            </>
          )}
          {!onConfirm && (
            <button
              onClick={onClose}
              style={{
                minHeight: 40,
                padding: "0 18px",
                borderRadius: 10,
                border: 0,
                background: t.accentGradient,
                color: "#fff",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProjectManagement({ colors: t, headers }) {
  const [projects, setProjects] = useState([]),
    [selected, setSelected] = useState(null),
    [members, setMembers] = useState([]),
    [users, setUsers] = useState([]),
    [role, setRole] = useState("Candidate"),
    [memberFilter, setMemberFilter] = useState("mapped"),
    [search, setSearch] = useState(""),
    [selectedIds, setSelectedIds] = useState([]),
    [membershipOverview, setMembershipOverview] = useState({}),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(null),
    [projectName, setProjectName] = useState("");

  const showResult = (title, description, tone = "success") =>
    setModal({ type: "result", title, description, tone });
  const errorText = (error) =>
    error?.response?.data?.detail ||
    error?.message ||
    "The operation could not be completed.";
  const run = async (action, success) => {
    setBusy(true);
    try {
      await action();
      setModal(null);
      if (success) showResult(success.title, success.description);
    } catch (error) {
      showResult("Operation failed", errorText(error), "danger");
    } finally {
      setBusy(false);
    }
  };

  const load = useCallback(async () => {
    const { data } = await axios.get(`${API}/api/projects`, { headers });
    const next = data || [];
    setProjects(next);
    setSelected((current) =>
      current
        ? next.find((project) => project.project_id === current.project_id) ||
          null
        : current,
    );
  }, [headers]);
  const loadMembers = useCallback(async () => {
    if (!selected) return;
    const [{ data: m }, { data: u }, { data: overview }] = await Promise.all([
      axios.get(`${API}/api/projects/${selected.project_id}/members`, {
        headers,
      }),
      axios.get(`${API}/api/users?role=${role}`, { headers }),
      axios.get(
        `${API}/api/projects/${selected.project_id}/membership-overview/${role}`,
        { headers },
      ),
    ]);
    setMembers(m || []);
    setUsers(u || []);
    setMembershipOverview(overview || {});
    setSelectedIds([]);
  }, [headers, selected?.project_id, role]);
  useEffect(() => {
    setLoading(true);
    load()
      .catch((error) =>
        showResult("Unable to load projects", errorText(error), "danger"),
      )
      .finally(() => setLoading(false));
  }, [load]);
  useEffect(() => {
    loadMembers().catch((error) =>
      showResult("Unable to load members", errorText(error), "danger"),
    );
  }, [loadMembers]);

  const mappedIds = useMemo(
    () =>
      new Set(
        members
          .filter((member) => member.role === role)
          .map((member) => member.user_id),
      ),
    [members, role],
  );
  const mappedCount = useMemo(
    () => users.filter((user) => mappedIds.has(uid(user))).length,
    [users, mappedIds],
  );
  const unmappedCount = Math.max(0, users.length - mappedCount);
  const filtered = useMemo(
    () =>
      users
        .filter((user) => {
          const mapped = mappedIds.has(uid(user));
          const matchesMembership =
            memberFilter === "mapped" ? mapped : !mapped;
          const matchesSearch = `${user.name || ""} ${user.email || ""}`
            .toLowerCase()
            .includes(search.trim().toLowerCase());
          return matchesMembership && matchesSearch;
        })
        .sort((a, b) =>
          String(a.name || "").localeCompare(String(b.name || "")),
        ),
    [users, search, mappedIds, memberFilter],
  );
  const selectedUsers = useMemo(
    () => users.filter((user) => selectedIds.includes(uid(user))),
    [users, selectedIds],
  );
  const mappedSelected = selectedIds.filter((id) => mappedIds.has(id));
  const availableSelected = selectedIds.filter((id) => !mappedIds.has(id));
  const allVisibleSelected =
    filtered.length > 0 &&
    filtered.every((user) => selectedIds.includes(uid(user)));

  const openCreate = () => {
    setProjectName("");
    setModal({ type: "create" });
  };
  const openRename = (project) => {
    setProjectName(project.project_name);
    setModal({ type: "rename", project });
  };
  const create = () =>
    run(
      async () => {
        await axios.post(
          `${API}/api/projects`,
          { project_name: projectName },
          { headers },
        );
        await load();
      },
      {
        title: "Project created",
        description: `${projectName} is ready for member mapping.`,
      },
    );
  const rename = () =>
    run(
      async () => {
        await axios.patch(
          `${API}/api/projects/${modal.project.project_id}`,
          { project_name: projectName },
          { headers },
        );
        await load();
      },
      {
        title: "Project renamed",
        description: `The project name is now ${projectName}.`,
      },
    );
  const removeProject = () =>
    run(
      async () => {
        const project = modal.project;
        const { data } = await axios.delete(
          `${API}/api/projects/${project.project_id}`,
          { headers },
        );
        if (selected?.project_id === project.project_id) setSelected(null);
        await load();
        return data;
      },
      {
        title: "Project deleted",
        description: `${modal.project.project_name} was deleted and its active member mappings were removed.`,
      },
    );
  const showMap = () => setModal({ type: "map", ids: availableSelected });
  const map = () =>
    run(
      async () => {
        await axios.post(
          `${API}/api/projects/${selected.project_id}/members`,
          { user_ids: modal.ids, role },
          { headers },
        );
        await Promise.all([load(), loadMembers()]);
      },
      {
        title: "Members mapped",
        description: `${modal.ids.length} ${role.toLowerCase()}${modal.ids.length === 1 ? "" : "s"} mapped to ${selected.project_name}.`,
      },
    );
  const showUnmap = () => setModal({ type: "unmap", ids: mappedSelected });
  const unmap = () =>
    run(
      async () => {
        await axios.delete(
          `${API}/api/projects/${selected.project_id}/members`,
          { headers, data: { user_ids: modal.ids } },
        );
        await Promise.all([load(), loadMembers()]);
      },
      {
        title: "Members unmapped",
        description: `${modal.ids.length} ${role.toLowerCase()}${modal.ids.length === 1 ? "" : "s"} removed from ${selected.project_name}.`,
      },
    );

  const card = {
    background: t.cardSurface,
    border: `1px solid ${t.border}`,
    borderRadius: 18,
  };
  const button = (active = false) => ({
    minHeight: 38,
    border: `1px solid ${active ? t.borderAccent : t.border}`,
    background: active ? t.accentSoft : t.surfaceGlass,
    color: active ? t.accent : t.textSecondary,
    borderRadius: 10,
    padding: "0 14px",
    fontWeight: 850,
    cursor: "pointer",
  });
  const label = {
    color: t.textMuted,
    fontSize: 10,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  };
  const operationNames = selectedUsers
    .map((user) => user.name || user.email)
    .slice(0, 6);
  const mappingList =
    modal?.type === "map"
      ? selectedUsers.filter((user) => modal.ids.includes(uid(user)))
      : [];

  return (
    <div style={{ display: "grid", gap: 18, color: t.textPrimary }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 23 }}>Project Management</h2>
          <p style={{ color: t.textMuted, margin: "5px 0 0", fontSize: 13 }}>
            Organize projects and control Candidate and Examiner membership.
          </p>
        </div>
        <button
          onClick={openCreate}
          style={{
            ...button(true),
            minHeight: 42,
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: t.accentGradient,
            color: "#fff",
            border: 0,
          }}
        >
          <Icon type="plus" />
          New Project
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(260px,330px) minmax(0,1fr)",
          gap: 16,
          minHeight: 560,
        }}
      >
        <aside
          style={{
            ...card,
            padding: 14,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <div
            style={{
              padding: "4px 4px 13px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={label}>Projects</div>
              <div style={{ color: t.textMuted, fontSize: 12, marginTop: 3 }}>
                {projects.length} total
              </div>
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gap: 8,
              overflowY: "auto",
              paddingRight: 3,
            }}
          >
            {loading ? (
              <div
                style={{ padding: 24, color: t.textMuted, textAlign: "center" }}
              >
                Loading projects...
              </div>
            ) : (
              projects.map((project) => {
                const active = selected?.project_id === project.project_id;
                return (
                  <button
                    key={project.project_id}
                    onClick={() => setSelected(project)}
                    style={{
                      textAlign: "left",
                      padding: 14,
                      borderRadius: 13,
                      border: `1px solid ${active ? t.borderAccent : t.border}`,
                      background: active ? t.accentSoft : t.surfaceGlass,
                      color: t.textPrimary,
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{ display: "flex", gap: 11, alignItems: "center" }}
                    >
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 10,
                          display: "grid",
                          placeItems: "center",
                          color: active ? t.accent : t.textMuted,
                          background: active ? `${t.accent}18` : t.inputBg,
                        }}
                      >
                        <Icon type="folder" />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontWeight: 900,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {project.project_name}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: t.textMuted,
                            marginTop: 3,
                          }}
                        >
                          {project.candidate_count} Candidates ·{" "}
                          {project.examiner_count} Examiners
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
            {!loading && !projects.length && (
              <div
                style={{
                  padding: "44px 18px",
                  textAlign: "center",
                  color: t.textMuted,
                }}
              >
                <div
                  style={{
                    width: 46,
                    height: 46,
                    margin: "0 auto 12px",
                    display: "grid",
                    placeItems: "center",
                    borderRadius: 14,
                    background: t.accentSoft,
                    color: t.accent,
                  }}
                >
                  <Icon type="folder" />
                </div>
                No projects yet
              </div>
            )}
          </div>
        </aside>

        <section style={{ ...card, padding: 20, minWidth: 0 }}>
          {!selected ? (
            <div
              style={{
                height: "100%",
                minHeight: 480,
                display: "grid",
                placeItems: "center",
                textAlign: "center",
                color: t.textMuted,
              }}
            >
              <div>
                <div
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: 18,
                    margin: "0 auto 14px",
                    display: "grid",
                    placeItems: "center",
                    background: t.accentSoft,
                    color: t.accent,
                  }}
                >
                  <Icon type="users" size={26} />
                </div>
                <h3 style={{ margin: "0 0 6px", color: t.textPrimary }}>
                  Select a project
                </h3>
                <div>Choose a project from the left to manage members.</div>
              </div>
            </div>
          ) : (
            <div
              style={{ display: "flex", flexDirection: "column", minHeight: 0 }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 14,
                  flexWrap: "wrap",
                  paddingBottom: 17,
                  borderBottom: `1px solid ${t.border}`,
                }}
              >
                <div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <h3 style={{ margin: 0, fontSize: 20 }}>
                      {selected.project_name}
                    </h3>
                    <span
                      style={{
                        padding: "4px 8px",
                        borderRadius: 999,
                        background: t.successBg,
                        color: t.success,
                        fontSize: 10,
                        fontWeight: 900,
                      }}
                    >
                      ACTIVE
                    </span>
                  </div>
                  <div
                    style={{ color: t.textMuted, fontSize: 12, marginTop: 5 }}
                  >
                    {selected.candidate_count} Candidates ·{" "}
                    {selected.examiner_count} Examiners
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => openRename(selected)}
                    style={{
                      ...button(),
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                    }}
                  >
                    <Icon type="edit" size={15} />
                    Rename
                  </button>
                  <button
                    onClick={() =>
                      setModal({ type: "delete", project: selected })
                    }
                    style={{
                      ...button(),
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      color: t.danger,
                      borderColor: `${t.danger}55`,
                    }}
                  >
                    <Icon type="trash" size={15} />
                    Delete
                  </button>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                  flexWrap: "wrap",
                  padding: "16px 0 12px",
                }}
              >
                <div style={{ display: "flex", gap: 8 }}>
                  {["Candidate", "Examiner"].map((item) => (
                    <button
                      key={item}
                      onClick={() => {
                        setRole(item);
                        setSearch("");
                        setMemberFilter("mapped");
                        setSelectedIds([]);
                      }}
                      style={button(role === item)}
                    >
                      {item}s{" "}
                      <span style={{ marginLeft: 5, opacity: 0.75 }}>
                        {item === "Candidate"
                          ? selected.candidate_count
                          : selected.examiner_count}
                      </span>
                    </button>
                  ))}
                </div>
                <div style={{ position: "relative", width: "min(360px,100%)" }}>
                  <span
                    style={{
                      position: "absolute",
                      left: 12,
                      top: 11,
                      color: t.textMuted,
                    }}
                  >
                    <Icon type="search" size={16} />
                  </span>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={`Search ${role.toLowerCase()}s by name or email`}
                    style={{
                      boxSizing: "border-box",
                      width: "100%",
                      minHeight: 40,
                      padding: "0 13px 0 38px",
                      background: t.inputBg,
                      color: t.textPrimary,
                      border: `1px solid ${t.border}`,
                      borderRadius: 10,
                      outline: 0,
                    }}
                  />
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  flexWrap: "wrap",
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    display: "inline-flex",
                    gap: 6,
                    padding: 4,
                    borderRadius: 12,
                    background: t.inputBg,
                    border: `1px solid ${t.border}`,
                  }}
                >
                  {[
                    { key: "mapped", label: "Mapped", count: mappedCount },
                    {
                      key: "unmapped",
                      label: "Unmapped",
                      count: unmappedCount,
                    },
                  ].map((option) => {
                    const active = memberFilter === option.key;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => {
                          setMemberFilter(option.key);
                          setSelectedIds([]);
                        }}
                        style={{
                          minHeight: 36,
                          padding: "0 13px",
                          borderRadius: 9,
                          border: `1px solid ${active ? t.borderAccent : "transparent"}`,
                          background: active ? t.accentSoft : "transparent",
                          color: active ? t.accent : t.textMuted,
                          fontWeight: 900,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 7,
                        }}
                      >
                        <span>{option.label}</span>
                        <span
                          style={{
                            minWidth: 22,
                            height: 22,
                            padding: "0 6px",
                            borderRadius: 999,
                            display: "inline-grid",
                            placeItems: "center",
                            background: active
                              ? `${t.accent}20`
                              : t.surfaceGlass,
                            color: active ? t.accent : t.textMuted,
                            fontSize: 10,
                            fontWeight: 900,
                          }}
                        >
                          {option.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize: 11.5, color: t.textMuted }}>
                  {memberFilter === "mapped"
                    ? `Showing ${mappedCount} mapped ${role.toLowerCase()}${mappedCount === 1 ? "" : "s"}`
                    : `Showing ${unmappedCount} unmapped ${role.toLowerCase()}${unmappedCount === 1 ? "" : "s"}`}
                </div>
              </div>
              {selectedIds.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                    padding: "10px 12px",
                    marginBottom: 10,
                    borderRadius: 12,
                    background: t.accentSoft,
                    border: `1px solid ${t.borderAccent}`,
                  }}
                >
                  <div
                    style={{ fontSize: 12, fontWeight: 850, color: t.accent }}
                  >
                    {selectedIds.length} selected{" "}
                    <button
                      onClick={() => setSelectedIds([])}
                      style={{
                        marginLeft: 8,
                        border: 0,
                        background: "transparent",
                        color: t.textMuted,
                        cursor: "pointer",
                      }}
                    >
                      Clear
                    </button>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {memberFilter === "unmapped" ? (
                      <button
                        disabled={!availableSelected.length}
                        onClick={showMap}
                        style={{
                          ...button(true),
                          opacity: availableSelected.length ? 1 : 0.5,
                        }}
                      >
                        Map selected ({availableSelected.length})
                      </button>
                    ) : (
                      <button
                        disabled={!mappedSelected.length}
                        onClick={showUnmap}
                        style={{
                          ...button(),
                          color: t.danger,
                          opacity: mappedSelected.length ? 1 : 0.5,
                        }}
                      >
                        Unmap selected ({mappedSelected.length})
                      </button>
                    )}
                  </div>
                </div>
              )}
              <div
                style={{
                  border: `1px solid ${t.border}`,
                  borderRadius: 14,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "44px minmax(170px,1.15fr) minmax(205px,1.2fr) minmax(170px,1fr) 100px",
                    alignItems: "center",
                    minHeight: 44,
                    padding: "0 14px",
                    background: t.inputBg,
                    borderBottom: `1px solid ${t.border}`,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(event) =>
                      setSelectedIds(
                        event.target.checked
                          ? Array.from(
                              new Set([...selectedIds, ...filtered.map(uid)]),
                            )
                          : selectedIds.filter(
                              (id) =>
                                !filtered.some((user) => uid(user) === id),
                            ),
                      )
                    }
                    aria-label="Select visible users"
                  />
                  <div style={label}>Name</div>
                  <div style={label}>Email</div>
                  <div style={label}>Other Projects</div>
                  <div style={label}>Status</div>
                </div>
                <div style={{ maxHeight: 410, overflowY: "auto" }}>
                  {filtered.map((user) => {
                    const id = uid(user),
                      mapped = mappedIds.has(id),
                      checked = selectedIds.includes(id);
                    return (
                      <label
                        key={id}
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "44px minmax(170px,1.15fr) minmax(205px,1.2fr) minmax(170px,1fr) 100px",
                          alignItems: "center",
                          minHeight: 58,
                          padding: "9px 14px",
                          borderBottom: `1px solid ${t.border}`,
                          background: checked ? t.accentSoft : "transparent",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            setSelectedIds((current) =>
                              event.target.checked
                                ? [...current, id]
                                : current.filter((value) => value !== id),
                            )
                          }
                        />
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            minWidth: 0,
                          }}
                        >
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: "50%",
                              display: "grid",
                              placeItems: "center",
                              flexShrink: 0,
                              background: mapped ? t.successBg : t.accentSoft,
                              color: mapped ? t.success : t.accent,
                              fontWeight: 900,
                            }}
                          >
                            {String(user.name || user.email || "U")
                              .charAt(0)
                              .toUpperCase()}
                          </div>
                          <strong
                            style={{
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {user.name || "Unnamed user"}
                          </strong>
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: t.textMuted,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            paddingRight: 10,
                          }}
                        >
                          {user.email}
                        </div>
                        <div
                          title={(membershipOverview[id] || [])
                            .filter((membership) => !membership.is_current)
                            .map((membership) => membership.project_name)
                            .join(", ")}
                          style={{
                            fontSize: 11,
                            color: t.textMuted,
                            whiteSpace: "normal",
                            overflowWrap: "anywhere",
                            lineHeight: 1.45,
                            paddingRight: 10,
                          }}
                        >
                          {(() => {
                            const otherProjects = (membershipOverview[id] || [])
                              .filter((membership) => !membership.is_current)
                              .map((membership) => membership.project_name);
                            return otherProjects.length
                              ? otherProjects.join(", ")
                              : "—";
                          })()}
                        </div>
                        <span
                          style={{
                            justifySelf: "start",
                            padding: "5px 9px",
                            borderRadius: 999,
                            fontSize: 10,
                            fontWeight: 900,
                            background: mapped ? t.successBg : t.surfaceGlass,
                            color: mapped ? t.success : t.textMuted,
                            border: `1px solid ${mapped ? `${t.success}45` : t.border}`,
                          }}
                        >
                          {mapped ? "Mapped" : "Available"}
                        </span>
                      </label>
                    );
                  })}
                  {!filtered.length && (
                    <div
                      style={{
                        padding: 50,
                        textAlign: "center",
                        color: t.textMuted,
                      }}
                    >
                      No {memberFilter} {role.toLowerCase()}s match the current
                      search.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      <Modal
        open={modal?.type === "create"}
        title="Create project"
        description="Project names are stored in uppercase and may contain up to 20 characters."
        icon="plus"
        confirmText="Create Project"
        onConfirm={create}
        onClose={() => setModal(null)}
        busy={busy}
        confirmDisabled={!projectName.trim()}
        t={t}
      >
        <div style={label}>Project name</div>
        <input
          autoFocus
          value={projectName}
          maxLength={20}
          onChange={(event) => setProjectName(upper(event.target.value))}
          placeholder="PROJECT NAME"
          style={{
            boxSizing: "border-box",
            width: "100%",
            marginTop: 7,
            minHeight: 44,
            padding: "0 12px",
            borderRadius: 10,
            border: `1px solid ${t.border}`,
            background: t.inputBg,
            color: t.textPrimary,
            outline: 0,
          }}
        />
        <div
          style={{
            marginTop: 6,
            textAlign: "right",
            fontSize: 10,
            color: t.textMuted,
          }}
        >
          {projectName.length}/20
        </div>
      </Modal>
      <Modal
        open={modal?.type === "rename"}
        title="Rename project"
        description={`Update ${modal?.project?.project_name || "this project"}. Existing member mappings remain connected.`}
        icon="edit"
        confirmText="Save Changes"
        onConfirm={rename}
        onClose={() => setModal(null)}
        busy={busy}
        confirmDisabled={
          !projectName.trim() || projectName === modal?.project?.project_name
        }
        t={t}
      >
        <div style={label}>New project name</div>
        <input
          autoFocus
          value={projectName}
          maxLength={20}
          onChange={(event) => setProjectName(upper(event.target.value))}
          style={{
            boxSizing: "border-box",
            width: "100%",
            marginTop: 7,
            minHeight: 44,
            padding: "0 12px",
            borderRadius: 10,
            border: `1px solid ${t.border}`,
            background: t.inputBg,
            color: t.textPrimary,
            outline: 0,
          }}
        />
        <div
          style={{
            marginTop: 6,
            textAlign: "right",
            fontSize: 10,
            color: t.textMuted,
          }}
        >
          {projectName.length}/20
        </div>
      </Modal>
      <Modal
        open={modal?.type === "delete"}
        title={`Delete ${modal?.project?.project_name || "project"}?`}
        description="This action removes the active project and unmaps all Candidates and Examiners currently connected to the project."
        icon="trash"
        tone="danger"
        confirmText="Delete Project"
        onConfirm={removeProject}
        onClose={() => setModal(null)}
        busy={busy}
        t={t}
      >
        <div
          style={{
            padding: 13,
            borderRadius: 12,
            background: `${t.danger}12`,
            border: `1px solid ${t.danger}40`,
            color: t.textSecondary,
            fontSize: 12.5,
            lineHeight: 1.6,
          }}
        >
          <strong
            style={{ display: "block", color: t.danger, marginBottom: 4 }}
          >
            This cannot be undone from this screen.
          </strong>
          User accounts and their other project memberships will not be deleted.
        </div>
      </Modal>
      <Modal
        open={modal?.type === "map"}
        title={`Map ${modal?.ids?.length || 0} ${role}${modal?.ids?.length === 1 ? "" : "s"}`}
        description={`Review current memberships before mapping to ${selected?.project_name}. Existing mappings are preserved.`}
        icon="users"
        confirmText={`Map to ${selected?.project_name || "Project"}`}
        onConfirm={map}
        onClose={() => setModal(null)}
        busy={busy}
        t={t}
      >
        <div
          style={{ display: "grid", gap: 8, maxHeight: 310, overflowY: "auto" }}
        >
          {mappingList.map((user) => {
            const userId = uid(user);
            const currentProjects = projects
              .filter((project) =>
                members.some(
                  (member) =>
                    member.user_id === userId &&
                    member.project_id === project.project_id,
                ),
              )
              .map((project) => project.project_name);
            return (
              <div
                key={userId}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  border: `1px solid ${t.border}`,
                  background: t.surfaceGlass,
                }}
              >
                <strong>{user.name || user.email}</strong>
                <div style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>
                  Currently mapped to:{" "}
                  {currentProjects.length
                    ? currentProjects.join(", ")
                    : "No other projects"}
                </div>
              </div>
            );
          })}
        </div>
      </Modal>
      <Modal
        open={modal?.type === "unmap"}
        title={`Unmap ${modal?.ids?.length || 0} ${role}${modal?.ids?.length === 1 ? "" : "s"}?`}
        description={`The selected users will be removed only from ${selected?.project_name}. Their accounts and other project memberships remain unchanged.`}
        icon="warning"
        tone="danger"
        confirmText="Unmap Members"
        onConfirm={unmap}
        onClose={() => setModal(null)}
        busy={busy}
        t={t}
      >
        <div style={{ display: "grid", gap: 7 }}>
          {operationNames.map((name) => (
            <div
              key={name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: t.textSecondary,
                fontSize: 12,
              }}
            >
              <span style={{ color: t.danger }}>
                <Icon type="close" size={14} />
              </span>
              {name}
            </div>
          ))}
        </div>
      </Modal>
      <Modal
        open={modal?.type === "result"}
        title={modal?.title}
        description={modal?.description}
        icon={modal?.tone === "danger" ? "warning" : "check"}
        tone={modal?.tone}
        onClose={() => setModal(null)}
        t={t}
      />
    </div>
  );
}
