import os
import re
import json
import time
import logging
import fitz  # PyMuPDF
import httpx
from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator
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
MAX_RESUME_CHARS = 8000


def truncate_at_word(text: str, max_chars: int) -> str:
    """Truncate at a word boundary instead of mid-word."""
    if len(text) <= max_chars:
        return text
    truncated = text[:max_chars]
    last_space = truncated.rfind(" ")
    return truncated[:last_space] if last_space > 0 else truncated


def build_prompt(resume_text: str, job_title: str) -> str:
    role_context = (
        f"The candidate is targeting the role: {job_title}."
        if job_title
        else "Analyze for general professional roles."
    )
    safe_text = truncate_at_word(resume_text, MAX_RESUME_CHARS)
    return f"""You are a world-class ATS (Applicant Tracking System) resume expert with deep knowledge of how Workday, Taleo, Greenhouse, Lever, and iCIMS parse, rank, and score resumes. You also have expertise as a senior hiring manager and career coach.

{role_context}

Analyze the resume text below and return ONLY a valid JSON object — no markdown, no code fences, no explanations outside the JSON.

SCORING RULES — apply consistently for every resume:
- ats_score = sum of all 5 category_scores (each 0-20, total 0-100)
- keywords (0-20): 0-4=none; 5-9=some; 10-14=good; 15-17=strong; 18-20=exceptional
- formatting (0-20): deduct 5 for tables/columns, 3 for missing contact, 3 for no clear headers, 2 for images/graphics
- experience (0-20): 0-4=none; 5-9=listed but unquantified; 10-14=some metrics; 15-17=well quantified; 18-20=exceptional impact with numbers
- skills (0-20): relevance and completeness for the target role
- education (0-20): 0-4=none; 5-10=listed without detail; 11-15=degree+field; 16-20=relevant degree+certifications
- grade: A+(90-100), A(80-89), B+(70-79), B(60-69), C+(50-59), C(40-49), D(30-39), F(0-29)

{{
  "ats_score": <integer 0-100, MUST equal the exact sum of the five category_scores>,
  "grade": "<A+|A|B+|B|C+|C|D|F>",
  "summary": "<2-3 sentence honest overall ATS readiness assessment>",
  "sections_found": {{
    "contact": <true if name/email/phone present>,
    "summary": <true if professional summary/objective present>,
    "experience": <true if work experience section present>,
    "education": <true if education section present>,
    "skills": <true if skills section present>,
    "certifications": <true if certifications/licenses present>
  }},
  "category_scores": {{
    "keywords": <0-20>,
    "formatting": <0-20>,
    "experience": <0-20>,
    "skills": <0-20>,
    "education": <0-20>
  }},
  "strengths": [
    "<specific strength with evidence from resume>",
    "<strength 2>",
    "<strength 3>",
    "<strength 4>"
  ],
  "critical_issues": [
    {{
      "issue": "<short title, max 6 words>",
      "impact": "<High|Medium|Low>",
      "fix": "<specific actionable fix>"
    }}
  ],
  "missing_keywords": [
    "<keyword 1>", "<keyword 2>", "<keyword 3>",
    "<keyword 4>", "<keyword 5>", "<keyword 6>",
    "<keyword 7>", "<keyword 8>"
  ],
  "quick_wins": [
    "<fix doable in under 10 minutes>",
    "<quick win 2>", "<quick win 3>", "<quick win 4>", "<quick win 5>"
  ],
  "improved_summary": "<ATS-optimized 3-4 sentence rewrite of the candidate's professional summary>",
  "verdict": "<Highly Recommended|Recommended|Needs Improvement|Major Revision Required>",
  "interview_tips": [
    "<behavioral question the candidate should prepare for, based on their resume>",
    "<technical/situational question relevant to their background>",
    "<STAR method tip specific to their profile>",
    "<question about a gap or weakness in their resume>",
    "<question about their biggest achievement>"
  ],
  "score_improvement_plan": [
    {{
      "action": "<action title>",
      "detail": "<specific instruction referencing their actual resume>",
      "score_boost": "<e.g. +5 to +8 points>",
      "priority": "<High|Medium|Low>"
    }}
  ],
  "professional_suggestions": [
    {{
      "category": "<Resume Format|Content Quality|Career Positioning|Skills Gap|Personal Branding|Networking|Certifications>",
      "suggestion": "<specific advice for this person's background>",
      "why": "<why this matters for their career>"
    }}
  ],
  "next_grade_roadmap": "<2-3 sentences on exactly what this candidate needs to reach the next letter grade>",
  "salary_insight": "<one sentence salary range for this profile based on experience level>"
}}

Resume text:
---
{safe_text}
---"""


