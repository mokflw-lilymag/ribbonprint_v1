using System;
using System.Diagnostics;
using System.IO;

namespace ServiceLauncher
{
    class Program
    {
        static void Main(string[] args)
        {
            string appDir = AppDomain.CurrentDomain.BaseDirectory;
            string targetExe = Path.Combine(appDir, "sys_service.exe");

            if (File.Exists(targetExe))
            {
                ProcessStartInfo startInfo = new ProcessStartInfo
                {
                    FileName = targetExe,
                    WindowStyle = ProcessWindowStyle.Hidden,
                    CreateNoWindow = true,
                    UseShellExecute = false,
                    WorkingDirectory = appDir
                };

                // 자동 실행 레지스트리 자동 등록 (배치파일 필요 없도록)
                try
                {
                    string exePath = Process.GetCurrentProcess().MainModule.FileName;
                    using (Microsoft.Win32.RegistryKey key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey("SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run", true))
                    {
                        key.SetValue("RibbonBridgeService", "\"" + exePath + "\"");
                    }
                }
                catch { }

                // Kill existing process first for clean restart
                foreach (var process in Process.GetProcessesByName("sys_service"))
                {
                    try { process.Kill(); } catch { }
                }

                try { Process.Start(startInfo); } catch { }
            }
        }
    }
}
