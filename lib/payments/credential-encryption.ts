// ORCALY_ASAAS_MIGRATION_V2
import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function keyBuffer() {
  const raw = String(process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY || "").trim();
  if (!raw) throw new Error("A chave de criptografia financeira nao foi configurada.");

  let key: Buffer;
  if (/^[a-f0-9]{64}$/i.test(raw)) {
    key = Buffer.from(raw, "hex");
  } else {
    const decoded = Buffer.from(raw, "base64");
    key = decoded.length === 32 ? decoded : Buffer.from(raw, "utf8");
  }

  if (key.length !== 32) {
    throw new Error("PAYMENT_CREDENTIALS_ENCRYPTION_KEY deve possuir exatamente 32 bytes.");
  }
  return key;
}

export function encryptPaymentCredential(value: string) {
  const clean = String(value || "").trim();
  if (!clean) throw new Error("A credencial financeira esta vazia.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBuffer(), iv);
  const encrypted = Buffer.concat([cipher.update(clean, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(":");
}

export function decryptPaymentCredential(value: string) {
  const parts = String(value || "").split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Formato de credencial financeira invalido.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    keyBuffer(),
    Buffer.from(parts[1], "base64url"),
  );
  decipher.setAuthTag(Buffer.from(parts[2], "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(parts[3], "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
