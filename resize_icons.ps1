Add-Type -AssemblyName System.Drawing

$src = "C:\Users\Muhammed\.gemini\antigravity-ide\brain\efd0f654-aace-44ed-8d3a-c75f4f13f109\.user_uploaded\media_1788910164668.jpg"
$assetsDir = "c:\Users\Muhammed\Desktop\EXIF\assets"

if (-not (Test-Path $assetsDir)) {
    New-Item -ItemType Directory -Path $assetsDir -Force | Out-Null
}

Copy-Item $src "$assetsDir\logo.jpg" -Force

$img = [System.Drawing.Image]::FromFile($src)

function Resize-Img($image, $width, $height, $outPath) {
    $bmp = New-Object System.Drawing.Bitmap $width, $height
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($image, 0, 0, $width, $height)
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
}

Resize-Img $img 512 512 "$assetsDir\icon-512.png"
Resize-Img $img 192 192 "$assetsDir\icon-192.png"
Resize-Img $img 180 180 "$assetsDir\apple-touch-icon.png"
Resize-Img $img 64 64 "$assetsDir\favicon.png"
Resize-Img $img 32 32 "$assetsDir\favicon-32.png"

$img.Dispose()
Get-ChildItem $assetsDir | Select-Object Name, Length
