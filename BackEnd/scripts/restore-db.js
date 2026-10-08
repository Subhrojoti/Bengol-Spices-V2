/* =====================================================================
   DATABASE RESTORE

   Puts a backup made by scripts/backup-db.js into a database.

     node scripts/restore-db.js <backup folder> --to <mongodb address> [--replace]

   The target address is ALWAYS given by hand. This script never reads the
   API's own database address from .env, so it cannot overwrite the live
   data by accident or by habit.

   The safe way to use it:

     1. Restore into a NEW, empty database and look at it:
          node scripts/restore-db.js /var/backups/bengol-spices/2026-10-07_2030 \
               --to "mongodb+srv://user:pass@cluster.mongodb.net/bengol-restore-check"
     2. Only if that looks right, point the API at it (MONGO_URI in .env)
        or restore over the original with --replace.

   Without --replace it refuses to touch a collection that already has
   documents. With --replace each collection in the backup is emptied and
   refilled; collections that are not in the backup are left alone.
   ===================================================================== */

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import readline from "node:readline";
import mongoose from "mongoose";

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => {
  const at = args.indexOf(`--${name}`);
  return at > -1 ? args[at + 1] : undefined;
};

const folder = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--to");
const target = option("to");
const replace = flag("replace");

const usage = () => {
  console.error(
    'Usage: node scripts/restore-db.js <backup folder> --to "<mongodb address including the database name>" [--replace]',
  );
  process.exit(2);
};

if (!folder || !target) usage();

const { EJSON } = mongoose.mongo.BSON;
const BATCH = 500;

const restoreCollection = async (db, name, file) => {
  // Made explicitly, so a collection that was empty in the backup exists
  // afterwards too (inserting nothing would not create it)
  const present = await db.listCollections({ name }, { nameOnly: true }).toArray();
  if (!present.length) await db.createCollection(name);

  const collection = db.collection(name);
  const existing = await collection.estimatedDocumentCount();

  if (existing > 0) {
    if (!replace) {
      throw new Error(
        `"${name}" already holds ${existing} documents. Restore into an empty database, or pass --replace to overwrite.`,
      );
    }
    await collection.deleteMany({});
  }

  const lines = readline.createInterface({
    input: fs.createReadStream(file).pipe(zlib.createGunzip()),
    crlfDelay: Infinity,
  });

  let batch = [];
  let count = 0;

  for await (const line of lines) {
    if (!line.trim()) continue;
    batch.push(EJSON.parse(line, { relaxed: false }));

    if (batch.length >= BATCH) {
      await collection.insertMany(batch, { ordered: true });
      count += batch.length;
      batch = [];
    }
  }

  if (batch.length) {
    await collection.insertMany(batch, { ordered: true });
    count += batch.length;
  }

  return count;
};

const run = async () => {
  const manifestFile = path.join(folder, "manifest.json");
  if (!fs.existsSync(manifestFile)) {
    throw new Error(`${folder} is not a complete backup (no manifest.json in it)`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));

  await mongoose.connect(target, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;

  console.log(
    `Restoring the backup of ${manifest.createdAt} (database "${manifest.database}") into "${db.databaseName}"${replace ? ", REPLACING what is there" : ""}`,
  );

  for (const [name, info] of Object.entries(manifest.collections)) {
    const file = path.join(folder, `${name}.jsonl.gz`);
    if (!fs.existsSync(file)) throw new Error(`the backup is missing ${name}.jsonl.gz`);

    const count = await restoreCollection(db, name, file);
    const note = count === info.documents ? "" : `  (the backup recorded ${info.documents})`;
    console.log(`  ${name.padEnd(28)} ${String(count).padStart(7)} documents${note}`);

    if (count !== info.documents) {
      throw new Error(`"${name}" restored ${count} documents but the backup recorded ${info.documents}`);
    }
  }

  console.log("Restore complete. The API rebuilds its indexes the next time it starts.");
};

run()
  .then(() => mongoose.disconnect())
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error(`RESTORE FAILED: ${error.message}`);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
