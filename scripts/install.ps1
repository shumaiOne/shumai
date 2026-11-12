param(
    [string]$Version = '__SHUMAI_CLI_VERSION__',
    [string]$InstallDir = (Join-Path $env:LOCALAPPDATA 'Shumai\bin'),
    [switch]$NoModifyPath
)
$ErrorActionPreference = 'Stop'
$Version = $Version -replace '^v', ''
if ($Version -notmatch '^\d+\.\d+\.\d+(-[0-9A-Za-z]+([.-][0-9A-Za-z]+)*)?$') {
    throw 'Use a release installer or pass -Version X.Y.Z'
}
if (-not [IO.Path]::IsPathRooted($InstallDir)) { throw '-InstallDir must be an absolute path' }
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'Use install.sh on macOS or Linux' }
# Read the native OS architecture from the machine environment, avoiding both
# process emulation and PSReadLine's conflicting RuntimeInformation type on PS 5.1.
$architecture = [Environment]::GetEnvironmentVariable('PROCESSOR_ARCHITECTURE', 'Machine')
if (!$architecture) { $architecture = $env:PROCESSOR_ARCHITEW6432 }
if (!$architecture) { $architecture = $env:PROCESSOR_ARCHITECTURE }
$architecture = "$architecture".ToLowerInvariant()
switch ($architecture) {
    'arm64' { $arch = 'arm64' }
    'amd64' { $arch = 'x64' }
    'x64' { $arch = 'x64' }
    default { throw "Unsupported CPU architecture: $architecture" }
}
$destination = Join-Path $InstallDir 'shumai-cli.exe'
$marker = Join-Path $InstallDir '.shumai-cli-install'
if (Test-Path -LiteralPath $destination) {
    if ((Get-Item -LiteralPath $destination).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Refusing to replace a linked installation' }
    if (!(Test-Path -LiteralPath $marker) -or (Get-Content -LiteralPath $marker -Raw).Trim() -ne 'shumai-cli') {
        throw "Refusing to replace an unmanaged installation at $destination; choose -InstallDir"
    }
}
$temporary = Join-Path ([IO.Path]::GetTempPath()) ([IO.Path]::GetRandomFileName())
$staged = $null
try {
    $null = New-Item -ItemType Directory -Path $temporary
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    $base = 'https://github.com/shumaiOne/shumai/releases/download'
    if ($env:SHUMAI_CLI_RELEASE_BASE_URL) { $base = $env:SHUMAI_CLI_RELEASE_BASE_URL.TrimEnd('/') }
    $base = "$base/v$Version"
    $archive = "shumai-cli-v$Version-windows-$arch.zip"
    $manifest = Join-Path $temporary 'checksums.txt'
    Invoke-WebRequest -UseBasicParsing -Uri "$base/checksums.txt" -OutFile $manifest
    $pattern = '^[a-f0-9]{64}  ' + [regex]::Escape($archive) + '$'
    $matchesChecksum = @(Get-Content -LiteralPath $manifest | Where-Object { $_ -cmatch $pattern })
    if ($matchesChecksum.Count -ne 1) { throw "Missing or ambiguous checksum for $archive" }
    $archivePath = Join-Path $temporary $archive
    Invoke-WebRequest -UseBasicParsing -Uri "$base/$archive" -OutFile $archivePath
    $actual = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -cne $matchesChecksum[0].Substring(0, 64)) { throw 'Download checksum does not match; existing installation preserved' }
    Expand-Archive -LiteralPath $archivePath -DestinationPath $temporary
    $executable = Join-Path $temporary 'shumai-cli.exe'
    if (!(Test-Path -LiteralPath $executable -PathType Leaf)) { throw 'Archive does not contain the CLI executable' }
    $binaryVersion = & $executable --version
    if ($LASTEXITCODE -ne 0 -or "$binaryVersion".Trim() -ne $Version) { throw 'Downloaded CLI version does not match' }
    $null = New-Item -ItemType Directory -Path $InstallDir -Force
    $staged = Join-Path $InstallDir ([IO.Path]::GetRandomFileName())
    Copy-Item -LiteralPath $executable -Destination $staged
    Set-Content -LiteralPath $marker -Value 'shumai-cli' -Encoding ASCII
    if (Test-Path -LiteralPath $destination) { [IO.File]::Replace($staged, $destination, $null) }
    else { [IO.File]::Move($staged, $destination) }
    $staged = $null
    if (!$NoModifyPath) {
        $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
        if (($userPath -split ';') -notcontains $InstallDir) {
            [Environment]::SetEnvironmentVariable('Path', "$InstallDir;$userPath", 'User')
        }
        Write-Output 'Open a new terminal to use the updated user PATH.'
    }
    Write-Output "Installed shumai-cli $Version to $destination"
    $resolved = Get-Command shumai-cli -ErrorAction SilentlyContinue
    if ($resolved -and $resolved.Source -ne $destination) { Write-Output "Your PATH currently selects another installation: $($resolved.Source)" }
}
finally {
    if ($staged -and (Test-Path -LiteralPath $staged)) { Remove-Item -LiteralPath $staged -Force }
    if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Recurse -Force }
}
