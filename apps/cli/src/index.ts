import { projectLs } from './commands/project'
import { ls } from './commands/ls'
import { mkdir } from './commands/mkdir'
import { upload } from './commands/upload'
import { createVersion } from './commands/create-version'
import { rename } from './commands/rename'
import { move } from './commands/move'
import { deleteAsset } from './commands/delete'

function printHelp() {
  console.log(`
Usage: shumai-cli <command> [arguments] [options]

Commands:
  project ls                      List all projects (returns id, name, root folder id)
  ls -p <parentId>                List direct children of a parent folder (returns id, name, type, size)
  mkdir <name> -p <parentId>      Create a new folder in a parent folder
  upload <path> -p <parentId>     Upload a local file or folder to a parent folder
  create-version <path> -p <id>   Create a new version of an existing file or version stack
  rename <assetId> <newName>      Rename an existing file or folder
  move <assetIds...> -p <target>  Move one or more assets to a destination parent folder (alias: mv)
  delete <assetId> --allow-delete Delete a single file or folder (alias: rm)

Options:
  -p, --parent <id>              The parent folder/asset ID (required for ls, mkdir, upload, create-version, move)
  --allow-delete                 Required flag to authorize deleting an asset
  -h, --help                     Show help details
`)
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    printHelp()
    process.exit(0)
  }

  const cmd = args[0]

  let parentId = ''
  const parentIdx = args.findIndex((a) => a === '-p' || a === '--parent')
  if (parentIdx !== -1 && parentIdx + 1 < args.length) {
    parentId = args[parentIdx + 1]
  }

  const allowDelete = args.includes('--allow-delete')

  const cleanArgs: string[] = []
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-p' || args[i] === '--parent') {
      i++
    } else if (args[i] === '--allow-delete') {
      // skip flag
    } else {
      cleanArgs.push(args[i])
    }
  }

  if (cmd === 'project' && cleanArgs[1] === 'ls') {
    await projectLs()
  } else if (cmd === 'ls') {
    if (!parentId) {
      console.error('Error: Option -p/--parent <parentId> is required.')
      process.exit(1)
    }
    await ls(parentId)
  } else if (cmd === 'mkdir') {
    const name = cleanArgs[1]
    if (!name) {
      console.error(
        'Error: Folder name is required. Usage: shumai-cli mkdir <folderName> -p <parentId>',
      )
      process.exit(1)
    }
    if (!parentId) {
      console.error('Error: Option -p/--parent <parentId> is required.')
      process.exit(1)
    }
    await mkdir(name, parentId)
  } else if (cmd === 'upload') {
    const localPath = cleanArgs[1]
    if (!localPath) {
      console.error(
        'Error: File/folder path is required. Usage: shumai-cli upload <localPath> -p <parentId>',
      )
      process.exit(1)
    }
    if (!parentId) {
      console.error('Error: Option -p/--parent <parentId> is required.')
      process.exit(1)
    }
    await upload(localPath, parentId)
  } else if (cmd === 'create-version') {
    const localPath = cleanArgs[1]
    if (!localPath) {
      console.error(
        'Error: Local file path is required. Usage: shumai-cli create-version <localPath> -p <parentAssetId>',
      )
      process.exit(1)
    }
    if (!parentId) {
      console.error('Error: Option -p/--parent <parentAssetId> is required.')
      process.exit(1)
    }
    await createVersion(localPath, parentId)
  } else if (cmd === 'rename') {
    const assetId = cleanArgs[1]
    const newName = cleanArgs[2]
    if (!assetId || !newName) {
      console.error(
        'Error: Asset ID and new name are required. Usage: shumai-cli rename <assetId> <newName>',
      )
      process.exit(1)
    }
    await rename(assetId, newName)
  } else if (cmd === 'move' || cmd === 'mv') {
    const assetIds = cleanArgs.slice(1)
    if (assetIds.length === 0) {
      console.error(
        'Error: At least one asset ID is required. Usage: shumai-cli move <assetId...> -p <parentId>',
      )
      process.exit(1)
    }
    if (!parentId) {
      console.error('Error: Option -p/--parent <parentId> is required.')
      process.exit(1)
    }
    await move(assetIds, parentId)
  } else if (cmd === 'delete' || cmd === 'rm') {
    const assetIds = cleanArgs.slice(1)
    if (assetIds.length === 0) {
      console.error(
        'Error: Asset ID is required. Usage: shumai-cli delete <assetId> --allow-delete',
      )
      process.exit(1)
    }
    await deleteAsset(assetIds, allowDelete)
  } else {
    console.error(`Error: Unknown command "${cmd}". Run "shumai-cli --help" for usage.`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
