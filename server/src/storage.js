import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import crypto from "node:crypto";
import { dataDir } from "./data-dir.js";

const historyPath = join(dataDir, "history.json");

export async function getHistory(userId = "") {
  try {
    const content = await readFile(historyPath, "utf-8");
    const items = JSON.parse(content);
    if (!userId) return items.filter((item) => !item.userId);
    return items.filter((item) => item.userId === userId || !item.userId);
  } catch {
    return [];
  }
}

export async function appendHistory(type, payload, userId = "") {
  const items = await readAllHistory();
  const item = {
    id: crypto.randomUUID(),
    userId,
    type,
    payload,
    createdAt: new Date().toISOString()
  };
  const next = trimHistory([item, ...items]);
  await mkdir(dirname(historyPath), { recursive: true });
  await writeFile(historyPath, JSON.stringify(next, null, 2), "utf-8");
  return item;
}

export async function deleteHistory(id, userId = "") {
  const items = await readAllHistory();
  const next = items.filter((item) => item.id !== id || (userId && item.userId && item.userId !== userId));
  await mkdir(dirname(historyPath), { recursive: true });
  await writeFile(historyPath, JSON.stringify(next, null, 2), "utf-8");
  return { ok: true };
}

async function readAllHistory() {
  try {
    const content = await readFile(historyPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return [];
  }
}

function trimHistory(items) {
  const legacy = items.filter((item) => !item.userId).slice(0, 100);
  const byUser = new Map();
  for (const item of items.filter((entry) => entry.userId)) {
    if (!byUser.has(item.userId)) byUser.set(item.userId, []);
    const list = byUser.get(item.userId);
    if (list.length < 100) list.push(item);
  }
  return [...legacy, ...[...byUser.values()].flat()]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
