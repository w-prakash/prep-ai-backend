import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

app.post("/ai/evaluate", async (req, res) => {
  try {
    const { role, question, userAnswer } = req.body;

    console.log("REQ BODY:", req.body);

    const prompt = `
You are an interview coach for a ${role} developer.

Question:
${question}

User Answer:
${userAnswer}

Respond ONLY in strict JSON like this:
{
  "feedback": "short feedback string",
  "improvedAnswer": "correct or improved answer",
  "explanation": "detailed step-by-step explanation of the correct concept",
  "score": 0,
  "topic": "string"
}
`;

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2
    });

    const text = completion.choices[0].message.content.trim();

    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      console.error("Raw AI response:", text);
      return res.status(500).json({ error: "AI returned invalid JSON" });
    }

    res.json(json);

  } catch (err) {
    console.error("AI error:", err);
    res.status(500).json({ error: "AI evaluation failed" });
  }
});
app.post("/ai/question", async (req, res) => {
  try {
    const { role, difficulty, topic } = req.body;

    console.log("QUESTION REQ:", req.body);

    const prompt = `
You are an interview coach.

Generate ONE ${difficulty} level interview question for a ${role} developer.
${topic ? `The question MUST be strictly from the topic: ${topic}.` : ''}

Rules:
- Return ONLY strict JSON

JSON format:
{
  "question": "string",
  "topic": "string"
}
`;

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4
    });

    const text = completion.choices[0].message.content.trim();

    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      console.error("Raw question AI response:", text);
      return res.status(500).json({ error: "AI returned invalid JSON" });
    }

    res.json(json);

  } catch (err) {
    console.error("AI question error:", err);
    res.status(500).json({ error: "AI question generation failed" });
  }
});
app.post("/ai/mcq-question", async (req, res) => {
  try {
    const { role, difficulty, topic } = req.body;

    console.log("MCQ REQ:", req.body);

    const prompt = `
You are an interview coach.

Generate ONE ${difficulty} level multiple-choice interview question for a ${role} developer.
${topic ? `The question MUST be strictly from the topic: ${topic}.` : ''}
Rules:
- Return ONLY strict JSON
- Exactly 4 options
- One correct answer
- The correct answer MUST be one of the options
- Do NOT return A/B/C/D
- Return the actual correct option text
- ALSO provide a  explanation of why this option is correct

JSON format:
{
  "question": "string",
  "options": ["opt1", "opt2", "opt3", "opt4"],
  "correctAnswer": "opt2",
  "topic": "string",
  "explanation": "brief 2-5 sentence explanation"
}
`;

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4
    });

    const text = completion.choices[0].message.content.trim();

    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      console.error("Raw MCQ AI response:", text);
      return res.status(500).json({ error: "AI returned invalid JSON" });
    }

    // 🔥 Normalize correct answer → index
    const correctIndex = json.options.findIndex(
      (opt) => opt.trim() === json.correctAnswer.trim()
    );

    if (correctIndex === -1) {
      console.error("Correct answer not in options:", json);
      return res.status(500).json({ error: "Correct answer mismatch" });
    }

    // 🔥 SEND EXPLANATION ALSO
    res.json({
      question: json.question,
      options: json.options,
      correctIndex,
      topic: json.topic,
      explanation: json.explanation || `The correct answer is "${json.correctAnswer}".`
    });

  } catch (err) {
    console.error("MCQ AI error:", err);
    res.status(500).json({ error: "MCQ generation failed" });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("AI server running on port", PORT);
});

// 🔥 Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/ai/explain", async (req, res) => {
  try {
    const { topic, role } = req.body;

    console.log("EXPLAIN REQ:", req.body);

    const prompt = `
You are an interview coach.

Explain the topic "${topic}" for a ${role} developer.

Give:
- Simple explanation
- Key points (bullet format)
- One small example if applicable
- 2 interview tips

Respond ONLY in plain text, well formatted.
`;

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3
    });

    const text = completion.choices[0].message.content.trim();

    res.json({
      topic,
      explanation: text
    });

  } catch (err) {
    console.error("Explain AI error:", err);
    res.status(500).json({ error: "Explain failed" });
  }
});


// app.listen(3000, () => {
//   console.log("AI server running on http://localhost:3000");
// });
