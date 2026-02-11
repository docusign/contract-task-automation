import express from "express";
import crypto from "crypto";

const app = express();
app.use(express.json({ limit: "1mb" }));

const {
  BASE_URL,

  MAESTRO_TRIGGER_URL,
  MAESTRO_EVENT_URL,
  MAESTRO_BEARER_TOKEN,

  NOTION_TOKEN,
  NOTION_DATABASE_ID,

  ACTION_TOKEN_SECRET,

  DEVELOPER_NAME = "Your Name",
  DEVELOPER_EMAIL = "you@example.com",
} = process.env;

function must(name, val) {
  if (!val) throw new Error(`Missing env var: ${name}`);
}

// Vercel sets BASE_URL implicitly via request host, but we keep BASE_URL for email links.
// If you *don't* set BASE_URL in Vercel env vars, we’ll infer it from the request.
function getBaseUrl(req) {
  if (BASE_URL) return BASE_URL.replace(/\/$/, "");
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers["host"];
  return `${proto}://${host}`;
}

function hmac(payload) {
  must("ACTION_TOKEN_SECRET", ACTION_TOKEN_SECRET);
  return crypto.createHmac("sha256", ACTION_TOKEN_SECRET).update(payload).digest("hex");
}

function makeActionToken({ bookingId, clientEmail }) {
  const payloadObj = { bookingId, clientEmail, iat: Date.now() };
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString("base64url");
  const sig = hmac(payload);
  return `${payload}.${sig}`;
}

function verifyActionToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  const expected = hmac(payload);
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

  try {
    const obj = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!obj.bookingId || !obj.clientEmail) return null;
    return obj;
  } catch {
    return null;
  }
}

async function startMaestroWorkflow(flatVars) {
  must("MAESTRO_TRIGGER_URL", MAESTRO_TRIGGER_URL);
  must("MAESTRO_BEARER_TOKEN", MAESTRO_BEARER_TOKEN);

  const res = await fetch(MAESTRO_TRIGGER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MAESTRO_BEARER_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(flatVars),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Maestro trigger failed: ${res.status} ${res.statusText} ${text}`);
  }
  return res.json().catch(() => ({}));
}

async function sendMaestroEvent(flatVars) {
  must("MAESTRO_EVENT_URL", MAESTRO_EVENT_URL);
  must("MAESTRO_BEARER_TOKEN", MAESTRO_BEARER_TOKEN);

  const res = await fetch(MAESTRO_EVENT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MAESTRO_BEARER_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(flatVars),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Maestro event failed: ${res.status} ${res.statusText} ${text}`);
  }
}

/**
 * Health check
 */
app.get("/", (req, res) => {
  res.status(200).send("OK - freelance maestro flow");
});

/**
 * Calendly -> Maestro trigger
 * URL on Vercel will be: https://YOUR_APP.vercel.app/webhook/booking
 */
