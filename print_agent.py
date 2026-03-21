import requests
import base64
import io
import time
import os
import json
import logging
from PIL import Image
from printer_bridge import PrinterManager

# Configuration
SUPABASE_URL = "https://rzyppdqawepbsjmtjvuo.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6eXBwZHFhd2VwYnNqbXRqdnVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NDYzOTksImV4cCI6MjA4OTUyMjM5OX0.RYcyWC6t3Vwt0408TZ0bnM_x_w8J5LFLX-cieDi8GfM"

# Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("PrintAgent")

# Local Settings
USER_ID_FILE = ".print_agent_userid"

def get_user_id():
    """Returns the user_id this agent is responsible for."""
    if os.path.exists(USER_ID_FILE):
        with open(USER_ID_FILE, 'r') as f:
            return f.read().strip()
    return None

def set_user_id(uid):
    with open(USER_ID_FILE, 'w') as f:
        f.write(uid)

class CloudPrintAgent:
    def __init__(self):
        self.printer_manager = PrinterManager()
        self.user_id = get_user_id()
        self.headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }

    def fetch_pending_jobs(self):
        if not self.user_id:
            logger.warning("USER_ID not set. Please set it in .print_agent_userid")
            return []
        
        # Poll pending jobs for this user
        url = f"{SUPABASE_URL}/rest/v1/print_jobs?user_id=eq.{self.user_id}&status=eq.pending&select=*"
        try:
            response = requests.get(url, headers=self.headers)
            if response.ok:
                return response.json()
            else:
                logger.error(f"Failed to fetch jobs: {response.status_code} {response.text}")
        except Exception as e:
            logger.error(f"Error fetching jobs: {e}")
        return []

    def update_job_status(self, job_id, status, error=None):
        url = f"{SUPABASE_URL}/rest/v1/print_jobs?id=eq.{job_id}"
        payload = {"status": status, "error_message": error}
        try:
            requests.patch(url, headers=self.headers, json=payload)
        except Exception as e:
            logger.error(f"Failed to update status for {job_id}: {e}")

    def process_job(self, job):
        job_id = job['id']
        printer_name = job['printer_name']
        logger.info(f"Processing job {job_id} for printer {printer_name}")
        
        try:
            # Update status to printing
            self.update_job_status(job_id, 'printing')

            # Detect and select printer
            self.printer_manager.refresh_printers()
            if not printer_name:
                # If no printer specified, try the first available one
                printers = self.printer_manager.get_printer_list()
                if not printers:
                    raise Exception("Available printers not found on this machine.")
                printer_name = printers[0]
            
            if not self.printer_manager.select_printer(printer_name):
                 raise Exception(f"Could not select printer: {printer_name}")

            # Decode Image
            image_data = job['image_base64'].split(",")[1]
            image_bytes = base64.b64decode(image_data)
            image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
            
            # Print
            res = self.printer_manager.bridge._send_to_printer(image, {
                '리본넓이': job['width_mm'], 
                '리본길이': job['length_mm']
            })
            
            if res:
                self.update_job_status(job_id, 'completed')
                logger.info(f"Job {job_id} completed successfully.")
            else:
                raise Exception("Printing failed in bridge driver.")

        except Exception as e:
            logger.error(f"Error processing job {job_id}: {e}")
            self.update_job_status(job_id, 'failed', str(e))

    def run(self):
        logger.info(f"Cloud Print Agent started for User: {self.user_id}")
        while True:
            jobs = self.fetch_pending_jobs()
            if jobs:
                for job in jobs:
                    self.process_job(job)
            time.sleep(5)  # Poll every 5 seconds

if __name__ == "__main__":
    agent = CloudPrintAgent()
    if not agent.user_id:
        print("--- SETUP MODE ---")
        uid = input("Please enter the Store/User UUID from the Web App Settings: ")
        if uid:
            set_user_id(uid)
            agent.user_id = uid
            print(f"Setup complete. Agent will now poll for User ID: {uid}")
        else:
            print("User ID is required. Exiting.")
            exit(1)
            
    agent.run()
