import { createHash } from "node:crypto";
import type { Express } from "express";
import { and, eq } from "drizzle-orm";
import { fileObjects, fileVersions } from "../shared/schema";
import { tenantId } from "./auth";
import { db } from "./storage";
import { decodeDataUrl, deleteFile, readFile, saveFile } from "./files";
import { parseStoredFileObjectPath } from "./file-object-location";

const categories = new Set(["bilag", "kontrakt", "foto", "dokument", "rapport"]);
const extensions: Record<string, string[]> = {
  "application/pdf": ["pdf"], "image/jpeg": ["jpg", "jpeg"], "image/png": ["png"],
  "image/gif": ["gif"], "image/webp": ["webp"],
};
const canWrite = (role?: string) => role === "leder" || role === "holdleder" || role === "bogholder" || role === "platform_admin";
const wrap = (fn: (req: any, res: any) => Promise<unknown>) =>
  (req: any, res: any, next: any) => Promise.resolve(fn(req, res)).catch(next);

/** Filobjekter er rigtige filer, ikke klientskabte metadata med opdigtede stier. */
export function registerFileObjectRoutes(app: Express) {
  app.get("/api/file-objects", wrap(async (req, res) => {
    res.json(db.select().from(fileObjects).where(eq(fileObjects.companyId, tenantId(req))).all());
  }));

  app.post("/api/file-objects", wrap(async (req, res) => {
    if (!canWrite(req.auth?.role)) return res.status(403).json({ error: "Ingen adgang til filupload." });
    const companyId = tenantId(req);
    const fileName = String(req.body?.fileName || "").trim();
    const category = String(req.body?.category || "");
    const dataUrl = String(req.body?.dataUrl || "");
    if (!fileName || fileName.length > 255 || /[\\/\r\n\0]/.test(fileName)
        || !categories.has(category) || dataUrl.length > 11_000_000) {
      return res.status(400).json({ error: "Vælg en gyldig fil og kategori. Maksimal filstørrelse er 8 MB." });
    }
    let decoded: ReturnType<typeof decodeDataUrl>;
    try { decoded = decodeDataUrl(dataUrl); }
    catch { return res.status(400).json({ error: "Kun gyldige PDF- og billedfiler kan uploades." }); }
    const extension = fileName.split(".").pop()?.toLowerCase() || "";
    if (!extensions[decoded.mimeType]?.includes(extension)) {
      return res.status(400).json({ error: "Filnavnets endelse passer ikke til filens indhold." });
    }
    if (decoded.buffer.length > 8 * 1024 * 1024) {
      return res.status(413).json({ error: "Filen må højst være 8 MB." });
    }
    const saved = await saveFile({ companyId, fileName, mimeType: decoded.mimeType, buffer: decoded.buffer });
    try {
      const row = db.insert(fileObjects).values({
        companyId, fileName, fileType: extension,
        fileSize: decoded.buffer.length, mimeType: decoded.mimeType, category,
        uploadedBy: String(req.auth?.user?.id || ""),
        storagePath: `${saved.storage}:${saved.storageKey}`,
        checksum: createHash("sha256").update(decoded.buffer).digest("hex"),
        isVirusScanned: false, status: "aktiv", createdAt: new Date().toISOString(),
      }).returning().get();
      return res.status(201).json(row);
    } catch (error) {
      await deleteFile(saved.storage, saved.storageKey);
      throw error;
    }
  }));

  app.get("/api/file-objects/:id/fil", wrap(async (req, res) => {
    const companyId = tenantId(req);
    const row = db.select().from(fileObjects).where(and(
      eq(fileObjects.id, Number(req.params.id)), eq(fileObjects.companyId, companyId),
    )).get();
    if (!row) return res.status(404).json({ error: "Filen findes ikke." });
    let location: ReturnType<typeof parseStoredFileObjectPath>;
    try { location = parseStoredFileObjectPath(row.storagePath || "", companyId); }
    catch { return res.status(409).json({ error: "Denne ældre registrering mangler en originalfil." }); }
    const bytes = await readFile(location.storage, location.key);
    if (bytes.length !== row.fileSize || createHash("sha256").update(bytes).digest("hex") !== row.checksum) {
      throw new Error("Filobjektets originalfil bestod ikke integritetskontrollen.");
    }
    res.setHeader("Content-Type", row.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${row.fileName.replace(/[\r\n"\\]/g, "_")}"`);
    return res.send(bytes);
  }));

  app.patch("/api/file-objects/:id", wrap(async (req, res) => {
    if (!canWrite(req.auth?.role)) return res.status(403).json({ error: "Ingen adgang." });
    if (!["aktiv", "arkiveret"].includes(req.body?.status)) {
      return res.status(400).json({ error: "Kun status kan ændres." });
    }
    const row = db.update(fileObjects).set({ status: req.body.status }).where(and(
      eq(fileObjects.id, Number(req.params.id)), eq(fileObjects.companyId, tenantId(req)),
    )).returning().get();
    if (!row) return res.status(404).json({ error: "Filen findes ikke." });
    return res.json(row);
  }));

  app.delete("/api/file-objects/:id", wrap(async (_req, res) => {
    return res.status(409).json({ error: "Originalfiler kan ikke slettes fra dette arkiv. Arkivér registreringen i stedet." });
  }));

  app.get("/api/file-versions", wrap(async (req, res) => {
    res.json(db.select().from(fileVersions).where(eq(fileVersions.companyId, tenantId(req))).all());
  }));

  app.post("/api/file-versions", wrap(async (req, res) => {
    if (!canWrite(req.auth?.role)) return res.status(403).json({ error: "Ingen adgang til versionsupload." });
    const companyId = tenantId(req);
    const fileId = Number(req.body?.fileId);
    const parent = Number.isSafeInteger(fileId) && fileId > 0 ? db.select().from(fileObjects).where(and(
      eq(fileObjects.id, fileId), eq(fileObjects.companyId, companyId),
    )).get() : undefined;
    if (!parent) return res.status(404).json({ error: "Den oprindelige fil findes ikke i virksomheden." });
    let originalLocation: ReturnType<typeof parseStoredFileObjectPath>;
    try { originalLocation = parseStoredFileObjectPath(parent.storagePath || "", companyId); }
    catch { return res.status(409).json({ error: "Den oprindelige registrering mangler filbytes og kan ikke versioneres." }); }
    const originalBytes = await readFile(originalLocation.storage, originalLocation.key);
    if (originalBytes.length !== parent.fileSize
        || createHash("sha256").update(originalBytes).digest("hex") !== parent.checksum) {
      return res.status(409).json({ error: "Den oprindelige fil bestod ikke integritetskontrollen." });
    }
    const fileName = String(req.body?.fileName || "").trim();
    const dataUrl = String(req.body?.dataUrl || "");
    if (!fileName || fileName.length > 255 || /[\\/\r\n\0]/.test(fileName) || dataUrl.length > 11_000_000) {
      return res.status(400).json({ error: "Vælg en gyldig fil på højst 8 MB." });
    }
    let decoded: ReturnType<typeof decodeDataUrl>;
    try { decoded = decodeDataUrl(dataUrl); }
    catch { return res.status(400).json({ error: "Kun gyldige PDF- og billedfiler kan uploades." }); }
    const extension = fileName.split(".").pop()?.toLowerCase() || "";
    if (!extensions[decoded.mimeType]?.includes(extension)) {
      return res.status(400).json({ error: "Filnavnets endelse passer ikke til filens indhold." });
    }
    if (decoded.buffer.length > 8 * 1024 * 1024) return res.status(413).json({ error: "Filen må højst være 8 MB." });
    const saved = await saveFile({ companyId, fileName, mimeType: decoded.mimeType, buffer: decoded.buffer });
    try {
      const row = db.transaction((tx) => {
        const previous = tx.select().from(fileVersions).where(and(
          eq(fileVersions.companyId, companyId), eq(fileVersions.fileId, fileId),
        )).all();
        const versionNumber = Math.max(1, ...previous.map((version) => version.versionNumber)) + 1;
        return tx.insert(fileVersions).values({
          companyId, fileId, versionNumber, fileName,
          storagePath: `${saved.storage}:${saved.storageKey}`,
          checksum: createHash("sha256").update(decoded.buffer).digest("hex"),
          uploadedBy: String(req.auth?.user?.id || ""),
          changeNote: String(req.body?.changeNote || "").slice(0, 1000) || null,
          createdAt: new Date().toISOString(),
        }).returning().get();
      });
      return res.status(201).json(row);
    } catch (error) {
      await deleteFile(saved.storage, saved.storageKey);
      throw error;
    }
  }));

  app.get("/api/file-versions/:id/fil", wrap(async (req, res) => {
    const companyId = tenantId(req);
    const row = db.select().from(fileVersions).where(and(
      eq(fileVersions.id, Number(req.params.id)), eq(fileVersions.companyId, companyId),
    )).get();
    if (!row) return res.status(404).json({ error: "Filversionen findes ikke." });
    let location: ReturnType<typeof parseStoredFileObjectPath>;
    try { location = parseStoredFileObjectPath(row.storagePath, companyId); }
    catch { return res.status(409).json({ error: "Denne ældre version mangler en originalfil." }); }
    const bytes = await readFile(location.storage, location.key);
    if (createHash("sha256").update(bytes).digest("hex") !== row.checksum) {
      throw new Error("Filversionen bestod ikke integritetskontrollen.");
    }
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${row.fileName.replace(/[\r\n"\\]/g, "_")}"`);
    return res.send(bytes);
  }));

  app.patch("/api/file-versions/:id", wrap(async (_req, res) =>
    res.status(409).json({ error: "En gemt filversion kan ikke ændres." })));
  app.delete("/api/file-versions/:id", wrap(async (_req, res) =>
    res.status(409).json({ error: "En gemt filversion kan ikke slettes her." })));
}
