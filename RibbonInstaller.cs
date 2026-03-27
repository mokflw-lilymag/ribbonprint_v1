using System;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Windows.Forms;
using Microsoft.Win32;
using System.Runtime.InteropServices;

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
            string zipPath = Path.Combine(localAppData, "RibbonBridgeUpdates.zip");

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

                // 2. 최신 버전 다운로드 (웹 인스톨러 방식)
                Form downForm = new Form();
                downForm.Text = "다운로드 중...";
                downForm.Size = new System.Drawing.Size(400, 100);
                downForm.StartPosition = FormStartPosition.CenterScreen;
                downForm.ControlBox = false;
                
                Label lbl = new Label();
                lbl.Text = "최신 브릿지 엔진을 클라우드에서 다운로드하고 있습니다...\n(잠시만 기다려주세요)";
                lbl.AutoSize = true;
                lbl.Location = new System.Drawing.Point(20, 20);
                downForm.Controls.Add(lbl);
                
                downForm.Show();
                Application.DoEvents();

                ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
                using (WebClient client = new WebClient())
                {
                    string url = "https://github.com/mokflw-lilymag/ribbonprint_v1/raw/main/RibbonBridge_Setup.zip";
                    client.DownloadFile(url, zipPath);
                }

                downForm.Close();

                // 3. 압축 풀기 및 설치
                if (File.Exists(zipPath))
                {
                    // 기존 파일들 삭제
                    DirectoryInfo di = new DirectoryInfo(installDir);
                    foreach (FileInfo file in di.GetFiles())
                    {
                        try { file.Delete(); } catch { }
                    }

                    ZipFile.ExtractToDirectory(zipPath, installDir);
                    File.Delete(zipPath); // Cleanup
                }
                else
                {
                    throw new Exception("다운로드된 파일을 찾을 수 없습니다.");
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

                MessageBox.Show("설치가 성공적으로 완료되었습니다!\n이제 리본 인쇄 버튼을 누르시면 곧바로 인쇄가 시작됩니다.\n\n(컴퓨터가 켜질 때마다 브릿지가 자동으로 백그라운드에서 조용히 실행됩니다.)", "설치 완료", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            catch (Exception ex)
            {
                MessageBox.Show("설치 중 오류가 발생했습니다.\n" + ex.Message + "\n\n인터넷 연결을 확인하시거나 백신 프로그램의 차단 여부를 확인해 주십시오.", "설치 오류", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }
}
