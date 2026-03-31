[Setup]
AppName=RibbonBridge Server
AppVersion=25.0
AppPublisher=RibbonSaaS
DefaultDirName={localappdata}\RibbonBridge
DisableDirPage=yes
DefaultGroupName=RibbonBridge
DisableProgramGroupPage=yes
OutputBaseFilename=RibbonBridge_Setup_v25_0
Compression=lzma
SolidCompression=yes
PrivilegesRequired=lowest
ChangesEnvironment=no
CloseApplications=force
RestartApplications=no

[Files]
Source: "RibbonBridge_Dist\system\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Run]
Filename: "{app}\launch_service.exe"; Flags: nowait postinstall runhidden; Description: "Start RibbonBridge Service"

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "RibbonBridgeService"; ValueData: """{app}\launch_service.exe"""; Flags: uninsdeletevalue
