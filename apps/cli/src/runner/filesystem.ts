import { spawn } from 'node:child_process'
import { constants } from 'node:fs'
import { access, realpath } from 'node:fs/promises'
import path from 'node:path'
import { commandEnv } from './config'

export async function findExecutable(name: string): Promise<string> {
  for (const directory of (process.env.PATH ?? '').split(path.delimiter)) {
    if (!directory) continue
    const candidate = path.resolve(directory, name)
    try {
      await access(candidate, constants.X_OK)
      return await realpath(candidate)
    } catch {
      /* Try the next PATH entry. */
    }
  }
  throw new Error(`${name} is required on the runner machine and must be available on PATH.`)
}

// Node has no portable openat API. This small, isolated Python helper uses directory
// descriptors for every workspace access, so concurrent shell symlink swaps cannot
// redirect host-side transfers or logs outside the workspace. No network or credentials.
const FILESYSTEM_HELPER = String.raw`
import os, sys, stat, json, hashlib, tempfile, zipfile, secrets, signal
MAX = 256 * 1024 * 1024
FLAGS = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
def cancelled(signum, frame): raise InterruptedError('File transfer aborted.')
signal.signal(signal.SIGTERM, cancelled)
root = os.open(sys.argv[1], FLAGS)
operation, relative = sys.argv[2:4]
def components(value):
    parts = value.split('/')
    if chr(92) in value or chr(0) in value or any(not p or p in ('.', '..') or ':' in p for p in parts):
        raise ValueError('Invalid workspace path.')
    return parts
def parent_at(base, parts, create=False):
    current = os.dup(base)
    try:
        for part in parts[:-1]:
            if create:
                try: os.mkdir(part, 0o700, dir_fd=current)
                except FileExistsError: pass
            following = os.open(part, FLAGS, dir_fd=current)
            os.close(current)
            current = following
        return current, parts[-1]
    except BaseException:
        os.close(current)
        raise
def remove_at(parent, name):
    try: info = os.stat(name, dir_fd=parent, follow_symlinks=False)
    except FileNotFoundError: return
    if stat.S_ISDIR(info.st_mode):
        child = os.open(name, FLAGS, dir_fd=parent)
        try:
            for entry in os.listdir(child): remove_at(child, entry)
        finally: os.close(child)
        os.rmdir(name, dir_fd=parent)
    else: os.unlink(name, dir_fd=parent)
def commit():
    if os.read(3, 1) != b'1': raise InterruptedError('File transfer was not committed.')
def publish_directory(parent, temporary, name):
    backup = '.shumai-' + secrets.token_hex(16)
    backed_up = False
    published = False
    mask = signal.pthread_sigmask(signal.SIG_BLOCK, {signal.SIGTERM})
    try:
        try:
            os.rename(name, backup, src_dir_fd=parent, dst_dir_fd=parent)
            backed_up = True
        except FileNotFoundError: pass
        try:
            os.replace(temporary, name, src_dir_fd=parent, dst_dir_fd=parent)
            published = True
        except BaseException:
            if backed_up:
                os.rename(backup, name, src_dir_fd=parent, dst_dir_fd=parent)
                backed_up = False
            raise
    finally:
        try: signal.pthread_sigmask(signal.SIG_SETMASK, mask)
        finally:
            if backed_up and published: remove_at(parent, backup)
def copy_input(destination, expected):
    digest, size = hashlib.sha256(), 0
    while True:
        chunk = sys.stdin.buffer.read(65536)
        if not chunk: break
        size += len(chunk)
        if size > MAX: raise ValueError('Download exceeds 256 MiB.')
        digest.update(chunk)
        destination.write(chunk)
    if expected and digest.hexdigest() != expected: raise ValueError('Downloaded file hash does not match.')
    return size
try:
    parts = components(relative)
    if parts[0] != '.pi' or len(parts) < 2: raise ValueError('File paths must stay inside .pi/.')
    parent, name = parent_at(root, parts, operation in ('write', 'extract'))
    try:
        if operation in ('stat', 'read'):
            try: fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=parent)
            except FileNotFoundError:
                if operation != 'stat': raise
                print(json.dumps({'exists': False}))
                sys.exit(0)
            try:
                info = os.fstat(fd)
                metadata = {'exists': True, 'isFile': stat.S_ISREG(info.st_mode), 'size': info.st_size, 'name': name}
                if operation == 'stat': print(json.dumps(metadata))
                else:
                    if not stat.S_ISREG(info.st_mode) or info.st_size > MAX: raise ValueError('Upload must be a regular file no larger than 256 MiB.')
                    print(json.dumps(metadata), file=sys.stderr, flush=True)
                    with os.fdopen(os.dup(fd), 'rb') as source:
                        remaining = info.st_size
                        while remaining:
                            chunk = source.read(min(65536, remaining))
                            if not chunk: raise ValueError('File changed during upload.')
                            sys.stdout.buffer.write(chunk)
                            remaining -= len(chunk)
            finally: os.close(fd)
        else:
            # A private sibling staging entry is published only after validation.
            temporary = '.shumai-' + secrets.token_hex(16)
            try:
                if operation == 'extract':
                    os.mkdir(temporary, 0o700, dir_fd=parent)
                    target = os.open(temporary, FLAGS, dir_fd=parent)
                    try:
                        with tempfile.TemporaryFile() as archive:
                            size = copy_input(archive, sys.argv[4])
                            archive.seek(0)
                            with zipfile.ZipFile(archive) as zip:
                                entries = zip.infolist()
                                if len(entries) > 10000: raise ValueError('ZIP contains too many entries.')
                                if sum(entry.file_size for entry in entries) > MAX: raise ValueError('Extracted ZIP exceeds 256 MiB.')
                                for entry in entries:
                                    mode = entry.external_attr >> 16
                                    kind = stat.S_IFMT(mode)
                                    if kind not in (0, stat.S_IFREG, stat.S_IFDIR): raise ValueError('ZIP links and special files are forbidden.')
                                    entry_parent, entry_name = parent_at(target, components(entry.filename.rstrip('/')), True)
                                    try:
                                        if entry.is_dir():
                                            try: os.mkdir(entry_name, 0o700, dir_fd=entry_parent)
                                            except FileExistsError: pass
                                        else:
                                            fd = os.open(entry_name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600 | (mode & 0o155), dir_fd=entry_parent)
                                            with os.fdopen(fd, 'wb') as output, zip.open(entry) as source:
                                                copied = 0
                                                while True:
                                                    chunk = source.read(65536)
                                                    if not chunk: break
                                                    copied += len(chunk)
                                                    if copied > entry.file_size: raise ValueError('Invalid ZIP entry size.')
                                                    output.write(chunk)
                                    finally: os.close(entry_parent)
                    finally: os.close(target)
                    commit()
                    publish_directory(parent, temporary, name)
                elif operation == 'write':
                    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=parent)
                    print(json.dumps({'ready': True}), file=sys.stderr, flush=True)
                    with os.fdopen(fd, 'wb') as output: size = copy_input(output, sys.argv[4])
                else: raise ValueError('Unknown file operation.')
                if operation == 'write':
                    commit()
                    os.replace(temporary, name, src_dir_fd=parent, dst_dir_fd=parent)
                print(json.dumps({'size': size, 'cached': False}))
            finally: remove_at(parent, temporary)
    finally: os.close(parent)
except FileNotFoundError:
    if operation == 'stat': print(json.dumps({'exists': False}))
    else: print('File or directory not found.', file=sys.stderr); sys.exit(1)
except BaseException as error:
    if isinstance(error, SystemExit): raise
    print(str(error), file=sys.stderr)
    sys.exit(1)
finally: os.close(root)
`

export function spawnFileHelper(
  python: string,
  cwd: string,
  operation: string,
  relative: string,
  expectedHash = '',
) {
  return spawn(python, ['-I', '-c', FILESYSTEM_HELPER, cwd, operation, relative, expectedHash], {
    env: commandEnv(),
    stdio: ['pipe', 'pipe', 'pipe', 'pipe'],
  })
}
