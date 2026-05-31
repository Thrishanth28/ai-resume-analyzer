# AI Resume Analyzer

A professional full-stack AI-powered resume analyzer that scores your resume against ATS systems, finds critical issues, and provides exact fixes to land more interviews.

**Tech Stack:** Next.js 14 · TypeScript · Tailwind CSS · FastAPI · Google Gemini 1.5 Flash · PyMuPDF

---

## Project Structure

```
resume-analyzer/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/app/
    │   ├── layout.tsx
    │   ├── globals.css
    │   └── page.tsx
    ├── next.config.js
    ├── package.json
    ├── tailwind.config.ts
    └── .env.example
```

---

## Local Development

### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
source venv/bin/activate     # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Set your Gemini API key
copy .env.example .env       # Windows
cp .env.example .env         # Mac/Linux
# Edit .env and add: GEMINI_API_KEY=your_key_here

# Run
uvicorn main:app --reload
# API available at http://localhost:8000
```

Get a free Gemini API key at: https://aistudio.google.com/app/apikey

### Frontend

```bash
cd frontend

npm install

# Set backend URL
copy .env.example .env.local    # Windows
cp .env.example .env.local      # Mac/Linux
# Edit .env.local: NEXT_PUBLIC_API_URL=http://localhost:8000

npm run dev
# App available at http://localhost:3000
```

---

## Deployment

### Backend → Render

1. Create a new **Web Service** on [render.com](https://render.com)
2. Connect your GitHub repo, set root directory to `backend/`
3. Configure:
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Add environment variable: `GEMINI_API_KEY` = your key
5. Deploy — note the public URL (e.g. `https://ai-resume-api.onrender.com`)

### Frontend → Vercel

1. Import repo on [vercel.com](https://vercel.com)
2. Set **Root Directory** to `frontend/`
3. Add environment variable:
   - `NEXT_PUBLIC_API_URL` = your Render backend URL
4. Deploy

---

## API Reference

| Method | Endpoint  | Description              |
|--------|-----------|--------------------------|
| GET    | `/`       | API info + health status |
| GET    | `/health` | Gemini configuration check |
| POST   | `/analyze`| Analyze a PDF resume     |

### POST /analyze

**Request:** `multipart/form-data` with `file` (PDF, max 5MB)

**Response:**
```json
{
  "ats_score": 82,
  "grade": "A",
  "summary": "Strong resume with good keyword density...",
  "sections_found": { "contact": true, "experience": true, ... },
  "category_scores": { "keywords": 17, "formatting": 18, ... },
  "strengths": ["Clear work history timeline", ...],
  "critical_issues": [{ "issue": "No LinkedIn URL", "impact": "High", "fix": "..." }],
  "missing_keywords": ["Docker", "CI/CD", ...],
  "quick_wins": ["Add LinkedIn profile URL", ...],
  "improved_summary": "Results-driven software engineer...",
  "verdict": "Highly Recommended",
  "word_count": 412,
  "processing_time_ms": 2341,
  "filename": "resume.pdf",
  "file_size_kb": 148.3
}
```

---

## Features

- **Instant ATS Score (0–100)** with animated circular meter
- **Letter Grade** (A+ through F)
- **5 Category Scores** — Keywords, Formatting, Experience, Skills, Education
- **Section Detection** — checks for all 6 key resume sections
- **Critical Issues** sorted by impact (High → Medium → Low)
- **Missing Keywords** as interactive pills
- **Quick Wins** — fixes actionable in 30 minutes
- **AI-Rewritten Summary** with one-click copy
- Graceful fallback when Gemini API is unavailable (demo mode)

---

Built by S. Thrishanth Reddy · Powered by Google Gemini AI
