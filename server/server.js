require("dotenv").config();

const express = require("express");
const iam = require("@docusign/iam-sdk");
const rateLimit = require("express-rate-limit");

const app = express();
app.use(express.urlencoded({ extended: true }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 login requests per windowMs
});

// Environment variables
const {
  DS_AUTH_SERVER = "https://account-d.docusign.com",
  DS_CLIENT_ID,
  DS_CLIENT_SECRET,
  DS_REDIRECT_URI = "http://localhost:4000/callback",
  DS_SCOPES = "aow_manage signature",
  DS_ACCOUNT_ID,
  MAESTRO_WORKFLOW_ID,
  PORT = 4000,
} = process.env;

// In-memory storage for access token (for demo purposes only - do not use in production)
let accessToken = null;

// Construct the  OAuth authorization URL
function buildAuthUrl() {
  const params = new URLSearchParams({
    response_type: "code",
    scope: DS_SCOPES,
    client_id: DS_CLIENT_ID,
    redirect_uri: DS_REDIRECT_URI,
  });
  return `${DS_AUTH_SERVER}/oauth/auth?${params.toString()}`;
}

// Create an authenticated IAM client
function makeIamClient(token) {
  return new iam.IamClient({ accessToken: token });
}

// Homepage route for server start
app.get("/", (req, res) => {
  const authed = Boolean(accessToken);

  res.type("html").send(`
    <h2>Contract Task Automation</h2>

    <p><strong>Status:</strong> ${authed ? "Authenticated" : "Not authenticated"}</p>

    ${
      authed
        ? `
          <form method="POST" action="/trigger">
            <button type="submit">Trigger workflow</button>
          </form>
          <p style="margin-top:12px;"><a href="/logout">Log out</a></p>
        `
        : `
          <a href="/login"><button>Log in to Docusign</button></a>
        `
    }
  `);
});

// OAuth login route
app.get("/login", loginLimiter, (req, res) => {
  res.redirect(buildAuthUrl());
});

// Logout route to clear the access token
app.get("/logout", (req, res) => {
  accessToken = null;
  res.redirect("/");
});

// OAuth callback route to handle the authorization code and exchange it for an access token
app.get("/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send("Missing ?code=");

  try {
    const iamClient = new iam.IamClient();

    const tokenResp = await iamClient.auth.getTokenFromConfidentialAuthCode(
      { clientId: DS_CLIENT_ID, secretKey: DS_CLIENT_SECRET },
      { code: String(code), redirectUri: DS_REDIRECT_URI }
    );

    accessToken =
      tokenResp?.access_token ||
      tokenResp?.accessToken ||
      tokenResp?.data?.access_token;

    if (!accessToken) {
      return res.status(500).send("Token exchange succeeded but token not found.");
    }

    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.status(500).send("Token exchange failed (check console).");
  }
});

// Helper function to build trigger_inputs based on the trigger schema returned by the SDK
function buildTriggerInputsFromSchema(schema) {
  const today = new Date().toISOString().split("T")[0];

  const developerName = process.env.DEVELOPER_NAME || "Developer";
  const developerEmail = process.env.DEVELOPER_EMAIL || "developer@example.com";

  const builderEmail =
    process.env.WORKFLOW_BUILDER_EMAIL || developerEmail;
  const preparerEmail =
    process.env.WORKFLOW_PREPARER_EMAIL || developerEmail;

  const inputs = {};

  for (const field of schema) {
    const name = field?.field_name;
    const type = field?.field_data_type;
    if (!name) continue;

    if (name === "startDate") inputs[name] = today;
    else if (name === "developerName") inputs[name] = developerName;
    else if (name === "developerEmail") inputs[name] = developerEmail;
    else if (name === "workflowBuilder") inputs[name] = { email: builderEmail };
    else if (name === "workflowPreparer") inputs[name] = { email: preparerEmail };
    else {
      if (type === "Date") inputs[name] = today;
      else if (type === "User") inputs[name] = { email: developerEmail };
      else if (type === "String") inputs[name] = "demo";
      else if (type === "Number") inputs[name] = 0;
      else if (type === "Boolean") inputs[name] = false;
      else inputs[name] = "demo";
    }
  }

  return inputs;
}

