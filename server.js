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

app.post("/ai/quiz-topic", async (req, res) => {
  try {
    const { topic, role } = req.body;

    console.log("QUIZ TOPIC REQ:", req.body);

    const prompt = `
You are an interview coach.

Generate 5 multiple choice interview questions ONLY about the topic "${topic}" for a ${role} developer.

Rules:
- Return ONLY strict JSON array
- Each question must include:
  - question
  - options (exactly 4)
  - correctIndex (0-3)
  - topic

Format:
[
  {
    "question": "string",
    "options": ["a","b","c","d"],
    "correctIndex": 1,
    "topic": "${topic}"
  }
]
`;

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3
    });

    const text = completion.choices[0].message.content.trim();

    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      console.error("Raw quiz AI response:", text);
      return res.status(500).json({ error: "Invalid quiz JSON" });
    }

    res.json({ questions: json });

  } catch (err) {
    console.error("Quiz topic AI error:", err);
    res.status(500).json({ error: "Quiz generation failed" });
  }
});

app.post("/ai/explain-wrong", async (req, res) => {
  try {
    const { question, options, correctAnswer, userAnswer, role } = req.body;

    const prompt = `
You are an interview coach.

Question:
${question}

Options:
${options.join(", ")}

User selected:
${userAnswer}

Correct answer:
${correctAnswer}

Explain:
- Why the user's answer is wrong
- Why the correct answer is right
- Give a short interview tip

Keep explanation short and clear.
`;

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3
    });

    const text = completion.choices[0].message.content.trim();

    res.json({ explanation: text });

  } catch (err) {
    console.error("Explain wrong error:", err);
    res.status(500).json({ error: "Explain wrong failed" });
  }
});

app.post("/ai/followup", async (req, res) => {
  try {
    const { question, context, userQuery, role } = req.body;

    const prompt = `
You are an interview coach.

Context (previous explanation):
${context}

Original Question:
${question}

User follow-up question:
${userQuery}

Reply clearly and concisely like a tutor.
`;

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3
    });

    const text = completion.choices[0].message.content.trim();

    res.json({ reply: text });

  } catch (err) {
    console.error("Follow-up AI error:", err);
    res.status(500).json({ error: "Follow-up failed" });
  }
});

app.post("/ai/mock-interview/start", async (req, res) => {
  try {
    const { role, difficulty, count } = req.body;

    const prompt = `
You are an interview coach.

Generate ${count} multiple-choice interview questions for a ${role} developer at ${difficulty} level.

Rules:
- Return ONLY strict JSON array
- Each item must contain:
  - question
  - options (exactly 4)
  - correctIndex (0-3)
  - explanation (short explanation of correct answer)
  - topic

Format:
[
  {
    "question": "string",
    "options": ["a","b","c","d"],
    "correctIndex": 1,
    "explanation": "string",
    "topic": "string"
  }
]
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
      console.error("Mock interview JSON error:", text);
      return res.status(500).json({ error: "Invalid interview JSON" });
    }

    res.json({ questions: json });

  } catch (err) {
    console.error("Mock interview start error:", err);
    res.status(500).json({ error: "Mock interview failed" });
  }
});

app.post("/ai/mock-interview/evaluate", async (req, res) => {
  try {
    const { role, answers } = req.body;

    const formatted = answers.map((a, i) => `
Q${i + 1}: ${a.question}
User Answer: ${a.answer}
`).join("\n");

    const prompt = `
You are an interview coach.

Evaluate this mock interview for a ${role} developer.

${formatted}

Give:
- Overall score (0-10)
- Strengths (bullet points)
- Weak areas (bullet points)
- Final interview feedback

Return ONLY strict JSON:
{
  "score": number,
  "strengths": ["string"],
  "weakAreas": ["string"],
  "feedback": "string"
}
`;

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3
    });

    const text = completion.choices[0].message.content.trim();

    let json;
    try {
      json = JSON.parse(text);
    } catch {
      return res.status(500).json({ error: "Invalid evaluation JSON" });
    }

    res.json(json);

  } catch (err) {
    console.error("Mock interview evaluate error:", err);
    res.status(500).json({ error: "Evaluation failed" });
  }
});

// app.listen(3000, () => {
//   console.log("AI server running on http://localhost:3000");
// });
