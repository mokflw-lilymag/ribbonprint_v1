from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import logging
import os
import tempfile
from typing import Optional, List, Dict
import threading
import time

# 기존 브릿지 모듈 임포트
from printer_bridge import RibbonPrinterBridge, PrinterManager
from print_agent import CloudPrintAgent, get_user_id, set_user_id


# -----------------------------------------------------
# 로깅 설정
# -----------------------------------------------------
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(name)s - %(message)s')
logger = logging.getLogger("BridgeServer")

app = FastAPI(title="Ribbon Print Bridge Agent")

# CORS 활성화 (로컬 웹앱 테스트를 위함)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: 운영 시 특정 오리진으로 제한 (예: http://localhost:5173)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------------------------------
# 전역 상태 (PrinterManager 인스턴스 싱글톤 유지)
# -----------------------------------------------------
printer_manager = PrinterManager()
cloud_agent = None
cloud_agent_thread = None

def start_cloud_agent():
    global cloud_agent, cloud_agent_thread
    uid = get_user_id()
    if uid:
        logger.info(f"Starting cloud print background agent for user: {uid}")
        if not cloud_agent:
            cloud_agent = CloudPrintAgent()
        
        if not cloud_agent_thread or not cloud_agent_thread.is_alive():
            cloud_agent_thread = threading.Thread(target=cloud_agent.run, daemon=True)
            cloud_agent_thread.start()
    else:
        logger.info("No user ID found for auto-pairing. Waiting for web app connection...")

# Call on startup
start_cloud_agent()


# -----------------------------------------------------
# API 모델 (웹앱으로부터 받을 JSON Schema)
# -----------------------------------------------------
class PrintJobRequest(BaseModel):
    printer_name: str
    configs: Dict[str, dict]  # {'경조사': config_dict, '보내는이': config_dict}

class PrintImageRequest(BaseModel):
    printer_name: str
    image_base64: str  # data:image/png;base64,....
    width_mm: float
    length_mm: float
    media_type: Optional[str] = "roll" # "roll" or "cut"

class AutoPairRequest(BaseModel):
    user_id: str

# -----------------------------------------------------
# HTTP 엔드포인트
# -----------------------------------------------------

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Ribbon Print Bridge Agent is running"}

@app.get("/api/printers")
def list_printers():
    """연결 가능한 지원 프린터 목록을 반환합니다."""
    try:
        # printer_manager.get_available_printers() -> refresh_printers() to ensure latest list
        printers = printer_manager.refresh_printers()
        return {"status": "success", "data": printers}
    except Exception as e:
        logger.error(f"Failed to get printer list: {e}")
        return {"status": "error", "message": str(e)}

@app.post("/api/print")
def submit_print_job(job: PrintJobRequest):
    """실제 인쇄를 실행하지 않고 에러를 방지하기 위해 둡니다."""
    logger.info(f"Received print job request for printer: {job.printer_name}")
    return {"status": "success", "message": "Print job simulated. Please use /api/print_image for actual output."}

@app.post("/api/print_image")
def submit_print_image(job: PrintImageRequest):
    """프론트엔드에서 렌더링된 이미지를 받아 출력합니다."""
    logger.info(f"Received image print job for printer: {job.printer_name}")
    try:
        if not job.printer_name:
            raise HTTPException(status_code=400, detail="Printer name is required")
        
        # 1. 프린터 선택
        success = printer_manager.select_printer(job.printer_name)
        if not success:
             return {"status": "error", "message": f"Failed to select printer {job.printer_name}"}

        # 2. 이미지 디코딩 및 인쇄
        import base64
        import io
        from PIL import Image
        
        image_data = job.image_base64.split(",")[1]
        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        
        # 브릿지로 이미지 전송 (이미 구현된 _send_to_printer 활용)
        res = printer_manager.bridge._send_to_printer(image, {'리본넓이': job.width_mm, '리본길이': job.length_mm})
        
        if res:
            return {"status": "success"}
        else:
            return {"status": "error", "message": "Printing failed in bridge"}
            
    except Exception as e:
        logger.error(f"Error during image print: {e}")
        return {"status": "error", "message": str(e)}

@app.post("/api/pair")
def pair_bridge_agent(req: AutoPairRequest):
    """로컬 브릿지와 현재 로그인한 사용자를 자동 연결합니다."""
    try:
        current_uid = get_user_id()
        if current_uid != req.user_id:
            logger.info(f"Pairing bridge to new user ID: {req.user_id}")
            set_user_id(req.user_id)
            if cloud_agent:
                cloud_agent.user_id = req.user_id
            start_cloud_agent()
        return {"status": "success", "message": "Bridge is automatically paired."}
    except Exception as e:
        logger.error(f"Auto pair failed: {e}")
        return {"status": "error", "message": str(e)}


if __name__ == "__main__":
    logger.info("Starting Print Bridge Agent...")
    # 브릿지 서버를 로컬호스트(127.0.0.1) 8000포트에서 실행
    uvicorn.run(app, host="127.0.0.1", port=8000)