// Route to trigger the Maestro workflow via the trigger URL obtained from the SDK
app.post("/trigger", async (req, res) => {
  if (!accessToken) return res.redirect("/login");

  try {
    const client = makeIamClient(accessToken);

    // 1) Get trigger requirements via IAM SDK
    const triggerReq = await client.maestro.workflows.getWorkflowTriggerRequirements({
      accountId: DS_ACCOUNT_ID,
      workflowId: MAESTRO_WORKFLOW_ID,
    });

    // Pull URL + schema from return
    const triggerUrl =
      triggerReq?.trigger_http_config?.url ||
      triggerReq?.triggerHttpConfig?.url ||
      triggerReq?.rawValue?.trigger_http_config?.url ||
      triggerReq?.rawValue?.triggerHttpConfig?.url;

    const schema =
      triggerReq?.trigger_input_schema ||
      triggerReq?.triggerInputSchema ||
      triggerReq?.rawValue?.trigger_input_schema ||
      triggerReq?.rawValue?.triggerInputSchema ||
      [];

    // Error handling for missing URL or schema in the SDK response
      if (!triggerUrl) {
      return res.type("html").send(`
        <h3>Missing trigger URL</h3>
        <details><summary>Raw trigger requirements</summary>
        <pre>${escapeHtml(JSON.stringify(triggerReq, null, 2))}</pre></details>
        <p><a href="/"><button>Back</button></a></p>
      `);
    }

    if (!Array.isArray(schema) || schema.length === 0) {
      return res.type("html").send(`
        <h3>Missing trigger schema</h3>
        <p>Could not locate trigger_input_schema in SDK response.</p>
        <details><summary>Raw trigger requirements</summary>
        <pre>${escapeHtml(JSON.stringify(triggerReq, null, 2))}</pre></details>
        <p><a href="/"><button>Back</button></a></p>
      `);
    }

    // 2) Build trigger_inputs from schema
    const triggerInputs = buildTriggerInputsFromSchema(schema);

    // 3) POST request to trigger workflow
    const body = {
      instance_name: "Web Forms Test",
      trigger_inputs: triggerInputs,
    };

    const resp = await fetch(triggerUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const triggerResp = await resp.json().catch(() => ({}));

    // Error handling for trigger request failure
    if (!resp.ok) {
      return res.type("html").send(`
        <h3>Trigger failed</h3>
        <p>Status: ${resp.status}</p>
        <details><summary>Response</summary>
        <pre>${escapeHtml(JSON.stringify(triggerResp, null, 2))}</pre></details>
        <details><summary>Request body</summary>
        <pre>${escapeHtml(JSON.stringify(body, null, 2))}</pre></details>
        <p><a href="/"><button>Back</button></a></p>
      `);
    }

    // Pull instance URL from response
    const instanceUrl = triggerResp?.instance_url;

    // Success page with link to Maestro instance and details for debugging
    res.type("html").send(`
      <h3>Triggered</h3>
      ${
        instanceUrl
          ? `<p><strong>Instance link:</strong> <a href="${instanceUrl}" target="_blank" rel="noreferrer">${instanceUrl}</a></p>`
          : `<p><strong>Instance link:</strong> (missing in response)</p>`
      }
      <details style="margin-top:12px;">
        <summary>Trigger inputs sent</summary>
        <pre>${escapeHtml(JSON.stringify(triggerInputs, null, 2))}</pre>
      </details>
      <details style="margin-top:12px;">
        <summary>Raw trigger response</summary>
        <pre>${escapeHtml(JSON.stringify(triggerResp, null, 2))}</pre>
      </details>
      <p style="margin-top:12px;"><a href="/"><button>Back</button></a></p>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send(`Trigger failed (check console).`);
  }
});

// Helper function to escape HTML for display in error messages and debugging details
function escapeHtml(str) {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Start the server
app.listen(Number(PORT), () => {
  console.log(`Listening on http://localhost:${PORT}`);
});
