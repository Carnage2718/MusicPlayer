import os
import subprocess
import boto3
from googleapiclient.discovery import build
from google.oauth2 import service_account
from googleapiclient.http import MediaIoBaseDownload
import io

SERVICE_ACCOUNT_FILE = 'service_account.json'
DRIVE_FOLDER_ID = '1mF-VFMvl-H7KXf-N7sajZ_VRfsJsJcB3'
R2_BUCKET = 'musicplayer'
R2_ENDPOINT = 'https://b5c85d39f96ff83f554c1aedf278736f.r2.cloudflarestorage.com'
R2_ACCESS_KEY = '61798cf7e8e0ea59f62d9cf8819f8022'
R2_SECRET_KEY = 'e6d0d1f3fffe2f27cce250161dcf8e62bb2e8d5476d0aee9bcb3fd6a3d5c76f8'

# ===== Drive接続 =====
SCOPES = ['https://www.googleapis.com/auth/drive']
credentials = service_account.Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE, scopes=SCOPES)
drive_service = build('drive', 'v3', credentials=credentials)

# ===== R2接続 =====
s3 = boto3.client(
    's3',
    endpoint_url=R2_ENDPOINT,
    aws_access_key_id=R2_ACCESS_KEY,
    aws_secret_access_key=R2_SECRET_KEY
)

# ===== 1件取得 =====
response = drive_service.files().list(
    q=f"'{DRIVE_FOLDER_ID}' in parents and mimeType='audio/x-m4a'",
    fields="files(id, name)",
    pageSize=1
).execute()

file = response['files'][0]
file_id = file['id']
file_name = file['name']

print("ダウンロード中:", file_name)

# ===== ダウンロード =====
request = drive_service.files().get_media(fileId=file_id)
fh = io.FileIO(file_name, 'wb')
downloader = MediaIoBaseDownload(fh, request)

done = False
while not done:
    status, done = downloader.next_chunk()

fh.close()

# ===== 128kbps変換 =====
output_name = "converted_" + file_name

subprocess.run([
    "ffmpeg", "-i", file_name,
    "-b:a", "128k",
    output_name
])

print("変換完了")

# ===== R2アップロード =====
s3.upload_file(output_name, R2_BUCKET, output_name)

print("R2アップロード完了")

# ===== ローカル削除 =====
os.remove(file_name)
os.remove(output_name)

print("ローカル削除完了")
print("🎉 1曲処理成功")