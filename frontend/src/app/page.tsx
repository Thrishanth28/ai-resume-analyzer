"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useId,
} from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CriticalIssue {
  issue: string;
  impact: "High" | "Medium" | "Low";
  fix: string;
}

interface ScoreImprovementAction {
  action: string;
  detail: string;
  score_boost: string;
  priority: "High" | "Medium" | "Low";
}

interface ProfessionalSuggestion {
  category: string;
  suggestion: string;
  why: string;
}

interface AnalysisResult {
  ats_score: number;
  grade: string;
  summary: string;
  sections_found: Record<string, boolean>;
  category_scores: Record<string, number>;
  strengths: string[];
  critical_issues: CriticalIssue[];
  missing_keywords: string[];
  quick_wins: string[];
  improved_summary: string;
  verdict: string;
  interview_tips: string[];
  score_improvement_plan: ScoreImprovementAction[];
  professional_suggestions: ProfessionalSuggestion[];
  next_grade_roadmap: string;
  salary_insight: string;
  word_count: number;
  processing_time_ms: number;
  filename: string;
  file_size_kb: number;
  job_title: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Helpers ───────────────────────────────────────────────────────────────────

// Unique fingerprint for a file — name + size + lastModified
function fileFingerprint(f: File): string {
  return `${f.name}__${f.size}__${f.lastModified}`;
}

// Returns real hex so it can be used in JS template literals like `${c}33`
function scoreColor(score: number) {
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#f59e0b";
  return "#ef4444";
}

function verdictColor(verdict: string) {
  if (verdict === "Highly Recommended") return "#22c55e";
  if (verdict === "Recommended") return "#3b82f6";
  if (verdict === "Needs Improvement") return "#f59e0b";
  return "#ef4444";
}

function toastColor(type: "success" | "error" | "info") {
  if (type === "success") return "#22c55e";
  if (type === "error") return "#ef4444";
  return "#6366f1";
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: "success" | "error" | "info";
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  const icon = type === "success" ? "✓" : type === "error" ? "✕" : "ℹ";
  const color = toastColor(type);

  return (
    <div className="toast">
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: `${color}22`,
          border: `1px solid ${color}44`,
          color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          flexShrink: 0,
          fontSize: "0.85rem",
        }}
      >
        {icon}
      </span>
      <span style={{ color: "var(--text2)", lineHeight: 1.4 }}>{message}</span>
      <button
        onClick={onClose}
        style={{
          marginLeft: "auto",
          background: "none",
          border: "none",
          color: "var(--muted)",
          cursor: "pointer",
          fontSize: "1rem",
          lineHeight: 1,
          padding: "0 2px",
        }}
      >
        ×
      </button>
    </div>
  );
}

// ── Score Circle ──────────────────────────────────────────────────────────────

function ScoreCircle({ score }: { score: number }) {
  const [displayed, setDisplayed] = useState(0);
  const r = 64;
  const circ = 2 * Math.PI * r;
  const color = scoreColor(displayed);
  const offset = circ - (displayed / 100) * circ;

  useEffect(() => {
    let start: number | null = null;
    const duration = 1600;
    function step(ts: number) {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplayed(Math.round(eased * score));
      if (p < 1) requestAnimationFrame(step);
    }
    const raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  const size = 168;
  const cx = size / 2;

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      <svg
        width={size}
        height={size}
        style={{ transform: "rotate(-90deg)", display: "block" }}
      >
        <circle
          className="score-track"
          cx={cx}
          cy={cx}
          r={r}
          strokeWidth="10"
        />
        <circle
          className="score-fill"
          cx={cx}
          cy={cx}
          r={r}
          strokeWidth="10"
          stroke={color}
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      {/* Centered overlay — positioned independently of SVG rotation */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <span
          style={{
            fontSize: "2.4rem",
            fontWeight: 800,
            lineHeight: 1,
            color,
            letterSpacing: "-0.04em",
          }}
        >
          {displayed}
        </span>
        <span style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: 2 }}>
          / 100
        </span>
      </div>
    </div>
  );
}

// ── Progress Bar ──────────────────────────────────────────────────────────────

