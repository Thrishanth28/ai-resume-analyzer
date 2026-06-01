import os
import json
import time
import logging
import fitz  # PyMuPDF
import httpx
from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any, Optional
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="AI Resume Analyzer API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB


def build_prompt(resume_text: str, job_title: str) -> str:
    role_context = f"The candidate is targeting the role: {job_title}." if job_title else "Analyze for general professional roles."
    return f"""You are a world-class ATS (Applicant Tracking System) resume expert with deep knowledge of how Workday, Taleo, Greenhouse, Lever, and iCIMS parse, rank, and score resumes. You also have expertise as a senior hiring manager and career coach.

{role_context}

Analyze the resume text below and return ONLY a valid JSON object — no markdown, no code fences, no explanations. The JSON must follow this EXACT schema:

{{
  "ats_score": <integer 0-100 based on ATS compatibility, keyword density, formatting, and completeness>,
  "grade": "<one of: A+|A|B+|B|C+|C|D|F>",
  "summary": "<2-3 sentence honest overall assessment of ATS readiness>",
  "sections_found": {{
    "contact": <true if name/email/phone found>,
    "summary": <true if professional summary/objective found>,
    "experience": <true if work experience section found>,
    "education": <true if education section found>,
    "skills": <true if skills section found>,
    "certifications": <true if certifications/licenses found>
  }},
  "category_scores": {{
    "keywords": <0-20, how well resume matches industry keywords>,
    "formatting": <0-20, ATS-friendly formatting score>,
    "experience": <0-20, quality and quantification of experience>,
    "skills": <0-20, relevance and completeness of skills>,
    "education": <0-20, education section quality>
  }},
  "strengths": [
    "<specific, actionable strength with evidence from the resume>",
    "<specific strength 2>",
    "<specific strength 3>",
    "<specific strength 4>"
  ],
  "critical_issues": [
    {{
      "issue": "<short issue title, max 6 words>",
      "impact": "<High|Medium|Low>",
      "fix": "<specific actionable fix the candidate can apply immediately>"
    }}
  ],
  "missing_keywords": [
    "<industry keyword or tool missing from resume>",
    "<keyword 2>",
    "<keyword 3>",
    "<keyword 4>",
    "<keyword 5>",
    "<keyword 6>",
    "<keyword 7>",
    "<keyword 8>"
  ],
  "quick_wins": [
    "<actionable improvement completable in under 10 minutes>",
    "<quick win 2>",
    "<quick win 3>",
    "<quick win 4>",
    "<quick win 5>"
  ],
  "improved_summary": "<professionally rewritten 3-4 sentence summary that is ATS-optimized, quantified, and compelling for the target role>",
  "verdict": "<one of: Highly Recommended|Recommended|Needs Improvement|Major Revision Required>",
  "interview_tips": [
    "<specific behavioral interview question the candidate should prepare for, based on their actual experience>",
    "<specific technical or situational question relevant to their background>",
    "<tip on how to frame their experience using STAR method for this specific profile>",
    "<question about a gap or weakness in their resume they should prepare to answer>",
    "<question about their biggest achievement or impact>"
  ],
  "score_improvement_plan": [
    {{
      "action": "<specific action title>",
      "detail": "<exactly what to do, referencing details from their actual resume>",
      "score_boost": "<estimated score points gained e.g. +5 to +8 points>",
      "priority": "<High|Medium|Low>"
    }}
  ],
  "professional_suggestions": [
    {{
      "category": "<one of: Resume Format|Content Quality|Career Positioning|Skills Gap|Personal Branding|Networking|Certifications>",
      "suggestion": "<specific professional suggestion tailored to this person's background>",
      "why": "<why this matters for their career progression>"
    }}
  ],
  "next_grade_roadmap": "<2-3 sentences describing exactly what this candidate needs to do to reach the next letter grade, referencing their specific resume>",
  "salary_insight": "<one sentence salary range insight for this profile based on their experience level and location if mentioned>"
}}

Resume text to analyze:
---
{resume_text[:8000]}
---"""


