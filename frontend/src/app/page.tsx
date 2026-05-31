"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface CriticalIssue {
  issue: string;
  impact: "High" | "Medium" | "Low";
  fix: string;
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
  word_count: number;
  processing_time_ms: number;
  filename: string;
  file_size_kb: number;
}

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Score Circle ─────────────────────────────────────────────────────────────

function ScoreCircle({ score, color }: { score: number; color: string }) {
  const [displayed, setDisplayed] = useState(0);
  const radius = 70;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (displayed / 100) * circ;

  useEffect(() => {
    let start: number | null = null;
    const duration = 1500;
    const end = score;
    function step(ts: number) {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(eased * end));
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }, [score]);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="180" height="180" style={{ transform: "rotate(-90deg)" }}>
        <circle
          className="score-circle-track"
          cx="90"
          cy="90"
          r={radius}
          strokeWidth="10"
        />
        <circle
          className="score-circle-fill"
          cx="90"
          cy="90"
          r={radius}
          strokeWidth="10"
          stroke={color}
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <div
        className="absolute flex flex-col items-center"
        style={{ transform: "none" }}
      >
        <span
          className="font-bold"
          style={{ fontSize: "2.75rem", color, lineHeight: 1 }}
        >
          {displayed}
        </span>
        <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>/ 100</span>
      </div>
    </div>
  );
}

// ── Progress Bar ──────────────────────────────────────────────────────────────

