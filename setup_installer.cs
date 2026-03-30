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
            // Ensure TLS 1.2 is enabled for older Windows systems to connect to Supabase/Cloudflare
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
        private string zipUrl = "https://rzyppdqawepbsjmtjvuo.supabase.co/storage/v1/object/public/assets/guides/RibbonBridge_15_7_2.zip";
        private string tempZipPath;
        private string installDir;

        public InstallerForm()
        {
            InitializeComponent();
            tempZipPath = Path.Combine(Path.GetTempPath(), "RibbonBridge_Temp.zip");
            
            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            installDir = Path.Combine(localAppData, "RibbonBridge");
            
            this.Shown += InstallerForm_Shown;
        }

        private void InitializeComponent()
        {
            this.Text = "리본프린터 브릿지 설치기";
            this.Size = new Size(400, 160);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;

            statusLabel = new Label
            {
                Text = "설치를 준비하고 있습니다...",
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
            
            statusLabel.Text = "브릿지 파일을 다운로드하는 중입니다... (약 30MB)";
            
            webClient = new WebClient();
            webClient.DownloadProgressChanged += WebClient_DownloadProgressChanged;
            webClient.DownloadFileCompleted += WebClient_DownloadFileCompleted;
            webClient.DownloadFileAsync(new Uri(zipUrl), tempZipPath);
        }

        private void WebClient_DownloadProgressChanged(object sender, DownloadProgressChangedEventArgs e)
        {
            progressBar.Value = e.ProgressPercentage;
        }

        private void WebClient_DownloadFileCompleted(object sender, AsyncCompletedEventArgs e)
        {
            if (e.Error != null)
            {
                MessageBox.Show("다운로드 중 오류가 발생했습니다.\n네트워크 상태를 확인해주세요.", "오류", MessageBoxButtons.OK, MessageBoxIcon.Error);
                Application.Exit();
                return;
            }

            try
            {
                statusLabel.Text = "파일의 압축을 원본 해제하고 설치하는 중입니다...";
                progressBar.Style = ProgressBarStyle.Marquee;
                Application.DoEvents();

                string extractTempDir = Path.Combine(Path.GetTempPath(), "RibbonBridge_Extract");
                if (Directory.Exists(extractTempDir)) Directory.Delete(extractTempDir, true);
                Directory.CreateDirectory(extractTempDir);

                ZipFile.ExtractToDirectory(tempZipPath, extractTempDir);

                string sourceSystemDir = Path.Combine(extractTempDir, "system");
                if (!Directory.Exists(sourceSystemDir))
                {
                    // Fallback to searching subdirectories just in case
                    var subDirs = Directory.GetDirectories(extractTempDir, "system", SearchOption.AllDirectories);
                    if (subDirs.Length > 0) sourceSystemDir = subDirs[0];
                }

                if (!Directory.Exists(installDir))
                {
                    Directory.CreateDirectory(installDir);
                }

                // Copy all files from system folder to installDir
                CopyDirectory(sourceSystemDir, installDir);
                
                // Cleanup temp
                Directory.Delete(extractTempDir, true);
                File.Delete(tempZipPath);

                statusLabel.Text = "시작 프로그램 등록 및 완료 중...";
                Application.DoEvents();

                // Add to registry for startup
                string exePath = Path.Combine(installDir, "launch_service.exe");
                RegistryKey rk = Registry.CurrentUser.OpenSubKey("SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run", true);
                rk.SetValue("RibbonBridgeService", "\"" + exePath + "\"");

                // Start the process
                ProcessStartInfo psi = new ProcessStartInfo(exePath);
                psi.WorkingDirectory = installDir;
                psi.WindowStyle = ProcessWindowStyle.Hidden;
                Process.Start(psi);

                MessageBox.Show("리본 프린터 브릿지 설치가 완벽하게 완료되었습니다!\n이제 웹에서 인쇄를 시작하실 수 있습니다.", "설치 성공 🎉", MessageBoxButtons.OK, MessageBoxIcon.Information);
                Application.Exit();
            }
            catch (Exception ex)
            {
                MessageBox.Show("설치 중 오류가 발생했습니다. 권한이 부족할 수 있습니다.\n" + ex.Message, "오류", MessageBoxButtons.OK, MessageBoxIcon.Error);
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
