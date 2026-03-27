using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

public class RawPrinterHelper {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

    public static bool SendBytesToPrinter(string szPrinterName, byte[] bytes) {
        IntPtr hPrinter = new IntPtr(0);
        DOCINFOA di = new DOCINFOA();
        di.pDocName = "RibbonMaker Native Engine v4.0 (ESC/P Roll Mode)";
        di.pDataType = "RAW"; 
        
        if (OpenPrinter(szPrinterName, out hPrinter, IntPtr.Zero)) {
            if (StartDocPrinter(hPrinter, 1, di)) {
                if (StartPagePrinter(hPrinter)) {
                    Int32 dwWritten = 0;
                    IntPtr pBytes = Marshal.AllocCoTaskMem(bytes.Length);
                    Marshal.Copy(bytes, 0, pBytes, bytes.Length);
                    WritePrinter(hPrinter, pBytes, bytes.Length, out dwWritten);
                    EndPagePrinter(hPrinter);
                    Marshal.FreeCoTaskMem(pBytes);
                    EndDocPrinter(hPrinter);
                    ClosePrinter(hPrinter);
                    return true;
                }
                EndDocPrinter(hPrinter);
            }
            ClosePrinter(hPrinter);
        }
        return false;
    }
}

public class EpsonESCPBuilder {
    private MemoryStream ms = new MemoryStream();

    private void Send(byte[] data) {
        ms.Write(data, 0, data.Length);
    }
    private void Send(string data) {
        byte[] b = Encoding.ASCII.GetBytes(data);
        ms.Write(b, 0, b.Length);
    }
    private void SendExt(string code, byte[] argData) {
        if (argData == null) argData = new byte[0];
        Send("\x1B(" + code);
        ms.Write(BitConverter.GetBytes((ushort)argData.Length), 0, 2);
        Send(argData);
    }

    private void Remote1Cmd(string cmd, byte[] argData) {
        if (argData == null) argData = new byte[0];
        Send(cmd);
        ushort len = (ushort)(argData.Length + 1);
        ms.Write(BitConverter.GetBytes(len), 0, 2);
        ms.WriteByte(0); // Response byte
        Send(argData);
    }