function ProgressBar({
  label,
  value,
  max = 20,
  delay = 0,
}: {
  label: string;
  value: number;
  max?: number;
  delay?: number;
}) {
  const [w, setW] = useState(0);
  const pct = Math.round((value / max) * 100);
  const color =
    pct >= 75 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444";

  useEffect(() => {
    const t = setTimeout(() => setW(pct), 120 + delay);
    return () => clearTimeout(t);
  }, [pct, delay]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
      <span
        style={{
          width: 88,
          fontSize: "0.82rem",
          color: "var(--text2)",
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <div className="bar-bg" style={{ flex: 1 }}>
        <div className="bar-fill" style={{ width: `${w}%`, background: color }} />
      </div>
      <span
        style={{
          width: 36,
          textAlign: "right",
          fontSize: "0.82rem",
          fontWeight: 700,
          color,
          flexShrink: 0,
        }}
      >
        {value}/{max}
      </span>
    </div>
  );
}

// ── Section Chip ──────────────────────────────────────────────────────────────

const SECTION_ICONS: Record<string, string> = {
  contact: "✉",
  summary: "📝",
  experience: "💼",
  education: "🎓",
  skills: "⚡",
  certifications: "🏅",
};

function SectionChip({ label, found }: { label: string; found: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        padding: "0.5rem 0.9rem",
        borderRadius: 10,
        background: found ? "rgba(34,197,94,0.07)" : "rgba(239,68,68,0.07)",
        border: `1px solid ${found ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
      }}
    >
      <span style={{ fontSize: "1rem" }}>
        {SECTION_ICONS[label.toLowerCase()] ?? "•"}
      </span>
      <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text2)" }}>
        {label}
      </span>
      <span
        style={{
          marginLeft: "auto",
          fontSize: "0.75rem",
          fontWeight: 700,
          color: found ? "var(--green)" : "var(--red)",
        }}
      >
        {found ? "✓" : "✗"}
      </span>
    </div>
  );
}

// ── Impact Badge ──────────────────────────────────────────────────────────────

function ImpactBadge({ impact }: { impact: string }) {
  const cls =
    impact === "High"
      ? "badge-high"
      : impact === "Medium"
      ? "badge-medium"
      : "badge-low";
  return (
    <span className={`badge ${cls}`} style={{ fontSize: "0.68rem" }}>
      {impact}
    </span>
  );
}

// ── Loading Overlay ───────────────────────────────────────────────────────────

const STEPS = [
  "Parsing PDF document…",
  "Extracting resume text…",
  "Sending to Gemini AI…",
  "Running ATS analysis…",
  "Scoring your resume…",
  "Generating fixes…",
];

function LoadingOverlay() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }, 1800);
    return () => clearInterval(iv);
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "2rem",
        padding: "3rem 1rem",
      }}
    >
      {/* Animated ring */}
      <div style={{ position: "relative", width: 80, height: 80 }}>
        <svg width={80} height={80} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={40} cy={40} r={34} fill="none" stroke="var(--border2)" strokeWidth="5" />
          <circle
            cx={40}
            cy={40}
            r={34}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 34 * 0.6} ${2 * Math.PI * 34 * 0.4}`}
            style={{ animation: "spinning 1.1s linear infinite" }}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.5rem",
          }}
        >
          🤖
        </div>
      </div>

      <div style={{ textAlign: "center" }}>
        <p
          style={{
            fontWeight: 700,
            fontSize: "1.05rem",
            marginBottom: "0.35rem",
            color: "var(--text)",
          }}
        >
          Analyzing with Gemini AI
        </p>
        <p
          style={{
            fontSize: "0.85rem",
            color: "var(--accent)",
            minHeight: "1.3em",
            transition: "opacity 0.3s",
          }}
        >
          {STEPS[step]}
        </p>
      </div>

      {/* Step dots */}
      <div style={{ display: "flex", gap: "0.4rem" }}>
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`step-dot ${i < step ? "done" : i === step ? "active" : ""}`}
          />
        ))}
      </div>

      <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
        This usually takes 10–20 seconds
      </p>
    </div>
  );
}

// ── Upload Section ────────────────────────────────────────────────────────────

