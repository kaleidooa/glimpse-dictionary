$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$taskIconDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'extension/icons'
New-Item -ItemType Directory -Force -Path $taskIconDir | Out-Null
foreach ($taskIconSize in @(16, 32, 48, 128)) {
  $taskBitmap = New-Object System.Drawing.Bitmap($taskIconSize, $taskIconSize)
  $taskGraphics = [System.Drawing.Graphics]::FromImage($taskBitmap)
  $taskGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $taskGraphics.ScaleTransform($taskIconSize / 128.0, $taskIconSize / 128.0)
  $taskGreen = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#45693a'))
  $taskCream = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#fffdf4'))
  $taskAccent = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#c5d6a8'))
  $taskShape = New-Object System.Drawing.Drawing2D.GraphicsPath
  $taskShape.AddArc(2, 2, 36, 36, 180, 90)
  $taskShape.AddArc(90, 2, 36, 36, 270, 90)
  $taskShape.AddArc(90, 90, 36, 36, 0, 90)
  $taskShape.AddArc(2, 90, 36, 36, 90, 90)
  $taskShape.CloseFigure()
  $taskGraphics.FillPath($taskGreen, $taskShape)
  $taskPoints = [System.Drawing.PointF[]]@([System.Drawing.PointF]::new(36,28),[System.Drawing.PointF]::new(88,67),[System.Drawing.PointF]::new(66,72),[System.Drawing.PointF]::new(78,95),[System.Drawing.PointF]::new(64,102),[System.Drawing.PointF]::new(53,79),[System.Drawing.PointF]::new(37,95))
  $taskGraphics.FillPolygon($taskCream, $taskPoints)
  $taskGraphics.FillEllipse($taskAccent, 88, 27, 15, 15)
  $taskBitmap.Save((Join-Path $taskIconDir "icon$taskIconSize.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $taskShape.Dispose(); $taskGreen.Dispose(); $taskCream.Dispose(); $taskAccent.Dispose(); $taskGraphics.Dispose(); $taskBitmap.Dispose()
}
