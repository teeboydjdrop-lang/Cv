const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();

/* =====================================================
   MIDDLEWARE
===================================================== */

app.use(cors());

app.use(
  express.json({
    limit: "1mb"
  })
);

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

/* =====================================================
   STARTUP LOG
===================================================== */

console.log("=================================");
console.log("CLASSIC VOICE BACKEND");
console.log("=================================");
console.log("Server directory:", __dirname);
console.log(
  "Index file:",
  findIndexFile() || "NOT FOUND"
);
console.log("Fish Audio model: s2-pro-free");
console.log("=================================");

/* =====================================================
   STATIC FILES
===================================================== */

app.use(express.static(__dirname));

const parentPublic = path.join(
  __dirname,
  "..",
  "public"
);

if (fs.existsSync(parentPublic)) {
  app.use(
    express.static(parentPublic)
  );
}

const currentPublic = path.join(
  process.cwd(),
  "public"
);

if (fs.existsSync(currentPublic)) {
  app.use(
    express.static(currentPublic)
  );
}

/* =====================================================
   HOME PAGE
===================================================== */

app.get("/", (req, res) => {
  const file = findIndexFile();

  if (!file) {
    return res.status(404).send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Classic Voice</title>
</head>
<body>
  <h1>Classic Voice</h1>
  <p>index.html was not found.</p>
  <p>Server directory: ${__dirname}</p>
</body>
</html>
    `);
  }

  return res.sendFile(file);
});

/* =====================================================
   HEALTH CHECK
===================================================== */

app.get("/health", (req, res) => {
  return res.json({
    status: "ok",
    service: "Classic Voice",
    model: "s2-pro-free",
    indexFound: !!findIndexFile()
  });
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
    } = req.body || {};

    /* -----------------------------------------------
       CHECK TEXT
    ------------------------------------------------ */

    if (
      typeof text !== "string" ||
      !text.trim()
    ) {
      return res.status(400).json({
        error: "Text is required"
      });
    }

    /* -----------------------------------------------
       FISH AUDIO API KEY
       Keep this ONLY in Render Environment Variables.
    ------------------------------------------------ */

    const apiKey =
      process.env.FISH_API_KEY;

    if (!apiKey) {
      console.error(
        "ERROR: FISH_API_KEY is missing."
      );

      return res.status(500).json({
        error:
          "FISH_API_KEY is not configured in Render Environment Variables"
      });
    }

    /* -----------------------------------------------
       REFERENCE ID
    ------------------------------------------------ */

    const referenceId =
      reference_id ||
      process.env.FISH_REFERENCE_ID ||
      "7e0f9863dea0412496e52691f1365d06";

    console.log("---------------------------------");
    console.log("TTS REQUEST RECEIVED");
    console.log("Reference ID:", referenceId);
    console.log("Model: s2-pro-free");
    console.log(
      "Text length:",
      text.trim().length
    );
    console.log("---------------------------------");

    /* -----------------------------------------------
       SEND REQUEST TO FISH AUDIO
    ------------------------------------------------ */

    const fishResponse = await fetch(
      "https://api.fish.audio/v1/tts",
      {
        method: "POST",

        headers: {
          "Authorization":
            `Bearer ${apiKey}`,

          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          text: text.trim(),

          reference_id:
            referenceId,

          model:
            "s2-pro-free",

          temperature:
            0.7,

          top_p:
            0.7,

          prosody: {
            speed:
              Number(speed) || 1,

            volume:
              Number(volume) || 0,

            normalize_loudness:
              true
          },

          chunk_length:
            300,

          normalize:
            true,

          format:
            "mp3",

          sample_rate:
            44100,

          mp3_bitrate:
            192
        })
      }
    );

    /* -----------------------------------------------
       FISH AUDIO ERROR
    ------------------------------------------------ */

    if (!fishResponse.ok) {
      const errorText =
        await fishResponse.text();

      console.error(
        "================================="
      );

      console.error(
        "FISH AUDIO ERROR"
      );

      console.error(
        "HTTP STATUS:",
        fishResponse.status
      );

      console.error(
        "RESPONSE:",
        errorText
      );

      console.error(
        "================================="
      );

      return res.status(
        fishResponse.status
      ).json({
        error:
          "Fish Audio request failed",

        details:
          errorText
      });
    }

    /* -----------------------------------------------
       GET AUDIO
    ------------------------------------------------ */

    const audioArrayBuffer =
      await fishResponse.arrayBuffer();

    const audioBuffer =
      Buffer.from(
        audioArrayBuffer
      );

    if (!audioBuffer.length) {
      console.error(
        "Fish Audio returned empty audio."
      );

      return res.status(502).json({
        error:
          "Fish Audio returned an empty audio file"
      });
    }

    console.log(
      "Audio generated successfully:",
      audioBuffer.length,
      "bytes"
    );

    /* -----------------------------------------------
       RETURN MP3 TO CLASSIC VOICE
    ------------------------------------------------ */

    res.set({
      "Content-Type":
        "audio/mpeg",

      "Content-Length":
        audioBuffer.length,

      "Cache-Control":
        "no-store"
    });

    return res.send(
      audioBuffer
    );

  } catch (error) {
    console.error(
      "================================="
    );

    console.error(
      "TTS SERVER ERROR"
    );

    console.error(
      error
    );

    console.error(
      "================================="
    );

    return res.status(500).json({
      error:
        "TTS generation failed",

      details:
        error.message
    });
  }
});

/* =====================================================
   404 HANDLER
===================================================== */

app.use((req, res) => {
  return res.status(404).json({
    error: "Route not found",
    path: req.path
  });
});

/* =====================================================
   START SERVER
===================================================== */

const PORT =
  process.env.PORT || 10000;

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      "================================="
    );

    console.log(
      `Classic Voice running on port ${PORT}`
    );

    console.log(
      `Port: ${PORT}`
    );

    console.log(
      "Fish Audio model: s2-pro-free"
    );

    console.log(
      "================================="
    );
  }
);