app.post("/webhook/booking", async (req, res) => {
  try {
    const { event, payload } = req.body || {};

    // Calendly: confirmed booking
    if (event !== "invitee.created") {
      return res.status(200).json({ ok: true, ignored: true });
    }

    const invitee = payload?.invitee || {};
    const eventInfo = payload?.event || {};
    const qna = payload?.questions_and_answers || [];

    const getAnswer = (contains) =>
      qna.find((q) => String(q.question || "").toLowerCase().includes(contains))?.answer;

    const clientName = invitee.name || "Client Name";
    const clientEmail = invitee.email || "client@example.com";
    const bookingStartDate = eventInfo.start_time || new Date().toISOString();
    const bookingId = payload?.uri?.split("/").pop() || crypto.randomUUID();

    const packageName = getAnswer("package") || eventInfo.name || "Standard";

    const rawPrice = getAnswer("budget") || getAnswer("price") || "1500";
    const price = Number(String(rawPrice).replace(/[^\d]/g, "")) || 1500;

    const baseUrl = getBaseUrl(req);
    const token = makeActionToken({ bookingId, clientEmail });

    const looksGood = `${baseUrl}/action/looks-good?token=${encodeURIComponent(token)}`;
    const needsEdits = `${baseUrl}/action/needs-edits?token=${encodeURIComponent(token)}`;
    const editsComplete = `${baseUrl}/action/edits-complete?token=${encodeURIComponent(token)}`;

    // Flat vars matching your Maestro variables
    const maestroVars = {
      clientName,
      clientEmail,
      bookingId,
      bookingStartDate,
      packageName,
      developerName: DEVELOPER_NAME,
      developerEmail: DEVELOPER_EMAIL,
      price,

      looksGood,
      needsEdits,
      editsComplete,

      runtimeWorkflowId: "",
      agreementId: "",
      agreementStatus: "sent",
      notionPageId: "",
      notionPageUrl: "",
      editRequest: "",
      needsEdits: "", // if your Maestro expects boolean, set false instead (see note below)
    };

    // If your Maestro variable "needsEdits" is boolean, use:
    // maestroVars.needsEdits = false;

    const maestroResp = await startMaestroWorkflow(maestroVars);
    res.status(200).json({ ok: true, bookingId, maestro: maestroResp });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * Action links -> Maestro events
 */
app.get("/action/looks-good", async (req, res) => {
  try {
    const decoded = verifyActionToken(req.query.token);
    if (!decoded) return res.status(401).send("Invalid or expired token.");

    await sendMaestroEvent({
      bookingId: decoded.bookingId,
      clientEmail: decoded.clientEmail,

      looksGood: true,
      needsEdits: false,
      editRequest: "",
    });

    res.status(200).send("Thanks! Marked as looks good. You can return to your email.");
  } catch (err) {
    console.error(err);
    res.status(500).send(`Error: ${err.message}`);
  }
});

app.get("/action/needs-edits", async (req, res) => {
  try {
    const decoded = verifyActionToken(req.query.token);
    if (!decoded) return res.status(401).send("Invalid or expired token.");

    const note = typeof req.query.note === "string" ? req.query.note : "";

    await sendMaestroEvent({
      bookingId: decoded.bookingId,
      clientEmail: decoded.clientEmail,

      looksGood: false,
      needsEdits: true,
      editRequest: note,
    });

    res.status(200).send("Got it — edits requested. The sender will follow up with an updated agreement.");
  } catch (err) {
    console.error(err);
    res.status(500).send(`Error: ${err.message}`);
  }
});

app.get("/action/edits-complete", async (req, res) => {
  try {
    const decoded = verifyActionToken(req.query.token);
    if (!decoded) return res.status(401).send("Invalid or expired token.");

    await sendMaestroEvent({
      bookingId: decoded.bookingId,
      clientEmail: decoded.clientEmail,

      editsComplete: true,
    });

    res.status(200).send("Edits marked complete — workflow will resend for signature.");
  } catch (err) {
    console.error(err);
    res.status(500).send(`Error: ${err.message}`);
  }
});

/**
 * Notion create project page (called by Maestro AFTER signature)
 * Vercel URL: https://YOUR_APP.vercel.app/notion/create-project
 */
app.post("/notion/create-project", async (req, res) => {
  try {
    must("NOTION_TOKEN", NOTION_TOKEN);
    must("NOTION_DATABASE_ID", NOTION_DATABASE_ID);

    const {
      clientName,
      clientEmail,
      bookingId,
      bookingStartDate,
      packageName,
      price,
      developerName,
      developerEmail,
      agreementId,
    } = req.body || {};

    if (!clientName || !clientEmail) throw new Error("Missing clientName/clientEmail");
    if (!bookingId) throw new Error("Missing bookingId");

    const pageTitle = `${clientName} — ${packageName || "Project"}`;

    const notionRes = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parent: { database_id: NOTION_DATABASE_ID },
        properties: {
          Name: { title: [{ text: { content: pageTitle } }] },
          "Client Name": { rich_text: [{ text: { content: clientName } }] },
          "Client Email": { email: clientEmail },
          "Package": packageName ? { select: { name: packageName } } : undefined,
          "Price": price !== undefined ? { number: Number(price) } : undefined,
          "Start Date": bookingStartDate ? { date: { start: bookingStartDate } } : undefined,
          "Booking ID": { rich_text: [{ text: { content: bookingId } }] },
          "Agreement Status": { select: { name: "Signed" } },
          "Agreement Envelope ID": agreementId
            ? { rich_text: [{ text: { content: String(agreementId) } }] }
            : undefined,
        },
        children: [
          { object: "block", type: "heading_2", heading_2: { rich_text: [{ type: "text", text: { content: "Overview" } }] } },
          { object: "block", type: "bulleted_list_item", bulleted_list_item: { rich_text: [{ type: "text", text: { content: `Package: ${packageName || ""}` } }] } },
          { object: "block", type: "bulleted_list_item", bulleted_list_item: { rich_text: [{ type: "text", text: { content: `Start date: ${bookingStartDate || ""}` } }] } },
          { object: "block", type: "bulleted_list_item", bulleted_list_item: { rich_text: [{ type: "text", text: { content: `Price: ${price ?? ""}` } }] } },
          { object: "block", type: "bulleted_list_item", bulleted_list_item: { rich_text: [{ type: "text", text: { content: `Agreement: Signed ✅` } }] } },
          { object: "block", type: "heading_2", heading_2: { rich_text: [{ type: "text", text: { content: "Task List" } }] } },
          { object: "block", type: "to_do", to_do: { rich_text: [{ type: "text", text: { content: "Send kickoff questionnaire" } }], checked: false } },
          { object: "block", type: "to_do", to_do: { rich_text: [{ type: "text", text: { content: "Create repo + initial scaffold" } }], checked: false } },
          { object: "block", type: "to_do", to_do: { rich_text: [{ type: "text", text: { content: "Schedule kickoff call" } }], checked: false } },
          { object: "block", type: "to_do", to_do: { rich_text: [{ type: "text", text: { content: "Gather assets (copy, brand, images)" } }], checked: false } },
          { object: "block", type: "to_do", to_do: { rich_text: [{ type: "text", text: { content: "First milestone delivery" } }], checked: false } },
          { object: "block", type: "heading_2", heading_2: { rich_text: [{ type: "text", text: { content: "Notes" } }] } },
          { object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: `POC: ${developerName || ""} (${developerEmail || ""})` } }] } },
        ].filter(Boolean),
      }),
    });

    if (!notionRes.ok) {
      const text = await notionRes.text().catch(() => "");
      throw new Error(`Notion create page failed: ${notionRes.status} ${notionRes.statusText} ${text}`);
    }

    const data = await notionRes.json();
    res.status(200).json({ ok: true, notionPageId: data.id, notionPageUrl: data.url || "" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default app;
