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

  const rawKey = process.env.DEV_PORTAL_API_KEY || "";
  const apiKey = rawKey.trim();
  const appId = (process.env.APP_ID || "app_02bd6decc052cfd1dfa2948744af6c6f").trim();

  if (!apiKey) {
    sendJson(res, 500, { error: "DEV_PORTAL_API_KEY not configured" });
    return;
  }

  const results = {};

  // Detect key format
  results.keyFormat = {
    raw: rawKey.slice(0, 8) + "...",
    trimmed: apiKey.slice(0, 8) + "...",
    length: apiKey.length,
    startsWithApi: apiKey.startsWith("api_"),
  };

  // 1. Try MCP with the key as-is (if it starts with api_)
  if (apiKey.startsWith("api_")) {
    try {
      const r = await fetch("https://developer.worldcoin.org/api/mcp", {
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
      results.mcpWithKey = await r.json();
    } catch (e) {
      results.mcpWithKey = { error: e.message };
    }
  }

  // 2. Try the v2 API to get app info (uses plain bearer — this already works for payments)
  try {
    const r = await fetch(
      `https://developer.worldcoin.org/api/v2/minikit/app/${appId}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
      }
    );
    results.v2AppInfo = { status: r.status, body: await r.json() };
  } catch (e) {
    results.v2AppInfo = { error: e.message };
  }

  // 3. Try Hasura GraphQL with the key as a Bearer token
  try {
    const r = await fetch("https://developer.worldcoin.org/api/v1/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query: `{ app(where: {id: {_eq: "${appId}"}}) { id name verification_status app_metadata { id verification_status } } }`,
      }),
    });
    results.hasuraQuery = { status: r.status, body: await r.json() };
  } catch (e) {
    results.hasuraQuery = { error: e.message };
  }

  // 4. Try unauthenticated app info endpoint
  try {
    const r = await fetch(
      `https://developer.worldcoin.org/api/v1/precheck/${appId}`,
    );
    results.precheck = { status: r.status, body: await r.json() };
  } catch (e) {
    results.precheck = { error: e.message };
  }

  // 5. Try MCP with key encoded as base64(key:) — some portals use this
  try {
    const encoded = Buffer.from(`${apiKey}:`).toString("base64");
    const mcpKey = `api_${encoded}`;
    const r = await fetch("https://developer.worldcoin.org/api/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${mcpKey}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 5,
        method: "tools/list",
        params: {},
      }),
    });
    results.mcpEncodedKey = await r.json();
  } catch (e) {
    results.mcpEncodedKey = { error: e.message };
  }

  sendJson(res, 200, { appId, results });
}
