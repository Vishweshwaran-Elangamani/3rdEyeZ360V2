import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import axios from "axios";
import useAuthStore from "../../store/authStore";
import useExamStore from "../../store/examStore";
import useSocket from "../../hooks/useSocket";
import ChatWindow from "../../components/common/ChatWindow";
import { startCandidateWebRTC, stopCandidateWebRTC } from "../../services/candidateWebRTC";
import { stopCameraStream } from "../../services/cameraStream";

const API = "http://localhost:3000";
const THEME_STORAGE_KEY = "3rdeyez360.theme";

const TERMINAL_ASSESSMENT_STATUSES = new Set(["TERMINATED", "COMPLETED"]);
const TERMINAL_EXAM_STATUSES = new Set(["COMPLETED", "TERMINATED", "STOPPED"]);

function getAssessmentTimerStorageKey(assessmentId) {
  return assessmentId ? `3rdeyez360.assessment-timer.${assessmentId}` : null;
}

/* ============= Theme system ============= */

const THEMES = {
  dark: {
    name: "dark",
    canvas: "#07080d",
    canvasTint:
      "radial-gradient(ellipse at top left, #10152a 0%, #07080d 50%), radial-gradient(ellipse at bottom right, #1a0f2e 0%, #07080d 60%)",
    surface: "rgba(22, 26, 40, 0.72)",
    surfaceElevated: "rgba(30, 34, 50, 0.85)",
    surfaceSolid: "#141826",
    sidebarBg: "#0f1220",
    browserBg: "#050609",
    surfaceGlass: "rgba(255, 255, 255, 0.03)",
    surfaceGlassHover: "rgba(255, 255, 255, 0.055)",
    cardSurface: "rgba(28, 32, 48, 0.75)",
    tabBar: "#0f1220",
    border: "rgba(255, 255, 255, 0.06)",
    borderStrong: "rgba(255, 255, 255, 0.12)",
    borderAccent: "rgba(91, 140, 255, 0.4)",
    textPrimary: "#f1f3fb",
    textSecondary: "#a8afc7",
    textMuted: "#6b7286",
    textFaint: "#464b60",
    accent: "#5b8cff",
    accent2: "#a065ff",
    accent3: "#ff6ec7",
    accentGradient: "linear-gradient(135deg, #5b8cff 0%, #a065ff 50%, #ff6ec7 100%)",
    accentGradientSoft:
      "linear-gradient(135deg, rgba(91,140,255,0.15) 0%, rgba(160,101,255,0.15) 50%, rgba(255,110,199,0.15) 100%)",
    accentSoft: "rgba(91,140,255,0.12)",
    success: "#3ecf8e",
    successGradient: "linear-gradient(135deg, #3ecf8e 0%, #22a37a 100%)",
    successBg: "rgba(62,207,142,0.12)",
    warning: "#e8b04b",
    warningGradient: "linear-gradient(135deg, #ffc94b 0%, #e8850b 100%)",
    warningBg: "rgba(232,176,75,0.12)",
    danger: "#ef6a6a",
    dangerGradient: "linear-gradient(135deg, #ff7a7a 0%, #d94a4a 100%)",
    dangerBg: "rgba(239,106,106,0.12)",
    info: "#6da5ff",
    infoBg: "rgba(109,165,255,0.12)",
    glowAccent: "0 8px 32px rgba(91,140,255,0.28), 0 0 60px rgba(160,101,255,0.15)",
    overlay: "rgba(3, 5, 10, 0.88)",
    // Timer palette â€” soft, non-glaring
    timerPillBg: "rgba(20, 24, 38, 0.55)",
    timerPillBorder: "rgba(255, 255, 255, 0.08)",
    timerConsumed: "rgba(255, 255, 255, 0.09)",
    timerGreen: "#52c98d",
    timerYellow: "#d4b356",
    timerRed: "#e07777",
  },
  light: {
    name: "light",
    canvas: "#eef1fb",
    canvasTint:
      "radial-gradient(ellipse at top left, #dbe4ff 0%, #eef1fb 45%), radial-gradient(ellipse at bottom right, #ffd9ec 0%, #eef1fb 55%)",
    surface: "rgba(255, 255, 255, 0.85)",
    surfaceElevated: "rgba(255, 255, 255, 0.94)",
    surfaceSolid: "#ffffff",
    sidebarBg: "#ffffff",
    browserBg: "#f6f8fd",
    surfaceGlass: "rgba(255, 255, 255, 0.6)",
    surfaceGlassHover: "rgba(255, 255, 255, 0.85)",
    cardSurface: "#ffffff",
    tabBar: "#f6f8fd",
    border: "rgba(20, 28, 60, 0.08)",
    borderStrong: "rgba(20, 28, 60, 0.15)",
    borderAccent: "rgba(75, 96, 232, 0.4)",
    textPrimary: "#0b1024",
    textSecondary: "#3a4160",
    textMuted: "#6a7290",
    textFaint: "#a4abc0",
    accent: "#4b60e8",
    accent2: "#7c3aed",
    accent3: "#e94aa8",
    accentGradient: "linear-gradient(135deg, #4b60e8 0%, #7c3aed 50%, #e94aa8 100%)",
    accentGradientSoft:
      "linear-gradient(135deg, rgba(75,96,232,0.12) 0%, rgba(124,58,237,0.12) 50%, rgba(233,74,168,0.12) 100%)",
    accentSoft: "rgba(75,96,232,0.10)",
    success: "#0ea564",
    successGradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    successBg: "rgba(14,165,100,0.14)",
    warning: "#d97706",
    warningGradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
    warningBg: "rgba(217,119,6,0.14)",
    danger: "#dc2626",
    dangerGradient: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
    dangerBg: "rgba(220,38,38,0.12)",
    info: "#2563eb",
    infoBg: "rgba(37,99,235,0.12)",
    glowAccent: "0 12px 40px rgba(75,96,232,0.25), 0 0 60px rgba(124,58,237,0.15)",
    overlay: "rgba(15, 20, 36, 0.85)",
    // Timer palette â€” soft, print-friendly
    timerPillBg: "rgba(255, 255, 255, 0.75)",
    timerPillBorder: "rgba(20, 28, 60, 0.10)",
    timerConsumed: "rgba(20, 28, 60, 0.10)",
    timerGreen: "#3ea67a",
    timerYellow: "#b8933f",
    timerRed: "#c85757",
  },
};

function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === "light" || stored === "dark") return stored;
    } catch (e) {}
    return "dark";
  });

  useEffect(() => {
    const handler = (e) => {
      if (e.key === THEME_STORAGE_KEY && (e.newValue === "light" || e.newValue === "dark")) {
        setTheme(e.newValue);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch (e) {}
      return next;
    });
  }, []);

  return { theme, toggleTheme };
}

/* ============= Timer Pill (curved vertical rectangle with tick marks) ============= */

/**
 * Precompute N tick positions clockwise around the inside perimeter of a
 * rounded rectangle. Each tick returns { x, y, nx, ny } where (nx, ny) is a
 * unit vector pointing INWARD (perpendicular to the edge).
 */
function computeTicks(W, H, R, N) {
  const straightTop = W - 2 * R;
  const straightSide = H - 2 * R;
  const arcLen = (Math.PI * R) / 2;
  const perimeter = 2 * straightTop + 2 * straightSide + 4 * arcLen;

  const ticks = [];

  for (let i = 0; i < N; i++) {
    let d = (i / N) * perimeter;
    let x = 0,
      y = 0,
      nx = 0,
      ny = 0;

    // Segments, clockwise, starting at (R, 0) â€” top-left corner point
    if (d < straightTop) {
      x = R + d;
      y = 0;
      nx = 0;
      ny = 1;
    } else if ((d -= straightTop) < arcLen) {
      const a = -Math.PI / 2 + (d / arcLen) * (Math.PI / 2);
      x = W - R + R * Math.cos(a);
      y = R + R * Math.sin(a);
      nx = -Math.cos(a);
      ny = -Math.sin(a);
    } else if ((d -= arcLen) < straightSide) {
      x = W;
      y = R + d;
      nx = -1;
      ny = 0;
    } else if ((d -= straightSide) < arcLen) {
      const a = 0 + (d / arcLen) * (Math.PI / 2);
      x = W - R + R * Math.cos(a);
      y = H - R + R * Math.sin(a);
      nx = -Math.cos(a);
      ny = -Math.sin(a);
    } else if ((d -= arcLen) < straightTop) {
      x = W - R - d;
      y = H;
      nx = 0;
      ny = -1;
    } else if ((d -= straightTop) < arcLen) {
      const a = Math.PI / 2 + (d / arcLen) * (Math.PI / 2);
      x = R + R * Math.cos(a);
      y = H - R + R * Math.sin(a);
      nx = -Math.cos(a);
      ny = -Math.sin(a);
    } else if ((d -= arcLen) < straightSide) {
      x = 0;
      y = H - R - d;
      nx = 1;
      ny = 0;
    } else {
      d -= straightSide;
      const a = Math.PI + (d / arcLen) * (Math.PI / 2);
      x = R + R * Math.cos(a);
      y = R + R * Math.sin(a);
      nx = -Math.cos(a);
      ny = -Math.sin(a);
    }

    ticks.push({ x, y, nx, ny });
  }
  return ticks;
}

function TimerPill({ remainingMs, totalMs, theme }) {
  const t = THEMES[theme];

  // Pill geometry â€” bigger, since it now lives in the sidebar as a focal element
  const W = 130;
  const H = 160;
  const R = 34;
  const N = 60; // number of tick marks around the pill
  const inset = 6; // gap between edge and tick start
  const tickLen = 9;

  const ticks = useMemo(() => computeTicks(W, H, R, N), []);

  const total = Math.max(1, totalMs || 0);
  const remaining = Math.max(0, remainingMs || 0);
  const pctRemaining = Math.min(1, remaining / total);
  const pctElapsed = 1 - pctRemaining;

  // Number of ticks still "alive"
  const remainingTicks =
    totalMs > 0 ? Math.max(0, Math.min(N, Math.ceil(pctRemaining * N))) : N;
  const consumed = N - remainingTicks;

  // Color band for the currently-remaining ticks (soft, non-glaring)
  //   0..60% elapsed  â†’ soft green
  //  60..90% elapsed  â†’ soft warm yellow
  //  90..100% elapsed â†’ soft red
  let liveColor;
  if (pctElapsed < 0.6) liveColor = t.timerGreen;
  else if (pctElapsed < 0.9) liveColor = t.timerYellow;
  else liveColor = t.timerRed;

  // Break the remaining time into H:MM (main) and SS (secondary)
  const totalSecs = Math.max(0, Math.floor(remaining / 1000));
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;

  const mainText = totalMs > 0 ? `${h}:${String(m).padStart(2, "0")}` : "â€”:â€”";
  const secText = totalMs > 0 ? String(s).padStart(2, "0") : "â€”";

  return (
    <div
      style={{
        position: "relative",
        width: W,
        height: H,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      aria-label="Remaining time"
      title={`${h} hours ${m} minutes ${s} seconds remaining`}
    >
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{ position: "absolute", inset: 0, overflow: "visible" }}
      >
        {/* Pill background */}
        <rect
          x={0.5}
          y={0.5}
          width={W - 1}
          height={H - 1}
          rx={R}
          ry={R}
          fill={t.timerPillBg}
          stroke={t.timerPillBorder}
          strokeWidth={1}
          style={{ transition: "fill 0.6s ease, stroke 0.6s ease" }}
        />

        {/* Tick marks around the inside perimeter */}
        {ticks.map((tk, i) => {
          const isRemaining = i >= consumed;
          const stroke = isRemaining ? liveColor : t.timerConsumed;
          const opacity = isRemaining ? 0.95 : 1;
          const sx = tk.x + tk.nx * inset;
          const sy = tk.y + tk.ny * inset;
          const ex = tk.x + tk.nx * (inset + tickLen);
          const ey = tk.y + tk.ny * (inset + tickLen);
          return (
            <line
              key={i}
              x1={sx}
              y1={sy}
              x2={ex}
              y2={ey}
              stroke={stroke}
              strokeWidth={1.8}
              strokeLinecap="round"
              opacity={opacity}
              style={{ transition: "stroke 0.6s ease, opacity 0.6s ease" }}
            />
          );
        })}
      </svg>

      {/* Text stack â€” main H:MM on top (elongated), seconds below (small) */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
        }}
      >
        <div
          style={{
            transform: "scaleY(1.55)",
            transformOrigin: "center",
            lineHeight: 1,
          }}
        >
          <span
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 42,
              fontWeight: 300,
              color: t.textPrimary,
              letterSpacing: -2,
              whiteSpace: "nowrap",
            }}
          >
            {mainText}
          </span>
        </div>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12,
            fontWeight: 500,
            color: t.textMuted,
            letterSpacing: 1,
            marginTop: 10,
          }}
        >
          {secText}s
        </span>
      </div>
    </div>
  );
}

