from fastapi import APIRouter, UploadFile, File, Form, Body, HTTPException
import subprocess, uuid, os, re, tempfile, hashlib
import boto3
from dotenv import load_dotenv
from botocore.client import Config
from botocore.exceptions import ClientError
from app.database import get_connection
from app.utils.cover import delete_cover_from_r2

load_dotenv()

router = APIRouter(prefix="/upload", tags=["upload"])

R2_PUBLIC_URL = os.getenv("R2_PUBLIC_URL")
R2_BUCKET = os.getenv("R2_BUCKET")
FFMPEG_PATH = os.getenv("FFMPEG_PATH", "ffmpeg")

r2 = boto3.client(
    "s3",
    endpoint_url=os.getenv("R2_ENDPOINT_URL"),
    aws_access_key_id=os.getenv("R2_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("R2_SECRET_ACCESS_KEY"),
    region_name="auto",
    config=Config(signature_version="s3v4")
)

# =============================
# UTIL
# =============================

def safe_ext(filename):
    ext = os.path.splitext(filename)[1].lower()
    return ext if ext in [".jpg", ".jpeg", ".png", ".webp"] else ".jpg"

def build_url(key):
    return f"{R2_PUBLIC_URL}/{key}"

def file_exists_in_r2(key):
    try:
        r2.head_object(Bucket=R2_BUCKET, Key=key)
        return True
    except ClientError:
        return False

def normalize_key(url_or_key: str):
    if not url_or_key:
        return None

    # フルURLなら key に変換
    if url_or_key.startswith("http"):
        return url_or_key.split(".dev/")[-1]

    return url_or_key

def normalize_filename(name):
    name = name.replace(" ", "_")
    name = name.replace(",", "_")
    name = name.replace("&", "and")
    name = name.replace("'", "")
    name = re.sub(r"\(.*?\)", "", name)
    return name

def parse_filename(filename):
    name = os.path.splitext(filename)[0]
    if " - " not in name:
        return [], name, []

    artist_part, title_part = name.split(" - ", 1)
    main = [a.strip() for a in artist_part.split(",")]

    ft_pattern = re.compile(r"\s+(ft\.|feat\.|featuring)\s+", re.I)
    match = ft_pattern.search(title_part)

    if match:
        title = title_part[:match.start()].strip()
        ft = [a.strip() for a in title_part[match.end():].split(",")]
    else:
        title = title_part.strip()
        ft = []

    return main, title, ft

def process_audio(input_path):
    output = tempfile.NamedTemporaryFile(delete=False, suffix=".m4a")
    output.close()

    subprocess.run([
        FFMPEG_PATH,
        "-y",
        "-i", input_path,
        "-vn",
        "-af", "loudnorm=I=-14:TP=-1.5:LRA=11",
        "-c:a", "aac",
        "-b:a", "128k",
        "-ar", "44100",
        "-ac", "2",
        "-movflags", "+faststart",
        output.name
    ], check=True)

    return output.name

def insert_artist(cur, song_id, name, role):

    cur.execute("""
    INSERT INTO artists(name, normalized_name)
    VALUES (%s,%s)
    ON CONFLICT(normalized_name) DO NOTHING
    """,(name, name.lower()))

    cur.execute(
        "SELECT id FROM artists WHERE normalized_name=%s",
        (name.lower(),)
    )

    artist_id = cur.fetchone()[0]

    # 🔥 ここ追加
    cur.execute("""
    SELECT 1 FROM song_artists
    WHERE song_id=%s AND artist_id=%s AND role=%s
    """,(song_id, artist_id, role))

    if cur.fetchone():
        return

    cur.execute("""
    INSERT INTO song_artists(song_id,artist_id,role)
    VALUES (%s,%s,%s)
    """,(song_id, artist_id, role))

# =============================
# COVER UPLOAD
# =============================

@router.post("/cover")
async def upload_cover(file: UploadFile = File(...)):
    conn = get_connection()
    cur = conn.cursor()

    temp = None

    try:
        ext = safe_ext(file.filename)
        filename = f"{uuid.uuid4()}{ext}"
        key = f"cover/{filename}"

        temp = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
        temp.write(await file.read())
        temp.close()

        with open(temp.name, "rb") as f:
            file_hash = hashlib.sha256(f.read()).hexdigest()

        cur.execute("SELECT id, file_url FROM covers WHERE file_hash=%s", (file_hash,))
        existing = cur.fetchone()

        if existing:
            existing_key = existing[1]

            if not file_exists_in_r2(existing_key):
                r2.upload_file(temp.name, R2_BUCKET, existing_key)

            return {
                "status": "duplicate",
                "cover_id": existing[0],
                "url": existing_key  # ✅ keyで返す
            }

        r2.upload_file(temp.name, R2_BUCKET, key)

        cur.execute("""
        INSERT INTO covers(file_url, file_hash)
        VALUES (%s,%s)
        RETURNING id
        """, (key, file_hash))

        cover_id = cur.fetchone()[0]
        conn.commit()

        return {
            "status": "ok",
            "cover_id": cover_id,
            "url": key  # ✅ keyで返す
        }

    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        cur.close()
        conn.close()
        if temp and os.path.exists(temp.name):
            os.remove(temp.name)
            
# =============================
# SONG UPLOAD
# =============================

@router.post("/song")
async def upload_song(
    file: UploadFile = File(...),
    cover: UploadFile = File(None),
    album_id: int = Form(None),
    track_number: int = Form(None)
):
    conn = get_connection()
    cur = conn.cursor()

    temp = tempfile.NamedTemporaryFile(delete=False, suffix=".m4a")
    temp.write(await file.read())
    temp.close()

    processed = None

    try:
        artists, title, ft = parse_filename(file.filename)

        processed = process_audio(temp.name)

        with open(processed, "rb") as f:
            file_hash = hashlib.sha256(f.read()).hexdigest()

        cur.execute("SELECT id FROM songs WHERE file_hash=%s", (file_hash,))
        if cur.fetchone():
            return {"status": "duplicate", "title": title}

        cover_key = None

        if cover:
            ext = safe_ext(cover.filename)
            filename = f"{uuid.uuid4()}{ext}"
            cover_key = f"cover/{filename}"

            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
            tmp.write(await cover.read())
            tmp.close()

            r2.upload_file(tmp.name, R2_BUCKET, cover_key)
            os.remove(tmp.name)


        normalized = normalize_filename(file.filename)
        audio_key = f"audio/{normalized}"
        r2.upload_file(processed, R2_BUCKET, audio_key)

        cur.execute("""
        INSERT INTO songs(title, normalized_title, stream_url, file_hash, album_id, track_number, cover_url)
        VALUES (%s,%s,%s,%s,%s,%s,%s)
        RETURNING id
        """, (
            title,
            title.lower(),
            audio_key,
            file_hash,
            album_id,
            track_number,
            cover_key
        ))


        song_id = cur.fetchone()[0]

        
        for a in set(artists):
            insert_artist(cur, song_id, a, "main")

        for a in set(ft):
            insert_artist(cur, song_id, a, "featuring")

        conn.commit()

        return {
            "status": "ok",
            "song_id": song_id,
            "cover_url": cover_key if cover_key else None
        }

    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        cur.close()
        conn.close()
        os.remove(temp.name)
        if processed and os.path.exists(processed):
            os.remove(processed)

# =============================
# COVER ASSIGN
# =============================

def validate(data, key):
    if not data.get(key) or not data.get("cover_url"):
        raise HTTPException(status_code=400, detail="invalid params")

@router.post("/cover/assign/song")
def assign_song(data: dict = Body(...)):
    validate(data, "song_id")

    cover_key = normalize_key(data["cover_url"])  # 🔥 ここ

    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        "UPDATE songs SET cover_url=%s WHERE id=%s",
        (cover_key, data["song_id"])
    )

    conn.commit()
    cur.close()
    conn.close()

    return {"status": "ok"}


