const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

loadEnv();

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";
const ROOT = __dirname;
const MAIL_TO = process.env.MAIL_TO || "ghighielsa@gmail.com";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/api/confirm") {
      await handleConfirmation(request, response);
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }

    serveStatic(request, response);
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: "Internal server error" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Invitation Lennon prête sur http://${HOST}:${PORT}`);
});

async function handleConfirmation(request, response) {
  const body = await readJson(request);
  const confirmation = {
    nom: String(body.nom || "").trim(),
    prenom: String(body.prenom || "").trim(),
    personnes: String(body.personnes || "").trim(),
    telephone: String(body.telephone || "").trim()
  };

  if (!confirmation.nom || !confirmation.prenom || !confirmation.personnes || !confirmation.telephone) {
    sendJson(response, 400, { error: "Tous les champs sont obligatoires." });
    return;
  }

  const confirmedAt = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Paris"
  }).format(new Date());

  const text = [
    "Nouvelle confirmation pour la Bar Mitsvah de Lennon Lillo.",
    "",
    `Nom : ${confirmation.nom}`,
    `Prénom : ${confirmation.prenom}`,
    `Nombre de personnes : ${confirmation.personnes}`,
    `Téléphone : ${confirmation.telephone}`,
    "",
    `Date de confirmation : ${confirmedAt}`
  ].join("\n");

  await sendConfirmationEmail(text);

  sendJson(response, 200, { ok: true });
}

function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);
  const cleanPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(ROOT, cleanPath));

  if (!filePath.startsWith(ROOT)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    const ext = path.extname(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": ext === ".html" ? "no-store" : "public, max-age=3600"
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    response.end(content);
  });
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let raw = "";

    request.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 25_000) {
        reject(new Error("Payload too large"));
        request.destroy();
      }
    });

    request.on("end", () => {
      try {
        resolve(JSON.parse(raw || "{}"));
      } catch (error) {
        reject(error);
      }
    });

    request.on("error", reject);
  });
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

async function sendConfirmationEmail(text) {
  const subject = "Nouvelle confirmation — Bar Mitsvah Lennon Lillo";

  if (process.env.RESEND_API_KEY) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM,
        to: [MAIL_TO],
        subject,
        text
      })
    });

    if (!response.ok) {
      throw new Error(`Resend a refusé l'envoi : ${response.status}`);
    }
    return;
  }

  if (process.env.FORMSPREE_ENDPOINT) {
    const response = await fetch(process.env.FORMSPREE_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: MAIL_TO,
        subject,
        message: text
      })
    });

    if (!response.ok) {
      throw new Error(`Formspree a refusé l'envoi : ${response.status}`);
    }
    return;
  }

  throw new Error("Configuration email manquante : RESEND_API_KEY ou FORMSPREE_ENDPOINT");
}

function loadEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}