function ProgressBar({
  label,
  value,
  max = 20,
}: {
  label: string;
  value: number;
  max?: number;
}) {
  const [width, setWidth] = useState(0);
  const pct = Math.round((value / max) * 100);
  const color =
    pct >= 75
      ? "var(--green)"
      : pct >= 50
      ? "var(--yellow)"
      : "var(--red)";

  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), 80);
    return () => clearTimeout(t);
  }, [pct]);

  return (
    <div className="flex items-center gap-3" style={{ minWidth: 0 }}>
      <span
        style={{
          width: 90,
          fontSize: "0.85rem",
          color: "var(--muted)",
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <div className="progress-bar-bg flex-1">
        <div
          className="progress-bar-fill"
          style={{ width: `${width}%`, background: color }}
        />
      </div>
      <span
        style={{
          width: 40,
          textAlign: "right",
          fontSize: "0.85rem",
          color,
          flexShrink: 0,
        }}
      >
        {value}/{max}
      </span>
    </div>
  );
}

// ── Section Icon ──────────────────────────────────────────────────────────────

function SectionIcon({
  label,
  found,
}: {
  label: string;
  found: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: found
            ? "rgba(34,197,94,0.1)"
            : "rgba(239,68,68,0.1)",
          border: `1px solid ${found ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.2rem",
        }}
      >
        {found ? "✓" : "✗"}
      </div>
      <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>{label}</span>
    </div>
  );
}

// ── Impact Badge ──────────────────────────────────────────────────────────────

function ImpactBadge({ impact }: { impact: "High" | "Medium" | "Low" }) {
  const cls =
    impact === "High"
      ? "badge-high"
      : impact === "Medium"
      ? "badge-medium"
      : "badge-low";
  return (
    <span
      className={cls}
      style={{
        fontSize: "0.7rem",
        fontWeight: 700,
        borderRadius: 6,
        padding: "0.15rem 0.5rem",
        letterSpacing: "0.05em",
      }}
    >
      {impact}
    </span>
  );
}

// ── Upload Area ───────────────────────────────────────────────────────────────

function UploadSection({
  onResult,
}: {
  onResult: (r: AnalysisResult) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndSet = (f: File) => {
    setError("");
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files are accepted.");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError("File exceeds 5MB limit.");
      return;
    }
    setFile(f);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files[0];
    if (f) validateAndSet(f);
  }, []);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const onDragLeave = () => setDragActive(false);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) validateAndSet(f);
  };

  const analyze = async () => {
    if (!file) return;
    setAnalyzing(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_URL}/analyze`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const data = (await res.json()) as { detail?: string };
        throw new Error(data.detail ?? "Analysis failed.");
      }
      const result = (await res.json()) as AnalysisResult;
      onResult(result);
    } catch (err: unknown) {
      if (err instanceof TypeError && err.message.includes("fetch")) {
        setError(
          "Cannot connect to the backend. Make sure it is running at " +
            API_URL
        );
      } else {
        setError(err instanceof Error ? err.message : "Unexpected error.");
      }
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", width: "100%" }}>
      {/* Dropzone */}
      <div
        className={`dropzone${dragActive ? " active" : ""}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
        style={{ padding: "3rem 2rem", textAlign: "center" }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          style={{ display: "none" }}
          onChange={onInputChange}
        />
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📄</div>
        {file ? (
          <>
            <p style={{ fontWeight: 600, color: "var(--accent)" }}>
              {file.name}
            </p>
            <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: 4 }}>
              {(file.size / 1024).toFixed(1)} KB · Click to change
            </p>
          </>
        ) : (
          <>
            <p style={{ fontWeight: 600, fontSize: "1.05rem" }}>
              Drop your resume here or click to upload
            </p>
            <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: 8 }}>
              PDF only · Max 5MB · 100% private
            </p>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            marginTop: "1rem",
            padding: "0.75rem 1rem",
            borderRadius: 10,
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "var(--red)",
            fontSize: "0.9rem",
          }}
        >
          {error}
          {error.includes("connect") && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                analyze();
              }}
              style={{
                marginLeft: 12,
                color: "var(--accent)",
                background: "none",
                border: "none",
                cursor: "pointer",
                textDecoration: "underline",
                fontSize: "0.9rem",
              }}
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Analyze button */}
      <button
        className="btn-accent"
        style={{ width: "100%", marginTop: "1.25rem" }}
        onClick={analyze}
        disabled={!file || analyzing}
      >
        {analyzing ? (
          <>
            <span className="spinner" />
            Analyzing your resume with AI...
          </>
        ) : (
          "Analyze My Resume"
        )}
      </button>
    </div>
  );
}

// ── Results Section ───────────────────────────────────────────────────────────

function Results({
  result,
  onReset,
}: {
  result: AnalysisResult;
  onReset: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const scoreColor =
    result.ats_score >= 80
      ? "var(--green)"
      : result.ats_score >= 60
      ? "var(--yellow)"
      : "var(--red)";

  const verdictColor =
    result.verdict === "Highly Recommended"
      ? "var(--green)"
      : result.verdict === "Recommended"
      ? "#60a5fa"
      : result.verdict === "Needs Improvement"
      ? "var(--yellow)"
      : "var(--red)";

  const sortedIssues = [...result.critical_issues].sort((a, b) => {
    const order: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
    return (order[a.impact] ?? 3) - (order[b.impact] ?? 3);
  });

  const copyToClipboard = () => {
    navigator.clipboard.writeText(result.improved_summary).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const sectionLabels: Record<string, string> = {
    contact: "Contact",
    summary: "Summary",
    experience: "Experience",
    education: "Education",
    skills: "Skills",
    certifications: "Certifications",
  };

  const categoryLabels: Record<string, string> = {
    keywords: "Keywords",
    formatting: "Formatting",
    experience: "Experience",
    skills: "Skills",
    education: "Education",
  };

  return (
    <div className="results-enter" style={{ width: "100%" }}>
      {/* 3a — Score header */}
      <div
        className="glass-card"
        style={{
          padding: "2rem",
          marginBottom: "1.5rem",
          textAlign: "center",
        }}
      >
        <ScoreCircle score={result.ats_score} color={scoreColor} />
        <div style={{ marginTop: "1rem", display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <span
            style={{
              background: "rgba(99,102,241,0.15)",
              border: "1px solid rgba(99,102,241,0.3)",
              color: "#a5b4fc",
              borderRadius: 8,
              padding: "0.3rem 0.9rem",
              fontWeight: 700,
              fontSize: "1rem",
            }}
          >
            {result.grade}
          </span>
          <span
            style={{
              background: "rgba(0,0,0,0.3)",
              border: `1px solid ${verdictColor}`,
              color: verdictColor,
              borderRadius: 8,
              padding: "0.3rem 0.9rem",
              fontWeight: 600,
              fontSize: "0.85rem",
            }}
          >
            {result.verdict}
          </span>
        </div>
        <p
          style={{
            marginTop: "1rem",
            color: "var(--muted)",
            fontSize: "0.9rem",
            maxWidth: 480,
            margin: "1rem auto 0",
            lineHeight: 1.6,
          }}
        >
          {result.summary}
        </p>
        <p style={{ marginTop: "0.75rem", fontSize: "0.78rem", color: "#52525b" }}>
          {result.filename} · {result.file_size_kb} KB · {result.word_count} words ·{" "}
          {result.processing_time_ms}ms
        </p>
      </div>

      {/* Grid: category scores + sections */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "1.25rem",
          marginBottom: "1.5rem",
        }}
      >
        {/* 3b — Category scores */}
        <div className="glass-card" style={{ padding: "1.5rem" }}>
          <p className="section-label">Category Scores</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            {Object.entries(result.category_scores).map(([key, val]) => (
              <ProgressBar
                key={key}
                label={categoryLabels[key] ?? key}
                value={val}
              />
            ))}
          </div>
        </div>

        {/* 3c — Sections detected */}
        <div className="glass-card" style={{ padding: "1.5rem" }}>
          <p className="section-label">Sections Detected</p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "1rem",
              marginTop: "0.5rem",
            }}
          >
            {Object.entries(result.sections_found).map(([key, found]) => (
              <SectionIcon
                key={key}
                label={sectionLabels[key] ?? key}
                found={found}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 3d — Strengths */}
      <div className="glass-card" style={{ padding: "1.5rem", marginBottom: "1.25rem" }}>
        <p className="section-label">Strengths</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {result.strengths.map((s, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: "0.75rem",
                alignItems: "flex-start",
                padding: "0.75rem",
                borderRadius: 10,
                background: "rgba(34,197,94,0.06)",
                border: "1px solid rgba(34,197,94,0.15)",
              }}
            >
              <span style={{ color: "var(--green)", fontWeight: 700, flexShrink: 0 }}>✓</span>
              <span style={{ fontSize: "0.9rem", lineHeight: 1.5 }}>{s}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 3e — Critical Issues */}
      {sortedIssues.length > 0 && (
        <div className="glass-card" style={{ padding: "1.5rem", marginBottom: "1.25rem" }}>
          <p className="section-label">Critical Issues</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {sortedIssues.map((issue, i) => (
              <div
                key={i}
                className={`stagger-${Math.min(i + 1, 5)}`}
                style={{
                  padding: "1rem 1.25rem",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid var(--border)",
                  animation: "resultsIn 0.4s ease both",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.4rem" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>{issue.issue}</span>
                  <ImpactBadge impact={issue.impact} />
                </div>
                <p style={{ fontSize: "0.85rem", color: "var(--muted)", lineHeight: 1.5 }}>
                  {issue.fix}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3f — Missing keywords */}
      {result.missing_keywords.length > 0 && (
        <div className="glass-card" style={{ padding: "1.5rem", marginBottom: "1.25rem" }}>
          <p className="section-label">Missing Keywords</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", overflowX: "auto" }}>
            {result.missing_keywords.map((kw) => (
              <span key={kw} className="keyword-pill">
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 3g — Quick wins */}
      {result.quick_wins.length > 0 && (
        <div className="glass-card" style={{ padding: "1.5rem", marginBottom: "1.25rem" }}>
          <p className="section-label">Quick Wins · Fix in 30 minutes</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {result.quick_wins.map((win, i) => (
              <div key={i} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    border: "1.5px solid var(--accent)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.75rem",
                    color: "var(--accent)",
                    fontWeight: 700,
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ fontSize: "0.9rem", lineHeight: 1.5 }}>{win}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3h — Improved summary */}
      <div className="glass-card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <p className="section-label" style={{ marginBottom: 0 }}>AI-Rewritten Summary</p>
          <button
            onClick={copyToClipboard}
            style={{
              background: copied ? "rgba(34,197,94,0.1)" : "rgba(99,102,241,0.1)",
              border: `1px solid ${copied ? "rgba(34,197,94,0.3)" : "rgba(99,102,241,0.3)"}`,
              color: copied ? "var(--green)" : "var(--accent)",
              borderRadius: 8,
              padding: "0.3rem 0.8rem",
              cursor: "pointer",
              fontSize: "0.8rem",
              fontWeight: 600,
              transition: "all 0.2s",
            }}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <div className="summary-box">
          <p style={{ fontSize: "0.9rem", lineHeight: 1.7, color: "var(--text)" }}>
            {result.improved_summary}
          </p>
        </div>
      </div>

      {/* 3i — Analyze another */}
      <div style={{ textAlign: "center" }}>
        <button
          onClick={onReset}
          style={{
            background: "none",
            border: "1px solid var(--border)",
            color: "var(--muted)",
            borderRadius: 10,
            padding: "0.75rem 2rem",
            cursor: "pointer",
            fontSize: "0.9rem",
            transition: "border-color 0.2s, color 0.2s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)";
          }}
        >
          Analyze Another Resume
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
    desc: "Get your resume's ATS compatibility score in under 10 seconds, powered by Google Gemini AI.",
  },
  {
    icon: "🔍",
    title: "Critical Issues Found",
    desc: "Pinpoint exact problems preventing your resume from passing ATS filters — with precise fixes.",
  },
  {
    icon: "🔑",
    title: "Missing Keywords",
    desc: "Discover industry keywords your resume is missing that ATS systems like Workday scan for.",
  },
  {
    icon: "✨",
    title: "AI-Rewritten Summary",
    desc: "Receive a professionally rewritten summary tailored to your experience — ready to copy and paste.",
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Home() {
  const [result, setResult] = useState<AnalysisResult | null>(null);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Hero */}
      <div className="hero-gradient" style={{ paddingBottom: "3rem" }}>
        <div
          style={{
            maxWidth: 760,
            margin: "0 auto",
            padding: "5rem 1.5rem 2rem",
            textAlign: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Badge */}
          <div style={{ marginBottom: "1.5rem" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "rgba(99,102,241,0.12)",
                border: "1px solid rgba(99,102,241,0.3)",
                color: "#a5b4fc",
                borderRadius: 999,
                padding: "0.35rem 1rem",
                fontSize: "0.78rem",
                fontWeight: 600,
                letterSpacing: "0.04em",
              }}
            >
              <span>✦</span> AI-Powered · ATS Optimized · Free
            </span>
          </div>

          {/* H1 */}
          <h1
            style={{
              fontSize: "clamp(2.2rem, 6vw, 3.75rem)",
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
              marginBottom: "1.25rem",
            }}
          >
            Is Your Resume{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #6366f1 0%, #a78bfa 100%)",
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
              color: "var(--muted)",
              lineHeight: 1.7,
              maxWidth: 520,
              margin: "0 auto 2.5rem",
            }}
          >
            Upload your resume and get an instant ATS score, find critical
            issues, and get exact fixes to land more interviews.
          </p>

          {/* Stats */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "2.5rem",
              marginBottom: "3rem",
              flexWrap: "wrap",
            }}
          >
            {[
              ["⚡", "10 Seconds", "Analysis"],
              ["🎯", "Proven", "ATS Accuracy"],
              ["🔧", "Actionable", "Fixes"],
            ].map(([icon, top, bot]) => (
              <div key={top} style={{ textAlign: "center" }}>
                <p style={{ fontSize: "1.1rem", marginBottom: 2 }}>
                  {icon}{" "}
                  <span style={{ fontWeight: 700 }}>{top}</span>
                </p>
                <p style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{bot}</p>
              </div>
            ))}
          </div>

          {/* Upload or Results */}
          {result ? (
            <Results result={result} onReset={() => setResult(null)} />
          ) : (
            <UploadSection onResult={setResult} />
          )}
        </div>
      </div>

      {/* Feature cards — always visible */}
      {!result && (
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1.5rem 4rem" }}>
          <p
            style={{
              textAlign: "center",
              fontSize: "0.75rem",
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--muted)",
              marginBottom: "2rem",
            }}
          >
            What you get
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "1rem",
            }}
          >
            {FEATURES.map((f) => (
              <div key={f.title} className="feature-card">
                <div style={{ fontSize: "1.75rem", marginBottom: "0.75rem" }}>{f.icon}</div>
                <p style={{ fontWeight: 700, marginBottom: "0.5rem", fontSize: "0.95rem" }}>
                  {f.title}
                </p>
                <p style={{ fontSize: "0.83rem", color: "var(--muted)", lineHeight: 1.6 }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid var(--border)",
          padding: "1.5rem",
          textAlign: "center",
          fontSize: "0.82rem",
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
        · Powered by Google Gemini AI
      </footer>
    </div>
  );
}