class SectionsFound(BaseModel):
    contact: bool
    summary: bool
    experience: bool
    education: bool
    skills: bool
    certifications: bool


class CategoryScores(BaseModel):
    keywords: int
    formatting: int
    experience: int
    skills: int
    education: int


class CriticalIssue(BaseModel):
    issue: str
    impact: str
    fix: str


class ScoreImprovementAction(BaseModel):
    action: str
    detail: str
    score_boost: str
    priority: str


class ProfessionalSuggestion(BaseModel):
    category: str
    suggestion: str
    why: str


class AnalysisResult(BaseModel):
    ats_score: int
    grade: str
    summary: str
    sections_found: SectionsFound
    category_scores: CategoryScores
    strengths: list[str]
    critical_issues: list[CriticalIssue]
    missing_keywords: list[str]
    quick_wins: list[str]
    improved_summary: str
    verdict: str
    interview_tips: list[str]
    score_improvement_plan: list[ScoreImprovementAction]
    professional_suggestions: list[ProfessionalSuggestion]
    next_grade_roadmap: str
    salary_insight: str
    word_count: int
    processing_time_ms: int
    filename: str
    file_size_kb: float
    job_title: str


def get_fallback_analysis(
    filename: str, file_size_kb: float, word_count: int,
    processing_time_ms: int, job_title: str
) -> dict[str, Any]:
    return {
        "ats_score": 65,
        "grade": "C+",
        "summary": "Demo mode active — Gemini API key is not configured on this server. Your resume was successfully parsed. Add GEMINI_API_KEY to enable real AI-powered analysis.",
        "sections_found": {"contact": True, "summary": False, "experience": True, "education": True, "skills": True, "certifications": False},
        "category_scores": {"keywords": 12, "formatting": 14, "experience": 13, "skills": 12, "education": 14},
        "strengths": [
            "Resume is machine-readable — text parsed successfully",
            "PDF format is compatible with major ATS systems",
            "File size is within the optimal range",
        ],
        "critical_issues": [{"issue": "API not configured", "impact": "High", "fix": "Set GEMINI_API_KEY environment variable on Render to enable real analysis."}],
        "missing_keywords": ["Python", "API", "Cloud", "Agile", "Docker"],
        "quick_wins": ["Configure Gemini API key", "Add a professional summary section", "Quantify achievements with numbers"],
        "improved_summary": "Results-driven professional with demonstrated expertise in their field. Proven track record of delivering measurable outcomes and collaborating across teams. Seeking to leverage skills in a high-impact role.",
        "verdict": "Needs Improvement",
        "interview_tips": [
            "Tell me about yourself — prepare a 90-second pitch covering your background, key wins, and why you want this role.",
            "Describe a challenge you overcame — use the STAR method (Situation, Task, Action, Result).",
            "Research the company thoroughly before your interview.",
        ],
        "score_improvement_plan": [
            {"action": "Add quantified achievements", "detail": "Replace vague bullets with metrics (e.g. 'increased sales by 30%')", "score_boost": "+8 to +12 points", "priority": "High"},
            {"action": "Add professional summary", "detail": "Write a 3-sentence ATS-optimized summary at the top", "score_boost": "+5 to +8 points", "priority": "High"},
        ],
        "professional_suggestions": [
            {"category": "Resume Format", "suggestion": "Use a single-column ATS-friendly layout with standard section headers.", "why": "Multi-column layouts confuse ATS parsers and cause auto-rejection."},
            {"category": "Personal Branding", "suggestion": "Add a LinkedIn URL and ensure it matches your resume.", "why": "Recruiters verify candidates on LinkedIn before reaching out."},
        ],
        "next_grade_roadmap": "To reach the next grade, quantify your achievements, add a strong professional summary, and incorporate industry-specific keywords relevant to your target role.",
        "salary_insight": "Enable real Gemini analysis to get salary insights tailored to your experience.",
        "word_count": word_count,
        "processing_time_ms": processing_time_ms,
        "filename": filename,
        "file_size_kb": file_size_kb,
        "job_title": job_title,
    }


