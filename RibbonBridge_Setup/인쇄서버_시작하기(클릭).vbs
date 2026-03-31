Set WshShell = CreateObject("WScript.Shell")
On Error Resume Next
WshShell.Run "taskkill /F /IM RibbonBridge_Core.exe", 0, True
WScript.Sleep 500
WshShell.Run chr(34) & "RibbonBridge_Core.exe" & Chr(34), 0
Set WshShell = Nothing
