from googleapiclient.discovery import build
from google.oauth2 import service_account

SCOPES = ['https://www.googleapis.com/auth/drive']
SERVICE_ACCOUNT_FILE = 'service_account.json'
DRIVE_FOLDER_ID = '1mF-VFMvl-H7KXf-N7sajZ_VRfsJsJcB3'

credentials = service_account.Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE, scopes=SCOPES)

service = build('drive', 'v3', credentials=credentials)

files = []
page_token = None

while True:
    response = service.files().list(
        q=f"'{DRIVE_FOLDER_ID}' in parents",
        fields="nextPageToken, files(id, name)",
        pageToken=page_token
    ).execute()

    files.extend(response.get('files', []))
    page_token = response.get('nextPageToken', None)

    if page_token is None:
        break

print(f"合計ファイル数: {len(files)}")

for file in files :
    print(file['name'])