using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

// ═══════════════════════════════════════════════════════════
// RibbonBridge HP PCL5 Native Engine
// HP 잉크젯/레이저 프린터용 RAW 래스터 인쇄 엔진
// PCL5 프로토콜로 드라이버 우회하여 커스텀 용지 크기 지원
// ═══════════════════════════════════════════════════════════

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
        di.pDocName = "RibbonBridge HP PCL5 Engine v1.0";
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

/// <summary>
/// HP PCL5 래스터 명령 빌더
/// PCL5 프로토콜 사양에 따라 래스터 그래픽 데이터를 구성
/// 참고: HP PCL5 Printer Language Technical Reference Manual
/// </summary>
public class HPPCLBuilder {
    private MemoryStream ms = new MemoryStream();
    
    private void Send(string data) {
        byte[] b = Encoding.ASCII.GetBytes(data);
        ms.Write(b, 0, b.Length);
    }
    
    private void Send(byte[] data) {
        ms.Write(data, 0, data.Length);
    }

    /// <summary>
    /// PCL5 래스터 인쇄 작업 빌드
    /// </summary>
    /// <param name="bmp">인쇄할 비트맵 (흑백 변환됨)</param>
    /// <param name="w_mm">리본 폭 (mm)</param>
    /// <param name="l_mm">리본 길이 (mm)</param>
    /// <param name="dpi">해상도 (기본 300)</param>
    public byte[] BuildRasterJob(Bitmap bmp, float w_mm, float l_mm, float margin_center_mm, int dpi = 300) {
        ms.SetLength(0);
        
        // ══════════════════════════════════════
        // 1. PCL5 초기화 & 리셋
        // ══════════════════════════════════════
        Send("\x1BE");  // PCL Reset (ESC E)
        
        // ══════════════════════════════════════
        // 2. 페이지 크기 설정 (커스텀)
        // ══════════════════════════════════════
        // PCL decipoints = mm * 283.46 / 10 = mm * 28.346
        // 실제로는 1/720 inch 단위: mm / 25.4 * 720
        int widthDecipoints = (int)Math.Round(w_mm / 25.4 * 720);
        int lengthDecipoints = (int)Math.Round(l_mm / 25.4 * 720);
        
        // Custom Page Size (PCL5 command)
        // ESC&l#A - Page Size (101 = Custom)
        Send("\x1B&l101A");
        
        // ESC&l#p#P - Custom paper dimensions (decipoints)
        // Width x Height in 1/720 inch
        Send(String.Format("\x1B&l{0}p{1}P", widthDecipoints, lengthDecipoints));
        
        // ══════════════════════════════════════
        // 3. 기본 인쇄 설정
        // ══════════════════════════════════════
        Send("\x1B&l0O");   // Orientation: Portrait
        Send("\x1B&l0E");   // Top margin: 0
        Send("\x1B&l0L");   // Lines per page: 0 (disable text mode)
        Send("\x1B&a0V");   // Vertical cursor position: 0
        
        // Horizontal cursor: position at left margin (margin_center - ribbon_width/2)
        float leftOffsetMM = margin_center_mm - (w_mm / 2.0f);
        if (leftOffsetMM < 0) leftOffsetMM = 0;
        int leftOffsetDecipoints = (int)Math.Round(leftOffsetMM / 25.4 * 720);
        Send(String.Format("\x1B&a{0}H", leftOffsetDecipoints));
        
        // ══════════════════════════════════════
        // 4. 래스터 그래픽 모드 설정
        // ══════════════════════════════════════
        // Set resolution
        Send(String.Format("\x1B*t{0}R", dpi));
        
        // Raster Graphics Presentation Mode (0 = current orientation)
        Send("\x1B*r0F");
        
        // Source raster width and height
        Send(String.Format("\x1B*r{0}S", bmp.Width));
        Send(String.Format("\x1B*r{0}T", bmp.Height));
        
        // Start raster graphics at current cursor position
        Send("\x1B*r1A");
        
        // Compression mode: 0 = Uncompressed (most compatible)
        Send("\x1B*b0M");
        
        // ══════════════════════════════════════
        // 5. 고속 래스터 데이터 전송
        // ══════════════════════════════════════
        int bytesPerRow = (bmp.Width + 7) / 8;
        
        // LockBits for high-performance pixel access
        BitmapData bmpData = bmp.LockBits(
            new Rectangle(0, 0, bmp.Width, bmp.Height),
            ImageLockMode.ReadOnly,
            PixelFormat.Format32bppArgb
        );
        int stride = Math.Abs(bmpData.Stride);
        byte[] pixelBuffer = new byte[stride * bmp.Height];
        Marshal.Copy(bmpData.Scan0, pixelBuffer, 0, pixelBuffer.Length);
        bmp.UnlockBits(bmpData);
        
        for (int y = 0; y < bmp.Height; y++) {
            byte[] lineData = new byte[bytesPerRow];
            int rowOffset = y * stride;
            
            for (int b = 0; b < bytesPerRow; b++) {
                byte val = 0;
                for (int bit = 0; bit < 8; bit++) {
                    int x = b * 8 + bit;
                    if (x < bmp.Width) {
                        int pixelOffset = rowOffset + x * 4;
                        byte blue  = pixelBuffer[pixelOffset];
                        byte green = pixelBuffer[pixelOffset + 1];
                        byte red   = pixelBuffer[pixelOffset + 2];
                        byte alpha = pixelBuffer[pixelOffset + 3];
                        // Convert to monochrome
                        if ((red + green + blue) / 3 < 128 && alpha > 128) {
                            val |= (byte)(0x80 >> bit);
                        }
                    }
                }
                lineData[b] = val;
            }
            
            // Transfer Raster Data by Row
            // ESC*b#W[data] - Transfer raster row (#=byte count)
            Send(String.Format("\x1B*b{0}W", bytesPerRow));
            Send(lineData);
        }
        
        // ══════════════════════════════════════
        // 6. 래스터 종료 & 페이지 출력
        // ══════════════════════════════════════
        Send("\x1B*rB");   // End raster graphics
        Send("\x0C");      // Form Feed (eject page)
        Send("\x1BE");     // PCL Reset (clean state for next job)
        
        return ms.ToArray();
    }
}

