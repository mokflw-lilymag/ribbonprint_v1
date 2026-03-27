# -*- coding: utf-8 -*-
"""
프린터 브릿지 드라이버 모듈
엡손 M/L 시리즈 프린터를 위한 베너 출력 지원
"""

import win32print
import win32ui
import win32gui
import win32con
from PIL import Image, ImageDraw, ImageFont
import os
import tempfile
from typing import Optional, List, Dict, Tuple
import logging

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class RibbonPrinterBridge:
    """리본 프린터 브릿지 클래스 - 독자적인 드라이버"""
    
    # 지원 프린터 모델별 설정
    PRINTER_MODELS = {
        # 엡손 M 시리즈
        'M100': {
            'brand': 'Epson',
            'max_width': 80,  # mm
            'max_length': 1000,  # mm
            'dpi': 180,
            'esc_commands': True,
            'driver_type': 'epson_esc_p'
        },
        'M105': {
            'brand': 'Epson',
            'max_width': 80,
            'max_length': 1000,
            'dpi': 180,
            'esc_commands': True,
            'driver_type': 'epson_esc_p'
        },
        'M200': {
            'brand': 'Epson',
            'max_width': 80,
            'max_length': 1000,
            'dpi': 180,
            'esc_commands': True,
            'driver_type': 'epson_esc_p'
        },
        # 엡손 L 시리즈
        'L100': {
            'brand': 'Epson',
            'max_width': 100,
            'max_length': 1000,
            'dpi': 180,
            'esc_commands': True,
            'driver_type': 'epson_esc_p'
        },
        'L200': {
            'brand': 'Epson',
            'max_width': 100,
            'max_length': 1000,
            'dpi': 180,
            'esc_commands': True,
            'driver_type': 'epson_esc_p'
        },
        # HP 프린터
        'HP_LaserJet': {
            'brand': 'HP',
            'max_width': 210,  # A4 폭
            'max_length': 297,  # A4 길이
            'dpi': 300,
            'esc_commands': False,
            'driver_type': 'hp_pcl'
        },
        'HP_DeskJet': {
            'brand': 'HP',
            'max_width': 210,
            'max_length': 297,
            'dpi': 300,
            'esc_commands': False,
            'driver_type': 'hp_pcl'
        },
        'HP_OfficeJet': {
            'brand': 'HP',
            'max_width': 210,
            'max_length': 297,
            'dpi': 300,
            'esc_commands': False,
            'driver_type': 'hp_pcl'
        }
    }
    
    def __init__(self):
        self.current_printer = None
        self.printer_info = None
        
    def detect_supported_printers(self) -> List[Dict]:
        """시스템에서 지원되는 프린터 감지 (독자적인 브릿지 드라이버 사용)"""
        printers = []
        
        try:
            # 시스템의 모든 프린터 목록 가져오기
            printer_list = win32print.EnumPrinters(
                win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS
            )
            
            for printer in printer_list:
                printer_name = printer[2]
                
                # 지원되는 프린터인지 확인 (엡손, HP 등)
                if self._is_supported_printer(printer_name):
                    printer_info = {
                        'name': printer_name,
                        'model': self._extract_model(printer_name),
                        'brand': self._extract_brand(printer_name),
                        'status': self._get_printer_status(printer_name),
                        'bridge_driver': True  # 우리 브릿지 드라이버 사용
                    }
                    printers.append(printer_info)
                    
        except Exception as e:
            logger.error(f"프린터 감지 중 오류: {e}")
            
        return printers
    
    def _is_supported_printer(self, printer_name: str) -> bool:
        """지원되는 프린터인지 확인 (엡손, HP 등)"""
        name_lower = printer_name.lower()
        
        # 엡손 프린터 키워드
        epson_keywords = ['epson', 'm100', 'm105', 'm200', 'l100', 'l200', 'm-series', 'l-series']
        
        # HP 프린터 키워드
        hp_keywords = ['hp', 'hewlett', 'packard', 'laserjet', 'deskjet', 'officejet', 'pavilion']
        
        return any(keyword in name_lower for keyword in epson_keywords + hp_keywords)
    
    def _extract_model(self, printer_name: str) -> str:
        """프린터 모델 추출"""
        name_lower = printer_name.lower()
        
        # 엡손 모델 확인
        for model in ['M100', 'M105', 'M200', 'L100', 'L200']:
            if model.lower() in name_lower:
                return model
        
        # HP 모델 확인
        if 'laserjet' in name_lower:
            return 'HP_LaserJet'
        elif 'deskjet' in name_lower:
            return 'HP_DeskJet'
        elif 'officejet' in name_lower:
            return 'HP_OfficeJet'
        
        return 'Unknown'
    
    def _extract_brand(self, printer_name: str) -> str:
        """프린터 브랜드 추출"""
        name_lower = printer_name.lower()
        
        if 'epson' in name_lower or any(model.lower() in name_lower for model in ['M100', 'M105', 'M200', 'L100', 'L200']):
            return 'Epson'
        elif 'hp' in name_lower or 'hewlett' in name_lower or 'packard' in name_lower:
            return 'HP'
        
        return 'Unknown'
    
    def _get_printer_status(self, printer_name: str) -> str:
        """프린터 상태 확인"""
        try:
            handle = win32print.OpenPrinter(printer_name)
            status = win32print.GetPrinter(handle, 2)
            win32print.ClosePrinter(handle)
            
            if status['Status'] == 0:
                return 'Ready'
            else:
                return 'Busy/Error'
        except:
            return 'Unknown'
    
    def select_printer(self, printer_name: str) -> bool:
        """프린터 선택"""
        try:
            self.current_printer = printer_name
            self.printer_info = self._get_printer_details(printer_name)
            logger.info(f"프린터 선택됨: {printer_name}")
            return True
        except Exception as e:
            logger.error(f"프린터 선택 실패: {e}")
            return False
    
    def _get_printer_details(self, printer_name: str) -> Dict:
        """프린터 상세 정보 가져오기"""
        model = self._extract_model(printer_name)
        return {
            'name': printer_name,
            'model': model,
            'specs': self.PRINTER_MODELS.get(model, self.PRINTER_MODELS['M100'])
        }
    
    def print_banner(self, ribbon_config: Dict, text_config: Dict) -> bool:
        """베너 형태로 리본 출력"""
        try:
            if not self.current_printer:
                raise Exception("프린터가 선택되지 않았습니다")
            
            # 베너 이미지 생성
            banner_image = self._create_banner_image(ribbon_config, text_config)
            
            # 프린터로 전송
            success = self._send_to_printer(banner_image, ribbon_config)
            
            if success:
                logger.info("베너 출력 완료")
            else:
                logger.error("베너 출력 실패")
                
            return success
            
        except Exception as e:
            logger.error(f"베너 출력 중 오류: {e}")
            return False
    
    def _create_banner_image(self, ribbon_config: Dict, text_config: Dict) -> Image.Image:
        """베너 이미지 생성"""
        # 리본 크기 계산 (mm를 픽셀로 변환)
        ribbon_width_mm = ribbon_config.get('리본넓이', 50)
        ribbon_length_mm = ribbon_config.get('리본길이', 400)
        dpi = self.printer_info['specs']['dpi']
        
        # mm를 픽셀로 변환 (1인치 = 25.4mm)
        width_px = int(ribbon_width_mm * dpi / 25.4)
        length_px = int(ribbon_length_mm * dpi / 25.4)
        
        # 이미지 생성 (흰색 배경)
        image = Image.new('RGB', (width_px, length_px), 'white')
        draw = ImageDraw.Draw(image)
        
        # 텍스트 렌더링
        self._render_banner_text(draw, text_config, ribbon_config, width_px, length_px, dpi)
        
        return image
    
    def _render_banner_text(self, draw: ImageDraw.Draw, text_config: Dict, 
                           ribbon_config: Dict, width_px: int, length_px: int, dpi: int):
        """베너 텍스트 렌더링"""
        try:
            # 폰트 설정
            font_size = int(ribbon_config.get('글자크기', 40) * dpi / 25.4)
            font_path = self._get_font_path(text_config.get('font', 'Arial'))
            
            if font_path and os.path.exists(font_path):
                font = ImageFont.truetype(font_path, font_size)
            else:
                font = ImageFont.load_default()
            
            # 텍스트 내용
            right_text = text_config.get('경조사', '')
            left_text = text_config.get('보내는이', '')
            
            # 여백 설정
            top_margin = int(ribbon_config.get('상단여백', 80) * dpi / 25.4)
            bottom_margin = int(ribbon_config.get('하단여백', 50) * dpi / 25.4)
            lace_margin = int(ribbon_config.get('레이스', 5) * dpi / 25.4)
            
            # 텍스트 영역 계산
            text_area_width = width_px - (lace_margin * 2)
            text_area_height = length_px - top_margin - bottom_margin
            
            # 텍스트 중앙 정렬로 그리기
            if right_text:
                self._draw_centered_text(draw, right_text, font, 
                                       width_px//2, top_margin + text_area_height//4,
                                       text_area_width, 'black')
            
            if left_text:
                self._draw_centered_text(draw, left_text, font,
                                       width_px//2, top_margin + text_area_height*3//4,
                                       text_area_width, 'black')
                                       
        except Exception as e:
            logger.error(f"텍스트 렌더링 오류: {e}")
    
    def _draw_centered_text(self, draw: ImageDraw.Draw, text: str, font: ImageFont.ImageFont,
                           center_x: int, center_y: int, max_width: int, color: str):
        """중앙 정렬 텍스트 그리기"""
        try:
            # 텍스트 크기 측정
            bbox = draw.textbbox((0, 0), text, font=font)
            text_width = bbox[2] - bbox[0]
            text_height = bbox[3] - bbox[1]
            
            # 텍스트가 너무 크면 크기 조정
            if text_width > max_width:
                # 폰트 크기를 줄여서 다시 시도
                return
            
            # 중앙 정렬 위치 계산
            x = center_x - text_width // 2
            y = center_y - text_height // 2
            
            # 텍스트 그리기
            draw.text((x, y), text, font=font, fill=color)
            
        except Exception as e:
            logger.error(f"텍스트 그리기 오류: {e}")
    
    def _get_font_path(self, font_name: str) -> Optional[str]:
        """폰트 파일 경로 찾기"""
        # Windows 폰트 경로들
        font_paths = [
            r'C:\Windows\Fonts',
            r'C:\Windows\System32\Fonts'
        ]
        
        for font_path in font_paths:
            if os.path.exists(font_path):
                for file in os.listdir(font_path):
                    if font_name.lower() in file.lower() and file.endswith(('.ttf', '.otf')):
                        return os.path.join(font_path, file)
        
        return None
    
    def _send_to_printer(self, image: Image.Image, ribbon_config: Dict) -> bool:
        """이미지를 프린터로 전송"""
        # 임시 파일 저장 절차를 건너뛰고 바로 GDI DC로 출력 합니다.
        return self._print_image_file(image, ribbon_config)
    
    def _print_image_file(self, image: Image.Image, ribbon_config: Dict) -> bool:
        """이미지 객체를 프린터로 직접 출력 (GDI 방식 - 전문가용 패치 4.0)"""
        try:
            from PIL import ImageWin
            
            # 리본 규격 가져오기 (mm)
            width_mm = ribbon_config.get('리본넓이', 50)
            length_mm = ribbon_config.get('리본길이', 400)
            
            # 1. 프린터 핸들 및 기본 설정 획득
            phandle = win32print.OpenPrinter(self.current_printer)
            pinfo = win32print.GetPrinter(phandle, 2)
            devmode = pinfo['pDevMode']
            
            # 2. 강제 커스텀 용지 설정 (핵심!)
            # 0.1mm 단위로 설정 (win32print 특성)
            devmode.PaperSize = 0  # DMPAPER_USER
            devmode.PaperWidth = int(width_mm * 10)
            devmode.PaperLength = int(length_mm * 10)
            # 드라이버에게 우리가 가로/세로/사이즈를 직접 정의했음을 알림
            devmode.Fields |= win32print.DM_PAPERSIZE | win32print.DM_PAPERWIDTH | win32print.DM_PAPERLENGTH
            
            # 3. DC 생성 (수정된 devmode를 전달하여 드라이버 제약 우회)
            hdc_handle = win32gui.CreateDC("WINSPOOL", self.current_printer, devmode)
            hdc = win32ui.CreateDCFromHandle(hdc_handle)
            
            # 4. 해상도 및 물리적 픽셀 계산
            printer_dpi_x = hdc.GetDeviceCaps(88) # LOGPIXELSX
            printer_dpi_y = hdc.GetDeviceCaps(90) # LOGPIXELSY
            
            phys_width = int(width_mm * printer_dpi_x / 25.4)
            phys_length = int(length_mm * printer_dpi_y / 25.4)
            
            # 5. 인쇄 작업 시작
            job_name = f"RibbonPrint_{int(width_mm)}x{int(length_mm)}mm"
            hdc.StartDoc(job_name)
            hdc.StartPage()
            
            # 6. 이미지 그리기 (물리적 영역에 스케일링하여 투사)
            dib = ImageWin.Dib(image.convert("RGB"))
            # StretchDIBits 느낌으로 물리적 크기에 맞춰 출력
            dib.draw(hdc.GetHandleOutput(), (0, 0, phys_width, phys_length))
            
            hdc.EndPage()
            hdc.EndDoc()
            hdc.DeleteDC()
            win32print.ClosePrinter(phandle)
            
            logger.info(f"Expert Print SUCCESS: {width_mm}x{length_mm}mm on {self.current_printer}")
            return True
            
        except Exception as e:
            logger.error(f"이미지 GDI 출력 오류: {e}")
            if 'hdc' in locals():
                try: hdc.DeleteDC()
                except: pass
            return False


class PrinterManager:
    """프린터 관리 클래스 - 독자적인 브릿지 드라이버"""
    
    def __init__(self):
        self.bridge = RibbonPrinterBridge()
        self.available_printers = []
        
    def refresh_printers(self):
        """프린터 목록 새로고침"""
        self.available_printers = self.bridge.detect_supported_printers()
        return self.available_printers
    
    def get_printer_list(self) -> List[str]:
        """프린터 이름 목록 반환"""
        return [printer['name'] for printer in self.available_printers]
    
    def select_printer(self, printer_name: str) -> bool:
        """프린터 선택"""
        return self.bridge.select_printer(printer_name)
    
    def print_ribbon(self, ribbon_config: Dict, text_config: Dict) -> bool:
        """리본 출력"""
        return self.bridge.print_banner(ribbon_config, text_config)
    
    def get_current_printer_info(self) -> Optional[Dict]:
        """현재 선택된 프린터 정보 반환"""
        return self.bridge.printer_info
