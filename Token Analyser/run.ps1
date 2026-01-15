param(
  [string]$Pdf = ".\\Examples\\07-SW-Testing.pdf",
  [int]$OutputTokens = 0,
  [string]$ModelsFile = ".\\models.example.json"
)

$ErrorActionPreference = "Stop"

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

$pythonCmd = (Get-Command python -ErrorAction SilentlyContinue)
if (-not $pythonCmd) {
  $pythonCmd = (Get-Command py -ErrorAction SilentlyContinue)
}
if (-not $pythonCmd) {
  throw "Neither 'python' nor 'py' found in PATH."
}

$venv = Join-Path $here ".venv"
if (-not (Test-Path $venv)) {
  & $pythonCmd.Source -m venv $venv
}

$python = Join-Path $venv "Scripts\\python.exe"
if (-not (Test-Path $python)) {
  throw "Virtualenv python not found at: $python"
}

& $python -m pip install --upgrade pip
& $python -m pip install -r ".\\requirements.txt"

$argsList = @(".\\main.py", $Pdf, "--output-tokens", "$OutputTokens")
if ($ModelsFile -ne "") {
  $argsList += @("--models-file", $ModelsFile)
}

& $python @argsList