def clean_gemini_json(raw: str) -> str:
    text = raw.strip()
    # Strip ```json ... ``` or ``` ... ```
    if text.startswith("```"):
        lines = text.split("\n")
        lines = lines[1:]  # drop opening fence line
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return text


async def call_gemini(resume_text: str, job_title: str) -> dict[str, Any]:
    prompt = build_prompt(resume_text, job_title)
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 1,          # required for gemini-2.5-flash thinking
            "maxOutputTokens": 8192,   # enough room for thinking + JSON output
        },
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(f"{GEMINI_URL}?key={GEMINI_API_KEY}", json=payload)
        if response.status_code != 200:
            logger.error("Gemini HTTP %s: %s", response.status_code, response.text[:500])
        response.raise_for_status()
        data = response.json()

    # gemini-2.5-flash may return thinking parts before the JSON part
    # find the part that contains JSON (starts with { or ```)
    parts = data["candidates"][0]["content"].get("parts", [])
    raw_text = ""
    for part in parts:
        text = part.get("text", "")
        stripped = text.strip()
        if stripped.startswith("{") or stripped.startswith("```"):
            raw_text = text
            break
    if not raw_text and parts:
        raw_text = parts[-1].get("text", "")

    logger.info("Gemini raw response length: %d chars", len(raw_text))
    cleaned = clean_gemini_json(raw_text)
    return json.loads(cleaned)


@app.get("/")
async def root() -> dict[str, str]:
    return {"name": "AI Resume Analyzer API", "version": "2.0.0", "status": "healthy"}


@app.get("/health")
async def health() -> dict[str, Any]:
    return {"status": "healthy", "gemini_configured": bool(GEMINI_API_KEY)}


@app.post("/analyze", response_model=AnalysisResult)
async def analyze(
    file: UploadFile = File(...),
    job_title: Optional[str] = Form(default=""),
) -> dict[str, Any]:
    start_time = time.time()

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds the 5MB limit.")

    file_size_kb = round(len(content) / 1024, 2)
    job_title_clean = (job_title or "").strip()

    try:
        doc = fitz.open(stream=content, filetype="pdf")
        pages_text = [page.get_text() for page in doc]
        doc.close()
        resume_text = "\n".join(pages_text).strip()
    except Exception as e:
        logger.error("PDF parse error: %s", e)
        raise HTTPException(status_code=422, detail="Could not parse this PDF. Make sure it is a text-based PDF, not a scanned image.")

    if len(resume_text) < 50:
        raise HTTPException(
            status_code=422,
            detail="This PDF appears to be a scanned image or has no readable text. Please upload a text-based PDF."
        )

    word_count = len(resume_text.split())
    logger.info("Parsed resume: %d words, %.1f KB", word_count, file_size_kb)

    if not GEMINI_API_KEY:
        logger.warning("GEMINI_API_KEY not set — returning fallback analysis")
        return get_fallback_analysis(file.filename, file_size_kb, word_count,
                                     int((time.time() - start_time) * 1000), job_title_clean)

    try:
        analysis = await call_gemini(resume_text, job_title_clean)
        logger.info("Gemini analysis complete")
    except json.JSONDecodeError as e:
        logger.error("Gemini returned invalid JSON: %s", e)
        return get_fallback_analysis(file.filename, file_size_kb, word_count,
                                     int((time.time() - start_time) * 1000), job_title_clean)
    except Exception as e:
        logger.error("Gemini call failed: %s", e)
        return get_fallback_analysis(file.filename, file_size_kb, word_count,
                                     int((time.time() - start_time) * 1000), job_title_clean)

    processing_time_ms = int((time.time() - start_time) * 1000)
    analysis.setdefault("interview_tips", [])
    analysis.setdefault("score_improvement_plan", [])
    analysis.setdefault("professional_suggestions", [])
    analysis.setdefault("next_grade_roadmap", "")
    analysis.setdefault("salary_insight", "")
    analysis["word_count"] = word_count
    analysis["processing_time_ms"] = processing_time_ms
    analysis["filename"] = file.filename
    analysis["file_size_kb"] = file_size_kb
    analysis["job_title"] = job_title_clean

    return analysis