/// <summary>
/// HP 프린터 전용 리본 인쇄 엔트리포인트
/// 사용법: ribbon_printer_hp.exe "프린터이름" "이미지파일" 폭mm 길이mm [margin_center_mm]
/// </summary>
public class RibbonPrinterHP {
    public static int Main(string[] args) {
        if (args.Length < 4) {
            Console.Error.WriteLine("Usage: ribbon_printer_hp.exe <printer_name> <image_path> <width_mm> <length_mm> [margin_center_mm]");
            return 1;
        }

        string printerName = args[0];
        string imagePath   = args[1];
        float w_mm = float.Parse(args[2]);
        float l_mm = float.Parse(args[3]);
        int dpi = 300;
        
        // margin_center_mm: 프린트헤드 0점에서 리본 중심까지 거리
        float margin_mm = 34.5f + (w_mm / 2.0f); // 기본값
        if (args.Length >= 5) {
            float.TryParse(args[4], out margin_mm);
        }

        try {
            using (Bitmap origBmp = new Bitmap(imagePath)) {
                // Resize to target DPI dimensions
                int pxWidth  = (int)Math.Ceiling(w_mm / 25.4 * dpi);
                int pxHeight = (int)Math.Ceiling(l_mm / 25.4 * dpi);

                using (Bitmap resBmp = new Bitmap(pxWidth, pxHeight)) {
                    using (Graphics g = Graphics.FromImage(resBmp)) {
                        g.Clear(Color.White);
                        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                        g.DrawImage(origBmp, 0, 0, pxWidth, pxHeight);
                    }

                    HPPCLBuilder builder = new HPPCLBuilder();
                    byte[] rawData = builder.BuildRasterJob(resBmp, w_mm, l_mm, margin_mm, dpi);
                    
                    Console.Error.WriteLine(String.Format(
                        "[HP-PCL] Job: {0}x{1}mm @ {2}dpi | Image: {3}x{4}px | RAW: {5}KB",
                        w_mm, l_mm, dpi, pxWidth, pxHeight, rawData.Length / 1024
                    ));

                    if (RawPrinterHelper.SendBytesToPrinter(printerName, rawData)) {
                        Console.WriteLine("SUCCESS");
                        return 0;
                    } else {
                        Console.Error.WriteLine("[HP-PCL] SendBytesToPrinter failed. Check printer connection.");
                    }
                }
            }
        } catch (Exception ex) {
            Console.Error.WriteLine("[HP-PCL] Error: " + ex.Message);
        }
        return 1;
    }
}
