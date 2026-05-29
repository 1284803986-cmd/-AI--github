import crypto from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { dataDir } from "./data-dir.js";

const usersPath = join(dataDir, "users.json");
const sessionsPath = join(dataDir, "sessions.json");
const SESSION_DAYS = 30;
let accessTokenCache = null;

export async function loginWithWechatCode({ code, profile = {} }) {
  if (!code) {
    const error = new Error("缺少登录凭证");
    error.name = "ValidationError";
    throw error;
  }

  const wechat = await codeToSession(code);
  const openid = wechat.openid;
  const now = new Date().toISOString();
  const users = await readJson(usersPath, []);
  let user = users.find((item) => item.openid === openid);

  if (!user) {
    user = {
      id: crypto.randomUUID(),
      openid,
      unionid: wechat.unionid || "",
      nickname: cleanProfileText(profile.nickname) || "微信用户",
      avatarUrl: cleanProfileText(profile.avatarUrl),
      role: profile.role === "teacher" ? "teacher" : "student",
      grade: cleanProfileText(profile.grade) || "一年级",
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now
    };
    users.unshift(user);
  } else {
    user.nickname = cleanProfileText(profile.nickname) || user.nickname || "微信用户";
    user.avatarUrl = cleanProfileText(profile.avatarUrl) || user.avatarUrl || "";
    user.role = profile.role === "teacher" || profile.role === "student" ? profile.role : user.role;
    user.grade = cleanProfileText(profile.grade) || user.grade || "一年级";
    user.unionid = wechat.unionid || user.unionid || "";
    user.updatedAt = now;
    user.lastLoginAt = now;
  }

  await writeJson(usersPath, users);
  const session = await createSession(user.id);
  return { token: session.token, expiresAt: session.expiresAt, user: publicUser(user) };
}

export async function loginWithPhoneNumber({ phoneCode, wxCode = "", profile = {} }) {
  if (!phoneCode) {
    const error = new Error("缺少手机号授权凭证");
    error.name = "ValidationError";
    throw error;
  }

  const phoneNumber = await getPhoneNumber(phoneCode);
  const wechat = wxCode ? await codeToSession(wxCode) : {};
  const now = new Date().toISOString();
  const users = await readJson(usersPath, []);
  let user = users.find((item) => item.phoneNumber === phoneNumber);
  if (!user && wechat.openid) user = users.find((item) => item.openid === wechat.openid);

  if (!user) {
    user = {
      id: crypto.randomUUID(),
      openid: wechat.openid || "",
      unionid: wechat.unionid || "",
      phoneNumber,
      nickname: cleanProfileText(profile.nickname) || maskPhone(phoneNumber),
      avatarUrl: cleanProfileText(profile.avatarUrl),
      role: profile.role === "teacher" ? "teacher" : "student",
      grade: cleanProfileText(profile.grade) || "一年级",
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now
    };
    users.unshift(user);
  } else {
    user.openid = wechat.openid || user.openid || "";
    user.unionid = wechat.unionid || user.unionid || "";
    user.phoneNumber = phoneNumber;
    user.nickname = cleanProfileText(profile.nickname) || user.nickname || maskPhone(phoneNumber);
    user.avatarUrl = cleanProfileText(profile.avatarUrl) || user.avatarUrl || "";
    user.role = profile.role === "teacher" || profile.role === "student" ? profile.role : user.role;
    user.grade = cleanProfileText(profile.grade) || user.grade || "一年级";
    user.updatedAt = now;
    user.lastLoginAt = now;
  }

  await writeJson(usersPath, users);
  const session = await createSession(user.id);
  return { token: session.token, expiresAt: session.expiresAt, user: publicUser(user) };
}

export async function getUserByToken(token) {
  if (!token) return null;
  const sessions = await readJson(sessionsPath, []);
  const session = sessions.find((item) => item.token === token);
  if (!session || new Date(session.expiresAt).getTime() < Date.now()) return null;
  const users = await readJson(usersPath, []);
  const user = users.find((item) => item.id === session.userId);
  return user ? publicUser(user) : null;
}