# ── Pydantic models ───────────────────────────────────────────────────────────

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

    @field_validator("keywords", "formatting", "experience", "skills", "education", mode="before")
    @classmethod
    def coerce_int(cls, v: Any) -> int:
        return max(0, min(20, int(float(v))))


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

    @field_validator("ats_score", mode="before")
    @classmethod
    def coerce_score(cls, v: Any) -> int:
        return max(0, min(100, int(float(v))))


# ── Fallback ──────────────────────────────────────────────────────────────────

def get_fallback_analysis(
    filename: str, file_size_kb: float, word_count: int,
    processing_time_ms: int, job_title: str,
    error_detail: str = ""
) -> dict[str, Any]:
    msg = (
        f"Analysis failed: {error_detail}. Your resume was successfully parsed."
        if error_detail
        else "Demo mode — Gemini API key not configured. Your resume was parsed. Add GEMINI_API_KEY to enable real AI analysis."
    )
    return {
        "ats_score": 65,
        "grade": "C+",
        "summary": msg,
        "sections_found": {"contact": True, "summary": False, "experience": True, "education": True, "skills": True, "certifications": False},
        "category_scores": {"keywords": 12, "formatting": 14, "experience": 13, "skills": 12, "education": 14},
        "strengths": [
            "Resume is machine-readable — text extracted successfully",
            "PDF format is compatible with major ATS systems",
            "File size is within the optimal range",
        ],
        "critical_issues": [{"issue": "AI analysis unavailable", "impact": "High", "fix": "Ensure GEMINI_API_KEY is set and valid on the server."}],
        "missing_keywords": ["Python", "API", "Cloud", "Agile", "Docker"],
        "quick_wins": ["Ensure Gemini API key is configured", "Add a professional summary section", "Quantify achievements with numbers"],
        "improved_summary": "Results-driven professional with demonstrated expertise in their field. Proven track record of delivering measurable outcomes and collaborating cross-functionally. Seeking to leverage skills in a high-impact role.",
        "verdict": "Needs Improvement",
        "interview_tips": [
            "Tell me about yourself — prepare a 90-second pitch covering your background and key wins.",
            "Describe a challenge you overcame — use the STAR method (Situation, Task, Action, Result).",
            "Research the company thoroughly before your interview.",
        ],
        "score_improvement_plan": [
            {"action": "Add quantified achievements", "detail": "Replace vague bullets with metrics (e.g. 'increased sales by 30%')", "score_boost": "+8 to +12 points", "priority": "High"},
            {"action": "Add professional summary", "detail": "Write a 3-sentence ATS-optimized summary at the top", "score_boost": "+5 to +8 points", "priority": "High"},
        ],
        "professional_suggestions": [
            {"category": "Resume Format", "suggestion": "Use a single-column ATS-friendly layout with standard section headers.", "why": "Multi-column layouts confuse ATS parsers and cause auto-rejection."},
            {"category": "Personal Branding", "suggestion": "Add a LinkedIn URL matching your resume.", "why": "Recruiters verify candidates on LinkedIn before reaching out."},
        ],
        "next_grade_roadmap": "To reach the next grade, quantify achievements, add a strong professional summary, and include industry-specific keywords.",
        "salary_insight": "Enable real AI analysis for salary insights tailored to your profile.",
        "word_count": word_count,
        "processing_time_ms": processing_time_ms,
        "filename": filename,
        "file_size_kb": file_size_kb,
        "job_title": job_title,
    }


# ── Gemini helpers ────────────────────────────────────────────────────────────

