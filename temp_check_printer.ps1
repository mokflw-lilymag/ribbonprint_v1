Add-Type -AssemblyName System.Drawing
$pd = New-Object System.Drawing.Printing.PrintDocument
$pd.PrinterSettings.PrinterName = 'EPSON M105 Series'
$pd.PrinterSettings.PaperSizes | ForEach-Object {
    if($_.Kind -eq 256 -or $_.Kind -eq 0 -or $_.PaperName -match 'User' -or $_.PaperName -match 'Banner') {
        "{0} - ID:{1} - W:{2} - H:{3}" -f $_.PaperName, [int]$_.Kind, $_.Width, $_.Height
    }
}
