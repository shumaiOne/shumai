import { Command } from 'commander'
import { operationDefinitions } from '@shumai/operations'
import { createVersion } from './commands/create-version'
import { upload } from './commands/upload'
import { callOperation, type CallOperation } from './operations/call-operation'
import { cliExtensions } from './operations/extensions'
import { registerOperationCommands } from './operations/generate'
import type { Output } from './operations/render'

export interface ProgramOptions {
  callOperation?: CallOperation
  output?: Output
}

function isDeleteAllowed(): boolean {
  const value = process.env.SHUMAI_ALLOW_DELETE
  return value === 'true' || value === '1'
}

/**
 * Builds the `shumai-cli` program. Operation commands (ls, mkdir, rename, move, delete,
 * read, render, project ls, ...) are generated from `@shumai/operations`; upload and create-version stream
 * local files and are defined here.
 */
export function createProgram(options: ProgramOptions = {}): Command {
  const program = new Command()
    .name('shumai-cli')
    .description('Command line interface for the Shumai media workspace.')
    .option('--json', 'Print raw JSON output instead of human-friendly text')
    .showHelpAfterError()
    .showSuggestionAfterError()

  registerOperationCommands(program, operationDefinitions, {
    callOperation: options.callOperation ?? callOperation,
    output: options.output ?? {
      out: process.stdout,
      isTty: Boolean(process.stdout.isTTY),
      columns: process.stdout.columns || 80,
    },
    allowDestructive: isDeleteAllowed,
    extensions: cliExtensions,
  })

  program
    .command('upload')
    .description('Upload a local file or folder to a parent folder.')
    .argument('<path>', 'Local file or folder to upload.')
    .requiredOption('-p, --parent <parentId>', 'The parent folder ID to upload into.')
    .action((localPath: string, opts: { parent: string }) => upload(localPath, opts.parent))

  program
    .command('create-version')
    .description('Upload a local file as a new version of an existing file or version stack.')
    .argument('<path>', 'Local file to upload as the new version.')
    .requiredOption('-p, --parent <parentId>', 'The file or version stack ID to add a version to.')
    .action((localPath: string, opts: { parent: string }) => createVersion(localPath, opts.parent))

  return program
}