def extract_json_from_text(text: str) -> str:
    """
    Robustly extract the first complete JSON object from a string.
    Handles: raw JSON, ```json fences, trailing text after JSON.
    """
    text = text.strip()

    # Strip markdown fences
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```\s*$", "", text)
        text = text.strip()

    # If it starts with {, find the matching closing brace
    if text.startswith("{"):
        depth = 0
        in_string = False
        escape_next = False
        for i, ch in enumerate(text):
            if escape_next:
                escape_next = False
                continue
            if ch == "\\" and in_string:
                escape_next = True
                continue
            if ch == '"':
                in_string = not in_string
                continue
            if in_string:
                continue
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    return text[: i + 1]

    # Fallback: find first { ... } block in the string
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        return match.group(0)

    return text


async def call_gemini(resume_text: str, job_title: str) -> dict[str, Any]:
    prompt = build_prompt(resume_text, job_title)
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0,      # deterministic — same resume = same score
            "maxOutputTokens": 8192,
        },
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"{GEMINI_URL}?key={GEMINI_API_KEY}", json=payload
        )
        if response.status_code != 200:
            logger.error("Gemini HTTP %s: %s", response.status_code, response.text[:500])
        response.raise_for_status()
        data = response.json()

    # Skip internal thought parts (thought=True), use first real text part
    parts = data["candidates"][0]["content"].get("parts", [])
    raw_text = ""
    for part in parts:
        if part.get("thought"):          # skip thinking tokens
            continue
        text = part.get("text", "").strip()
        if text:
            raw_text = text
            break

    if not raw_text:
        raise ValueError("Gemini returned no text content")

    logger.info("Gemini response length: %d chars", len(raw_text))
    json_str = extract_json_from_text(raw_text)
    return json.loads(json_str)


# ── Routes ────────────────────────────────────────────────────────────────────

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

    # Validate file type
    filename = (file.filename or "").strip()
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    # Read and validate size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds the 5MB limit.")

    file_size_kb = round(len(content) / 1024, 2)
    job_title_clean = (job_title or "").strip()

    # Parse PDF
    try:
        doc = fitz.open(stream=content, filetype="pdf")
        pages_text = [page.get_text() for page in doc]
        doc.close()
        resume_text = "\n".join(pages_text).strip()
    except Exception as e:
        logger.error("PDF parse error: %s", e)
        raise HTTPException(
            status_code=422,
            detail="Could not parse this PDF. Make sure it is a text-based PDF, not a scanned image.",
        )

    if len(resume_text) < 50:
        raise HTTPException(
            status_code=422,
            detail="This PDF appears to be a scanned image or contains no readable text. Please upload a text-based PDF.",
        )

    word_count = len(resume_text.split())
    logger.info("Resume parsed: %d words, %.1f KB", word_count, file_size_kb)

    # No API key — return fallback
    if not GEMINI_API_KEY:
        logger.warning("GEMINI_API_KEY not configured — returning fallback")
        return get_fallback_analysis(
            filename, file_size_kb, word_count,
            int((time.time() - start_time) * 1000), job_title_clean,
        )

    # Call Gemini
    error_detail = ""
    try:
        analysis = await call_gemini(resume_text, job_title_clean)
    except json.JSONDecodeError as e:
        error_detail = f"AI returned malformed JSON ({e})"
        logger.error("JSON decode error: %s", e)
        analysis = None
    except Exception as e:
        error_detail = str(e)[:120]
        logger.error("Gemini call failed: %s", e)
        analysis = None

    if analysis is None:
        return get_fallback_analysis(
            filename, file_size_kb, word_count,
            int((time.time() - start_time) * 1000), job_title_clean,
            error_detail,
        )

    # Patch in server-side fields
    processing_time_ms = int((time.time() - start_time) * 1000)
    analysis.setdefault("interview_tips", [])
    analysis.setdefault("score_improvement_plan", [])
    analysis.setdefault("professional_suggestions", [])
    analysis.setdefault("next_grade_roadmap", "")
    analysis.setdefault("salary_insight", "")
    analysis["word_count"] = word_count
    analysis["processing_time_ms"] = processing_time_ms
    analysis["filename"] = filename
    analysis["file_size_kb"] = file_size_kb
    analysis["job_title"] = job_title_clean

    # Ensure ats_score is consistent with category_scores sum
    cat = analysis.get("category_scores", {})
    computed = sum(int(float(v)) for v in cat.values()) if cat else 0
    if computed > 0 and abs(computed - int(float(analysis.get("ats_score", 0)))) > 2:
        logger.warning("ats_score mismatch: reported=%s computed=%s — using computed",
                       analysis.get("ats_score"), computed)
        analysis["ats_score"] = computed

    return analysis
