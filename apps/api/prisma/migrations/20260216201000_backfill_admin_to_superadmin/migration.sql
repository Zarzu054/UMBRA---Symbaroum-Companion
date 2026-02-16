UPDATE "users"
SET "role" = 'superadmin'
WHERE "role"::text = 'admin';
