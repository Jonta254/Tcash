import { list, put } from "@vercel/blob";
import { allowMethods, readJsonBody, sendJson } from "./_lib/http.js";

const ORDER_PREFIX = "tmpesa/orders/";

function sanitizeOrderId(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function isOrderRecord(value) {
  return (
    value &&
    typeof value === "object" &&
    typeof value.id === "string" &&
    ["buy", "sell"].includes(value.type) &&
    typeof value.asset === "string" &&
    Number.isFinite(Number(value.cryptoAmount)) &&
    Number.isFinite(Number(value.kesAmount))
  );
}

function normalizeOrders(value) {
  const orders = Array.isArray(value.orders) ? value.orders : [value.order];
  return orders.filter(isOrderRecord);
}

function sortOrders(first, second) {
  const firstDate = new Date(first.updatedAt || first.createdAt || 0).getTime();
  const secondDate = new Date(second.updatedAt || second.createdAt || 0).getTime();
  return secondDate - firstDate;
}

async function readOrderBlob(blob) {
  try {
    const response = await fetch(blob.url, { cache: "no-store" });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    const order = payload?.order || payload;

    if (!isOrderRecord(order)) {
      return null;
    }

    return {
      ...order,
      adminQueueUrl: blob.url,
      adminSyncedAt: payload.syncedAt || String(blob.uploadedAt || ""),
    };
  } catch {
    return null;
  }
}

async function listOrderBlobs() {
  const blobs = [];
  let cursor;

  do {
    const result = await list({
      limit: 1000,
      prefix: ORDER_PREFIX,
      cursor,
    });

    blobs.push(...result.blobs);
    cursor = result.cursor;

    if (!result.hasMore) {
      break;
    }
  } while (cursor);

  return blobs;
}

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["GET", "POST"])) {
    return;
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    sendJson(res, 200, {
      ok: false,
      pendingSetup: true,
      orders: [],
      message: "Set BLOB_READ_WRITE_TOKEN so TMpesa can share orders with admin.",
    });
    return;
  }

  if (req.method === "GET") {
    try {
      const blobs = await listOrderBlobs();
      const snapshots = await Promise.all(blobs.map(readOrderBlob));
      const latestById = new Map();

      for (const order of snapshots.filter(Boolean)) {
        const current = latestById.get(order.id);

        if (!current || sortOrders(order, current) < 0) {
          latestById.set(order.id, order);
        }
      }

      sendJson(res, 200, {
        ok: true,
        orders: Array.from(latestById.values()).sort(sortOrders),
      });
    } catch (error) {
      sendJson(res, 502, {
        ok: false,
        orders: [],
        error: error instanceof Error ? error.message : "Unable to load admin orders.",
      });
    }
    return;
  }

  try {
    const payload = await readJsonBody(req);
    const orders = normalizeOrders(payload);

    if (!orders.length) {
      sendJson(res, 400, {
        ok: false,
        error: "Send at least one valid TMpesa order.",
      });
      return;
    }

    const syncedAt = new Date().toISOString();
    const blobs = await Promise.all(
      orders.map((order) => {
        const orderId = sanitizeOrderId(order.id);

        return put(
          `${ORDER_PREFIX}${orderId}/${Date.now()}.json`,
          JSON.stringify({ order, syncedAt }, null, 2),
          {
            access: "public",
            addRandomSuffix: true,
            contentType: "application/json",
          },
        );
      }),
    );

    sendJson(res, 200, {
      ok: true,
      count: orders.length,
      syncedAt,
      urls: blobs.map((blob) => blob.url),
    });
  } catch (error) {
    sendJson(res, 502, {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to sync admin order.",
    });
  }
}
