$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$extensionRoot = [System.IO.Path]::GetFullPath((Join-Path $projectRoot 'dist-extension'))
$releaseRoot = [System.IO.Path]::GetFullPath((Join-Path $projectRoot 'release'))
$extensionVersion = (Get-Content -LiteralPath (Join-Path $extensionRoot 'manifest.json') -Encoding UTF8 -Raw | ConvertFrom-Json).version
if ($extensionVersion -notmatch '^\d+\.\d+\.\d+$') { throw 'Invalid extension version' }
[System.IO.Directory]::CreateDirectory($releaseRoot) | Out-Null
$archivePath = Join-Path $releaseRoot "Glimpse-$extensionVersion.zip"
$archiveStream = [System.IO.File]::Open($archivePath, [System.IO.FileMode]::Create)
$archive = [System.IO.Compression.ZipArchive]::new($archiveStream, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($asset in Get-ChildItem -LiteralPath $extensionRoot -File -Recurse) {
    $entryName = $asset.FullName.Substring($extensionRoot.Length + 1).Replace('\', '/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $asset.FullName, $entryName, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally { $archive.Dispose(); $archiveStream.Dispose() }
$check = [System.IO.Compression.ZipFile]::OpenRead($archivePath)
try {
  $reader = [System.IO.StreamReader]::new($check.GetEntry('manifest.json').Open())
  try { $manifest = $reader.ReadToEnd() | ConvertFrom-Json } finally { $reader.Dispose() }
  $shards = @($check.Entries | Where-Object { $_.FullName -match '^lab/dictionary/(wiktionary|kengdic)/[a-z]\.json$' })
  if ($manifest.version -ne $extensionVersion -or $shards.Count -ne 52) { throw 'ZIP version or dictionary files mismatch' }
  Write-Output "ZIP verified: v$extensionVersion, $($check.Entries.Count) files, $($shards.Count) dictionary shards"
} finally { $check.Dispose() }
$checksum = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
[System.IO.File]::WriteAllText("$archivePath.sha256", "$checksum  Glimpse-$extensionVersion.zip`n", [System.Text.UTF8Encoding]::new($false))
Get-Item -LiteralPath $archivePath | Select-Object Name, Length, LastWriteTime
