import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import crypto from "node:crypto";
import { dataDir } from "./data-dir.js";

const historyPath = join(dataDir, "history.json");

export async function getHistory() {
  try {
    const content = await readFile(historyPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return [];
  }
}

export async function appendHistory(type, payload) {
  const items = await getHistory();
  const item = {
    id: crypto.randomUUID(),
    type,
    payload,
    createdAt: new Date().toISOString()
  };
  const next = [item, ...items].slice(0, 100);
  await mkdir(dirname(historyPath), { recursive: true });
  await writeFile(historyPath, JSON.stringify(next, null, 2), "utf-8");
  return item;
}

export async function deleteHistory(id) {
  const items = await getHistory();
  const next = items.filter((item) => item.id !== id);
  await mkdir(dirname(historyPath), { recursive: true });
  await writeFile(historyPath, JSON.stringify(next, null, 2), "utf-8");
  return { ok: true };
}
