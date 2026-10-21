import { defineConfig } from 'drizzle-kit';
export default defineConfig({dialect:'sqlite',schema:'./src/db/schema.ts',out:'./migrations/generated',dbCredentials:{url:process.env.DATABASE_URL??'data/app.db'}});