export async function logoutByToken(token) {
  if (!token) return { ok: true };
  const sessions = await readJson(sessionsPath, []);
  await writeJson(sessionsPath, sessions.filter((item) => item.token !== token));
  return { ok: true };
}

export function getBearerToken(request) {
  const header = request.headers.authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : "";
}

async function codeToSession(code) {
  const appid = process.env.WECHAT_APPID;
  const secret = process.env.WECHAT_SECRET;
  if (!appid || !secret || secret === "replace_with_wechat_app_secret") {
    return { openid: process.env.DEV_OPENID || "dev_local_user" };
  }

  const url = new URL("https://api.weixin.qq.com/sns/jscode2session");
  url.searchParams.set("appid", appid);
  url.searchParams.set("secret", secret);
  url.searchParams.set("js_code", code);
  url.searchParams.set("grant_type", "authorization_code");
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok || data.errcode) {
    const error = new Error(data.errmsg || "微信登录失败");
    error.name = "ValidationError";
    throw error;
  }
  return data;
}

async function getPhoneNumber(phoneCode) {
  const appid = process.env.WECHAT_APPID;
  const secret = process.env.WECHAT_SECRET;
  if (!appid || !secret || secret === "replace_with_wechat_app_secret") {
    return process.env.DEV_PHONE_NUMBER || "13800000000";
  }

  const accessToken = await getWechatAccessToken(appid, secret);
  const response = await fetch(`https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${accessToken}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: phoneCode })
  });
  const data = await response.json();
  if (!response.ok || data.errcode) {
    const error = new Error(data.errmsg || "手机号授权失败");
    error.name = "ValidationError";
    throw error;
  }
  const phoneNumber = data.phone_info?.phoneNumber || data.phone_info?.purePhoneNumber || "";
  if (!phoneNumber) {
    const error = new Error("未获取到手机号");
    error.name = "ValidationError";
    throw error;
  }
  return phoneNumber;
}

async function getWechatAccessToken(appid, secret) {
  if (accessTokenCache && accessTokenCache.expiresAt > Date.now() + 60_000) return accessTokenCache.token;
  const url = new URL("https://api.weixin.qq.com/cgi-bin/token");
  url.searchParams.set("grant_type", "client_credential");
  url.searchParams.set("appid", appid);
  url.searchParams.set("secret", secret);
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok || data.errcode) {
    const error = new Error(data.errmsg || "微信 access_token 获取失败");
    error.name = "ValidationError";
    throw error;
  }
  accessTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + Math.max(60, Number(data.expires_in || 7200) - 300) * 1000
  };
  return accessTokenCache.token;
}

async function createSession(userId) {
  const sessions = await readJson(sessionsPath, []);
  const now = Date.now();
  const active = sessions.filter((item) => new Date(item.expiresAt).getTime() > now);
  const session = {
    token: crypto.randomBytes(32).toString("hex"),
    userId,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString()
  };
  active.unshift(session);
  await writeJson(sessionsPath, active);
  return session;
}

function publicUser(user) {
  return {
    id: user.id,
    nickname: user.nickname || "微信用户",
    avatarUrl: user.avatarUrl || "",
    phoneNumber: user.phoneNumber ? maskPhone(user.phoneNumber) : "",
    role: user.role || "student",
    grade: user.grade || "一年级",
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt
  };
}

function cleanProfileText(value) {
  return typeof value === "string" ? value.trim().slice(0, 120) : "";
}

function maskPhone(phoneNumber) {
  const text = String(phoneNumber || "");
  if (text.length < 7) return text;
  return `${text.slice(0, 3)}****${text.slice(-4)}`;
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf-8"));
  } catch {
    return fallback;
  }
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}
