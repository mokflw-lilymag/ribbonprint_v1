using System;
using System.Diagnostics;
using System.IO;
using System.Threading;
using Microsoft.Win32;

namespace ServiceLauncher
{
    class Program
    {
        static void Main(string[] args)
        {
            // Ensure single instance of launcher to avoid duplicates
            bool createdNew;
            using (Mutex mutex = new Mutex(true, "RibbonBridgeLauncher_Mutex", out createdNew))
            {
                if (!createdNew) return;

                string appDir = AppDomain.CurrentDomain.BaseDirectory;
                // Prefer RibbonBridge_Core.exe or sys_service.exe
                string targetExe = Path.Combine(appDir, "RibbonBridge_Core.exe");
                if (!File.Exists(targetExe)) targetExe = Path.Combine(appDir, "sys_service.exe");

                // Early exit if the core binary isn't found
                if (!File.Exists(targetExe)) return;

                // Ensure auto-start registry entry is always present
                EnsureAutoStart();

                // Infinite loop to serve as a watchdog
                while (true)
                {
                    try
                    {
                        // Check if the service is currently running
                        string procName = Path.GetFileNameWithoutExtension(targetExe);
                        Process[] processes = Process.GetProcessesByName(procName);

                        if (processes.Length == 0)
                        {
                            // If NO service found, start it with hidden window
                            ProcessStartInfo startInfo = new ProcessStartInfo
                            {
                                FileName = targetExe,
                                WindowStyle = ProcessWindowStyle.Hidden,
                                CreateNoWindow = true,
                                UseShellExecute = false,
                                WorkingDirectory = appDir
                            };
                            Process.Start(startInfo);
                        }
                    }
                    catch { /* Silence errors to keep watchdog alive */ }

                    // Check every 10 seconds
                    Thread.Sleep(10000);
                }
            }
        }

        static void EnsureAutoStart()
        {
            try
            {
                string exePath = Process.GetCurrentProcess().MainModule.FileName;
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey("SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run", true))
                {
                    key.SetValue("RibbonBridgeService", "\"" + exePath + "\"");
                }
            }
            catch { }
        }
    }
}

