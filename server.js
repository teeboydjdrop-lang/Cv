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

function sendJsonError(res, status, error, details = "") {
  return res.status(status).json({
    error,
    ...(details ? { details } : {})
  });
}

console.log("Server directory:", __dirname);
console.log(
  "Index file:",
  findIndexFile() || "NOT FOUND"
);

/* =====================================================
   STATIC FILES
===================================================== */

app.use(express.static(__dirname));

if (
  fs.existsSync(
    path.join(__dirname, "..", "public")
  )
) {
  app.use(
    express.static(
      path.join(__dirname, "..", "public")
    )
  );
}

if (
  fs.existsSync(
    path.join(process.cwd(), "public")
  )
) {
  app.use(
    express.static(
      path.join(process.cwd(), "public")
    )
  );
}

/* =====================================================
   HOME PAGE
===================================================== */

app.get("/", (req, res) => {
  const file = findIndexFile();

  if (!file) {
    return res.status(404).send(`
      <h1>Classic Voice</h1>
      <p>index.html was not found.</p>
      <p>Server directory: ${__dirname}</p>
    `);
  }

  res.sendFile(file);
});

/* =====================================================
   HEALTH CHECK
===================================================== */

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Classic Voice",
    model: "s2-pro-free",
    indexFound: !!findIndexFile()
  });
});

/* =====================================================
   FISH AUDIO TEXT TO SPEECH
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
      return sendJsonError(
        res,
        400,
        "Text is required"
      );
    }

    /* -----------------------------------------------
       FISH API KEY
       Stored ONLY in Render Environment Variables
    ------------------------------------------------ */

    const apiKey =
      process.env.FISH_API_KEY;

    if (!apiKey) {
      console.error(
        "FISH_API_KEY is missing."
      );

      return sendJsonError(
        res,
        500,
        "FISH_API_KEY is not configured in Render Environment Variables"
      );
    }

    /* -----------------------------------------------
       REFERENCE ID
    ------------------------------------------------ */

    const referenceId =
      reference_id ||
      process.env.FISH_REFERENCE_ID ||
      "7e0f9863dea0412496e52691f1365d06";

    console.log(
      "TTS request received"
    );

    console.log(
      "Reference ID:",
      referenceId
    );

    console.log(
      "Model: s2-pro-free"
    );

    /* -----------------------------------------------
       FISH AUDIO REQUEST
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