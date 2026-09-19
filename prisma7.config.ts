// Loads .env.local (the project's single source of truth for secrets — see .env.example)
// rather than dotenv's default .env, so the Prisma CLI and the Next.js app read the same file.
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
