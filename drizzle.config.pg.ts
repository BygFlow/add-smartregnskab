import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle-pg",
  schema: "./shared/schema.pg.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
