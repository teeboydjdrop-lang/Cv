const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Serve your Classic Voice website
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Text-to-speech
app.post("/tts", async (req, res) => {
  try {
    const { text, reference_id, speed, volume } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({
        error: "Text is required"
      });
    }

    if (!process.env.FISH_API_KEY) {
      return res.status(500).json({
        error: "FISH_API_KEY is not configured"
      });
    }

    const fishResponse = await fetch(
      "https://api.fish.audio/v1/tts",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.FISH_API_KEY}`,
          "Content-Type": "application/json",
          "model": "s2.1-pro-free"
        },
        body: JSON.stringify({
          text: text.trim(),
          reference_id:
            reference_id || process.env.FISH_REFERENCE_ID,

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
          mp3_bitrate: 192,
          latency: "normal",
          max_new_tokens: 1024,
          repetition_penalty: 1.2,
          min_chunk_length: 50,
          condition_on_previous_chunks: true,
          early_stop_threshold: 1
        })
      }
    );

    if (!fishResponse.ok) {
      const errorText = await fishResponse.text();

      return res.status(fishResponse.status).json({
        error: "Fish Audio request failed",
        details: errorText
      });
    }

    const audioBuffer = Buffer.from(
      await fishResponse.arrayBuffer()
    );

    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": audioBuffer.length,
      "Cache-Control": "no-store"
    });

    res.send(audioBuffer);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "TTS generation failed",
      details: error.message
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Classic Voice running on port ${PORT}`);
});