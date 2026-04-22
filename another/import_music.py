import os
import re
import io
import boto3
import psycopg2
import tempfile
import subprocess
import hashlib

from dotenv import load_dotenv
from googleapiclient.discovery import build
from google.oauth2.service_account import Credentials
from googleapiclient.http import MediaIoBaseDownload


# =============================
# ENV LOAD
# =============================

load_dotenv()

R2_ENDPOINT = os.getenv("R2_ENDPOINT_URL")
R2_ACCESS_KEY = os.getenv("R2_ACCESS_KEY_ID")
R2_SECRET_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
R2_BUCKET = os.getenv("R2_BUCKET")

DATABASE_URL = os.getenv("DATABASE_URL")

DRIVE_FOLDER_ID = os.getenv("GOOGLE_DRIVE_FOLDER_ID")
SERVICE_ACCOUNT_FILE = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON")

FFMPEG_PATH = os.getenv("FFMPEG_PATH", "ffmpeg")


# =============================
# R2 CLIENT
# =============================

r2 = boto3.client(
    "s3",
    endpoint_url=R2_ENDPOINT,
    aws_access_key_id=R2_ACCESS_KEY,
    aws_secret_access_key=R2_SECRET_KEY
)


# =============================
# DB CONNECT
# =============================

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()


# =============================
# GOOGLE DRIVE
# =============================

scopes = ["https://www.googleapis.com/auth/drive.readonly"]

creds = Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE,
    scopes=scopes
)

drive = build("drive", "v3", credentials=creds)


# =============================
# FILENAME NORMALIZE
# =============================

def normalize_filename(name):

    name = name.replace(" ", "_")
    name = name.replace(",", "_")
    name = name.replace("&", "and")
    name = name.replace("'", "")

    name = re.sub(r"\(.*?\)", "", name)

    name = re.sub(r"\.+(?=.*\.)", "", name)

    return name


# =============================
# PARSE ARTIST / TITLE
# =============================

def parse_filename(filename):

    name = filename.replace(".m4a", "")

    if " - " not in name:
        return None, None, None

    artist_part, title_part = name.split(" - ", 1)

    main_artists = [a.strip() for a in artist_part.split(",")]

    ft_pattern = re.compile(r"\s+(ft\.|feat\.|featuring)\s+", re.IGNORECASE)

    match = ft_pattern.search(title_part)

    if match:

        title = title_part[:match.start()].strip()

        ft_raw = title_part[match.end():]

        ft_artists = [a.strip() for a in ft_raw.split(",")]

    else:

        title = title_part.strip()
        ft_artists = []

    return main_artists, title, ft_artists


# =============================
# DRIVE FILE LIST (PAGINATION)
# =============================

files = []
page_token = None

while True:

    response = drive.files().list(
        q=f"'{DRIVE_FOLDER_ID}' in parents",
        fields="nextPageToken, files(id,name)",
        pageToken=page_token
    ).execute()

    files.extend(response.get("files", []))

    page_token = response.get("nextPageToken")

    if not page_token:
        break

print("TOTAL FILES:", len(files))


# =============================
# MAIN LOOP
# =============================

count = 0

for file in files:

    try:

        file_id = file["id"]
        filename = file["name"]

        print("PROCESS:", filename)

        # =============================
        # DOWNLOAD FROM DRIVE
        # =============================

        request = drive.files().get_media(fileId=file_id)

        fh = io.BytesIO()

        downloader = MediaIoBaseDownload(fh, request)

        done = False

        while not done:
            status, done = downloader.next_chunk()

        # =============================
        # TEMP INPUT
        # =============================

        temp_input = tempfile.NamedTemporaryFile(delete=False, suffix=".m4a")
        temp_input.write(fh.getvalue())
        temp_input.close()

        normalized = normalize_filename(filename)

        # =============================
        # ENCODE
        # =============================

        temp_output = tempfile.NamedTemporaryFile(delete=False, suffix=".m4a")
        temp_output.close()

        subprocess.run([
            "ffmpeg",
            "-y",
            "-i", temp_input.name,
            "-af", "loudnorm=I=-14:TP=-1.5:LRA=11",
            "-c:a", "aac",
            "-b:a", "128k",
            "-ar", "44100",
            "-ac", "2",
            "-movflags", "+faststart",
            temp_output.name
        ], check=True)

        key = f"audio/{normalized}"

        # =============================
        # DB INSERT
        # =============================

        main_artists, title, ft_artists = parse_filename(filename)

        
        with open (temp_output.name, "rb") as f:
            file_hash = hashlib.sha256(f.read()).hexdigest()


        cur.execute("""
        INSERT INTO songs(title, normalized_title, stream_url, file_hash)
        VALUES (%s,%s,%s,%s)
        RETURNING id
        """, (title, title.lower(), key, file_hash))

        song_id = cur.fetchone()[0]

        # =============================
        # MAIN ARTISTS
        # =============================

        for artist in main_artists:

            cur.execute("""
            INSERT INTO artists(name, normalized_name)
            VALUES (%s,%s)
            ON CONFLICT(normalized_name) DO NOTHING
            """, (artist, artist.lower()))

            cur.execute(
                "SELECT id FROM artists WHERE normalized_name=%s",
                (artist.lower(),)
            )

            artist_id = cur.fetchone()[0]

            cur.execute("""
            INSERT INTO song_artists(song_id,artist_id,role)
            VALUES (%s,%s,'main')
            """, (song_id, artist_id))

        # =============================
        # FEATURING
        # =============================

        for artist in ft_artists:

            cur.execute("""
            INSERT INTO artists(name, normalized_name)
            VALUES (%s,%s)
            ON CONFLICT(normalized_name) DO NOTHING
            """, (artist, artist.lower()))

            cur.execute(
                "SELECT id FROM artists WHERE normalized_name=%s",
                (artist.lower(),)
            )

            artist_id = cur.fetchone()[0]

            cur.execute("""
            INSERT INTO song_artists(song_id,artist_id,role)
            VALUES (%s,%s,'featuring')
            """, (song_id, artist_id))

        # =============================
        # R2 UPLOAD
        # =============================

        r2.upload_file(
            temp_output.name,
            R2_BUCKET,
            key
        )

        # =============================
        # COMMIT
        # =============================

        conn.commit()

        count += 1

        print("SUCCESS:", count)

        # =============================
        # CLEANUP
        # =============================

        os.remove(temp_input.name)
        os.remove(temp_output.name)

    except Exception as e:

        conn.rollback()

        print("ERROR:", filename)
        print(e)

print("IMPORT COMPLETE:", count)

cur.close()
conn.close()