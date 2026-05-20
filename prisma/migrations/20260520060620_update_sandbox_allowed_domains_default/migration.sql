-- AlterTable
ALTER TABLE "sandboxes" ALTER COLUMN "allowedDomains" SET DEFAULT ARRAY['npmjs.org', '*.npmjs.org', 'registry.npmjs.org', 'registry.yarnpkg.com', 'pypi.org', '*.pypi.org', 'github.com', '*.github.com', 'api.github.com', 'raw.githubusercontent.com']::TEXT[];
