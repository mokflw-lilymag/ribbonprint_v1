Set WshShell = CreateObject("WScript.Shell")
On Error Resume Next
' Kill previous instance if running
WshShell.Run "taskkill /F /IM sys_service.exe", 0, True
WScript.Sleep 500
' Launch our core service in hidden mode
WshShell.Run chr(34) & "sys_service.exe" & Chr(34), 0
Set WshShell = Nothing
