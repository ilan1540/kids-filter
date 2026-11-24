import "dotenv/config";
import { defineConfig } from "prisma/config";

// Migrations use Neon's direct (non-pooled) connection. Vercel's Neon integration
// names it DATABASE_URL_UNPOOLED; locally we use DIRECT_DATABASE_URL.
const url =
  process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url },
});
