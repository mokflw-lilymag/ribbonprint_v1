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
                "리본 브릿지(RibbonBridge) v6.1 설치 마법사를 시작합니다.\n인쇄를 위한 필수 파일이 자동으로 컴퓨터에 설정됩니다.\n\n계속하시겠습니까?", 
                "RibbonBridge 설치", 
                MessageBoxButtons.YesNo, 
                MessageBoxIcon.Information);

            if (result != DialogResult.Yes) return;

            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string installDir = Path.Combine(localAppData, "RibbonBridge");
            string zipPath = Path.Combine(localAppData, "RibbonBridge_Embedded.zip");

            try
            {
                // 1. 기존 프로세스 강제 종료
                Process[] procs = Process.GetProcessesByName("RibbonBridge_Core");
                foreach (Process p in procs) {
                    try { p.Kill(); p.WaitForExit(); } catch { }
                }

                // 폴더 정리
                if (!Directory.Exists(installDir)) {
                    Directory.CreateDirectory(installDir);
                }

                Form form = new Form();
                form.Text = "설치 중...";
                form.Size = new System.Drawing.Size(400, 100);
                form.StartPosition = FormStartPosition.CenterScreen;
                form.ControlBox = false;
                Label lbl = new Label();
                lbl.Text = "프로그램을 설치하는 중입니다...\n(잠시만 기다려주세요)";
                lbl.AutoSize = true;
                lbl.Location = new System.Drawing.Point(20, 20);
                form.Controls.Add(lbl);
                form.Show();
                Application.DoEvents();

                // 2. 내부 리소스에서 ZIP 파일 추출 (인터넷 다운로드 제거 -> 바이러스 오탐지 방지)
                using (Stream stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("RibbonBridge_Setup.zip"))
                {
                    if (stream == null) throw new Exception("설치 프로그램 내부에 필요한 패키지가 없습니다.");
                    using (FileStream fileStream = new FileStream(zipPath, FileMode.Create))
                    {
                        byte[] buffer = new byte[8192];
                        int bytesRead;
                        while ((bytesRead = stream.Read(buffer, 0, buffer.Length)) > 0)
                        {
                            fileStream.Write(buffer, 0, bytesRead);
                        }
                    }
                }

                // 3. 압축 풀기 및 설치
                if (File.Exists(zipPath))
                {
                    // 기존 파일들 삭제
                    DirectoryInfo di = new DirectoryInfo(installDir);
                    foreach (FileInfo file in di.GetFiles()) {
                        try { file.Delete(); } catch { }
                    }
                    ZipFile.ExtractToDirectory(zipPath, installDir);
                    File.Delete(zipPath); // Cleanup
                }

                // 4. 레지스트리에 윈도우 시작 시 자동 실행 등록
                string runKey = @"SOFTWARE\Microsoft\Windows\CurrentVersion\Run";
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(runKey, true))
                {
                    string vbsScript = Path.Combine(installDir, "인쇄서버_시작하기(클릭).vbs");
                    string runValue = "\"" + vbsScript + "\"";
                    key.SetValue("RibbonBridgeAutoStart", runValue);
                }

                // 5. 백그라운드 서버 재시작
                string startScript = Path.Combine(installDir, "인쇄서버_시작하기(클릭).vbs");
                if (File.Exists(startScript))
                {
                    ProcessStartInfo startInfo = new ProcessStartInfo();
                    startInfo.FileName = startScript;
                    startInfo.WorkingDirectory = installDir;
                    startInfo.UseShellExecute = true;
                    Process.Start(startInfo);
                }

                form.Close();
                MessageBox.Show("설치가 성공적으로 완료되었습니다!\n이제 리본 인쇄 버튼을 누르시면 곧바로 인쇄가 시작됩니다.\n\n(컴퓨터가 켜질 때마다 브릿지가 자동으로 백그라운드에서 실행됩니다.)", "설치 완료", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            catch (Exception ex)
            {
                MessageBox.Show("설치 중 오류가 발생했습니다.\n" + ex.Message, "설치 오류", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }
}
