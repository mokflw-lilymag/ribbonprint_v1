using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Windows.Forms;
using Microsoft.Win32;

namespace RibbonBridgeInstaller
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            // TLS 1.2 활성화 (구형 윈도우 지원)
            ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072 | (SecurityProtocolType)768 | SecurityProtocolType.Tls;
            
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new InstallerForm());
        }
    }

    public class InstallerForm : Form
    {
        private ProgressBar progressBar;
        private Label statusLabel;
        private WebClient webClient;
        // GitHub CDN을 통한 v23.0 최신 파일 경로 지정
        private string zipUrl = "https://rzyppdqawepbsjmtjvuo.supabase.co/storage/v1/object/public/assets/guides/RibbonBridge_v23_0.zip";
        private string tempZipPath;
        private string installDir;

        public InstallerForm()
        {
            InitializeComponent();
            tempZipPath = Path.Combine(Path.GetTempPath(), "RibbonBridge_Temp_V23.zip");
            
            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            installDir = Path.Combine(localAppData, "RibbonBridge");
            
            this.Shown += InstallerForm_Shown;
        }

        private void InitializeComponent()
        {
            this.Text = "리본프린터 브릿지 v23.0 설치기";
            this.Size = new Size(400, 160);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;

            statusLabel = new Label
            {
                Text = "최신 브릿지 v23.0을 준비하고 있습니다...",
                Location = new Point(20, 20),
                AutoSize = true,
                Font = new Font("맑은 고딕", 10, FontStyle.Regular)
            };

            progressBar = new ProgressBar
            {
                Location = new Point(20, 50),
                Size = new Size(340, 25),
                Style = ProgressBarStyle.Blocks
            };

            this.Controls.Add(statusLabel);
            this.Controls.Add(progressBar);
        }

        private void InstallerForm_Shown(object sender, EventArgs e)
        {
            StartInstallation();
        }

        private void StartInstallation()
        {
            KillExistingProcesses();

            if (File.Exists(tempZipPath)) File.Delete(tempZipPath);
            
            statusLabel.Text = "최신 파일을 다운로드하는 중입니다... (v23.0)";
            
            webClient = new WebClient();
            webClient.DownloadProgressChanged += WebClient_DownloadProgressChanged;
            webClient.DownloadFileCompleted += WebClient_DownloadFileCompleted;
            
            try {
                webClient.DownloadFileAsync(new Uri(zipUrl), tempZipPath);
            } catch (Exception ex) {
                MessageBox.Show("네트워크 연결에 실패했습니다: " + ex.Message);
                Application.Exit();
            }
        }

        private void WebClient_DownloadProgressChanged(object sender, DownloadProgressChangedEventArgs e)
        {
            progressBar.Value = e.ProgressPercentage;
        }

        private void WebClient_DownloadFileCompleted(object sender, AsyncCompletedEventArgs e)
        {
            if (e.Error != null)
            {
                MessageBox.Show("다운로드 중 오류가 발생했습니다.\n서버 점검 중일 수 있습니다.", "오류", MessageBoxButtons.OK, MessageBoxIcon.Error);
                Application.Exit();
                return;
            }

            try
            {
                statusLabel.Text = "시스템에 최신 브릿지를 설치하는 중입니다...";
                progressBar.Style = ProgressBarStyle.Marquee;
                Application.DoEvents();

                string extractTempDir = Path.Combine(Path.GetTempPath(), "RibbonBridge_Extract_V23");
                if (Directory.Exists(extractTempDir)) Directory.Delete(extractTempDir, true);
                Directory.CreateDirectory(extractTempDir);

                ZipFile.ExtractToDirectory(tempZipPath, extractTempDir);

                if (!Directory.Exists(installDir))
                {
                    Directory.CreateDirectory(installDir);
                }

                // 기존 파일 삭제 후 교체
                DirectoryInfo di = new DirectoryInfo(installDir);
                foreach (FileInfo file in di.GetFiles()) {
                    try { file.Delete(); } catch { }
                }

                // 압축 해제된 파일들을 설치 폴더로 이동
                CopyDirectory(extractTempDir, installDir);
                
                // 임시 파일 정리
                try {
                    Directory.Delete(extractTempDir, true);
                    File.Delete(tempZipPath);
                } catch {}

                statusLabel.Text = "설치 완료! 서비스를 시작합니다...";
                Application.DoEvents();

                // 윈도우 시작 시 자동 실행 등록 (vbs 기반)
                string startScript = Path.Combine(installDir, "인쇄서버_시작하기(클릭).vbs");
                if (File.Exists(startScript)) {
                    RegistryKey rk = Registry.CurrentUser.OpenSubKey("SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run", true);
                    rk.SetValue("RibbonBridgeService", "\"" + startScript + "\"");

                    // 즉시 실행
                    ProcessStartInfo psi = new ProcessStartInfo(startScript);
                    psi.WorkingDirectory = installDir;
                    psi.UseShellExecute = true;
                    Process.Start(psi);
                }

                MessageBox.Show("리본 프린터 브릿지 v23.0 설치가 완벽하게 완료되었습니다!\n이제 바로 인쇄를 시작할 수 있습니다.", "설치 성공 🎉", MessageBoxButtons.OK, MessageBoxIcon.Information);
                Application.Exit();
            }
            catch (Exception ex)
            {
                MessageBox.Show("설치 과정에서 오류가 발생했습니다.\n" + ex.Message, "오류", MessageBoxButtons.OK, MessageBoxIcon.Error);
                Application.Exit();
            }
        }

        private void KillExistingProcesses()
        {
            string[] names = { "launch_service", "sys_service", "RibbonBridge_Core" };
            foreach (string n in names)
            {
                Process[] procs = Process.GetProcessesByName(n);
                foreach (Process p in procs)
                {
                    try { p.Kill(); p.WaitForExit(); } catch { }
                }
            }
        }

        private void CopyDirectory(string sourceDir, string targetDir)
        {
            Directory.CreateDirectory(targetDir);
            foreach (var file in Directory.GetFiles(sourceDir))
            {
                string targetFile = Path.Combine(targetDir, Path.GetFileName(file));
                File.Copy(file, targetFile, true);
            }
            foreach (var directory in Directory.GetDirectories(sourceDir))
            {
                CopyDirectory(directory, Path.Combine(targetDir, Path.GetFileName(directory)));
            }
        }
    }
}