function UploadSection({
  onResult,
  onToast,
  onAnalysisStart,
  onAnalysisError,
  cache,
}: {
  onResult: (r: AnalysisResult) => void;
  onToast: (msg: string, type: "success" | "error" | "info") => void;
  onAnalysisStart: () => void;
  onAnalysisError: () => void;
  cache: React.MutableRefObject<Map<string, AnalysisResult>>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [jobTitle, setJobTitle] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const jobId = useId();

  const validateAndSet = useCallback((f: File) => {
    setError("");
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files are accepted. Please upload a .pdf file.");
      return false;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError("File exceeds the 5MB limit. Compress your PDF and try again.");
      return false;
    }
    setFile(f);
    return true;
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const f = e.dataTransfer.files[0];
      if (f) validateAndSet(f);
    },
    [validateAndSet]
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  // Fix: check relatedTarget to avoid flicker when hovering child elements
  const onDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragActive(false);
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) validateAndSet(f);
    e.target.value = "";
  };

  const analyze = async () => {
    if (!file) return;

    // Check cache first — same file + same job title = instant result, no API call
    const cacheKey = `${fileFingerprint(file)}__${jobTitle.trim()}`;
    const cached = cache.current.get(cacheKey);
    if (cached) {
      onResult(cached);
      onToast(`Loaded from cache — ATS Score: ${cached.ats_score}/100`, "info");
      return;
    }

    setAnalyzing(true);
    setError("");
    onAnalysisStart(); // clears old result immediately in parent
    try {
      const form = new FormData();
      form.append("file", file);
      if (jobTitle.trim()) form.append("job_title", jobTitle.trim());

      const res = await fetch(`${API_URL}/analyze`, {
        method: "POST",
        body: form,
        cache: "no-store",
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { detail?: string };
        throw new Error(data.detail ?? `Server error (${res.status})`);
      }

      const result = (await res.json()) as AnalysisResult;
      cache.current.set(cacheKey, result); // store for instant re-use
      onResult(result);
      onToast(`Analysis complete! ATS Score: ${result.ats_score}/100`, "success");
    } catch (err: unknown) {
      const msg =
        err instanceof TypeError
          ? "Cannot reach the backend. It may be waking up — please try again in 30 seconds."
          : err instanceof Error
          ? err.message
          : "An unexpected error occurred.";
      setError(msg);
      onToast(msg, "error");
      onAnalysisError();
    } finally {
      setAnalyzing(false);
    }
  };

  if (analyzing) return <LoadingOverlay />;

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", width: "100%" }}>
      {/* Job title input */}
      <div style={{ marginBottom: "1rem" }}>
        <label
          htmlFor={jobId}
          style={{
            display: "block",
            fontSize: "0.8rem",
            fontWeight: 600,
            color: "var(--text2)",
            marginBottom: "0.4rem",
          }}
        >
          Target Job Title{" "}
          <span style={{ color: "var(--muted)", fontWeight: 400 }}>(optional — for tailored analysis)</span>
        </label>
        <input
          id={jobId}
          className="input-field"
          type="text"
          placeholder="e.g. Senior Software Engineer, Product Manager, Data Scientist…"
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          maxLength={80}
        />
      </div>

      {/* Dropzone */}
      <div
        className={`dropzone${dragActive ? " active" : ""}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
        style={{ padding: "2.75rem 2rem", textAlign: "center" }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          style={{ display: "none" }}
          onChange={onInputChange}
        />

        {file ? (
          <>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                background: "rgba(99,102,241,0.12)",
                border: "1px solid rgba(99,102,241,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.6rem",
                margin: "0 auto 1rem",
              }}
            >
              📄
            </div>
            <p style={{ fontWeight: 700, color: "var(--accent)", fontSize: "0.95rem" }}>
              {file.name}
            </p>
            <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: 6 }}>
              {(file.size / 1024).toFixed(1)} KB · Click to change file
            </p>
          </>
        ) : (
          <>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                background: "rgba(99,102,241,0.08)",
                border: "1px dashed rgba(99,102,241,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.8rem",
                margin: "0 auto 1.25rem",
              }}
            >
              📤
            </div>
            <p style={{ fontWeight: 700, fontSize: "1rem", marginBottom: 8 }}>
              Drop your resume here or{" "}
              <span style={{ color: "var(--accent)" }}>click to browse</span>
            </p>
            <p style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
              PDF only · Max 5MB · 100% private · Never stored
            </p>
          </>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div
          style={{
            marginTop: "0.875rem",
            padding: "0.75rem 1rem",
            borderRadius: 10,
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.25)",
            color: "#f87171",
            fontSize: "0.85rem",
            lineHeight: 1.5,
            display: "flex",
            gap: "0.5rem",
          }}
        >
          <span style={{ flexShrink: 0 }}>⚠</span>
          <span>{error}</span>
        </div>
      )}

      {/* CTA */}
      <button
        className="btn-primary"
        style={{ width: "100%", marginTop: "1rem", padding: "1rem" }}
        onClick={analyze}
        disabled={!file}
      >
        Analyze My Resume →
      </button>

      <p style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.75rem" }}>
        🔒 Your resume is processed in memory only. We never store your data.
      </p>
    </div>
  );
}

// ── Results ───────────────────────────────────────────────────────────────────

const TABS = ["Overview", "Issues", "Keywords", "AI Fixes", "Career Tips"] as const;
type Tab = (typeof TABS)[number];

const SUGGESTION_ICONS: Record<string, string> = {
  "Resume Format": "📐",
  "Content Quality": "✍️",
  "Career Positioning": "🎯",
  "Skills Gap": "🔧",
  "Personal Branding": "🌟",
  "Networking": "🤝",
  "Certifications": "🏅",
};

function Results({
  result,
  onReset,
  onToast,
}: {
  result: AnalysisResult;
  onReset: () => void;
  onToast: (msg: string, type: "success" | "error" | "info") => void;
}) {
  const [tab, setTab] = useState<Tab>("Overview");
  const [copied, setCopied] = useState(false);

  const color = scoreColor(result.ats_score);
  const vColor = verdictColor(result.verdict);

  const sortedIssues = [...result.critical_issues].sort((a, b) => {
    const o: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
    return (o[a.impact] ?? 3) - (o[b.impact] ?? 3);
  });

  const sectionLabels: Record<string, string> = {
    contact: "Contact",
    summary: "Summary",
    experience: "Experience",
    education: "Education",
    skills: "Skills",
    certifications: "Certifications",
  };

  const catLabels: Record<string, string> = {
    keywords: "Keywords",
    formatting: "Formatting",
    experience: "Experience",
    skills: "Skills",
    education: "Education",
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(result.improved_summary);
      setCopied(true);
      onToast("Summary copied to clipboard!", "success");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      onToast("Copy failed — select the text manually.", "error");
    }
  };

  const totalScore = Object.values(result.category_scores).reduce(
    (a, b) => a + b,
    0
  );

  return (
    <div className="fade-up" style={{ width: "100%" }}>
      {/* ── Score header ── */}
      <div
        className="glass"
        style={{
          padding: "2rem",
          marginBottom: "1.25rem",
          display: "flex",
          flexWrap: "wrap",
          gap: "1.5rem",
          alignItems: "center",
        }}
      >
        <ScoreCircle score={result.ats_score} />

        <div style={{ flex: 1, minWidth: 200 }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.5rem",
              marginBottom: "0.75rem",
              alignItems: "center",
            }}
          >
            <span
              style={{
                background: "rgba(99,102,241,0.12)",
                border: "1px solid rgba(99,102,241,0.3)",
                color: "#a5b4fc",
                borderRadius: 8,
                padding: "0.25rem 0.8rem",
                fontWeight: 800,
                fontSize: "1.1rem",
              }}
            >
              {result.grade}
            </span>
            <span
              style={{
                border: `1px solid ${vColor}55`,
                background: `${vColor}18`,
                color: vColor,
                borderRadius: 8,
                padding: "0.25rem 0.8rem",
                fontWeight: 600,
                fontSize: "0.82rem",
              }}
            >
              {result.verdict}
            </span>
            {result.job_title && (
              <span className="badge badge-accent">
                🎯 {result.job_title}
              </span>
            )}
          </div>

          <p
            style={{
              fontSize: "0.9rem",
              color: "var(--text2)",
              lineHeight: 1.65,
              marginBottom: "0.75rem",
            }}
          >
            {result.summary}
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "1.25rem",
              fontSize: "0.78rem",
              color: "var(--muted)",
            }}
          >
            <span>📄 {result.filename}</span>
            <span>📊 {result.word_count} words</span>
            <span>💾 {result.file_size_kb} KB</span>
            <span>⚡ {(result.processing_time_ms / 1000).toFixed(1)}s</span>
            <span style={{ color }}>Total: {totalScore}/100</span>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div
        className="fade-up delay-2"
        style={{
          display: "flex",
          gap: "0.35rem",
          flexWrap: "wrap",
          marginBottom: "1.25rem",
          padding: "0.35rem",
          background: "var(--surface)",
          borderRadius: 12,
          border: "1px solid var(--border)",
        }}
      >
        {TABS.map((t) => (
          <button
            key={t}
            className={`tab-btn${tab === t ? " active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── TAB: Overview ── */}
      {tab === "Overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Category scores + sections grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))",
              gap: "1.25rem",
            }}
          >
            <div className="glass fade-up delay-1" style={{ padding: "1.5rem" }}>
              <p className="label" style={{ marginBottom: "1rem" }}>Category Scores</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                {Object.entries(result.category_scores).map(([k, v], i) => (
                  <ProgressBar
                    key={k}
                    label={catLabels[k] ?? k}
                    value={v}
                    delay={i * 80}
                  />
                ))}
              </div>
            </div>

            <div className="glass fade-up delay-2" style={{ padding: "1.5rem" }}>
              <p className="label" style={{ marginBottom: "1rem" }}>Sections Detected</p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "0.5rem",
                }}
              >
                {Object.entries(result.sections_found).map(([k, v]) => (
                  <SectionChip
                    key={k}
                    label={sectionLabels[k] ?? k}
                    found={v}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Strengths */}
          <div className="glass fade-up delay-3" style={{ padding: "1.5rem" }}>
            <p className="label" style={{ marginBottom: "1rem" }}>Strengths</p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "0.6rem",
              }}
            >
              {result.strengths.map((s, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: "0.6rem",
                    padding: "0.75rem",
                    borderRadius: 10,
                    background: "rgba(34,197,94,0.05)",
                    border: "1px solid rgba(34,197,94,0.15)",
                  }}
                >
                  <span style={{ color: "var(--green)", fontWeight: 700, flexShrink: 0 }}>✓</span>
                  <span style={{ fontSize: "0.85rem", color: "var(--text2)", lineHeight: 1.5 }}>{s}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Nudge to Career Tips tab */}
          <div
            className="fade-up delay-4"
            style={{
              padding: "0.9rem 1.25rem",
              borderRadius: 12,
              background: "rgba(99,102,241,0.06)",
              border: "1px solid rgba(99,102,241,0.2)",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
            }}
          >
            <span style={{ fontSize: "1.3rem" }}>💡</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>
                See your personalised Career Tips
              </p>
              <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                Interview questions, score improvement plan & professional suggestions
              </p>
            </div>
            <button
              className="btn-ghost"
              style={{ fontSize: "0.8rem", padding: "0.4rem 0.9rem", flexShrink: 0 }}
              onClick={() => setTab("Career Tips")}
            >
              View →
            </button>
          </div>
        </div>
      )}

      {/* ── TAB: Issues ── */}
      {tab === "Issues" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {sortedIssues.length === 0 ? (
            <div
              className="glass"
              style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}
            >
              <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🎉</p>
              <p>No critical issues found! Your resume is in great shape.</p>
            </div>
          ) : (
            sortedIssues.map((issue, i) => (
              <div
                key={i}
                className={`glass fade-up delay-${Math.min(i + 1, 6) as 1}`}
                style={{ padding: "1.25rem 1.5rem" }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.75rem",
                    marginBottom: "0.6rem",
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: "0.95rem", flex: 1 }}>
                    {issue.issue}
                  </span>
                  <ImpactBadge impact={issue.impact} />
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    padding: "0.65rem 0.85rem",
                    borderRadius: 8,
                    background: "rgba(99,102,241,0.06)",
                    border: "1px solid rgba(99,102,241,0.15)",
                  }}
                >
                  <span style={{ color: "var(--accent)", flexShrink: 0, fontSize: "0.85rem" }}>→</span>
                  <p style={{ fontSize: "0.85rem", color: "var(--text2)", lineHeight: 1.55 }}>
                    {issue.fix}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── TAB: Keywords ── */}
      {tab === "Keywords" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div className="glass" style={{ padding: "1.5rem" }}>
            <p className="label" style={{ marginBottom: "0.5rem" }}>Missing Keywords</p>
            <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: "1rem" }}>
              Add these keywords naturally into your resume to improve ATS ranking.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {result.missing_keywords.map((kw) => (
                <span key={kw} className="pill">{kw}</span>
              ))}
            </div>
          </div>

          <div className="glass" style={{ padding: "1.5rem" }}>
            <p className="label" style={{ marginBottom: "1rem" }}>Quick Wins · Do these in 30 minutes</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              {result.quick_wins.map((win, i) => (
                <div
                  key={i}
                  style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}
                >
                  <span
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 7,
                      border: "1.5px solid var(--accent)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.72rem",
                      fontWeight: 800,
                      color: "var(--accent)",
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    {i + 1}
                  </span>
                  <span style={{ fontSize: "0.875rem", color: "var(--text2)", lineHeight: 1.55 }}>
                    {win}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: AI Fixes ── */}
      {tab === "AI Fixes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div className="glass" style={{ padding: "1.5rem" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              <div>
                <p className="label">AI-Rewritten Professional Summary</p>
                <p style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: 2 }}>
                  ATS-optimized · Ready to copy-paste
                </p>
              </div>
              <button
                onClick={copyToClipboard}
                className="btn-ghost"
                style={{ padding: "0.5rem 1rem", fontSize: "0.8rem" }}
              >
                {copied ? "✓ Copied!" : "Copy"}
              </button>
            </div>
            <div className="summary-inset">
              <p style={{ fontSize: "0.9rem", lineHeight: 1.75, color: "var(--text)" }}>
                {result.improved_summary}
              </p>
            </div>
          </div>

          <div className="glass" style={{ padding: "1.5rem" }}>
            <p className="label" style={{ marginBottom: "1rem" }}>Quick Wins</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              {result.quick_wins.map((win, i) => (
                <div
                  key={i}
                  style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}
                >
                  <span style={{ color: "var(--green)", flexShrink: 0, marginTop: 2 }}>✓</span>
                  <span style={{ fontSize: "0.875rem", color: "var(--text2)", lineHeight: 1.55 }}>
                    {win}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: Career Tips ── */}
      {tab === "Career Tips" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

          {/* Next grade roadmap */}
          {result.next_grade_roadmap && (
            <div
              className="glass fade-up"
              style={{
                padding: "1.5rem",
                background: "rgba(99,102,241,0.06)",
                borderColor: "rgba(99,102,241,0.25)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.85rem" }}>
                <span style={{ fontSize: "1.3rem" }}>🚀</span>
                <p className="label" style={{ marginBottom: 0 }}>
                  How to Reach the Next Grade
                </p>
              </div>
              <p style={{ fontSize: "0.9rem", color: "var(--text2)", lineHeight: 1.75 }}>
                {result.next_grade_roadmap}
              </p>
            </div>
          )}

          {/* Score improvement plan */}
          {result.score_improvement_plan && result.score_improvement_plan.length > 0 && (
            <div className="glass fade-up delay-1" style={{ padding: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem" }}>
                <span style={{ fontSize: "1.2rem" }}>📈</span>
                <p className="label" style={{ marginBottom: 0 }}>Score Improvement Plan</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {result.score_improvement_plan.map((item, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "1rem 1.25rem",
                      borderRadius: 12,
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid var(--border2)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.45rem", flexWrap: "wrap" }}>
                      <span
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 6,
                          background: "rgba(99,102,241,0.12)",
                          border: "1px solid rgba(99,102,241,0.25)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.7rem",
                          fontWeight: 800,
                          color: "#a5b4fc",
                          flexShrink: 0,
                        }}
                      >
                        {i + 1}
                      </span>
                      <span style={{ fontWeight: 700, fontSize: "0.92rem", flex: 1 }}>{item.action}</span>
                      <span
                        style={{
                          background: "rgba(34,197,94,0.1)",
                          border: "1px solid rgba(34,197,94,0.2)",
                          color: "#4ade80",
                          borderRadius: 999,
                          padding: "0.15rem 0.6rem",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.score_boost}
                      </span>
                      <ImpactBadge impact={item.priority as "High" | "Medium" | "Low"} />
                    </div>
                    <p style={{ fontSize: "0.84rem", color: "var(--text2)", lineHeight: 1.55, paddingLeft: "2rem" }}>
                      {item.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Interview tips */}
          {result.interview_tips && result.interview_tips.length > 0 && (
            <div className="glass fade-up delay-2" style={{ padding: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem" }}>
                <span style={{ fontSize: "1.2rem" }}>🎤</span>
                <div>
                  <p className="label" style={{ marginBottom: 0 }}>Interview Preparation</p>
                  <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 2 }}>
                    Questions and tips tailored to your resume
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                {result.interview_tips.map((tip, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: "0.75rem",
                      padding: "0.85rem 1rem",
                      borderRadius: 10,
                      background: "rgba(59,130,246,0.05)",
                      border: "1px solid rgba(59,130,246,0.15)",
                    }}
                  >
                    <span
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        background: "rgba(59,130,246,0.12)",
                        border: "1px solid rgba(59,130,246,0.25)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.68rem",
                        fontWeight: 800,
                        color: "#93c5fd",
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    >
                      Q
                    </span>
                    <span style={{ fontSize: "0.875rem", color: "var(--text2)", lineHeight: 1.6 }}>
                      {tip}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Professional suggestions */}
          {result.professional_suggestions && result.professional_suggestions.length > 0 && (
            <div className="glass fade-up delay-3" style={{ padding: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem" }}>
                <span style={{ fontSize: "1.2rem" }}>💼</span>
                <div>
                  <p className="label" style={{ marginBottom: 0 }}>Professional Development</p>
                  <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 2 }}>
                    Tailored career advice based on your profile
                  </p>
                </div>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  gap: "0.75rem",
                }}
              >
                {result.professional_suggestions.map((s, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "1rem 1.125rem",
                      borderRadius: 12,
                      background: "rgba(168,85,247,0.04)",
                      border: "1px solid rgba(168,85,247,0.15)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                      <span style={{ fontSize: "1.1rem" }}>
                        {SUGGESTION_ICONS[s.category] ?? "💡"}
                      </span>
                      <span
                        style={{
                          fontSize: "0.68rem",
                          fontWeight: 800,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: "#d8b4fe",
                        }}
                      >
                        {s.category}
                      </span>
                    </div>
                    <p style={{ fontSize: "0.855rem", fontWeight: 600, color: "var(--text)", marginBottom: "0.4rem", lineHeight: 1.4 }}>
                      {s.suggestion}
                    </p>
                    <p style={{ fontSize: "0.78rem", color: "var(--muted)", lineHeight: 1.55 }}>
                      {s.why}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Salary insight */}
          {result.salary_insight && (
            <div
              style={{
                padding: "1rem 1.25rem",
                borderRadius: 12,
                background: "rgba(99,102,241,0.06)",
                border: "1px solid rgba(99,102,241,0.18)",
                display: "flex",
                gap: "0.6rem",
                alignItems: "flex-start",
              }}
            >
              <span style={{ fontSize: "1.2rem", flexShrink: 0 }}>💰</span>
              <div>
                <p style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>
                  Salary Insight
                </p>
                <p style={{ fontSize: "0.875rem", color: "var(--text2)", lineHeight: 1.6 }}>
                  {result.salary_insight}
                </p>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Reset */}
      <div style={{ textAlign: "center", marginTop: "2rem" }}>
        <button className="btn-ghost" onClick={onReset}>
          ← Analyze Another Resume
        </button>
      </div>
    </div>
  );
}

// ── Feature Cards ─────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: "⚡",
    title: "Instant ATS Score",
    desc: "Score your resume against real ATS criteria in under 20 seconds using Google Gemini AI.",
  },
  {
    icon: "🔍",
    title: "Critical Issues",
    desc: "Identify exact problems — missing keywords, poor formatting, weak bullet points — with precise fixes.",
  },
  {
    icon: "🎯",
    title: "Role-Specific Analysis",
    desc: "Enter your target job title and get tailored keyword recommendations and salary insights.",
  },
  {
    icon: "✨",
    title: "AI-Rewritten Summary",
    desc: "Get a professionally rewritten, ATS-optimized summary tailored to your background.",
  },
];

const HOW_IT_WORKS = [
  { n: "1", title: "Upload your PDF", desc: "Drag and drop your resume — text-based PDF, max 5MB." },
  { n: "2", title: "Add job title", desc: "Optionally enter the role you're targeting for precise analysis." },
  { n: "3", title: "Gemini analyzes", desc: "Our AI runs a full ATS scan: keywords, formatting, sections, impact." },
  { n: "4", title: "Get your report", desc: "Review your score, fix issues, copy your improved summary." },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Home() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  // resultKey forces Results + ScoreCircle to fully remount on every new analysis
  const [resultKey, setResultKey] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error" | "info";
  } | null>(null);
  // Cache: fingerprint → result, so same file + same job title never re-hits the API
  const cacheRef = useRef<Map<string, AnalysisResult>>(new Map());
  const resultsRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback(
    (msg: string, type: "success" | "error" | "info") => {
      setToast({ msg, type });
    },
    []
  );

  // Called when user clicks Analyze — clears old result immediately
  const handleAnalysisStart = useCallback(() => {
    setResult(null);
    setAnalyzing(true);
  }, []);

  const handleResult = useCallback((r: AnalysisResult) => {
    setAnalyzing(false);
    setResult(r);
    setResultKey((k) => k + 1); // force full remount of Results + ScoreCircle
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  }, []);

  const handleError = useCallback(() => {
    setAnalyzing(false);
  }, []);

  const handleReset = useCallback(() => {
    setResult(null);
    setResultKey((k) => k + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* ── Navbar ── */}
      <nav className="navbar">
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "0 1.5rem",
            height: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span style={{ fontSize: "1.25rem" }}>🤖</span>
            <span style={{ fontWeight: 800, fontSize: "1rem", letterSpacing: "-0.02em" }}>
              ResumeAI
            </span>
            <span
              className="badge badge-accent hide-mobile"
              style={{ marginLeft: 4, fontSize: "0.62rem" }}
            >
              FREE
            </span>
          </div>
          <div style={{ display: "flex", gap: "1.5rem", fontSize: "0.82rem", color: "var(--muted)" }}>
            <span className="hide-mobile">Powered by Gemini 2.5 Flash</span>
            <a
              href="https://github.com/Thrishanth28/ai-resume-analyzer"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--text2)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              GitHub
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <div className="hero-bg">
        <div
          style={{
            maxWidth: 720,
            margin: "0 auto",
            padding: "5rem 1.5rem 4rem",
            textAlign: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div style={{ marginBottom: "1.5rem" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "rgba(99,102,241,0.1)",
                border: "1px solid rgba(99,102,241,0.25)",
                color: "#a5b4fc",
                borderRadius: 999,
                padding: "0.35rem 1.1rem",
                fontSize: "0.78rem",
                fontWeight: 700,
                letterSpacing: "0.05em",
              }}
            >
              ✦ AI-Powered · ATS Optimized · 100% Free
            </span>
          </div>

          <h1
            style={{
              fontSize: "clamp(2rem, 6vw, 3.8rem)",
              fontWeight: 900,
              lineHeight: 1.08,
              letterSpacing: "-0.04em",
              marginBottom: "1.25rem",
            }}
          >
            Is Your Resume{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #6366f1 0%, #a78bfa 60%, #e879f9 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              ATS Ready?
            </span>
          </h1>

          <p
            style={{
              fontSize: "1.1rem",
              color: "var(--text2)",
              lineHeight: 1.7,
              maxWidth: 500,
              margin: "0 auto 2.5rem",
            }}
          >
            Upload your resume and get an instant ATS score, uncover critical
            issues, and receive exact fixes to land more interviews.
          </p>

          {/* Stats row */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "2rem",
              marginBottom: "3.5rem",
              flexWrap: "wrap",
            }}
          >
            {[
              ["⚡", "~15s", "Analysis time"],
              ["🎯", "6 ATS", "Systems covered"],
              ["🔧", "8+", "Fix categories"],
            ].map(([icon, val, lbl]) => (
              <div key={lbl} style={{ textAlign: "center" }}>
                <p style={{ fontWeight: 800, fontSize: "1rem" }}>
                  {icon} {val}
                </p>
                <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 2 }}>{lbl}</p>
              </div>
            ))}
          </div>

          {/* Upload card */}
          <div
            className="glass"
            style={{ padding: "2rem", textAlign: "left", marginBottom: "2rem" }}
          >
            <UploadSection
              onResult={handleResult}
              onToast={showToast}
              onAnalysisStart={handleAnalysisStart}
              onAnalysisError={handleError}
              cache={cacheRef}
            />
          </div>
        </div>
      </div>

      {/* ── Loading (full page, between hero and results) ── */}
      {analyzing && !result && (
        <div style={{ maxWidth: 600, margin: "0 auto", padding: "2rem 1.5rem" }}>
          <div className="glass" style={{ padding: "2rem" }}>
            <LoadingOverlay />
          </div>
        </div>
      )}

      {/* ── Results ── */}
      {result && (
        <div
          ref={resultsRef}
          style={{
            maxWidth: 900,
            margin: "0 auto",
            padding: "0 1.5rem 4rem",
          }}
        >
          {/* key={resultKey} forces full remount → score re-animates, tab resets */}
          <Results key={resultKey} result={result} onReset={handleReset} onToast={showToast} />
        </div>
      )}

      {/* ── How it works ── */}
      {!result && (
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 1.5rem 5rem" }}>
          <p
            style={{
              textAlign: "center",
              fontSize: "0.68rem",
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--muted)",
              marginBottom: "0.75rem",
            }}
          >
            How it works
          </p>
          <h2
            style={{
              textAlign: "center",
              fontWeight: 800,
              fontSize: "clamp(1.4rem, 3vw, 2rem)",
              letterSpacing: "-0.03em",
              marginBottom: "2rem",
            }}
          >
            4 steps to a better resume
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "1rem",
              marginBottom: "4rem",
            }}
          >
            {HOW_IT_WORKS.map((s) => (
              <div key={s.n} className="step-card">
                <div className="step-num">{s.n}</div>
                <p style={{ fontWeight: 700, marginBottom: "0.4rem", fontSize: "0.9rem" }}>
                  {s.title}
                </p>
                <p style={{ fontSize: "0.8rem", color: "var(--muted)", lineHeight: 1.6 }}>
                  {s.desc}
                </p>
              </div>
            ))}
          </div>

          <p
            style={{
              textAlign: "center",
              fontSize: "0.68rem",
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--muted)",
              marginBottom: "0.75rem",
            }}
          >
            What you get
          </p>
          <h2
            style={{
              textAlign: "center",
              fontWeight: 800,
              fontSize: "clamp(1.4rem, 3vw, 2rem)",
              letterSpacing: "-0.03em",
              marginBottom: "2rem",
            }}
          >
            Everything you need to get hired
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: "1rem",
            }}
          >
            {FEATURES.map((f) => (
              <div key={f.title} className="feature-card glass-hover">
                <div style={{ fontSize: "1.75rem", marginBottom: "0.75rem" }}>{f.icon}</div>
                <p style={{ fontWeight: 700, marginBottom: "0.45rem", fontSize: "0.92rem" }}>
                  {f.title}
                </p>
                <p style={{ fontSize: "0.81rem", color: "var(--muted)", lineHeight: 1.6 }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <footer
        style={{
          borderTop: "1px solid var(--border)",
          padding: "1.5rem",
          textAlign: "center",
          fontSize: "0.8rem",
          color: "var(--muted)",
        }}
      >
        Built by{" "}
        <a
          href="https://thrishanth-portfolio.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--accent)", textDecoration: "none" }}
        >
          S. Thrishanth Reddy
        </a>{" "}
        · Powered by{" "}
        <span style={{ color: "var(--text2)" }}>Google Gemini AI</span>
        {" · "}
        <a
          href="https://github.com/Thrishanth28/ai-resume-analyzer"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--text2)", textDecoration: "none" }}
        >
          Open Source
        </a>
      </footer>

      {/* ── Toast ── */}
      {toast && (
        <Toast
          message={toast.msg}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
