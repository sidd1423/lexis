const express = require("express");
const fetch = require("node-fetch"); // only needed if Node < 18
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public"))); // serve front-end files

// API endpoint proxy
app.post("/api/analyze", async (req, res) => {
  const { text, mode } = req.body;

  if (!text) return res.status(400).json({ error: "No text provided" });

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
          generationConfig: { maxOutputTokens: 1400, temperature: 0.3 },
        }),
      }
    );

    const data = await response.json();
    res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));