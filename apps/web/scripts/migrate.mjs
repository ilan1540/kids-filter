// Runs `prisma migrate deploy` during the build when a database is configured.
// Lets the very first Vercel deploy succeed before Neon is connected.
import { execSync } from "node:child_process";

const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.warn("⚠ No database URL set: skipping migrations. Connect Neon in Vercel → Storage, then redeploy.");
} else {
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
}
