using System;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Windows.Forms;
using Microsoft.Win32;

namespace RibbonBridgeInstaller
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            DialogResult result = MessageBox.Show(
                "🎀 리본 브릿지(RibbonBridge) v25.0 프리미엄 설치를 시작합니다.\n인쇄를 위한 모든 환경이 자동으로 설정됩니다.\n\n지금 설치하시겠습니까?", 
                "RibbonBridge Universal Setup", 
                MessageBoxButtons.YesNo, 
                MessageBoxIcon.Information);

            if (result != DialogResult.Yes) return;

            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string installDir = Path.Combine(localAppData, "RibbonBridge");
            string zipPath = Path.Combine(localAppData, "RibbonBridge_Bundle.zip");

            try
            {
                // 1. 기존 프로세스 강제 종료 (클린 설치 환경 조성)
                string[] targetProcs = { "RibbonBridge_Core", "ribbon_printer", "launch_service" };
                foreach (string procName in targetProcs) {
                    foreach (var p in Process.GetProcessesByName(procName)) {
                        try { p.Kill(); p.WaitForExit(2000); } catch { }
                    }
                }

                // 폴더 정리
                if (!Directory.Exists(installDir)) {
                    Directory.CreateDirectory(installDir);
                }

                Form form = new Form();
                form.Text = "RibbonBridge v25.0 설치 중...";
                form.Size = new System.Drawing.Size(420, 120);
                form.FormBorderStyle = FormBorderStyle.FixedDialog;
                form.StartPosition = FormStartPosition.CenterScreen;
                form.ControlBox = false;
                Label lbl = new Label();
                lbl.Text = "시스템 파일을 안전하게 구성하는 중입니다...\n이 작업은 약 5~10초 정도 소요됩니다.";
                lbl.AutoSize = true;
                lbl.Location = new System.Drawing.Point(30, 30);
                form.Controls.Add(lbl);
                form.Show();
                Application.DoEvents();

                // 2. 임베디드 리소스에서 ZIP 패키지 추출
                // 빌드 시 /resource:RibbonBridge_Temp.zip,RibbonBridgePackage.zip 옵션으로 포함됨
                using (Stream stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("RibbonBridgePackage.zip"))
                {
                    if (stream == null) throw new Exception("설치 프로그램 내부에 패키지 리소스(RibbonBridgePackage.zip)가 누락되었습니다.");
                    using (FileStream fileStream = new FileStream(zipPath, FileMode.Create))
                    {
                        stream.CopyTo(fileStream);
                    }
                }

                // 3. 압축 풀기
                if (File.Exists(zipPath))
                {
                    // 기존 파일 덮어쓰기 위해 정리 (사용 중인 파일 제외)
                    DirectoryInfo di = new DirectoryInfo(installDir);
                    if (di.Exists) {
                        foreach (FileInfo file in di.GetFiles()) { try { file.Delete(); } catch { } }
                        foreach (DirectoryInfo subDir in di.GetDirectories()) { try { subDir.Delete(true); } catch { } }
                    }

                    // ZIP 내부의 'system' 폴더나 'installer.bat' 등이 포함된 구조로 압축되어 있어야 함
                    // 하지만 사용자 편의를 위해 내부 내용을 바로 installDir에 풀기
                    using (ZipArchive archive = ZipFile.OpenRead(zipPath))
                    {
                        foreach (ZipArchiveEntry entry in archive.Entries)
                        {
                            // ZIP 내부의 최상위 폴더명(예: RibbonBridge_Final/)을 제거하고 풀기 위한 로직
                            string relativePath = entry.FullName;
                            int firstSlash = relativePath.IndexOf('/');
                            if (firstSlash > 0) relativePath = relativePath.Substring(firstSlash + 1);
                            if (string.IsNullOrEmpty(relativePath)) continue;

                            string fullPath = Path.Combine(installDir, relativePath);
                            if (entry.FullName.EndsWith("/")) {
                                Directory.CreateDirectory(fullPath);
                            } else {
                                Directory.CreateDirectory(Path.GetDirectoryName(fullPath));
                                entry.ExtractToFile(fullPath, true);
                            }
                        }
                    }
                    File.Delete(zipPath); // Cleanup
                }

                // 4. 레지스트리 자동 실행 설정 (Watchdog 실행 파일 등록)
                string launcherPath = Path.Combine(installDir, "system", "launch_service.exe");
                if (!File.Exists(launcherPath)) launcherPath = Path.Combine(installDir, "launch_service.exe");

                string runKey = @"SOFTWARE\Microsoft\Windows\CurrentVersion\Run";
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(runKey, true))
                {
                    key.SetValue("RibbonBridgeService", "\"" + launcherPath + "\"");
                }

                // 5. 와치독 즉시 실행 (와치독이 코어를 자동으로 띄움)
                if (File.Exists(launcherPath))
                {
                    Process.Start(new ProcessStartInfo(launcherPath) { WorkingDirectory = Path.GetDirectoryName(launcherPath) });
                }


                form.Close();
                MessageBox.Show("🎉 리본폰트 브릿지 v25.0 설치가 완료되었습니다!\n\n이제 웹 사이트에서 바로 인쇄하실 수 있습니다.\n(컴퓨터 시작 시 자동으로 실행됩니다.)", "설치 성공", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            catch (Exception ex)
            {
                MessageBox.Show("설치 도중 문제가 발생했습니다.\n\n오류 내용: " + ex.Message, "설치 실패", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }
}

