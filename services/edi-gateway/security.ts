import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";

export const requireGatewayAdmin: RequestHandler = (req, res, next) => {
  const configured = process.env.EDI_GATEWAY_ADMIN_TOKEN || "";
  const supplied = String(req.headers.authorization || "").match(/^Bearer (.+)$/i)?.[1] || "";
  const actual = Buffer.from(supplied);
  const expected = Buffer.from(configured);
  if (!configured || actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    res.status(401).json({ error: "Ugyldig gateway-administratornøgle." });
    return;
  }
  next();
};