@router.post("/cover/assign/album")
def assign_album(data: dict = Body(...)):
    validate(data, "album_id")

    cover_key = normalize_key(data["cover_url"])  # 🔥

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
    UPDATE albums SET cover_url=%s WHERE id=%s
    """, (cover_key, data["album_id"]))

    cur.execute("""
    UPDATE songs SET cover_url=%s WHERE album_id=%s
    """, (cover_key, data["album_id"]))

    conn.commit()
    cur.close()
    conn.close()

    return {"status": "ok"}


@router.post("/cover/assign/playlist")
def assign_playlist(data: dict = Body(...)):
    validate(data, "playlist_id")

    cover_key = normalize_key(data["cover_url"])

    conn = get_connection()
    cur = conn.cursor()

    # 🔥 古いcover取得
    cur.execute("""
    SELECT cover_url FROM playlists WHERE id = %s
    """, (data["playlist_id"],))

    row = cur.fetchone()
    old_cover = row[0] if row else None

    # 🔥 UPDATE
    cur.execute("""
    UPDATE playlists SET cover_url=%s WHERE id=%s
    """, (cover_key, data["playlist_id"]))

    conn.commit()

    # 🔥 古いcover削除（ここが本質）
    if old_cover and old_cover.startswith("cover/playlist/"):
        try:
            delete_cover_from_r2(old_cover)
        except Exception as e:
            print("delete failed:", e)

    cur.close()
    conn.close()

    return {"status": "ok"}

@router.post("/cover/assign/artist")
def assign_artist(data: dict = Body(...)):
    validate(data, "artist_id")

    cover_key = normalize_key(data["cover_url"])

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
    UPDATE artists SET image_url=%s WHERE id=%s
    """, (cover_key, data["artist_id"]))

    conn.commit()
    cur.close()
    conn.close()

    return {"status": "ok"}