    public byte[] BuildRasterJob(Bitmap bmp, float w_mm, float l_mm, float margin_center_mm, int dpi = 360) {
        ms.SetLength(0);

        // 1. Packet Mode Exit & Init
        Send("\x00\x00\x00\x1B\x01@EJL 1284.4\n@EJL     \n");
        Send("\x1B@");

        // 2. REMOTE1 HARDWARE HACK (Forces Printer into Roll Paper Mode to Bypass A4 Limit)
        Send("\x1B(R\x08\x00\x00REMOTE1");
        
        DateTime now = DateTime.Now;
        byte[] timeData = new byte[6];
        timeData[0] = (byte)(now.Year >> 8); timeData[1] = (byte)(now.Year & 0xFF);
        timeData[2] = (byte)now.Month; timeData[3] = (byte)now.Day;
        timeData[4] = (byte)now.Hour; timeData[5] = (byte)now.Minute;
        Remote1Cmd("TI", timeData);

        Remote1Cmd("JS", new byte[] { 0, 0, 0 });
        
        byte[] headerData = new byte[5 + 10]; 
        headerData[0] = 0; headerData[1] = 0; headerData[2] = 0; headerData[3] = 0; headerData[4] = 0;
        Array.Copy(Encoding.ASCII.GetBytes("ESCPPRLib\x00"), 0, headerData, 5, 10);
        Remote1Cmd("JH", headerData);

        Remote1Cmd("HD", new byte[] { 3, 4 });
        
        // *** THE MAGIC BULLET: PP (Paper Path) = 0 (ASF/Auto) 대신 3 (ROLL PAPER)를 사용하면 
        // 롤 기능이 없는 데스크탑 EPSON (M105 등)은 에러를 내고 멈춥니다.
        // 모든 범용 호환을 위해 0(Auto/ASF)으로 설정합니다.
        Remote1Cmd("PP", new byte[] { 0, 0 }); 
        
        Send("\x1B\x00\x00\x00"); // Exit REMOTE1

        Send("\x1B@"); // Init again as per ESC/P specs

        // 3. ESC/P Setup Commands
        SendExt("G", new byte[] { 1 });
        Send("\x1BU\x01"); // Unidirectional (better for continuous text)
        SendExt("K", new byte[] { 0, 1 }); // Monochrome
        SendExt("D", new byte[] { 0xA0, 0x05, 4, 4 }); // 360 DPI

        // The user's table defines Center Margin exactly!
        // We use that to calculate Left Physical Offset from printer's 0 edge
        float leftOffsetMM = margin_center_mm - (w_mm / 2.0f);
        if (leftOffsetMM < 0) leftOffsetMM = 0;
        
        // We set the paper width safely to cover the full physical area (A4 width 210mm)
        // so the margin fits perfectly inside without clipping
        uint paperWidth = (uint)Math.Ceiling(210.0 / 25.4 * dpi); 
        uint paperHeight = (uint)Math.Ceiling(l_mm / 25.4 * dpi);

        MemoryStream cData = new MemoryStream();
        cData.Write(BitConverter.GetBytes((uint)0), 0, 4); // Top Margin 0
        cData.Write(BitConverter.GetBytes(paperHeight), 0, 4); // Bottom Margin full length
        SendExt("c", cData.ToArray());

        MemoryStream sData = new MemoryStream();
        sData.Write(BitConverter.GetBytes(paperWidth), 0, 4);
        sData.Write(BitConverter.GetBytes(paperHeight), 0, 4);
        SendExt("S", sData.ToArray());

        SendExt("m", new byte[] { 0x12 }); // Print method

        // 4. HIGH SPEED Raster Data Transmission (LockBits turbo mode)
        SendExt("V", BitConverter.GetBytes((uint)0)); 

        int columns = bmp.Width;
        int bytesPerRow = (columns + 7) / 8; 
        uint emptyLines = 0;
        
        uint horizontalShift = (uint)Math.Round(leftOffsetMM / 25.4 * dpi);

        // === PERFORMANCE: LockBits for direct memory pixel access (10-50x faster than GetPixel) ===
        BitmapData bmpData = bmp.LockBits(
            new Rectangle(0, 0, bmp.Width, bmp.Height),
            ImageLockMode.ReadOnly,
            PixelFormat.Format32bppArgb
        );
        int stride = bmpData.Stride;
        byte[] pixelBuffer = new byte[Math.Abs(stride) * bmp.Height];
        Marshal.Copy(bmpData.Scan0, pixelBuffer, 0, pixelBuffer.Length);
        bmp.UnlockBits(bmpData);

        for (int y = 0; y < bmp.Height; y++) {
            byte[] lineData = new byte[bytesPerRow];
            bool lineHasData = false;
            int rowOffset = y * Math.Abs(stride);

            for (int b = 0; b < bytesPerRow; b++) {
                byte val = 0;
                for (int bit = 0; bit < 8; bit++) {
                    int x = b * 8 + bit;
                    if (x < bmp.Width) {
                        int pixelOffset = rowOffset + x * 4; // ARGB = 4 bytes per pixel
                        byte blue  = pixelBuffer[pixelOffset];
                        byte green = pixelBuffer[pixelOffset + 1];
                        byte red   = pixelBuffer[pixelOffset + 2];
                        byte alpha = pixelBuffer[pixelOffset + 3];
                        if ((red + green + blue) / 3 < 128 && alpha > 128) {
                            val |= (byte)(0x80 >> bit);
                            lineHasData = true;
                        }
                    }
                }
                lineData[b] = val;
            }

            if (lineHasData) {
                // Perform skipped blank lines feed instantly
                if (emptyLines > 0) {
                    SendExt("v", BitConverter.GetBytes(emptyLines));
                    emptyLines = 0;
                }

                // MAGIC PHYSICAL ALIGNMENT HACK:
                SendExt("$", BitConverter.GetBytes(horizontalShift)); 
                
                MemoryStream iCmd = new MemoryStream();
                iCmd.WriteByte(0); // Color: Black
                iCmd.WriteByte(0); // CMode: Uncompressed
                iCmd.WriteByte(1); // BPP: 1
                iCmd.Write(BitConverter.GetBytes((ushort)lineData.Length), 0, 2);
                iCmd.Write(BitConverter.GetBytes((ushort)1), 0, 2);
                iCmd.Write(lineData, 0, lineData.Length);
                
                Send("\x1Bi");
                Send(iCmd.ToArray());

                // Advance single line
                SendExt("v", BitConverter.GetBytes((uint)1)); 
            } else {
                emptyLines++;
            }
        }

        if (emptyLines > 0) {
            SendExt("v", BitConverter.GetBytes(emptyLines));
        }

        // 5. Close Job
        Send("\x0C"); // Form Feed (cut/eject)
        Send("\x1B@"); 

        return ms.ToArray();
    }
}

public class RibbonPrinter {
    public static int Main(string[] args) {
        if (args.Length < 4) return 1;

        string printerName = args[0];
        string imagePath = args[1];
        float w_mm = float.Parse(args[2]);
        float l_mm = float.Parse(args[3]);
        
        // Derive or read the Center Margin. Default calculation derived from table (Offset ~34.5 + half width)
        float margin_mm = 34.5f + (w_mm / 2.0f); 
        if (args.Length >= 5) {
            float.TryParse(args[4], out margin_mm);
        }

        using (Bitmap origBmp = new Bitmap(imagePath)) {
            int pxWidth = (int)Math.Ceiling(w_mm / 25.4 * 360);
            int pxHeight = (int)Math.Ceiling(l_mm / 25.4 * 360);

            using (Bitmap resBmp = new Bitmap(pxWidth, pxHeight)) {
                using (Graphics g = Graphics.FromImage(resBmp)) {
                    g.Clear(Color.White);
                    g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                    g.DrawImage(origBmp, 0, 0, pxWidth, pxHeight);
                }

                EpsonESCPBuilder builder = new EpsonESCPBuilder();
                byte[] rawData = builder.BuildRasterJob(resBmp, w_mm, l_mm, margin_mm, 360);

                if (RawPrinterHelper.SendBytesToPrinter(printerName, rawData)) {
                    Console.WriteLine("SUCCESS");
                    return 0;
                }
            }
        }
        return 1;
    }
}
