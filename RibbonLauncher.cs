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