/* ============= Header controls ============= */

function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === "dark";
  const t = THEMES[theme];
  return (
    <button
      onClick={onToggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      style={{
        position: "relative",
        width: 58,
        height: 30,
        borderRadius: 999,
        border: `1px solid ${t.borderStrong}`,
        background: isDark
          ? "linear-gradient(135deg, #0f1428 0%, #1a0f2e 100%)"
          : "linear-gradient(135deg, #ffe9a8 0%, #ffcfd8 100%)",
        cursor: "pointer",
        padding: 0,
        overflow: "hidden",
        flexShrink: 0,
        transition: "background 0.6s ease, border-color 0.5s ease",
      }}
    >
      {[
        { top: 6, left: 10, size: 2, o: isDark ? 0.9 : 0 },
        { top: 18, left: 15, size: 1.5, o: isDark ? 0.6 : 0 },
        { top: 9, left: 20, size: 1.5, o: isDark ? 0.7 : 0 },
      ].map((s, i) => (
        <span key={i} style={{ position: "absolute", top: s.top, left: s.left, width: s.size, height: s.size, borderRadius: "50%", background: "#ffffff", opacity: s.o, transition: "opacity 0.6s ease" }} />
      ))}
      <span
        style={{
          position: "absolute",
          top: 3,
          left: isDark ? 31 : 3,
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: isDark
            ? "linear-gradient(135deg, #e2e6f2 0%, #b0b8d0 100%)"
            : "linear-gradient(135deg, #ffd75c 0%, #ff9640 100%)",
          boxShadow: isDark
            ? "0 2px 10px rgba(0,0,0,0.5), inset -2px -2px 5px rgba(0,0,0,0.2)"
            : "0 2px 12px rgba(255,150,0,0.45), inset -2px -2px 5px rgba(180,90,0,0.2)",
          transition: "left 0.5s cubic-bezier(0.68, -0.4, 0.27, 1.4), background 0.5s ease, box-shadow 0.5s ease",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isDark ? "#3d4460" : "#7a4a00"} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: isDark ? 1 : 0, transform: isDark ? "rotate(0)" : "rotate(-140deg) scale(0.4)", transition: "opacity 0.4s ease, transform 0.5s ease", position: "absolute" }}>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7a4a00" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: isDark ? 0 : 1, transform: isDark ? "rotate(140deg) scale(0.4)" : "rotate(0)", transition: "opacity 0.4s ease, transform 0.5s ease", position: "absolute" }}>
          <circle cx="12" cy="12" r="4" />
          <line x1="12" y1="2" x2="12" y2="4" />
          <line x1="12" y1="20" x2="12" y2="22" />
          <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
          <line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
          <line x1="2" y1="12" x2="4" y2="12" />
          <line x1="20" y1="12" x2="22" y2="12" />
          <line x1="4.93" y1="19.07" x2="6.34" y2="17.66" />
          <line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
        </svg>
      </span>
    </button>
  );
}

function IconButton({ theme, onClick, danger, title, ariaLabel, disabled, children }) {
  const t = THEMES[theme];
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={ariaLabel}
      title={title}
      style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        background: hover ? (danger ? t.dangerBg : t.surfaceGlassHover) : t.surfaceGlass,
        border: `1px solid ${hover ? (danger ? t.danger + "55" : t.borderStrong) : t.border}`,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: hover ? (danger ? t.danger : t.textPrimary) : t.textSecondary,
        transition: "all 0.25s ease",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

/* ============= Data helpers ============= */

function pick(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}
function toUpper(value) {
  return String(value ?? "").trim().toUpperCase();
}
function canonicalStatus(value) {
  return toUpper(value).replace(/\s+/g, "").replace(/_/g, "");
}

function formatStatus(status) {
  if (
    status === undefined ||
    status === null ||
    String(status).trim() === "" ||
    String(status).trim() === "â€”"
  ) {
    return "â€”";
  }

  const labels = {
    DRAFT: "Draft",
    PUBLISHED: "Published",
    SCHEDULED: "Scheduled",
    AVAILABLE: "Available",
    ASSIGNED: "Assigned",
    READY: "Ready",
    PENDING: "Pending",
    RUNNING: "Running",
    ACTIVE: "Active",
    PAUSED: "Paused",
    RESUMED: "Resumed",
    INTERRUPTED: "Interrupted",
    COMPLETED: "Completed",
    TERMINATED: "Terminated",
    LOCKED: "Locked",
    CANCELLED: "Cancelled",
    CANCELED: "Canceled",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    LATEENTRYREQUESTED: "Late Entry Requested",
    LATEENTRYAPPROVED: "Late Entry Approved",
    LATEENTRYREJECTED: "Late Entry Rejected",
    REENTRYREQUESTED: "Re-entry Requested",
    REENTRYAPPROVED: "Re-entry Approved",
    REENTRYREJECTED: "Re-entry Rejected",
    NOTSTARTED: "Not Started",
    INPROGRESS: "In Progress",
    UNDERREVIEW: "Under Review",
    NOTATTENDED: "Not Attended",
  };

  const key = canonicalStatus(status).replace(/-/g, "");
  if (labels[key]) return labels[key];

  return String(status)
    .trim()
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function normalizeSites(...sources) {
  const unique = new Set();
  for (const source of sources) {
    if (!Array.isArray(source)) continue;
    for (const item of source) {
      const value = String(item || "").trim();
      if (value) unique.add(value);
    }
  }
  return Array.from(unique);
}
function parseServerDateMs(value) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  const text = String(value).trim();
  if (!text) return 0;
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text);
  const timestamp = new Date(hasTimezone ? text : `${text}Z`).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}
function normalizeExam(raw) {
  if (!raw) return null;
  const status = toUpper(pick(raw.examstatus, raw.exam_status, raw.status, ""));
  return {
    ...raw,
    examid: pick(raw.examid, raw.exam_id),
    assessmentid: pick(raw.assessmentid, raw.assessment_id),
    candidateid: pick(raw.candidateid, raw.candidate_id),
    name: pick(raw.name, raw.examname, raw.exam_name, "Exam"),
    description: pick(raw.description, raw.examdescription, raw.exam_description, ""),
    date: pick(raw.date, raw.examdate, raw.exam_date, "â€”"),
    starttime: pick(raw.starttime, raw.start_time, raw.examstarttime, raw.exam_start_time, "â€”"),
    endtime: pick(raw.endtime, raw.end_time, raw.examendtime, raw.exam_end_time, "â€”"),
    durationminutes: Number(pick(raw.durationminutes, raw.duration_minutes, 0) || 0),
    timeextensionminutes: Number(pick(raw.timeextensionminutes, raw.time_extension_minutes, 0) || 0),
    sessiondeadlineat: pick(raw.sessiondeadlineat, raw.session_deadline_at),
    instructions: pick(raw.instructions, ""),
    allowedwebsites: normalizeSites(raw.allowedwebsites, raw.allowed_websites),
    allowedapplications: Array.isArray(pick(raw.allowedapplications, raw.allowed_applications))
      ? pick(raw.allowedapplications, raw.allowed_applications)
      : [],
    status,
    examstatus: status,
    examtype: toUpper(pick(raw.examtype, raw.exam_type, "SINGLE_SESSION")),
    sessionnumber: Number(pick(raw.sessionnumber, raw.session_number, 0)) || 0,
    permanentlystopped: Boolean(pick(raw.permanentlystopped, raw.permanently_stopped, false)),
    stopmode: toUpper(pick(raw.stopmode, raw.stop_mode, "BOTH")),
  };
}
function normalizeAssessment(raw) {
  if (!raw) return null;
  // Assessment lifecycle aliases must win over a stale generic status field.
  const status = toUpper(pick(raw.assessmentstatus, raw.assessment_status, raw.status, ""));
  const finalstatus = toUpper(pick(raw.finalstatus, raw.final_status, ""));
  const examstatus = toUpper(pick(raw.examstatus, raw.exam_status, raw.runtimestatus, raw.status_exam, ""));
  return {
    ...raw,
    assessmentid: pick(raw.assessmentid, raw.assessment_id),
    examid: pick(raw.examid, raw.exam_id),
    candidateid: pick(raw.candidateid, raw.candidate_id),
    examinerid: pick(raw.examinerid, raw.examiner_id),
    name: pick(raw.name, raw.examname, raw.exam_name, "Upcoming Exam"),
    description: pick(raw.description, raw.examdescription, raw.exam_description, ""),
    date: pick(raw.date, raw.examdate, raw.exam_date, "â€”"),
    starttime: pick(raw.starttime, raw.start_time, raw.examstarttime, raw.exam_start_time, "â€”"),
    endtime: pick(raw.endtime, raw.end_time, raw.examendtime, raw.exam_end_time, "â€”"),
    durationminutes: Number(pick(raw.durationminutes, raw.duration_minutes, 0) || 0),
    timeextensionminutes: Number(pick(raw.timeextensionminutes, raw.time_extension_minutes, 0) || 0),
    sessiondeadlineat: pick(raw.sessiondeadlineat, raw.session_deadline_at),
    instructions: pick(raw.instructions, ""),
    allowedwebsites: normalizeSites(raw.allowedwebsites, raw.allowed_websites),
    allowedapplications: Array.isArray(pick(raw.allowedapplications, raw.allowed_applications))
      ? pick(raw.allowedapplications, raw.allowed_applications)
      : [],
    status,
    assessmentstatus: status,
    finalstatus,
    examstatus,
    examtype: toUpper(pick(raw.examtype, raw.exam_type, "SINGLE_SESSION")),
    sessionnumber: Number(pick(raw.sessionnumber, raw.session_number, 0)) || 0,
    permanentlystopped: Boolean(pick(raw.permanentlystopped, raw.permanently_stopped, false)),
    stopmode: toUpper(pick(raw.stopmode, raw.stop_mode, "BOTH")),
    isfinalized: Boolean(pick(raw.isfinalized, raw.is_finalized, false)),
  };
}
function getExamStatus(source) {
  return canonicalStatus(pick(source?.examstatus, source?.exam_status, source?.status, ""));
}
function getAssessmentStatus(source) {
  return canonicalStatus(pick(source?.assessmentstatus, source?.assessment_status, source?.status, ""));
}
function getFinalStatus(source) {
  return canonicalStatus(pick(source?.finalstatus, source?.final_status, ""));
}
function safeHost(url) {
  try {
    const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(normalized).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function formatViolationLabel(value) {
  const raw = String(value || "Violation").trim();
  return raw
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function formatViolationTime(value) {
  if (!value) return "—";
  const timestamp = parseServerDateMs(value);
  return timestamp > 0 ? new Date(timestamp).toLocaleString() : "—";
}
/* ============= Status chip ============= */

function StatusChip({ status, theme, label }) {
  const t = THEMES[theme];
  const s = canonicalStatus(status);
  let color = t.textMuted;
  let gradient = `linear-gradient(135deg, ${t.textMuted}, ${t.textFaint})`;
  if (["ACTIVE", "APPROVED", "REENTRYAPPROVED", "LATEENTRYAPPROVED", "READY", "ASSIGNED"].includes(s)) {
    color = t.success;
    gradient = t.successGradient;
  } else if (["PAUSED", "PENDING", "REENTRYREQUESTED", "LATEENTRYREQUESTED"].includes(s)) {
    color = t.warning;
    gradient = t.warningGradient;
  } else if (["TERMINATED", "LOCKED", "REJECTED", "REENTRYREJECTED", "LATEENTRYREJECTED"].includes(s)) {
    color = t.danger;
    gradient = t.dangerGradient;
  } else if (s === "RUNNING") {
    color = t.info;
    gradient = `linear-gradient(135deg, ${t.info}, ${t.accent2})`;
  } else if (s === "COMPLETED") {
    color = t.success;
    gradient = t.successGradient;
  }
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 12px 5px 8px",
        borderRadius: 999,
        background: `${color}18`,
        border: `1px solid ${color}55`,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.4,
        color,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: gradient,
          display: "inline-block",
          boxShadow: `0 0 8px ${color}66`,
        }}
      />
      {label ? `${label}: ` : ""}{formatStatus(status)}
    </div>
  );
}

