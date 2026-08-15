const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

/* =====================================================
   FIND INDEX.HTML
===================================================== */

const possibleIndexFiles = [
  path.join(__dirname, "index.html"),
  path.join(__dirname, "..", "index.html"),
  path.join(process.cwd(), "index.html"),
  path.join(process.cwd(), "public", "index.html")
];

function findIndexFile() {
  for (const file of possibleIndexFiles) {
    if (fs.existsSync(file)) {
      return file;
    }
  }
  return null;
}

const indexFile = findIndexFile();

console.log("Server directory:", __dirname);
console.log("Index file:", indexFile || "NOT FOUND");

/* Serve static files */
app.use(express.static(__dirname));

/* Also try common project locations */
if (fs.existsSync(path.join(__dirname, "..", "public"))) {
  app.use(express.static(path.join(__dirname, "..", "public")));
}

if (fs.existsSync(path.join(process.cwd(), "public"))) {
  app.use(express.static(path.join(process.cwd(), "public")));
}

/* =====================================================
   HOME PAGE
===================================================== */

app.get("/", (req, res) => {
  const file = findIndexFile();

  if (!file) {
    return res.status(404).send(`
      <h1>Classic Voice</h1>
      <p>index.html was not found on the server.</p>
      <p>Server directory: ${__dirname}</p>
    `);
  }

  res.sendFile(file);
});

/* =====================================================
   TEXT TO SPEECH
===================================================== */

app.post("/tts", async (req, res) => {
  try {
    const {
      text,
      reference_id,
      speed,
      volume
    } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({
        error: "Text is required"
      });
    }

    const apiKey = process.env.FISH_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "FISH_API_KEY is not configured in Render Environment Variables"
      });
    }

    const referenceId =
      reference_id ||
      process.env.FISH_REFERENCE_ID ||
      "7e0f9863dea0412496e52691f1365d06";

    console.log("TTS request received");
    console.log("Reference ID:", referenceId);

    const fishResponse = await fetch(
      "https://api.fish.audio/v1/tts",
      {
        method: "POST",

        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          text: text.trim(),

          reference_id: referenceId,

          model: "s2.1-pro-free",

          temperature: 0.7,
          top_p: 0.7,

          prosody: {
            speed: Number(speed) || 1,
            volume: Number(volume) || 0,
            normalize_loudness: true
          },

          chunk_length: 300,

          normalize: true,

          format: "mp3",

          sample_rate: 44100,

          mp3_bitrate: 192
        })
      }
    );

    if (!fishResponse.ok) {
      const errorText = await fishResponse.text();

      console.error(
        "Fish Audio error:",
        fishResponse.status,
        errorText
      );

      return res.status(fishResponse.status).json({
        error: "Fish Audio request failed",
        details: errorText
      });
    }

    const audioBuffer = Buffer.from(
      await fishResponse.arrayBuffer()
    );

    console.log(
      "Audio generated:",
      audioBuffer.length,
      "bytes"
    );

    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": audioBuffer.length,
      "Cache-Control": "no-store"
    });

    res.send(audioBuffer);

  } catch (error) {
    console.error("TTS ERROR:", error);

    res.status(500).json({
      error: "TTS generation failed",
      details: error.message
    });
  }
});

/* =====================================================
   HEALTH CHECK
===================================================== */

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Classic Voice",
    indexFound: !!findIndexFile()
  });
});

/* =====================================================
   START SERVER
===================================================== */

const PORT = process.env.PORT || 10000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Classic Voice running on port ${PORT}`
  );
});