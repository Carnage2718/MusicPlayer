import boto3
import psycopg2
import re

# ===== R2設定 =====
ACCOUNT_ID = "b5c85d39f96ff83f554c1aedf278736f"
ACCESS_KEY = "61798cf7e8e0ea59f62d9cf8819f8022"
SECRET_KEY = "e6d0d1f3fffe2f27cce250161dcf8e62bb2e8d5476d0aee9bcb3fd6a3d5c76f8"
BUCKET_NAME = "musicplayer"

PUBLIC_BASE_URL = f"https://{ACCOUNT_ID}.r2.cloudflarestorage.com/{BUCKET_NAME}/"

# ===== DB接続情報（RenderのExternal URLから分解）=====
DB_HOST = "dpg-d68q4n4r85hc73d09elg-a.oregon-postgres.render.com"
DB_NAME = "musicplayer_db_p12q"
DB_USER = "musicplayer_db_p12q_user"
DB_PASSWORD ="NZdzhu4XBJAZ3YM9tysoaRhddDRFjaI2"
DB_PORT = 5432

# ===== R2接続 =====
r2 = boto3.client(
    service_name="s3",
    endpoint_url=f"https://{ACCOUNT_ID}.r2.cloudflarestorage.com",
    aws_access_key_id=ACCESS_KEY,
    aws_secret_access_key=SECRET_KEY,
    region_name="auto",
)

# ===== ファイル名パース =====
def parse_filename(filename):
    name = filename.replace("converted_", "").replace(".m4a", "")
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

# ===== DB接続 =====
conn = psycopg2.connect(
    host=DB_HOST,
    database=DB_NAME,
    user=DB_USER,
    password=DB_PASSWORD,
    port=DB_PORT
)

cur = conn.cursor()

response = r2.list_objects_v2(Bucket=BUCKET_NAME)

inserted_songs = 0

try:
    for obj in response.get("Contents", []):
        key = obj["Key"]

        if not key.endswith(".m4a"):
            continue

        main_artists, title, ft_artists = parse_filename(key)

        stream_url = PUBLIC_BASE_URL + key
        file_hash = obj["ETag"].replace('"', "")

        # songs INSERT
        cur.execute("""
            INSERT INTO songs (title, normalized_title, stream_url, file_hash)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (file_hash) DO NOTHING
            RETURNING id;
            """, (title, title.lower(), stream_url, file_hash))

        result = cur.fetchone()
        if result is None:
            continue # 重複曲はスキップ

        song_id = result[0]

        # アーティスト処理
        for artist in main_artists:
            normalized = artist.lower()

            cur.execute("""
                INSERT INTO artists (name, normalized_name)
                VALUES (%s, %s)
                ON CONFLICT (normalized_name) DO NOTHING;
            """, (artist, normalized))

            cur.execute("""
                SELECT id FROM artists WHERE normalized_name = %s;
            """, (normalized,))
            artist_id = cur.fetchone()[0]

            cur.execute("""
                INSERT INTO song_artists (song_id, artist_id, role)
                VALUES (%s, %s, 'main');
            """, (song_id, artist_id))

        for artist in ft_artists:
            normalized = artist.lower()

            cur.execute("""
                INSERT INTO artists (name, normalized_name)
                VALUES (%s, %s)
                ON CONFLICT (normalized_name) DO NOTHING;
            """, (artist, normalized))

            cur.execute("""
                SELECT id FROM artists WHERE normalized_name = %s;
            """, (normalized,))
            artist_id = cur.fetchone()[0]

            cur.execute("""
                INSERT INTO song_artists (song_id, artist_id, role)
                VALUES (%s, %s, 'featuring');
            """, (song_id, artist_id))

        inserted_songs += 1

    conn.commit()
    print(f"移行完了！追加曲数: {inserted_songs}")

except Exception as e:
    conn.rollback()
    print("エラー発生:", e)

finally:
    cur.close()
    conn.close()