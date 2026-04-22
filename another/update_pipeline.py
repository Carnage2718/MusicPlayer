import os
import re
import subprocess
import tempfile
import traceback
import boto3
import psycopg2
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
import io

# ==========================
# 🔐 設定
# ==========================

UNPROCESSED_FOLDER_ID = "16X30SAdoiyt2nErccMsbD4VO_QEGzvG7"
PROCESSED_FOLDER_ID = "1mF-VFMvl-H7KXf-N7sajZ_VRfsJsJcB3"

SERVICE_ACCOUNT_FILE = "service_account.json"

DATABASE_URL = "postgresql://musicplayer_db_p12q_user:NZdzhu4XBJAZ3YM9tysoaRhddDRFjaI2@dpg-d68q4n4r85hc73d09elg-a.oregon-postgres.render.com/musicplayer_db_p12q"

ACCOUNT_ID = "b5c85d39f96ff83f554c1aedf278736f"
ACCESS_KEY = "61798cf7e8e0ea59f62d9cf8819f8022"
SECRET_KEY = "e6d0d1f3fffe2f27cce250161dcf8e62bb2e8d5476d0aee9bcb3fd6a3d5c76f8"
BUCKET_NAME = "musicplayer"

PUBLIC_BASE_URL = f"https://{ACCOUNT_ID}.r2.cloudflarestorage.com/{BUCKET_NAME}/"

# ==========================
# 🎵 Drive接続
# ==========================

creds = Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE,
    scopes=["https://www.googleapis.com/auth/drive"]
)

service = build("drive", "v3", credentials=creds)

# ==========================
# ☁ R2接続
# ==========================

r2 = boto3.client(
    service_name="s3",
    endpoint_url=f"https://{ACCOUNT_ID}.r2.cloudflarestorage.com",
    aws_access_key_id=ACCESS_KEY,
    aws_secret_access_key=SECRET_KEY,
    region_name="auto",
)

# ==========================
# 🗄 DB接続
# ==========================

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

# ==========================
# 🎶 ファイル名パース
# ==========================

def parse_filename(filename):
    name = filename.replace(".m4a", "")
    artists_part, title_part = name.split(" - ", 1)

    main_artists = [a.strip() for a in artists_part.split(",")]

    ft_pattern = re.compile(r'\s+(ft\.|feat\.|featuring)\s+', re.IGNORECASE)
    match = ft_pattern.search(title_part)

    if match:
        title = ft_pattern.split(title_part)[0].strip()
        featuring_raw = title_part[match.end():]
        featuring_artists = [a.strip() for a in featuring_raw.split(",")]
    else:
        title = title_part.strip()
        featuring_artists = []

    return main_artists, title, featuring_artists

# ==========================
# 🚀 メイン処理
# ==========================

results = service.files().list(
    q=f"'{UNPROCESSED_FOLDER_ID}' in parents and trashed=false",
    fields="files(id, name)"
).execute()

files = results.get("files", [])

print(f"\n==={len(files)} 件の未処理ファイルを検出===\n")

for file in files:

    file_id = file["id"]
    filename = file["name"]

    if not filename.endswith(".m4a"):
        continue

    print(f"\n>処理中: {filename}")

    try:
        main_artists, title, ft_artists = parse_filename(filename)
        # ========= ダウンロード =========
        request = service.files().get_media(fileId=file_id)
        temp_input = tempfile.NamedTemporaryFile(delete=False, suffix=".m4a")
        downloader = MediaIoBaseDownload(temp_input, request)

        done = False
        while not done:
            status, done = downloader.next_chunk()

        temp_input.close()

        # ========= 再エンコード =========
        temp_output = tempfile.NamedTemporaryFile(delete=False, suffix=".m4a")
        temp_output.close()

        subprocess.run([
            "ffmpeg",
            "-y",
            "-i", temp_input.name,
            "-c:a", "aac",
            "-b:a", "128k",
            "-ar", "44100",
            "-ac", "2",
            "-movflags", "+faststart",
            temp_output.name
        ], check=True)
        
        converted_filename = f"converted_{filename}"
        # ========= R2アップロード =========
        print(f"R2にアップロード中: {converted_filename}")
        r2.upload_file(temp_output.name, BUCKET_NAME, converted_filename)

        head = r2.head_object(Bucket=BUCKET_NAME, Key=converted_filename)
        file_hash = head["ETag"].replace('"', "")

        stream_url = PUBLIC_BASE_URL + converted_filename

        # ========= DB登録 =========
        print(f"DBに登録中: {filename}")
        main_artists, title, ft_artists = parse_filename(filename)

        cur.execute("""
            INSERT INTO songs (title, normalized_title, stream_url, file_hash)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (file_hash) DO NOTHING
            RETURNING id;
        """, (title, title.lower(), stream_url, file_hash))

        result = cur.fetchone()

        if result:
            song_id = result[0]
            print(f"新規登録: {filename}")

            for artist in main_artists:
                normalized = artist.lower()

                cur.execute("""
                    INSERT INTO artists (name, normalized_name)
                    VALUES (%s, %s)
                    ON CONFLICT (normalized_name) DO NOTHING;
                """, (artist, normalized))

                cur.execute("SELECT id FROM artists WHERE normalized_name = %s;", (normalized,))
                artist_id = cur.fetchone()[0]

                cur.execute("""
                    INSERT INTO song_artists (song_id, artist_id, role)
                    VALUES (%s, %s, 'main')
                    ON CONFLICT DO NOTHING;
                """, (song_id, artist_id))

            for artist in ft_artists:
                normalized = artist.lower()

                cur.execute("""
                    INSERT INTO artists (name, normalized_name)
                    VALUES (%s, %s)
                    ON CONFLICT (normalized_name) DO NOTHING;
                """, (artist, normalized))

                cur.execute("SELECT id FROM artists WHERE normalized_name = %s;", (normalized,))
                artist_id = cur.fetchone()[0]

                cur.execute("""
                    INSERT INTO song_artists (song_id, artist_id, role)
                    VALUES (%s, %s, 'featuring')
                    ON CONFLICT DO NOTHING;
                """, (song_id, artist_id))

            conn.commit()
        else:
            print(f"既存のファイルと重複: {filename}")
            conn.rollback()

        # ========= Drive移動 =========
        print(f"Drive内で移動中: {filename}")
        service.files().update(
            fileId=file_id,
            addParents=PROCESSED_FOLDER_ID,
            removeParents=UNPROCESSED_FOLDER_ID
        ).execute()

        print(f"処理完了: {filename}")

        # ========= 一時削除 =========
        os.remove(temp_input.name)
        os.remove(temp_output.name)

    except Exception:
        traceback.print_exc()
        conn.rollback()
        print("エラー")

print("全処理終了")

cur.close()
conn.close()