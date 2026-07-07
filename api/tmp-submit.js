import { sendJson } from "./_lib/http.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const secret = req.headers["x-submit-secret"];
  if (secret !== "tcash-submit-2026") {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  const apiKey = process.env.DEV_PORTAL_API_KEY;
  const appId = process.env.APP_ID || "app_02bd6decc052cfd1dfa2948744af6c6f";

  if (!apiKey) {
    sendJson(res, 500, { error: "DEV_PORTAL_API_KEY not configured" });
    return;
  }

  try {
    // Step 1: list tools to confirm MCP connection
    const listRes = await fetch("https://developer.worldcoin.org/api/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      }),
    });
    const listData = await listRes.json();

    // Step 2: get app context first
    const ctxRes = await fetch("https://developer.worldcoin.org/api/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "get_team_context",
          arguments: {},
        },
      }),
    });
    const ctxData = await ctxRes.json();

    // Step 3: submit for review
    const submitRes = await fetch("https://developer.worldcoin.org/api/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "submit_app_for_review",
          arguments: {
            app_id: appId,
            confirm_submission: true,
            changelog: "Tcash rebrand complete. Added User Guidelines page (/guidelines), linked legal docs from Profile and Support pages. All tmpesa-icon.svg references replaced with tcash-logo.png. Package name updated to tcash. Admin route aliases updated.",
            is_developer_allow_listing: true,
          },
        },
      }),
    });
    const submitData = await submitRes.json();

    sendJson(res, 200, {
      apiKeyPresent: true,
      appId,
      list: listData,
      teamContext: ctxData,
      submission: submitData,
    });
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
}
