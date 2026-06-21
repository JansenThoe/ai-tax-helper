# AI Tax Helper

An AI-powered tool that analyzes tax and financial documents, answers your questions, and gives you step-by-step instructions on where to enter values on IRS forms.

---

## Features

| Input | Output |
|---|---|
| Upload PDFs, images, text files (W-2, 1099, receipts, etc.) | Extracted financial data table |
| Your tax question (e.g. "How much did I spend on travel?") | Direct answer citing document + section |
| Tax profile (filing status, state) | Step-by-step IRS form instructions |

---

## Quick Start

### 1. Install Node.js

Download from https://nodejs.org (LTS version recommended).

Verify installation:
```bash
node -v   # should print v18 or higher
npm -v
```

### 2. Get a Gemini API Key

1. Go to https://aistudio.google.com/apikey
2. Create a free API key
3. Copy it

### 3. Set Up the Project

```bash
# Clone or download this project, then:
cd "USAII Project 2026"
npm install

# Create your .env file from the template
cp .env.example .env
```

Open `.env` and paste your API key:
```
GEMINI_API_KEY=your_actual_key_here
PORT=3000
```

### 4. Run the App

```bash
npm start
```

Then open your browser to: **http://localhost:3000**

---

## How It Works

```
Start
  │
  ▼
User uploads documents + asks question + provides tax profile
  │
  ▼
Server sends documents + question to Gemini 2.5 Flash (via secure backend proxy)
  │
  ▼
Gemini extracts data, answers the question, and generates IRS form instructions
  │
  ▼
Results displayed in 3 tabs:
  ├─ 📊 Extracted Data   — table of values pulled from documents
  ├─ 💬 Direct Answer    — plain-English answer citing sources
  └─ 📋 Instructions     — which form, which line, which value to enter
```

---

## File Structure

```
├── server.js          # Express backend — Gemini API calls happen here
├── public/
│   ├── index.html     # Main UI
│   ├── app.js         # Frontend logic
│   └── styles.css     # Styling
├── .env               # Your API key (never commit this)
├── .env.example       # Template
└── package.json
```

---

## Supported File Types

- PDF (`.pdf`)
- Images: PNG, JPG/JPEG, WEBP
- Text/CSV (`.txt`, `.csv`)
- Max 20 MB per file, up to 10 files

---

## Notes

- The API key is kept on the server — it is never exposed to the browser.
- This tool is powered by [Gemini 2.5 Flash](https://ai.google.dev/).
- **Not a substitute for professional tax advice.** Always verify with a qualified CPA or tax professional.
