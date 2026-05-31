import os
import json
import time
import fitz  # PyMuPDF
import httpx
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="AI Resume Analyzer API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

GEMINI_PROMPT = """You are an expert ATS (Applicant Tracking System) resume analyzer with deep knowledge of how Workday, Taleo, Greenhouse and Lever parse and score resumes.

Analyze the resume text provided and return a JSON response with EXACTLY this structure — no extra text, no markdown, just valid JSON:

{
  "ats_score": <number 0-100>,
  "grade": "<A+|A|B+|B|C+|C|D|F>",
  "summary": "<2-3 sentence overall assessment>",
  "sections_found": {
    "contact": <true/false>,
    "summary": <true/false>,
    "experience": <true/false>,
    "education": <true/false>,
    "skills": <true/false>,
    "certifications": <true/false>
  },
  "category_scores": {
    "keywords": <0-20>,
    "formatting": <0-20>,
    "experience": <0-20>,
    "skills": <0-20>,
    "education": <0-20>
  },
  "strengths": [
    "<specific strength 1>",
    "<specific strength 2>",
    "<specific strength 3>"
  ],
  "critical_issues": [
    {
      "issue": "<issue title>",
      "impact": "<High|Medium|Low>",
      "fix": "<exact actionable fix>"
    }
  ],
  "missing_keywords": [
    "<keyword 1>",
    "<keyword 2>",
    "<keyword 3>",
    "<keyword 4>",
    "<keyword 5>"
  ],
  "quick_wins": [
    "<quick fix 1 — can do in 5 minutes>",
    "<quick fix 2>",
    "<quick fix 3>"
  ],
  "improved_summary": "<rewritten professional summary for this person based on their experience>",
  "verdict": "<Highly Recommended|Recommended|Needs Improvement|Major Revision Required>"
}"""


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
    word_count: int
    processing_time_ms: int
    filename: str
    file_size_kb: float


def get_fallback_analysis(filename: str, file_size_kb: float, word_count: int, processing_time_ms: int) -> dict[str, Any]:
    return {
        "ats_score": 65,
        "grade": "C+",
        "summary": "Demo mode: Gemini API is not configured. This is a sample analysis. Your resume was successfully parsed and contains readable content. Configure GEMINI_API_KEY for real AI analysis.",
        "sections_found": {
            "contact": True,
            "summary": False,
            "experience": True,
            "education": True,
            "skills": True,
            "certifications": False,
        },
        "category_scores": {
            "keywords": 12,
            "formatting": 14,
            "experience": 13,
            "skills": 12,
            "education": 14,
        },
        "strengths": [
            "Resume was successfully parsed — text is machine-readable",
            "File size is within optimal range for ATS systems",
            "PDF format is ATS-compatible",
        ],
        "critical_issues": [
            {
                "issue": "Gemini API not configured",
                "impact": "High",
                "fix": "Set the GEMINI_API_KEY environment variable to enable real AI analysis.",
            }
        ],
        "missing_keywords": ["Python", "API", "Cloud", "Agile", "Docker"],
        "quick_wins": [
            "Add GEMINI_API_KEY to enable real analysis",
            "Ensure contact section includes LinkedIn URL",
            "Add a professional summary section at the top",
        ],
        "improved_summary": "Experienced professional with a strong background in their field. Demonstrated ability to deliver results and collaborate effectively. Seeking opportunities to leverage expertise and drive meaningful impact.",
        "verdict": "Needs Improvement",
        "word_count": word_count,
        "processing_time_ms": processing_time_ms,
        "filename": filename,
        "file_size_kb": file_size_kb,
    }


async def call_gemini(resume_text: str) -> dict[str, Any]:
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": GEMINI_PROMPT + "\n\nResume text:\n" + resume_text}
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 2048,
        },
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{GEMINI_URL}?key={GEMINI_API_KEY}",
            json=payload,
        )
        response.raise_for_status()
        data = response.json()

    raw_text = data["candidates"][0]["content"]["parts"][0]["text"]

    # Strip markdown code fences if present
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```", 2)[1]
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
        cleaned = cleaned.rsplit("```", 1)[0].strip()

    return json.loads(cleaned)


@app.get("/")
async def root() -> dict[str, str]:
    return {"name": "AI Resume Analyzer API", "version": "1.0.0", "status": "healthy"}


@app.get("/health")
async def health() -> dict[str, Any]:
    return {"status": "healthy", "gemini_configured": bool(GEMINI_API_KEY)}


@app.post("/analyze", response_model=AnalysisResult)
async def analyze(file: UploadFile = File(...)) -> dict[str, Any]:
    start_time = time.time()

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    content = await file.read()

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File exceeds 5MB limit.")

    file_size_kb = round(len(content) / 1024, 2)

    try:
        doc = fitz.open(stream=content, filetype="pdf")
        resume_text = ""
        for page in doc:
            resume_text += page.get_text()
        doc.close()
    except Exception:
        raise HTTPException(status_code=422, detail="Could not parse PDF. Ensure it is a valid, text-based PDF.")

    word_count = len(resume_text.split())

    processing_time_ms = int((time.time() - start_time) * 1000)

    if not GEMINI_API_KEY:
        return get_fallback_analysis(file.filename, file_size_kb, word_count, processing_time_ms)

    try:
        analysis = await call_gemini(resume_text)
    except Exception:
        return get_fallback_analysis(file.filename, file_size_kb, word_count, processing_time_ms)

    processing_time_ms = int((time.time() - start_time) * 1000)

    analysis["word_count"] = word_count
    analysis["processing_time_ms"] = processing_time_ms
    analysis["filename"] = file.filename
    analysis["file_size_kb"] = file_size_kb

    return analysis
