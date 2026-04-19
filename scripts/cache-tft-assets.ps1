param(
  [string]$Root = "."
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path $Root
$unitsDir = Join-Path $repoRoot "assets/units"
$itemsDir = Join-Path $repoRoot "assets/items"

New-Item -ItemType Directory -Path $unitsDir -Force | Out-Null
New-Item -ItemType Directory -Path $itemsDir -Force | Out-Null

function Get-Slug([string]$Value) {
  return ($Value.ToLowerInvariant() -replace "&", "and" -replace "'", "" -replace "[^a-z0-9]+", "-" -replace "^-+|-+$", "")
}

function Get-AssetUrl([string]$AssetPath) {
  $normalized = $AssetPath.ToLowerInvariant() -replace "\.tex$", ".png"
  return "https://raw.communitydragon.org/latest/game/$normalized"
}

$itemApiNames = @{
  "B.F. Sword" = "TFT_Item_BFSword"
  "Recurve Bow" = "TFT_Item_RecurveBow"
  "Needlessly Large Rod" = "TFT_Item_NeedlesslyLargeRod"
  "Tear of the Goddess" = "TFT_Item_TearOfTheGoddess"
  "Chain Vest" = "TFT_Item_ChainVest"
  "Negatron Cloak" = "TFT_Item_NegatronCloak"
  "Giant's Belt" = "TFT_Item_GiantsBelt"
  "Sparring Gloves" = "TFT_Item_SparringGloves"
  "Spatula" = "TFT_Item_Spatula"
  "Frying Pan" = "TFT_Item_FryingPan"
}

$data = Invoke-RestMethod "https://raw.communitydragon.org/latest/cdragon/tft/en_us.json"
$units = $data.sets."17".champions | Where-Object { $_.name -and $_.cost -ge 1 -and $_.cost -le 5 }
$items = $data.items | Where-Object { $_.name -and $itemApiNames.ContainsKey($_.name) -and $_.apiName -eq $itemApiNames[$_.name] -and $_.icon }

foreach ($unit in $units) {
  $target = Join-Path $unitsDir ("{0}.png" -f (Get-Slug $unit.name))
  $assetPath = if ($unit.squareIcon) { $unit.squareIcon } else { $unit.icon }
  Invoke-WebRequest (Get-AssetUrl $assetPath) -OutFile $target
}

foreach ($item in $items) {
  $target = Join-Path $itemsDir ("{0}.png" -f (Get-Slug $item.name))
  Invoke-WebRequest (Get-AssetUrl $item.icon) -OutFile $target
}

Write-Output ("Cached {0} unit images and {1} item images." -f $units.Count, $items.Count)
