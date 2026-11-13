#!/bin/sh
# Release builds replace this placeholder with the version of the attached binaries.
set -eu

fail() { printf 'Error: %s\n' "$*" >&2; exit 1; }

main() {
  version='__SHUMAI_CLI_VERSION__'
  install_dir="${HOME:?HOME must be set}/.local/bin"
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --version|--install-dir)
        [ "$#" -ge 2 ] && [ -n "$2" ] || fail "$1 requires a value"
        case "$1" in --version) version=${2#v} ;; --install-dir) install_dir=$2 ;; esac
        shift 2 ;;
      --help|-h)
        printf 'Usage: install.sh [--version X.Y.Z] [--install-dir DIRECTORY]\n'
        return ;;
      *) fail "Unknown option: $1" ;;
    esac
  done
  printf '%s\n' "$version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z]+([.-][0-9A-Za-z]+)*)?$' || fail 'Use a release installer or pass --version X.Y.Z'
  case "$install_dir" in /*) ;; *) fail '--install-dir must be an absolute path' ;; esac

  case "$(uname -s)" in
    Darwin) platform=darwin ;;
    Linux)
      platform=linux
      if ldd --version 2>&1 | grep -qi musl; then fail 'Linux musl/Alpine is not supported; use the npm package instead'; fi ;;
    *) fail 'Supported systems are macOS and Linux with glibc' ;;
  esac
  machine=$(uname -m)
  if [ "$platform" = darwin ] && [ "$(sysctl -n hw.optional.arm64 2>/dev/null || true)" = 1 ]; then machine=arm64; fi
  case "$machine" in
    arm64|aarch64) arch=arm64 ;;
    x86_64|amd64) arch=x64 ;;
    *) fail "Unsupported CPU architecture: $machine" ;;
  esac

  command -v tar >/dev/null 2>&1 || fail 'tar is required'
  if command -v curl >/dev/null 2>&1; then downloader=curl
  elif command -v wget >/dev/null 2>&1; then downloader=wget
  else fail 'curl or wget is required'; fi
  if command -v sha256sum >/dev/null 2>&1; then hasher=sha256sum
  elif command -v shasum >/dev/null 2>&1; then hasher=shasum
  else fail 'sha256sum or shasum is required'; fi

  destination="$install_dir/shumai-cli"
  marker="$install_dir/.shumai-cli-install"
  if [ -e "$destination" ] || [ -L "$destination" ]; then
    [ ! -L "$destination" ] && [ -f "$marker" ] && [ "$(cat "$marker")" = shumai-cli ] || fail "Refusing to replace an unmanaged installation at $destination; choose --install-dir"
  fi

  temporary=$(mktemp -d "${TMPDIR:-/tmp}/shumai-install.XXXXXX")
  staged=''
  trap 'rm -rf "$temporary"; if [ -n "$staged" ]; then rm -f "$staged"; fi' 0
  trap 'exit 1' HUP INT TERM
  archive="shumai-cli-v$version-$platform-$arch.tar.gz"
  base="${SHUMAI_CLI_RELEASE_BASE_URL:-https://github.com/shumaiOne/shumai/releases/download}/v$version"
  download() {
    if [ "$downloader" = curl ]; then curl -fsSL --retry 2 --connect-timeout 10 "$base/$1" -o "$2"
    else wget -q "$base/$1" -O "$2"; fi
  }
  download checksums.txt "$temporary/checksums.txt"
  expected=$(awk -v name="$archive" '$2 == name { print $1 }' "$temporary/checksums.txt")
  [ "${#expected}" -eq 64 ] || fail "Missing or ambiguous checksum for $archive"
  case "$expected" in *[!0-9a-f]*) fail 'Invalid SHA-256 checksum' ;; esac
  download "$archive" "$temporary/$archive"
  if [ "$hasher" = sha256sum ]; then actual=$(sha256sum "$temporary/$archive")
  else actual=$(shasum -a 256 "$temporary/$archive"); fi
  [ "${actual%% *}" = "$expected" ] || fail 'Download checksum does not match; existing installation preserved'

  tar -xzf "$temporary/$archive" -C "$temporary" shumai-cli
  [ -f "$temporary/shumai-cli" ] && [ ! -L "$temporary/shumai-cli" ] || fail 'Archive does not contain the CLI executable'
  chmod 755 "$temporary/shumai-cli"
  [ "$("$temporary/shumai-cli" --version)" = "$version" ] || fail 'Downloaded CLI version does not match'
  mkdir -p "$install_dir"
  staged=$(mktemp "$install_dir/.shumai-cli.XXXXXX")
  cp "$temporary/shumai-cli" "$staged"
  chmod 755 "$staged"
  printf 'shumai-cli\n' > "$marker"
  mv -f "$staged" "$destination"
  staged=''
  printf 'Installed shumai-cli %s to %s\n' "$version" "$destination"
  case ":${PATH:-}:" in
    *":$install_dir:"*) ;;
    *)
      escaped_install_dir=$(printf '%s' "$install_dir" | sed "s/'/'\\\\''/g")
      printf '\nTo use shumai-cli in this terminal (Bash/Zsh), run:\n'
      printf "  export PATH='%s':\"\$PATH\"\n" "$escaped_install_dir"
      printf '\nFor future terminals, add that line to ~/.bashrc (Bash) or ~/.zshrc (Zsh).\n'
      printf 'For Bash login shells, use your existing login profile\n(e.g. ~/.bash_profile or ~/.profile).\n'
      printf 'Open a new terminal after saving. If already configured, skip this step.\n'
      ;;
  esac
  resolved=$(command -v shumai-cli || true)
  if [ -n "$resolved" ] && [ "$resolved" != "$destination" ]; then
    printf 'Your PATH currently selects another installation: %s\n' "$resolved"
  fi
}

main "$@"