/* ============= Main ============= */

export default function ActiveExam({ exam, assessment, onComplete, onLogout, onReturnToDashboard }) {
  const { theme, toggleTheme } = useTheme();
  const t = THEMES[theme];

  const shellRef = useRef(null);
  const browserAreaRef = useRef(null);
  const completedRef = useRef(false);
  const browserOpenedRef = useRef(false);
  const lastNavigatedUrlRef = useRef(null);
  const returningRef = useRef(false);
  const sessionIdRef = useRef(null);
  const entryGrantedRef = useRef(false);
  const intentionalExitRef = useRef(false);
  const entryRequestRef = useRef(null);
  const heartbeatFailureRef = useRef(false);
  const waitingRegistrationRef = useRef(null);
  const monitoringStartedRef = useRef(false);
  const thresholdExitRef = useRef(false);
  const automaticEndRef = useRef(false);
  const removalNoticeRef = useRef(false);
  const removalRedirectTimerRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    document.documentElement.dataset.examMode = "true";

    window.electronAPI?.enterExamWindowMode?.().then((result) => {
      if (mounted && result?.success === false) {
        console.error("Unable to enter secured exam window mode:", result.error);
      }
    }).catch((error) => {
      if (mounted) console.error("Unable to enter secured exam window mode:", error);
    });

    return () => {
      mounted = false;
      delete document.documentElement.dataset.examMode;
      window.electronAPI?.exitExamWindowMode?.().catch?.((error) => {
        console.error("Unable to restore the application window:", error);
      });
    };
  }, []);

  // Stopwatch countdown starts when secured candidate entry is granted.
  const timerStartedAtRef = useRef(null);
  const { accessToken, user } = useAuthStore();
  const waitingSessionId = useExamStore((state) => state.waitingSessionId);
  const clearWaitingSession = useExamStore((state) => state.clearWaitingSession);
  const socket = useSocket(accessToken);

  const normalizedExam = useMemo(() => normalizeExam(exam), [exam]);
  const normalizedAssessment = useMemo(() => normalizeAssessment(assessment), [assessment]);

  const [liveExam, setLiveExam] = useState(normalizedExam);
  const [liveAssessment, setLiveAssessment] = useState(normalizedAssessment);
  const [activeTab, setActiveTab] = useState(0);
  const [checking, setChecking] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [returning, setReturning] = useState(false);
  const [browserError, setBrowserError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [allowedSitesOpen, setAllowedSitesOpen] = useState(false);
  const [fiveMinuteAlertOpen, setFiveMinuteAlertOpen] = useState(false);
  const [violationsOpen, setViolationsOpen] = useState(false);
  const [candidateViolations, setCandidateViolations] = useState([]);
  const [violationCount, setViolationCount] = useState(0);
  const [violationLimit, setViolationLimit] = useState(0);
  const [violationsLoading, setViolationsLoading] = useState(false);
  const [violationsError, setViolationsError] = useState("");
  const [progressiveWarning, setProgressiveWarning] = useState(null);
  const [warningSecondsLeft, setWarningSecondsLeft] = useState(0);
  const fiveMinuteAlertShownRef = useRef(false);
  const [pauseLocked, setPauseLocked] = useState(
    canonicalStatus(normalizedAssessment?.status) === "PAUSED"
  );

  useEffect(() => {
    if (waitingSessionId && !sessionIdRef.current) {
      sessionIdRef.current = waitingSessionId;
    }
  }, [waitingSessionId]);

  useEffect(() => setLiveExam(normalizedExam), [normalizedExam]);
  useEffect(() => setLiveAssessment(normalizedAssessment), [normalizedAssessment]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const examId = pick(
    liveAssessment?.examid,
    normalizedAssessment?.examid,
    liveExam?.examid,
    normalizedExam?.examid
  );
  const assessmentId = pick(
    liveAssessment?.assessmentid,
    normalizedAssessment?.assessmentid,
    liveExam?.assessmentid,
    normalizedExam?.assessmentid
  );
  const candidateId = pick(
    liveAssessment?.candidateid,
    normalizedAssessment?.candidateid,
    liveExam?.candidateid,
    normalizedExam?.candidateid,
    user?.userid,
    user?.user_id
  );

  const startAiMonitoring = useCallback(async (reason = "EXAM_ENTRY") => {
    if (!window.electronAPI?.startCapture) {
      console.warn("[MONITORING] startCapture API is not available.");
      setStatusMsg("Continuous AI monitoring is unavailable.");
      return false;
    }
    if (!assessmentId || !candidateId || !examId) {
      console.warn(
        "[MONITORING] Cannot start AI monitoring because identifiers are missing.",
        { assessmentId, candidateId, examId, reason },
      );
      return false;
    }

    if (monitoringStartedRef.current) {
      // WaitScreen may already own the shared capture. Calling startCapture again
      // updates the existing renderer session from basic to full monitoring.
      console.log("[MONITORING] Updating active monitoring to full exam mode.", {
        assessmentId,
        candidateId,
        examId,
        reason,
      });
    }

    monitoringStartedRef.current = true;
    try {
      await window.electronAPI.startCapture({
        assessmentId,
        candidateId,
        examId,
        token: accessToken,
        sessionId: sessionIdRef.current,
        monitoringMode: "full",
        reason,
      });
      return true;
    } catch (error) {
      monitoringStartedRef.current = false;
      console.error("[MONITORING] Failed to start capture", error);
      setStatusMsg(
        error?.message || "Continuous AI monitoring could not be started.",
      );
      return false;
    }
  }, [assessmentId, candidateId, examId, accessToken]);

  useEffect(() => {
    // Restore the original candidate entry time after refresh or remount.
    if (!assessmentId || timerStartedAtRef.current) return;

    const storageKey = getAssessmentTimerStorageKey(assessmentId);
    if (!storageKey) return;

    try {
      const storedStartedAt = Number(localStorage.getItem(storageKey));
      if (Number.isFinite(storedStartedAt) && storedStartedAt > 0) {
        timerStartedAtRef.current = storedStartedAt;
        setNow(Date.now());
      }
    } catch (error) {
      console.warn("Unable to restore assessment timer", error);
    }
  }, [assessmentId]);

  useEffect(() => {
    if (!socket || !examId || !candidateId) return undefined;

    let cancelled = false;

    startCandidateWebRTC({
      socket,
      examid: examId,
      assessmentid: assessmentId,
      candidateid: candidateId,
    }).catch((error) => {
      if (!cancelled) {
        console.error(
          "Unable to continue live examiner camera stream",
          error
        );
      }
    });

    return () => {
      cancelled = true;
      // Keep the shared camera alive during internal React page transitions.
      // Explicit exit flows call cleanupExamShell() for the real shutdown.
    };
  }, [socket, examId, assessmentId, candidateId]);

  const cleanupExamShell = useCallback(async () => {
    monitoringStartedRef.current = false;
    try {
  stopCandidateWebRTC();
} catch (error) {
  console.log("stopCandidateWebRTC failed", error);
}

try {
  stopCameraStream();
} catch (error) {
  console.log("stopCameraStream failed", error);
}

    try { await window.electronAPI?.stopCapture?.(); } catch (error) { console.log("stopCapture failed", error); }
    try { await window.electronAPI?.closeBrowser?.(); } catch (error) { console.log("closeBrowser failed", error); }
    try { await window.electronAPI?.disableLockdown?.(); } catch (error) { console.log("disableLockdown failed", error); }
    try { await window.electronAPI?.exitExamWindowMode?.(); } catch (error) { console.log("exitExamWindowMode failed", error); }
    try { await window.electronAPI?.setClosable?.(true); } catch (error) { console.log("setClosable failed", error); }
    browserOpenedRef.current = false;
    lastNavigatedUrlRef.current = null;
  }, []);

  const exitForViolationThreshold = useCallback(
    async (payload = {}) => {
      if (thresholdExitRef.current || completedRef.current) return;

      thresholdExitRef.current = true;
      intentionalExitRef.current = true;
      entryGrantedRef.current = false;
      monitoringStartedRef.current = false;
      sessionIdRef.current = null;
      setPauseLocked(false);

      const violationCount = Number(
        pick(
          payload?.violationcount,
          payload?.violation_count,
          payload?.count,
          payload?.assessment?.violationcount,
          payload?.assessment?.violation_count,
          0,
        ) || 0,
      );
      const violationThreshold = Number(
        pick(
          payload?.violationthreshold,
          payload?.violation_threshold,
          payload?.threshold,
          payload?.assessment?.violationthreshold,
          payload?.assessment?.violation_threshold,
          payload?.assessment?.threshold,
          0,
        ) || 0,
      );

      setLiveAssessment((previous) => ({
        ...(previous || {}),
        ...(payload?.assessment || {}),
        status: "LOCKED",
        assessmentstatus: "LOCKED",
        assessment_status: "LOCKED",
        thresholdreached: true,
        threshold_reached: true,
        requiresreentryapproval: true,
        requires_reentry_approval: true,
        activesessionid: null,
        active_session_id: null,
      }));

      setStatusMsg(
        violationThreshold > 0
          ? `Violation threshold reached (${violationCount}/${violationThreshold}). Re-entry approval is required.`
          : "Violation threshold reached. Re-entry approval is required.",
      );
      setBrowserError("");

      try {
        await cleanupExamShell();
      } finally {
        clearWaitingSession();
        await onReturnToDashboard?.();
      }
    },
    [cleanupExamShell, clearWaitingSession, onReturnToDashboard],
  );

  const confirmDisqualificationExit = useCallback(async () => {
    if (removalRedirectTimerRef.current) {
      window.clearTimeout(removalRedirectTimerRef.current);
      removalRedirectTimerRef.current = null;
    }
    await exitForViolationThreshold({
      violation_count: progressiveWarning?.count ?? violationCount,
      allowed_limit: progressiveWarning?.limit ?? violationLimit,
      threshold_reached: true,
      status: "LOCKED",
    });
  }, [exitForViolationThreshold, progressiveWarning, violationCount, violationLimit]);
  const scheduleDisqualificationExit = useCallback((payload) => {
    if (removalRedirectTimerRef.current) {
      window.clearTimeout(removalRedirectTimerRef.current);
    }
    removalRedirectTimerRef.current = window.setTimeout(() => {
      removalRedirectTimerRef.current = null;
      void exitForViolationThreshold(payload);
    }, 12000);
  }, [exitForViolationThreshold]);
  useEffect(() => () => {
    if (removalRedirectTimerRef.current) {
      window.clearTimeout(removalRedirectTimerRef.current);
      removalRedirectTimerRef.current = null;
    }
  }, []);
  const loadCandidateViolations = useCallback(async ({ silent = false } = {}) => {
    if (!assessmentId || !accessToken) return;
    if (!silent) setViolationsLoading(true);
    try {
      const response = await axios.get(
        `${API}/api/violations/assessment/${assessmentId}/candidate-summary`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      setCandidateViolations(Array.isArray(response.data?.violations) ? response.data.violations : []);
      setViolationCount(Number(response.data?.violationcount ?? response.data?.violation_count ?? 0) || 0);
      setViolationLimit(Number(response.data?.allowedlimit ?? response.data?.allowed_limit ?? 0) || 0);
      setViolationsError("");
    } catch (error) {
      if (!silent) {
        setViolationsError(error?.response?.data?.detail || error?.message || "Violation history could not be loaded.");
      }
    } finally {
      if (!silent) setViolationsLoading(false);
    }
  }, [assessmentId, accessToken]);
  useEffect(() => {
    if (!assessmentId || !accessToken) return undefined;
    void loadCandidateViolations({ silent: true });
    const timer = setInterval(() => void loadCandidateViolations({ silent: true }), 5000);
    return () => clearInterval(timer);
  }, [assessmentId, accessToken, loadCandidateViolations]);
  useEffect(() => {
    if (!window.electronAPI?.onDetectionResult) return undefined;

    const unsubscribe = window.electronAPI.onDetectionResult((payload) => {
      console.log("[DETECTION RESULT]", payload);
      setTimeout(() => void loadCandidateViolations({ silent: true }), 250);
      const warningPayload = payload?.persisted === true
        ? (payload?.backend || payload?.response || null)
        : null;
      const warningAction = canonicalStatus(warningPayload?.action);
      if (warningPayload && ["TOAST", "VIOLATION", "FINALWARNING"].includes(warningAction)) {
        const finalWarning = warningAction === "FINALWARNING" || warningPayload?.final_warning === true;
        const graceActive = warningAction === "GRACEPERIOD" || warningPayload?.grace_active === true;
        setProgressiveWarning({
          level: finalWarning ? "FINAL" : graceActive ? "GRACE" : toUpper(warningPayload?.warning_level || "STANDARD"),
          message: warningPayload?.message || "A proctoring violation was detected.",
          type: warningPayload?.violation?.type || warningPayload?.violation?.violation_type || warningPayload?.violation?.detail || "Violation",
          count: Number(warningPayload?.violation_count || warningPayload?.violationcount || 0),
          limit: Number(warningPayload?.allowed_limit || warningPayload?.allowedlimit || 0),
        });
        setWarningSecondsLeft(Number(warningPayload?.grace_seconds || 0));
      }

      const candidates = payload?.persisted === true
        ? [payload?.backend, payload?.response].filter(Boolean)
        : [];

      const thresholdPayload = candidates.find((item) => {
        const action = canonicalStatus(item?.action);
        const status = canonicalStatus(
          pick(item?.status, item?.assessmentstatus, item?.assessment_status),
        );
        return (
          action === "THRESHOLDREACHED" ||
          action === "LOCK" ||
          status === "LOCKED" ||
          item?.thresholdreached === true ||
          item?.threshold_reached === true
        );
      });

      if (thresholdPayload) {
        const removalCount = Number(thresholdPayload?.violation_count || thresholdPayload?.violationcount || 0);
        const removalLimit = Number(thresholdPayload?.allowed_limit || thresholdPayload?.allowedlimit || 0);
        setProgressiveWarning({
          level: "REMOVAL",
          message: "The maximum number of confirmed violations has been reached. Your assessment session has been ended in accordance with the examination monitoring rules.",
          type: "Assessment access revoked",
          count: removalCount,
          limit: removalLimit,
        });
        setWarningSecondsLeft(0);
        removalNoticeRef.current = true;
        void window.electronAPI?.hideBrowser?.();
        scheduleDisqualificationExit(thresholdPayload);
      }
    });

    return () => {
      try {
        if (typeof unsubscribe === "function") unsubscribe();
        window.electronAPI.removeDetectionListener?.();
      } catch (error) {
        console.error(error);
      }
    };
  }, [exitForViolationThreshold, loadCandidateViolations, scheduleDisqualificationExit]);

  useEffect(() => {
    if (!progressiveWarning || warningSecondsLeft <= 0) return undefined;
    const timer = window.setTimeout(() => setWarningSecondsLeft((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [progressiveWarning, warningSecondsLeft]);
  const dismissProgressiveWarning = useCallback(() => {
    if (warningSecondsLeft > 0) return;
    setProgressiveWarning(null);
  }, [warningSecondsLeft]);
  const presentViolationRemoval = useCallback((payload = {}) => {
    if (removalNoticeRef.current || thresholdExitRef.current || completedRef.current) return;
    removalNoticeRef.current = true;
    const count = Number(pick(payload?.violationcount, payload?.violation_count, payload?.assessment?.violationcount, payload?.assessment?.violation_count, violationCount, 0) || 0);
    const limit = Number(pick(payload?.allowedlimit, payload?.allowed_limit, payload?.violationthreshold, payload?.violation_threshold, payload?.assessment?.violationthreshold, payload?.assessment?.violation_threshold, violationLimit, 0) || 0);
    setProgressiveWarning({
      level: "REMOVAL",
      message: "The maximum number of confirmed violations has been reached. Your assessment session has been ended in accordance with the examination monitoring rules.",
      type: "Assessment access revoked",
      count,
      limit,
    });
    setWarningSecondsLeft(0);
    void window.electronAPI?.hideBrowser?.();
    scheduleDisqualificationExit({ ...payload, violation_count: count, allowed_limit: limit });
  }, [scheduleDisqualificationExit, violationCount, violationLimit]);
  const reportInterruption = useCallback(async (reason, source) => {
    if (!entryGrantedRef.current || completedRef.current || intentionalExitRef.current || !assessmentId || !accessToken) {
      return;
    }
    intentionalExitRef.current = true;
    try {
      await axios.post(
        `${API}/api/assessments/${assessmentId}/interrupt`,
        { reason, source, sessionid: sessionIdRef.current },
        { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 5000 }
      );
    } catch (error) {
      console.warn("Failed to report assessment interruption", error);
    } finally {
      entryGrantedRef.current = false;
      sessionIdRef.current = null;
    }
  }, [assessmentId, accessToken]);

  const allowedSites = useMemo(
    () =>
      normalizeSites(
        normalizedAssessment?.allowedwebsites,
        normalizedExam?.allowedwebsites,
        liveAssessment?.allowedwebsites,
        liveExam?.allowedwebsites
      ),
    [normalizedAssessment, normalizedExam, liveAssessment, liveExam]
  );

  useEffect(() => {
    if (activeTab > allowedSites.length - 1) setActiveTab(0);
  }, [allowedSites, activeTab]);
  useEffect(() => {
    return () => {
      // Do not stop camera/WebRTC from this generic component cleanup.
      // cleanupExamShell() handles genuine assessment exits.
      window.electronAPI?.closeBrowser?.().catch?.(() => {});
    };
  }, []);
  const merged = useMemo(
    () => ({
      ...(normalizedExam || {}),
      ...(normalizedAssessment || {}),
      ...(liveExam || {}),
      ...(liveAssessment || {}),
    }),
    [normalizedExam, normalizedAssessment, liveExam, liveAssessment]
  );

  const activeUrl = allowedSites[activeTab] || allowedSites[0] || null;
  const assessmentStatus = liveAssessment?.status || normalizedAssessment?.status || merged.status || "â€”";
  const examStatus = liveExam?.examstatus || liveExam?.status || merged.examstatus || "â€”";
  const isExamRunning = canonicalStatus(examStatus) === "RUNNING";
  const isPaused = pauseLocked || canonicalStatus(assessmentStatus) === "PAUSED";

  const safeElectron = useCallback(async (runner, fallbackMessage, options = {}) => {
    const { silent = false } = options;
    try {
      const result = await runner();
      if (result && typeof result === "object" && "success" in result && result.success !== true) {
        throw new Error(result?.error || fallbackMessage);
      }
      if (!silent) setBrowserError("");
      return true;
    } catch (error) {
      console.log(fallbackMessage, error);
      if (!silent) setBrowserError(error?.message || fallbackMessage);
      return false;
    }
  }, []);



  const obtainEntryPermission = useCallback(async () => {
    if (!isExamRunning || completedRef.current || intentionalExitRef.current) {
      return false;
    }
    if (entryGrantedRef.current && sessionIdRef.current) {
      await startAiMonitoring("ENTRY_ALREADY_GRANTED");
      return true;
    }
    if (!assessmentId || !accessToken) return false;
    if (entryRequestRef.current) return entryRequestRef.current;

    const currentStatus = canonicalStatus(assessmentStatus);
    const explicitlyApproved = [
      "LATEENTRYAPPROVED",
      "REENTRYAPPROVED",
    ].includes(currentStatus);

    if (!sessionIdRef.current && !explicitlyApproved) {
      const message =
        "The waiting session was not registered. Late-entry permission is required.";
      setStatusMsg(message);
      setBrowserError(message);
      await cleanupExamShell();
      await onReturnToDashboard?.();
      return false;
    }

    const requestedSessionId =
      sessionIdRef.current ||
      globalThis.crypto?.randomUUID?.() ||
      `SES-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const fromWaitingRoom = Boolean(sessionIdRef.current && waitingSessionId);

    entryRequestRef.current = (async () => {
      try {
        const response = await axios.post(
          `${API}/api/assessments/${assessmentId}/enter`,
          { sessionid: requestedSessionId, fromwaitingroom: fromWaitingRoom },
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const sessionId = response.data?.sessionid || response.data?.session_id;
        if (!sessionId || response.data?.waiting === true) {
          throw new Error("The server did not create an active assessment session.");
        }
        sessionIdRef.current = sessionId;
        entryGrantedRef.current = true;
        intentionalExitRef.current = false;
        heartbeatFailureRef.current = false;
        // Persist the first successful candidate-entry time. Never overwrite it
        // during refresh, remount, pause, resume, or repeated /enter calls.
        if (!timerStartedAtRef.current) {
          const storageKey = getAssessmentTimerStorageKey(assessmentId);
          let startedAt = Date.now();

          try {
            const storedStartedAt = storageKey
              ? Number(localStorage.getItem(storageKey))
              : 0;

            if (Number.isFinite(storedStartedAt) && storedStartedAt > 0) {
              startedAt = storedStartedAt;
            } else if (storageKey) {
              localStorage.setItem(storageKey, String(startedAt));
            }
          } catch (error) {
            console.warn("Unable to persist assessment timer", error);
          }

          timerStartedAtRef.current = startedAt;
          setNow(Date.now());
        }
clearWaitingSession();
        if (response.data?.exam) {
          setLiveExam(normalizeExam(response.data.exam));
        }
        if (response.data?.assessment) {
          const enteredAssessment = normalizeAssessment(response.data.assessment);
          setLiveAssessment(enteredAssessment);
          if (!response.data?.exam && enteredAssessment?.sessiondeadlineat) {
            setLiveExam((previous) => ({
              ...(previous || {}),
              examid: examId,
              status: "RUNNING",
              examstatus: "RUNNING",
              durationminutes: enteredAssessment.durationminutes,
              timeextensionminutes: enteredAssessment.timeextensionminutes,
              sessiondeadlineat: enteredAssessment.sessiondeadlineat,
            }));
          }
        }
        setStatusMsg("Secured assessment session created.");
        setBrowserError("");
        await startAiMonitoring("ENTRY_GRANTED");
        return true;
      } catch (error) {
        entryGrantedRef.current = false;
        sessionIdRef.current = null;
        const message =
          error?.response?.data?.detail ||
          error?.message ||
          "Entry permission could not be verified.";
        setStatusMsg(message);
        setBrowserError(message);
        await cleanupExamShell();
        await onReturnToDashboard?.();
        return false;
      } finally {
        entryRequestRef.current = null;
      }
    })();
    return entryRequestRef.current;
  }, [
    isExamRunning,
    assessmentId,
    accessToken,
    assessmentStatus,
    waitingSessionId,
    clearWaitingSession,
    cleanupExamShell,
    onReturnToDashboard,
    startAiMonitoring,
  ]);

  // Establish the ACTIVE backend session as soon as the active workspace mounts.
  // Previously this was only attempted while opening an allowed website, so the
  // camera could be live while the persisted assessment remained READY.
  useEffect(() => {
    if (!isExamRunning || !assessmentId || !accessToken) return;
    if (entryGrantedRef.current || entryRequestRef.current) return;
    void obtainEntryPermission();
  }, [isExamRunning, assessmentId, accessToken, obtainEntryPermission]);

  const resizeBrowserToArea = useCallback(async () => {
    if (
      !browserAreaRef.current ||
      !window.electronAPI ||
      completedRef.current
    ) {
      return false;
    }

    const browserRect = browserAreaRef.current.getBoundingClientRect();
    const bounds = {
      x: Math.max(0, Math.round(browserRect.left)),
      y: Math.max(0, Math.round(browserRect.top)),
      width: Math.max(1, Math.round(browserRect.width)),
      height: Math.max(1, Math.round(browserRect.height)),
    };

    if (bounds.width <= 1 || bounds.height <= 1) {
      return false;
    }

    try {
      const result = await window.electronAPI.resizeBrowser(bounds);
      return !result || result.success !== false;
    } catch (error) {
      console.log("Failed to resize WebContentsView", error);
      return false;
    }
  }, []);

  const showBrowserForActiveState = useCallback(async () => {
    if (!window.electronAPI || completedRef.current || violationsOpen || progressiveWarning?.level === "REMOVAL") return false;
    const shown = await safeElectron(() => window.electronAPI.showBrowser(), "Failed to show secured browser.", { silent: true });
    if (!shown) return false;
    const resized = await safeElectron(() => resizeBrowserToArea(), "Failed to resize BrowserView", { silent: false });
    if (!resized) return false;
    await safeElectron(() => window.electronAPI.restoreBrowser(), "Failed to restore secured browser.", { silent: true });
    // Routine status polling, Socket.IO updates, and resize synchronization must
    // never steal keyboard focus from the embedded React chat composer.
    return true;
  }, [resizeBrowserToArea, safeElectron, violationsOpen, progressiveWarning?.level]);

  const hideBrowserForPause = useCallback(async () => {
    if (!window.electronAPI || completedRef.current || !browserOpenedRef.current) return false;
    return safeElectron(() => window.electronAPI.hideBrowser(), "Failed to hide secured browser.", { silent: true });
  }, [safeElectron]);
  const openViolationsPanel = useCallback(async () => {
    if (browserOpenedRef.current && window.electronAPI) {
      await safeElectron(
        () => window.electronAPI.hideBrowser(),
        "Failed to hide secured browser for violations panel.",
        { silent: true },
      );
    }
    setViolationsOpen(true);
    void loadCandidateViolations();
  }, [loadCandidateViolations, safeElectron]);
  const closeViolationsPanel = useCallback(() => {
    setViolationsOpen(false);
    window.setTimeout(async () => {
      if (
        !browserOpenedRef.current ||
        completedRef.current ||
        isPaused ||
        !isExamRunning ||
        !window.electronAPI
      ) {
        return;
      }
      await safeElectron(
        () => window.electronAPI.showBrowser(),
        "Failed to show secured browser.",
        { silent: true },
      );
      await safeElectron(
        () => resizeBrowserToArea(),
        "Failed to resize secured browser.",
        { silent: true },
      );
      await safeElectron(
        () => window.electronAPI.restoreBrowser(),
        "Failed to restore secured browser.",
        { silent: true },
      );
      await safeElectron(
        () => window.electronAPI.focusBrowser(),
        "Failed to focus secured browser.",
        { silent: true },
      );
    }, 80);
  }, [isPaused, isExamRunning, resizeBrowserToArea, safeElectron]);

  useEffect(() => {
    let cancelled = false;

    const ensureBrowserOpen = async () => {
      if (!window.electronAPI || completedRef.current || browserOpenedRef.current) return;
      if (!allowedSites.length) return;

      if (!isExamRunning) {
        setStatusMsg("Precheck complete. Waiting for the examiner to start the exam.");
        setBrowserError("");
        return;
      }

      const entryAllowed = await obtainEntryPermission();

      /*
       * A cancelled React effect only means this particular effect instance
       * became stale. It does not mean that the assessment is ending.
       * Never shut down the shared camera/WebRTC connection for cancellation.
       */
      if (cancelled || completedRef.current) {
        return;
      }

      if (!entryAllowed) {
        await cleanupExamShell();
        return;
      }

      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      );

      const browserRect = browserAreaRef.current?.getBoundingClientRect();
      const initialBounds = browserRect
        ? {
            x: Math.max(0, Math.round(browserRect.left)),
            y: Math.max(0, Math.round(browserRect.top)),
            width: Math.max(1, Math.round(browserRect.width)),
            height: Math.max(1, Math.round(browserRect.height)),
          }
        : null;

      const ok = await safeElectron(
        () =>
          window.electronAPI.openBrowser({
            allowedWebsites: allowedSites,
            bounds: initialBounds,
          }),
        "Failed to open secured browser."
      );
      if (!cancelled && ok) {
        browserOpenedRef.current = true;
        setBrowserError("");
        if (isPaused) await hideBrowserForPause();
        else await showBrowserForActiveState();
      }
    };

    ensureBrowserOpen();
    return () => { cancelled = true; };
  }, [
    allowedSites,
    isExamRunning,
    isPaused,
    obtainEntryPermission,
    hideBrowserForPause,
    showBrowserForActiveState,
    safeElectron,
    cleanupExamShell,
  ]);

  useEffect(() => {
    if (!browserOpenedRef.current || completedRef.current || !window.electronAPI) return;
    const sync = async () => {
      if (isPaused || violationsOpen) {
        await hideBrowserForPause();
      } else {
        await showBrowserForActiveState();
      }
    };
    sync();
  }, [isPaused, violationsOpen, hideBrowserForPause, showBrowserForActiveState]);

  useEffect(() => {
    if (!activeUrl || !browserOpenedRef.current || completedRef.current || isPaused || violationsOpen) return;
    if (lastNavigatedUrlRef.current === activeUrl) return;
    let cancelled = false;
    const navigate = async () => {
      const ok = await safeElectron(
        () => window.electronAPI.navigateBrowser(activeUrl),
        "Failed to navigate secured browser."
      );
      if (!cancelled && ok) {
        lastNavigatedUrlRef.current = activeUrl;
        await showBrowserForActiveState();
      }
    };
    navigate();
    return () => { cancelled = true; };
  }, [activeUrl, isPaused, violationsOpen, safeElectron, showBrowserForActiveState]);

  useEffect(() => {
    if (!browserAreaRef.current || typeof ResizeObserver === "undefined") {
      return undefined;
    }

    let frameId = null;
    const observer = new ResizeObserver(() => {
      if (
        !browserOpenedRef.current ||
        completedRef.current ||
        isPaused ||
        violationsOpen
      ) {
        return;
      }

      if (frameId) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        resizeBrowserToArea();
      });
    });

    observer.observe(browserAreaRef.current);

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [isPaused, violationsOpen, resizeBrowserToArea]);

  useEffect(() => {
    const onResize = async () => {
      if (!browserOpenedRef.current || completedRef.current || isPaused || violationsOpen) return;
      await resizeBrowserToArea();
    };

    const id = setTimeout(onResize, 150);
    window.addEventListener("resize", onResize);

    return () => {
      clearTimeout(id);
      window.removeEventListener("resize", onResize);
    };
  }, [isPaused, violationsOpen, resizeBrowserToArea]);



  const finishExam = useCallback(async () => {
    if (completedRef.current) return;
    // Remove the persisted timer only when the assessment genuinely finishes.
    try {
      const storageKey = getAssessmentTimerStorageKey(assessmentId);
      if (storageKey) localStorage.removeItem(storageKey);
    } catch (error) {
      console.warn("Unable to clear assessment timer", error);
    }
    timerStartedAtRef.current = null;
    completedRef.current = true;
    intentionalExitRef.current = true;
    entryGrantedRef.current = false;
    sessionIdRef.current = null;
    monitoringStartedRef.current = false;
    await cleanupExamShell();
    onComplete?.();
  }, [cleanupExamShell, onComplete]);

  const returnToDashboardSafe = useCallback(async () => {
    if (completedRef.current || returningRef.current || returning) return;
    returningRef.current = true;
    setReturning(true);
    try {
      await reportInterruption(
        "Candidate returned to dashboard during the active assessment",
        "RETURN_TO_DASHBOARD"
      );
      await cleanupExamShell();
      await onReturnToDashboard?.();
    } finally {
      setReturning(false);
      returningRef.current = false;
    }
  }, [cleanupExamShell, onReturnToDashboard, reportInterruption, returning]);

  useEffect(() => {
    if (!entryGrantedRef.current || !sessionIdRef.current || !assessmentId || !accessToken) return;
    let cancelled = false;
    const sendHeartbeat = async () => {
      if (cancelled || !entryGrantedRef.current || !sessionIdRef.current) return;
      try {
        await axios.post(
          `${API}/api/assessments/${assessmentId}/heartbeat`,
          { sessionid: sessionIdRef.current },
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
      } catch (error) {
        if (cancelled) return;
        const statusCode = error?.response?.status;
        if (statusCode === 409 && !heartbeatFailureRef.current) {
          // A locked assessment returns 409 to heartbeat. Do not immediately
          // clean up and navigate because that closes the native removal alert
          // before the candidate can read it. Route through the same 6.5-second
          // violation-removal notice used by detection, polling, and Socket.IO.
          heartbeatFailureRef.current = true;
          presentViolationRemoval({
            ...(error?.response?.data || {}),
            violation_count: violationCount,
            allowed_limit: violationLimit,
            threshold_reached: true,
            status: "LOCKED",
          });
          return;
        }
        if ([401, 403].includes(statusCode) && !heartbeatFailureRef.current) {
          heartbeatFailureRef.current = true;
          entryGrantedRef.current = false;
          sessionIdRef.current = null;
          await cleanupExamShell();
          await onReturnToDashboard?.();
        }
      }
    };
    sendHeartbeat();
    const timer = setInterval(sendHeartbeat, 10000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [
    assessmentId,
    accessToken,
    liveAssessment?.status,
    cleanupExamShell,
    onReturnToDashboard,
    presentViolationRemoval,
    violationCount,
    violationLimit,
  ]);

  useEffect(() => {
    if (!socket || !examId) return;

    const joinExamRoom = () => {
      if (!socket.connected) return;
      socket.emit("join_exam", {
        examid: examId,
        assessmentid: assessmentId,
        candidateid: candidateId,
        role: "Candidate",
      });
    };

    const handleReconnect = () => {
      joinExamRoom();
    };

    joinExamRoom();

    const onControlCommand = async (payload) => {
      const payloadExamId = pick(payload?.examid, payload?.examId);
      const payloadAssessmentId = pick(payload?.assessmentid, payload?.assessmentId);
      const payloadCandidateId = pick(payload?.candidateid, payload?.candidateId);

      const examMatch = !payloadExamId || String(payloadExamId) === String(examId);
      const assessmentMatch = !payloadAssessmentId || String(payloadAssessmentId) === String(assessmentId);
      const candidateMatch = !payloadCandidateId || String(payloadCandidateId) === String(candidateId);

      if (!examMatch || !assessmentMatch || !candidateMatch) return;

      const action = toUpper(payload?.action ?? payload);
      const status = canonicalStatus(
        pick(payload?.status, payload?.assessment?.status),
      );
      const thresholdReached =
        action === "THRESHOLD_REACHED" ||
        action === "THRESHOLDREACHED" ||
        action === "LOCK" ||
        status === "LOCKED" ||
        payload?.thresholdreached === true ||
        payload?.threshold_reached === true ||
        payload?.assessment?.thresholdreached === true ||
        payload?.assessment?.threshold_reached === true;

      if (thresholdReached) {
        presentViolationRemoval(payload);
        return;
      }

      if (action === "TERMINATE" || status === "TERMINATED") {
        setStatusMsg("Your assessment has been terminated by the examiner.");
        await finishExam();
        return;
      }
      if (action === "PAUSE") {
setPauseLocked(true);
        setLiveAssessment((prev) => ({ ...(prev || {}), status: "PAUSED", assessmentstatus: "PAUSED" }));
        setStatusMsg("Your assessment has been paused by the examiner.");
        setBrowserError("");
        await hideBrowserForPause();
        return;
      }
      if (action === "RESUME") {
setPauseLocked(false);
        setLiveAssessment((prev) => ({ ...(prev || {}), status: "ACTIVE", assessmentstatus: "ACTIVE" }));
        setStatusMsg("Your assessment has been resumed.");
        setBrowserError("");
        await showBrowserForActiveState();
      }
    };

    socket.on("connect", handleReconnect);
    socket.on("control_command", onControlCommand);
    socket.on("threshold_reached", onControlCommand);
    socket.on("assessment_locked", onControlCommand);
    return () => {
      socket.off("connect", handleReconnect);
      socket.off("control_command", onControlCommand);
      socket.off("threshold_reached", onControlCommand);
      socket.off("assessment_locked", onControlCommand);
    };
  }, [
    socket,
    examId,
    assessmentId,
    candidateId,
    finishExam,
    hideBrowserForPause,
    showBrowserForActiveState,
    exitForViolationThreshold,
    presentViolationRemoval,
  ]);

  const checkLiveStatus = useCallback(async () => {
    if (completedRef.current) { setChecking(false); return; }
    if (!examId || !assessmentId || !accessToken) { setChecking(false); return; }

    try {
      const [examRes, assessmentRes] = await Promise.all([
        axios.get(`${API}/api/exams/${examId}`, { headers: { Authorization: `Bearer ${accessToken}` } }),
        axios.get(`${API}/api/assessments/${assessmentId}`, { headers: { Authorization: `Bearer ${accessToken}` } }),
      ]);
      const latestExam = normalizeExam(examRes?.data);
      const latestAssessment = normalizeAssessment(assessmentRes?.data);
      if (latestExam) setLiveExam(latestExam);
      if (latestAssessment) {
        setLiveAssessment(latestAssessment);
        if (latestAssessment.sessiondeadlineat) {
          setLiveExam((previous) => ({
            ...(previous || {}),
            sessiondeadlineat: latestAssessment.sessiondeadlineat,
            timeextensionminutes: latestAssessment.timeextensionminutes,
            durationminutes: latestAssessment.durationminutes,
          }));
        }
      }

      const examStatusValue = getExamStatus(latestExam);
      const assessmentStatusValue = getAssessmentStatus(latestAssessment);
      const finalStatus = getFinalStatus(latestAssessment);

      if (assessmentStatusValue === "LOCKED" || finalStatus === "LOCKED") {
        presentViolationRemoval(latestAssessment || {});
        return;
      }
      const shouldEnd =
        TERMINAL_EXAM_STATUSES.has(examStatusValue) ||
        TERMINAL_ASSESSMENT_STATUSES.has(assessmentStatusValue) ||
        (finalStatus && TERMINAL_ASSESSMENT_STATUSES.has(finalStatus));

      if (shouldEnd) {
        await finishExam();
        return;
      }
      if (examStatusValue !== "RUNNING" && !entryGrantedRef.current) {
        setStatusMsg("Precheck complete. Waiting for the examiner to start the exam.");
        setBrowserError("");
        return;
      }
      if (assessmentStatusValue === "PAUSED") {
        setPauseLocked(true);
        setBrowserError("");
        await hideBrowserForPause();
        return;
      }
      if (assessmentStatusValue === "ACTIVE") {
        setPauseLocked(false);
        await showBrowserForActiveState();
      }
    } catch (error) {
      console.log("ActiveExam status check failed", error);
      setStatusMsg(error?.response?.data?.detail || error?.message || "Live status check failed.");
    } finally {
      setChecking(false);
    }
  }, [examId, assessmentId, accessToken, finishExam, hideBrowserForPause, showBrowserForActiveState, presentViolationRemoval]);

  useEffect(() => {
    let cancelled = false;

    const pollLiveStatus = async () => {
      if (cancelled || completedRef.current || thresholdExitRef.current) return;
      await checkLiveStatus();
    };

    void pollLiveStatus();
    const timer = setInterval(pollLiveStatus, 3000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [checkLiveStatus]);

  useEffect(() => {
    if (!socket || !examId || !assessmentId) return;

    const onExamUpdated = async (payload) => {
      const next = normalizeExam(payload?.exam || payload);
      if (!next?.examid || String(next.examid) !== String(examId)) return;
      setLiveExam((previous) => ({ ...(previous || {}), ...next }));
      if (TERMINAL_EXAM_STATUSES.has(getExamStatus(next))) await finishExam();
    };

    const onAssessmentUpdated = async (payload) => {
      const next = normalizeAssessment(payload?.assessment || payload);
      if (!next?.assessmentid || String(next.assessmentid) !== String(assessmentId)) return;
      setLiveAssessment((previous) => ({ ...(previous || {}), ...next }));
      const status = getAssessmentStatus(next);
      const finalStatus = getFinalStatus(next);
      if (status === "LOCKED" || finalStatus === "LOCKED") {
        presentViolationRemoval(payload?.assessment || payload);
      } else if (TERMINAL_ASSESSMENT_STATUSES.has(status) || TERMINAL_ASSESSMENT_STATUSES.has(finalStatus)) {
        await finishExam();
      } else if (status === "PAUSED") {
        setPauseLocked(true);
        await hideBrowserForPause();
      } else if (status === "ACTIVE") {
        setPauseLocked(false);
        await showBrowserForActiveState();
      }
    };

    socket.on("exam_updated", onExamUpdated);
    socket.on("assessment_updated", onAssessmentUpdated);
    socket.on("request_reviewed", onAssessmentUpdated);
    return () => {
      socket.off("exam_updated", onExamUpdated);
      socket.off("assessment_updated", onAssessmentUpdated);
      socket.off("request_reviewed", onAssessmentUpdated);
    };
  }, [socket, examId, assessmentId, finishExam, hideBrowserForPause, showBrowserForActiveState, presentViolationRemoval]);
  const baseDurationMinutes = Number(merged.durationminutes || normalizedExam?.durationminutes || 0);
  const extensionMinutes = Number(pick(liveExam?.timeextensionminutes, liveExam?.time_extension_minutes, normalizedExam?.timeextensionminutes, 0) || 0);
  const durationMinutes = Math.max(0, baseDurationMinutes + extensionMinutes);
  const totalMs = durationMinutes > 0 ? durationMinutes * 60 * 1000 : 0;
  const deadlineValue = pick(
    liveExam?.sessiondeadlineat,
    liveExam?.session_deadline_at,
    normalizedExam?.sessiondeadlineat,
    normalizedExam?.session_deadline_at,
    liveAssessment?.sessiondeadlineat,
    liveAssessment?.session_deadline_at,
  );
  const authoritativeDeadlineMs = parseServerDateMs(deadlineValue);
  // The shared exam-session deadline is authoritative. Candidate entry time is
  // retained only as a legacy fallback when an older exam has no deadline.
  const elapsedMs = timerStartedAtRef.current
    ? Math.max(0, now - timerStartedAtRef.current)
    : 0;
  const remainingMs = authoritativeDeadlineMs > 0
    ? Math.max(0, authoritativeDeadlineMs - now)
    : totalMs > 0
      ? timerStartedAtRef.current
        ? Math.max(0, totalMs - elapsedMs)
        : totalMs
      : 0;

  const fiveMinuteThresholdMs = 5 * 60 * 1000;
  useEffect(() => {
    if (fiveMinuteAlertShownRef.current || totalMs <= fiveMinuteThresholdMs) return;
    if (!timerStartedAtRef.current || remainingMs <= 0 || remainingMs > fiveMinuteThresholdMs) return;
    const sessionNumber = Number(pick(merged.sessionnumber, merged.session_number, 1) || 1);
    const key = assessmentId ? `3rdeyez360.five-minute-alert.${assessmentId}.${sessionNumber}` : null;
    try {
      if (key && localStorage.getItem(key) === "shown") {
        fiveMinuteAlertShownRef.current = true;
        return;
      }
      if (key) localStorage.setItem(key, "shown");
    } catch (error) {
      console.warn("Unable to persist five-minute alert state", error);
    }
    fiveMinuteAlertShownRef.current = true;
    setFiveMinuteAlertOpen(true);
  }, [remainingMs, totalMs, assessmentId, merged.sessionnumber, merged.session_number]);

  const stopMode = toUpper(pick(merged.stopmode, merged.stop_mode, "BOTH"));
  const automaticSessionEndEnabled = stopMode === "AUTOMATIC" || stopMode === "BOTH";
  useEffect(() => {
    if (!automaticSessionEndEnabled || !isExamRunning || totalMs <= 0 || remainingMs > 0) return;
    if (!examId || !accessToken || automaticEndRef.current || completedRef.current) return;
    automaticEndRef.current = true;
    const endAtTimerExpiry = async () => {
      try {
        setStatusMsg("Time expired. Ending the current session...");
        await axios.patch(`${API}/api/exams/${examId}/auto-end`, {}, { headers: { Authorization: `Bearer ${accessToken}` } });
        await finishExam();
      } catch (error) {
        automaticEndRef.current = false;
        setStatusMsg(error?.response?.data?.detail || error?.message || "Automatic session end failed.");
      }
    };
    void endAtTimerExpiry();
  }, [automaticSessionEndEnabled, isExamRunning, totalMs, remainingMs, examId, accessToken, finishExam]);

  useEffect(() => {
    return () => {
      if (completedRef.current || intentionalExitRef.current || !entryGrantedRef.current || !assessmentId || !accessToken) return;
      const sessionId = sessionIdRef.current;
      fetch(`${API}/api/assessments/${assessmentId}/interrupt`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ reason: "Assessment component closed unexpectedly", source: "COMPONENT_UNMOUNT", sessionid: sessionId }),
        keepalive: true,
      }).catch(() => {});
      window.electronAPI?.stopCapture?.();
      window.electronAPI?.closeBrowser?.();
      window.electronAPI?.disableLockdown?.();
      window.electronAPI?.exitExamWindowMode?.();
      window.electronAPI?.setClosable?.(true);
    };
  }, [assessmentId, accessToken]);

  const handleLogout = useCallback(async () => {
    await reportInterruption("Candidate logged out during the active assessment", "LOGOUT");
    await cleanupExamShell();
    await onLogout?.();
  }, [reportInterruption, cleanupExamShell, onLogout]);

  const examName = merged.name || normalizedExam?.name || "Exam";

  return (
    <div
      ref={shellRef}
      style={{
        minHeight: "100vh",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: t.canvas,
        backgroundImage: t.canvasTint,
        color: t.textPrimary,
        overflow: "hidden",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        transition: "background 0.7s ease, color 0.6s ease",
        position: "relative",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulseDot { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.4); } }
        @keyframes gradientShift { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes warningSlideIn { from { opacity: 0; transform: translate(-50%, -26px); } to { opacity: 1; transform: translate(-50%, 0); } }
        @keyframes warningSlideOut { from { opacity: 1; transform: translate(-50%, 0); } to { opacity: 0; transform: translate(-50%, -26px); } }
        @keyframes ringPulse {
          0%   { transform: scale(0.9); opacity: 0.7; }
          100% { transform: scale(1.7); opacity: 0; }
        }

        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${t.borderStrong}; border-radius: 999px; }
        ::-webkit-scrollbar-thumb:hover { background: ${t.accent}; }

        .brand-gradient {
          background: ${t.accentGradient};
          background-size: 200% 200%;
          animation: gradientShift 8s ease infinite;
        }

        button { transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease, opacity 0.2s ease; }
      `}</style>

      {/* ============= HEADER ============= */}
      <header
        style={{
          height: 64,
          padding: "0 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
          borderBottom: `1px solid ${t.border}`,
          background: t.surface,
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          position: "relative",
          zIndex: 10,
          transition: "background 0.55s ease, border-color 0.5s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15, minWidth: 0 }}>
            <span
              style={{
                fontWeight: 700,
                fontSize: 14,
                color: t.textPrimary,
                fontFamily: "'Space Grotesk', sans-serif",
                letterSpacing: -0.2,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: 320,
              }}
            >
              {examName}
            </span>
            <span style={{ fontSize: 10, color: t.textMuted, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 600 }}>
              Live Proctored Session
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <StatusChip status={assessmentStatus} theme={theme} />
          <StatusChip status={examStatus} theme={theme} />
          <button
            type="button"
            onClick={() => void openViolationsPanel()}
            title="View detected violations"
            style={{
              height: 30,
              padding: "0 11px",
              borderRadius: 999,
              border: `1px solid ${violationCount > 0 ? `${t.warning}66` : t.border}`,
              background: violationCount > 0 ? t.warningBg : t.surfaceGlass,
              color: violationCount > 0 ? t.warning : t.textSecondary,
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              cursor: "pointer",
              fontSize: 10.5,
              fontWeight: 800,
              fontFamily: "'Inter', sans-serif",
              whiteSpace: "nowrap",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Violations {violationCount}/{violationLimit || "—"}
          </button>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          {onLogout ? (
            <IconButton theme={theme} onClick={handleLogout} danger title="Sign out" ariaLabel="Sign out">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </IconButton>
          ) : null}
        </div>
      </header>

      {/* ============= TAB BAR (allowed sites) ============= */}
      {allowedSites.length > 1 ? (
        <div
          style={{
            height: 40,
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "0 20px",
            background: t.tabBar,
            borderBottom: `1px solid ${t.border}`,
            flexShrink: 0,
            overflowX: "auto",
            zIndex: 5,
          }}
        >
          <span
            style={{
              fontSize: 10,
              color: t.textMuted,
              letterSpacing: 0.8,
              textTransform: "uppercase",
              fontWeight: 700,
              marginRight: 8,
              whiteSpace: "nowrap",
            }}
          >
            Tabs
          </span>
          {allowedSites.map((site, index) => {
            const active = index === activeTab;
            return (
              <button
                key={`${site}-${index}`}
                onClick={() => setActiveTab(index)}
                disabled={isPaused}
                title={site}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: active ? t.accentSoft : t.surfaceGlass,
                  border: `1px solid ${active ? t.borderAccent : t.border}`,
                  color: active ? t.accent : t.textSecondary,
                  borderRadius: 8,
                  padding: "5px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: isPaused ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap",
                  opacity: isPaused ? 0.5 : 1,
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                {safeHost(site)}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* ============= MAIN BODY ============= */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Browser view host */}
        <div
          ref={browserAreaRef}
          style={{
            flex: 1,
            background: t.browserBg,
            position: "relative",
            borderRight: `1px solid ${t.border}`,
            transition: "background 0.5s ease, border-color 0.5s ease",
          }}
        >
          {/* Pause overlay */}
          {isPaused ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: t.overlay,
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 100,
                textAlign: "center",
                padding: 24,
                animation: "fadeIn 0.35s ease",
              }}
            >
              <div style={{ position: "relative", width: 90, height: 90, marginBottom: 22 }}>
                <span
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    border: `2px solid ${t.warning}`,
                    opacity: 0.55,
                    animation: "ringPulse 2s ease-out infinite",
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    border: `2px solid ${t.warning}`,
                    opacity: 0.35,
                    animation: "ringPulse 2s ease-out 0.7s infinite",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 10,
                    borderRadius: "50%",
                    background: t.warningGradient,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: `0 8px 24px ${t.warning}55`,
                  }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="#ffffff">
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                </div>
              </div>

              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  marginBottom: 8,
                  color: "#ffffff",
                  fontFamily: "'Space Grotesk', sans-serif",
                  letterSpacing: -0.4,
                }}
              >
                Assessment Paused
              </h2>
              <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 14, maxWidth: 380, lineHeight: 1.7, margin: 0 }}>
                Your examiner has paused the assessment. Website access is locked while paused. Please stay available and wait for the exam to resume.
              </p>
            </div>
          ) : null}

          {/* Browser error banner */}
          {browserError && !isPaused ? (
            <div
              style={{
                position: "absolute",
                top: 16,
                left: 16,
                right: 16,
                zIndex: 101,
                background: t.dangerBg,
                border: `1px solid ${t.danger}55`,
                borderRadius: 12,
                padding: "12px 14px",
                color: t.danger,
                fontSize: 13,
                lineHeight: 1.6,
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{browserError}</span>
            </div>
          ) : null}

          {/* No allowed websites empty state */}
          {!allowedSites.length ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: t.textMuted,
                fontSize: 14,
                zIndex: 50,
                padding: 24,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: "50%",
                  background: t.accentGradientSoft,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 14,
                  border: `1px solid ${t.border}`,
                }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="1.8">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>
              <div style={{ fontWeight: 700, marginBottom: 4, color: t.textPrimary, fontSize: 15, fontFamily: "'Space Grotesk', sans-serif" }}>
                No allowed website configured
              </div>
              <div>Please contact your examiner if this state persists.</div>
            </div>
          ) : null}
        </div>

        {/* ============= SIDEBAR ============= */}
        <div
          style={{
            width: 340,
            background: t.sidebarBg,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            flexShrink: 0,
            borderLeft: `1px solid ${t.border}`,
            transition: "background 0.55s ease, border-color 0.5s ease",
          }}
        >
          {/* ============= SMALL TIMER PILL ============= */}
          <div
            style={{
              height: 142,
              flexShrink: 0,
              borderBottom: `1px solid ${t.border}`,
              background: t.surfaceGlass,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              paddingTop: 8,
            }}
          >
            <div
              style={{
                color: t.textMuted,
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: 1.6,
                textTransform: "uppercase",
                marginBottom: 2,
                lineHeight: 1,
              }}
            >
              Time remaining
            </div>

            <div
              style={{
                width: 94,
                height: 116,
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "center",
                overflow: "visible",
              }}
            >
              <div
                style={{
                  width: 130,
                  height: 160,
                  flexShrink: 0,
                  transform: "scale(0.7)",
                  transformOrigin: "top center",
                }}
              >
                <TimerPill
                  remainingMs={remainingMs}
                  totalMs={totalMs}
                  theme={theme}
                />
              </div>
            </div>
          </div>
{/* Candidate-examiner private chat */}
          {/* Chat and Allowed Websites switchable workspace */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {allowedSitesOpen ? (
              <>
                <button
                  type="button"
                  onClick={() => setAllowedSitesOpen(false)}
                  style={{
                    minHeight: 48,
                    width: "100%",
                    padding: "0 20px",
                    border: "none",
                    borderBottom: `1px solid ${t.border}`,
                    background: t.surfaceGlass,
                    color: t.textSecondary,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    flexShrink: 0,
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 10.5,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: 1.2,
                    }}
                  >
                    <span style={{ width: 20, height: 1, background: t.accentGradient }} />
                    Chat with examiner
                  </span>

                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: "auto",
                    padding: "18px 20px",
                  }}
                >
                  <div
                    style={{
                      fontSize: 10.5,
                      color: t.textMuted,
                      fontWeight: 700,
                      letterSpacing: 1.2,
                      textTransform: "uppercase",
                      marginBottom: 14,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span style={{ width: 20, height: 1, background: t.accentGradient }} />
                    Allowed websites
                  </div>

                  {allowedSites.length === 0 ? (
                    <div
                      style={{
                        padding: "30px 16px",
                        borderRadius: 12,
                        border: `1px solid ${t.border}`,
                        background: t.surfaceGlass,
                        color: t.textMuted,
                        fontSize: 12,
                        lineHeight: 1.6,
                        textAlign: "center",
                      }}
                    >
                      No allowed websites were configured for this assessment.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {allowedSites.map((site, index) => {
                        const active = index === activeTab;

                        return (
                          <button
                            key={`${site}-${index}`}
                            type="button"
                            onClick={() => {
                              setActiveTab(index);
                              setAllowedSitesOpen(false);
                            }}
                            disabled={isPaused}
                            title={site}
                            style={{
                              width: "100%",
                              textAlign: "left",
                              background: active ? t.accentSoft : t.surfaceGlass,
                              border: `1px solid ${active ? t.borderAccent : t.border}`,
                              borderRadius: 12,
                              padding: "12px 14px",
                              color: active ? t.accent : t.textPrimary,
                              cursor: isPaused ? "not-allowed" : "pointer",
                              opacity: isPaused ? 0.55 : 1,
                              fontFamily: "'Inter', sans-serif",
                              display: "flex",
                              alignItems: "center",
                              gap: 11,
                            }}
                          >
                            <div
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: 10,
                                background: active ? t.accentGradient : t.surfaceGlassHover,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: active ? "#ffffff" : t.textMuted,
                                flexShrink: 0,
                              }}
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="2" y1="12" x2="22" y2="12" />
                                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                              </svg>
                            </div>

                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 700 }}>
                                {safeHost(site)}
                              </div>
                              <div
                                style={{
                                  marginTop: 3,
                                  fontSize: 10.5,
                                  color: t.textMuted,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  fontFamily: "'JetBrains Mono', monospace",
                                }}
                              >
                                {site}
                              </div>
                            </div>

                            {active ? (
                              <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: t.accent }}>
                                Active
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {merged.instructions ? (
                    <>
                      <div
                        style={{
                          marginTop: 24,
                          marginBottom: 12,
                          fontSize: 10.5,
                          color: t.textMuted,
                          fontWeight: 700,
                          letterSpacing: 1.2,
                          textTransform: "uppercase",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span style={{ width: 20, height: 1, background: t.accentGradient }} />
                        Instructions
                      </div>
                      <div
                        style={{
                          background: t.surfaceGlass,
                          border: `1px solid ${t.border}`,
                          borderRadius: 12,
                          padding: 14,
                          fontSize: 12.5,
                          color: t.textSecondary,
                          lineHeight: 1.7,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}
                      >
                        {merged.instructions}
                      </div>
                    </>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {examId && candidateId ? (
                    <ChatWindow
                      examId={examId}
                      assessmentId={assessmentId}
                      candidateId={candidateId}
                      currentUser={user}
                      conversationType="PRIVATE"
                      embedded
                      theme={t}
                    />
                  ) : (
                    <div
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 20,
                        color: t.textMuted,
                        fontSize: 12,
                        textAlign: "center",
                      }}
                    >
                      Chat becomes available when the assessment session is identified.
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setAllowedSitesOpen(true)}
                  style={{
                    minHeight: 48,
                    width: "100%",
                    padding: "0 20px",
                    border: "none",
                    borderTop: `1px solid ${t.border}`,
                    background: t.surfaceGlass,
                    color: t.textSecondary,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    flexShrink: 0,
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 10.5,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: 1.2,
                    }}
                  >
                    <span style={{ width: 20, height: 1, background: t.accentGradient }} />
                    Allowed websites
                    <span
                      style={{
                        minWidth: 20,
                        height: 20,
                        padding: "0 6px",
                        borderRadius: 999,
                        background: t.accentSoft,
                        color: t.accent,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 9.5,
                        fontWeight: 800,
                        letterSpacing: 0,
                      }}
                    >
                      {allowedSites.length}
                    </span>
                  </span>

                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                </button>
              </>
            )}
          </div>
          
          <div
            // style={{
            //   padding: "10px 20px",
            //   borderTop: `1px solid ${t.border}`,
            //   display: "flex",
            //   alignItems: "center",
            //   gap: 8,
            //   flexShrink: 0,
            //   background: t.surfaceGlass,
            // }}
          >
            {/* <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: isPaused ? t.warning : t.success,
                boxShadow: `0 0 8px ${isPaused ? t.warning : t.success}`,
                animation: "pulseDot 1.5s ease-in-out infinite",
                flexShrink: 0,
              }}
            /> */}
            {/* <span style={{ fontSize: 11, color: t.textSecondary, fontWeight: 600 }}>
              {isPaused ? "Waiting for resume" : "Secured session live"}
            </span>
            <span style={{ marginLeft: "auto", fontSize: 10.5, color: t.textMuted, letterSpacing: 0.4 }}>
              Do not close this window
            </span> */}
          </div>
        </div>
      </div>

      {progressiveWarning?.level === "REMOVAL" ? (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="disqualification-title"
          aria-describedby="disqualification-description"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1600,
            background: t.overlay,
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            animation: "fadeIn 0.3s ease",
          }}
        >
          <div style={{ width: "min(620px, 100%)", padding: "32px", borderRadius: 24, background: t.surfaceSolid, border: `2px solid ${t.danger}88`, boxShadow: `0 34px 100px rgba(0,0,0,0.72), 0 0 58px ${t.danger}28`, textAlign: "center" }}>
            <div style={{ width: 72, height: 72, margin: "0 auto 18px", borderRadius: 22, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", background: t.dangerGradient, boxShadow: `0 14px 38px ${t.danger}55` }}>
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <div style={{ color: t.danger, fontSize: 11, fontWeight: 900, letterSpacing: 1.8, textTransform: "uppercase" }}>Violation limit reached</div>
            <h2 id="disqualification-title" style={{ margin: "10px 0 0", color: t.textPrimary, fontSize: 28, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: -0.5 }}>Assessment Access Revoked</h2>
            <p id="disqualification-description" style={{ margin: "15px auto 0", maxWidth: 520, color: t.textSecondary, fontSize: 15, lineHeight: 1.7 }}>
              {progressiveWarning.message}
            </p>
            <div style={{ margin: "20px auto 0", display: "inline-flex", alignItems: "center", gap: 10, padding: "10px 16px", borderRadius: 999, background: t.dangerBg, border: `1px solid ${t.danger}55`, color: t.textPrimary, fontWeight: 800 }}>
              <span>{progressiveWarning.count} / {progressiveWarning.limit || "—"} confirmed violations</span>
            </div>
            <div style={{ marginTop: 18, padding: 14, borderRadius: 12, background: t.surfaceGlass, border: `1px solid ${t.border}`, color: t.textSecondary, fontSize: 12.5, lineHeight: 1.6 }}>
              You will now be returned to the Candidate Dashboard. If this action requires review, submit a re-entry request for Examiner approval.
            </div>
            <button
              type="button"
              onClick={() => void confirmDisqualificationExit()}
              style={{ marginTop: 22, minWidth: 220, minHeight: 46, padding: "0 20px", border: "none", borderRadius: 12, background: t.dangerGradient, color: "#fff", cursor: "pointer", fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 800, boxShadow: `0 12px 30px ${t.danger}40` }}
            >
              Return to Dashboard
            </button>
            <div style={{ marginTop: 12, color: t.textMuted, fontSize: 10.5 }}>The dashboard will open automatically if no action is taken.</div>
          </div>
        </div>
      ) : null}
      {violationsOpen ? (
        <div
          onMouseDown={(event) => { if (event.target === event.currentTarget) closeViolationsPanel(); }}
          style={{ position: "fixed", inset: 0, zIndex: 1200, background: t.overlay, backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
        >
          <div style={{ width: "min(720px, 100%)", maxHeight: "82vh", display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: 18, background: t.surfaceSolid, border: `1px solid ${t.borderStrong}`, boxShadow: "0 28px 80px rgba(0,0,0,0.5)" }}>
            <div style={{ padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, borderBottom: `1px solid ${t.border}` }}>
              <div>
                <div style={{ color: t.textPrimary, fontSize: 17, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif" }}>My Violations</div>
                <div style={{ marginTop: 4, color: t.textMuted, fontSize: 11.5 }}>Detected during this assessment</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ padding: "6px 10px", borderRadius: 999, background: violationCount > 0 ? t.warningBg : t.successBg, border: `1px solid ${violationCount > 0 ? `${t.warning}55` : `${t.success}55`}`, color: violationCount > 0 ? t.warning : t.success, fontSize: 11, fontWeight: 800 }}>
                  {violationCount} / {violationLimit || "—"}
                </div>
                <button type="button" onClick={closeViolationsPanel} aria-label="Close violations panel" style={{ width: 32, height: 32, borderRadius: 9, border: `1px solid ${t.border}`, background: t.surfaceGlass, color: t.textSecondary, cursor: "pointer", fontSize: 18 }}>×</button>
              </div>
            </div>
            <div style={{ padding: 18, overflowY: "auto", minHeight: 180 }}>
              {violationsLoading ? (
                <div style={{ minHeight: 160, display: "flex", alignItems: "center", justifyContent: "center", color: t.textMuted, fontSize: 12.5 }}>Loading violation history...</div>
              ) : violationsError ? (
                <div style={{ padding: 14, borderRadius: 11, background: t.dangerBg, border: `1px solid ${t.danger}55`, color: t.danger, fontSize: 12.5 }}>{violationsError}</div>
              ) : candidateViolations.length === 0 ? (
                <div style={{ minHeight: 160, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", color: t.textMuted }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: t.successBg, color: t.success, marginBottom: 10 }}>
                    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div style={{ color: t.textPrimary, fontWeight: 800, fontSize: 14 }}>No violations detected</div>
                  <div style={{ marginTop: 4, fontSize: 11.5 }}>Detected violations will appear here.</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {candidateViolations.map((item, index) => (
                    <div key={item.violationid || item.violation_id || `${item.timestamp}-${index}`} style={{ padding: 14, borderRadius: 12, border: `1px solid ${t.warning}44`, background: t.warningBg, display: "grid", gridTemplateColumns: "minmax(140px, 0.8fr) minmax(220px, 1.5fr) auto", gap: 14, alignItems: "center" }}>
                      <div>
                        <div style={{ color: t.textMuted, fontSize: 8.5, fontWeight: 900, letterSpacing: 0.8, textTransform: "uppercase" }}>Violation type</div>
                        <div style={{ marginTop: 5, color: t.warning, fontSize: 12.5, fontWeight: 800 }}>{formatViolationLabel(item.violationtype || item.violation_type)}</div>
                      </div>
                      <div>
                        <div style={{ color: t.textMuted, fontSize: 8.5, fontWeight: 900, letterSpacing: 0.8, textTransform: "uppercase" }}>Warning message</div>
                        <div style={{ marginTop: 5, color: t.textPrimary, fontSize: 12, lineHeight: 1.45 }}>{item.warningmessage || item.warning_message || item.message || "A proctoring violation was detected."}</div>
                      </div>
                      <div style={{ color: t.textMuted, fontSize: 10.5, fontFamily: "'JetBrains Mono', monospace", whiteSpace: "nowrap" }}>{formatViolationTime(item.timestamp)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ padding: "12px 18px", borderTop: `1px solid ${t.border}`, color: t.textMuted, fontSize: 10.5 }}>
              Current violation count: <strong style={{ color: t.textPrimary }}>{violationCount}</strong> · Allowed limit: <strong style={{ color: t.textPrimary }}>{violationLimit || "—"}</strong>
            </div>
          </div>
        </div>
      ) : null}
      {fiveMinuteAlertOpen ? (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            position: "fixed",
            top: 72,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            width: "min(300px, calc(100vw - 32px))",
            minHeight: 44,
            padding: "8px 9px 8px 10px",
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            gap: 9,
            background: t.surfaceElevated,
            border: `1px solid ${t.warning}88`,
            boxShadow: `0 10px 28px rgba(0,0,0,0.35), 0 0 14px ${t.warning}20`,
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            animation: "fadeIn 0.25s ease",
          }}
        >
          <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", background: t.warningGradient }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <polyline points="12 7 12 12 15 14" />
            </svg>
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ color: t.warning, fontSize: 8, fontWeight: 900, letterSpacing: 0.8, textTransform: "uppercase", lineHeight: 1 }}>Time warning</div>
            <div style={{ marginTop: 3, color: t.textPrimary, fontSize: 13.5, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1.2 }}>Only 5 minutes left</div>
          </div>
          <button
            type="button"
            onClick={() => setFiveMinuteAlertOpen(false)}
            aria-label="Dismiss five-minute warning"
            title="Dismiss"
            style={{ width: 26, height: 26, padding: 0, flexShrink: 0, borderRadius: 7, border: `1px solid ${t.border}`, background: t.surfaceGlass, color: t.textSecondary, cursor: "pointer", fontSize: 16, lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      ) : null}
      {/* Recovery back-to-dashboard button when terminal */}
      {typeof onReturnToDashboard === "function" &&
      (canonicalStatus(assessmentStatus) === "LOCKED" || canonicalStatus(assessmentStatus) === "TERMINATED") ? (
        <div style={{ position: "fixed", right: 20, bottom: 20, zIndex: 120 }}>
          <button
            onClick={returnToDashboardSafe}
            disabled={returning}
            style={{
              padding: "12px 20px",
              fontSize: 13,
              fontWeight: 700,
              background: t.accentGradient,
              color: "#ffffff",
              border: "none",
              borderRadius: 12,
              cursor: returning ? "wait" : "pointer",
              fontFamily: "'Inter', sans-serif",
              letterSpacing: 0.3,
              boxShadow: t.glowAccent,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {returning ? (
              <>
                <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#ffffff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                Returning...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
                Back to Dashboard
              </>
            )}
          </button>
        </div>
      ) : null}

    </div>
  );
}
