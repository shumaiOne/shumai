import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

/**
 * This script extracts the exact versions of specific runtime dependencies
 * from the current workspace using `bun pm ls --all`.
 * It generates a `runner-package.json` that is used in the final stage of the Docker build
 * to ensure that production dependencies match development/build versions exactly.
 */

const depsToExtract = [
  '@temporalio/activity',
  '@temporalio/client',
  '@temporalio/worker',
  '@temporalio/workflow',
  'prisma',
  'sharp'
];

function run(cmd: string) {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' });
  } catch (e) {
    console.error(`Command failed: ${cmd}`);
    return null;
  }
}

console.log('Extracting runtime dependency versions using `bun pm ls --all`...');

const output = run('bun pm ls --all');

if (!output) {
  console.error('Failed to get dependency list from bun.');
  process.exit(1);
}

const deps: Record<string, string> = {};

for (const dep of depsToExtract) {
  // regex to find the version after the package name in `bun pm ls` output
  // e.g., ├── @temporalio/client@1.17.2
  const escapedDep = dep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(?:^|\\s)${escapedDep}@(\\d+\\.\\d+\\.\\d+[^\\s]*)`, 'g');
  const match = regex.exec(output);
  
  if (match && match[1]) {
    // If there are multiple matches (different versions in workspace), we take the first one found.
    // In our pinned workspace, they should all be the same.
    deps[dep] = match[1];
    console.log(`  Found ${dep}@${match[1]}`);
  } else {
    console.warn(`  Warning: Could not find version for ${dep} in \`bun pm ls --all\` output.`);
  }
}

if (Object.keys(deps).length === 0) {
  console.error('Error: No dependencies were extracted. Check if `bun install` was run correctly.');
  process.exit(1);
}

const runnerPkg = {
  name: "shumai-runner",
  version: "1.0.0",
  private: true,
  dependencies: deps
};

const outputPath = 'runner-package.json';
writeFileSync(outputPath, JSON.stringify(runnerPkg, null, 2) + '\n', 'utf-8');
console.log(`\nGenerated ${outputPath} with ${Object.keys(deps).length} dependencies for Docker runner stage.`);
