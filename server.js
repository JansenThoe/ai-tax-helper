require("dotenv").config();
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { GoogleGenAI } = require("@google/genai");

// ── App setup ──────────────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// ── Gemini client (singleton) ──────────────────────────────────────────────
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ── File upload (temp storage, cleared after each request) ────────────────
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB per file
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "text/plain",
      "text/csv",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not supported: ${file.mimetype}`));
    }
  },
});

// ── System prompt (static — placed first for implicit caching) ─────────────
const SYSTEM_PROMPT = `You are an expert US tax advisor assistant. Your role is to:
1. Analyze uploaded financial and tax documents carefully.
2. Extract relevant financial data and values.
3. Answer the user's specific tax question based on the documents.
4. Provide clear instructions on where to enter values on IRS tax forms.

Always structure your response in exactly this JSON format:
{
  "extractedData": [
    { "label": "string describing the value", "value": "string amount or info", "source": "document name or section" }
  ],
  "directAnswer": "A clear, specific answer to the user's question citing document names and sections.",
  "instructions": [
    { "step": 1, "form": "IRS Form name (e.g. Schedule C)", "line": "Line number or field name", "value": "Amount or value to enter", "note": "Any important clarification" }
  ],
  "summary": "A brief 1-2 sentence overall summary of the key finding."
}

Rules:
- Be precise about dollar amounts. Always include the $ sign.
- Reference the exact document name and section/line when citing sources.
- If a value cannot be determined from the documents, say so explicitly.
- Apply tax rules based on the user's filing status and state of residence when provided.
- Do not give advice beyond what the documents support.`;

// ── Helper: convert uploaded file to Gemini inline part ───────────────────
function fileToInlinePart(file) {
  const data = fs.readFileSync(file.path);
  return {
    inlineData: {
      mimeType: file.mimetype,
      data: data.toString("base64"),
    },
  };
}

// ── Helper: clean up temp files ────────────────────────────────────────────
function cleanupFiles(files) {
  if (!files) return;
  files.forEach((f) => {
    try {
      fs.unlinkSync(f.path);
    } catch (_) {
      // ignore cleanup errors
    }
  });
}

// ── POST /api/analyze ──────────────────────────────────────────────────────
app.post("/api/analyze", upload.array("documents", 10), async (req, res) => {
  const files = req.files || [];

  try {
    const { question, filingStatus, stateOfResidence } = req.body;

    if (!question || question.trim().length === 0) {
      cleanupFiles(files);
      return res.status(400).json({ error: "A question is required." });
    }

    if (files.length === 0) {
      cleanupFiles(files);
      return res.status(400).json({ error: "At least one document is required." });
    }

    // Build user context string
    const taxProfile = [
      filingStatus ? `Filing status: ${filingStatus}` : null,
      stateOfResidence ? `State of residence: ${stateOfResidence}` : null,
    ]
      .filter(Boolean)
      .join(", ");

    const profileNote = taxProfile
      ? `\n\nUser tax profile: ${taxProfile}`
      : "";

    // Build document parts
    const documentParts = files.map((file) => fileToInlinePart(file));
    const documentNames = files.map((f) => f.originalname).join(", ");

    // Compose the prompt (dynamic content last — after static system prompt)
    const userPrompt = `Documents provided: ${documentNames}${profileNote}

User question: ${question}

Please analyze the documents and respond in the specified JSON format.`;

    // Call Gemini
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: SYSTEM_PROMPT },
            ...documentParts,
            { text: userPrompt },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    // Validate finish reason before parsing
    const candidate = response.candidates?.[0];
    if (!candidate || candidate.finishReason === "SAFETY") {
      cleanupFiles(files);
      return res.status(422).json({
        error: "The response was blocked for safety reasons. Please review your documents.",
      });
    }

    const rawText = response.text;

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // If JSON parse fails, return raw text wrapped in a fallback shape
      parsed = {
        extractedData: [],
        directAnswer: rawText,
        instructions: [],
        summary: "The AI returned an unstructured response. See the direct answer above.",
      };
    }

    cleanupFiles(files);
    return res.json({ success: true, result: parsed });
  } catch (err) {
    cleanupFiles(files);
    console.error("Gemini error:", err);

    // Surface rate-limit errors clearly
    if (err.status === 429) {
      return res.status(429).json({
        error: "Rate limit reached. Please wait a moment and try again.",
      });
    }

    return res.status(500).json({
      error: err.message || "An unexpected error occurred.",
    });
  }
});

// ── Health check ───────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", model: "gemini-2.5-flash" });
});

// ── Start ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`AI Tax Helper running at http://localhost:${PORT}`);
});
