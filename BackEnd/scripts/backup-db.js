/* =====================================================================
   DATABASE BACKUP

   Copies every collection out of the database the API uses into a dated
   folder, one compressed file per collection, and deletes backups older
   than the newest N.

     node scripts/backup-db.js [--out <folder>] [--keep <number>]

       --out    where backups are kept
                (default: $BACKUP_DIR, or "bengol-backups" in the home folder)
       --keep   how many backups to keep (default 14)

   On the server this runs every night from cron; deploy/push.sh sets that
   up. To run one by hand there:

     cd /var/www/Bengol-Spices-V2/BackEnd && node scripts/backup-db.js --out /var/backups/bengol-spices

   It only READS the database. Nothing here writes to it.

   Each backup is written to "<name>.partial" and renamed when it is
   complete, so a backup that was interrupted is never mistaken for a good
   one, and never counts towards the ones that are kept.

   Restore with scripts/restore-db.js.
   ===================================================================== */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";

const BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(BACKEND, ".env"), quiet: true });

// After .env is loaded: the address is read when the function is called
const { mongoUrl } = await import("../database/db.js");

const argument = (name, fallback) => {
  const at = process.argv.indexOf(`--${name}`);
  return at > -1 && process.argv[at + 1] ? process.argv[at + 1] : fallback;
};

const OUT = path.resolve(
  argument("out", process.env.BACKUP_DIR || path.join(os.homedir(), "bengol-backups")),
);
const KEEP = Math.max(1, Number.parseInt(argument("keep", "14"), 10) || 14);

// Names look like 2026-10-07_2030: they sort by date as plain text
const NAME = /^\d{4}-\d{2}-\d{2}_\d{4}$/;
const stamp = () => {
  const now = new Date();
  const two = (n) => String(n).padStart(2, "0");
  return (
    `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}` +
    `_${two(now.getHours())}${two(now.getMinutes())}`
  );
};

const log = (message) => console.log(`[${new Date().toISOString()}] ${message}`);

/* One document per line, in MongoDB's "extended JSON", which keeps the
   difference between an id, a date and a plain string. Ordinary JSON would
   turn every id and date into text and the data could not be put back. */
const { EJSON } = mongoose.mongo.BSON;

const dumpCollection = async (collection, file) => {
  const gzip = zlib.createGzip({ level: 6 });
  const out = fs.createWriteStream(file);
  gzip.pipe(out);

  let count = 0;
  // Values are read exactly as stored (a whole number kept as a decimal
  // stays a decimal) so the restored copy is identical, not merely equal.
  const exact = { promoteValues: false, promoteLongs: false, promoteBuffers: false };

  for await (const document of collection.find({}, exact)) {
    count += 1;
    if (!gzip.write(`${EJSON.stringify(document, { relaxed: false })}\n`)) {
      await once(gzip, "drain");
    }
  }

  gzip.end();
  await once(out, "finish");
  return count;
};

const run = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not set, so there is no database to back up");
  }

  await mongoose.connect(mongoUrl(), { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;

  const name = stamp();
  const partial = path.join(OUT, `${name}.partial`);
  const final = path.join(OUT, name);

  fs.mkdirSync(OUT, { recursive: true });
  fs.rmSync(partial, { recursive: true, force: true });
  fs.mkdirSync(partial);

  const collections = (await db.listCollections({}, { nameOnly: false }).toArray())
    .filter((c) => c.type !== "view" && !c.name.startsWith("system."))
    .sort((a, b) => a.name.localeCompare(b.name));

  const manifest = {
    createdAt: new Date().toISOString(),
    database: db.databaseName,
    collections: {},
  };

  let total = 0;
  for (const { name: collectionName } of collections) {
    const collection = db.collection(collectionName);
    const count = await dumpCollection(collection, path.join(partial, `${collectionName}.jsonl.gz`));

    manifest.collections[collectionName] = {
      documents: count,
      // kept for reference; the API recreates its own indexes when it starts
      indexes: await collection.indexes().catch(() => []),
    };
    total += count;
  }

  fs.writeFileSync(path.join(partial, "manifest.json"), JSON.stringify(manifest, null, 2));

  // Only now does it count as a backup
  fs.rmSync(final, { recursive: true, force: true });
  fs.renameSync(partial, final);

  const bytes = fs
    .readdirSync(final)
    .reduce((sum, file) => sum + fs.statSync(path.join(final, file)).size, 0);
  log(
    `Backup ${name}: ${total} documents in ${collections.length} collections from "${db.databaseName}", ${(bytes / 1024).toFixed(0)} KB, in ${final}`,
  );

  // Keep the newest KEEP complete backups; leftovers of interrupted runs go too
  const entries = fs.readdirSync(OUT, { withFileTypes: true }).filter((e) => e.isDirectory());
  const complete = entries.map((e) => e.name).filter((n) => NAME.test(n)).sort();

  for (const old of complete.slice(0, Math.max(0, complete.length - KEEP))) {
    fs.rmSync(path.join(OUT, old), { recursive: true, force: true });
    log(`Removed old backup ${old}`);
  }
  for (const entry of entries) {
    if (entry.name.endsWith(".partial") && entry.name !== `${name}.partial`) {
      fs.rmSync(path.join(OUT, entry.name), { recursive: true, force: true });
    }
  }
};

run()
  .then(() => mongoose.disconnect())
  .then(() => process.exit(0))
  .catch(async (error) => {
    log(`BACKUP FAILED: ${error.message}`);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
