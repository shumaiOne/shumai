-- Data migration: set network_sandbox_enabled to true for existing legacy sandbox records
UPDATE "sandboxes" SET "network_sandbox_enabled" = true;