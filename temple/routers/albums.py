from fastapi import APIRouter, Query
from app.database import get_connection
from app.models import AlbumCreate, AddSongs, TrackCreate
from app.utils.url import build_cover_url
router = APIRouter(prefix="/albums", tags=["albums"])

# =========================
# GET ALL
# =========================

@router.get("")
def get_albums():

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT 
            al.id,
            al.name,
            al.cover_url,
            ar.name,
            ar.id AS artist_id
        FROM albums al
        LEFT JOIN artists ar ON al.artist_id = ar.id
        ORDER BY al.name ASC
    """)

    rows = cur.fetchall()

    cur.close()
    conn.close()

    return [
        {
            "id": r[0],
            "name": r[1],
            "artist": r[3],
            "artist_id": r[4],
            "image": build_cover_url(r[2])
        }
        for r in rows
    ]


# =========================
# GET DETAIL
# =========================

@router.get("/{album_id}")
def get_album_detail(album_id: int):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT id, name, cover_url, release_date, artist_id
        FROM albums
        WHERE id = %s
    """, (album_id,))

    album = cur.fetchone()

    if not album:
        cur.close()
        conn.close()
        return {"message": "Album not found"}
    
    cur.execute("""
        SELECT id, title, cover_url, track_number
        FROM songs
        WHERE album_id = %s
        ORDER BY track_number ASC NULLS LAST
    """, (album_id,))
    
    songs = cur.fetchall()

    cur.close()
    conn.close()

    return {
        "id": album[0],
        "name": album[1],
        "image": build_cover_url(album[2]),
        "release_date": album[3],
        "artist_id": album[4],
        "songs": [
            {
                "song_id": s[0],
                "title": s[1],
                "image": build_cover_url(s[2]),
                "track_number": s[3]
            }
            for s in songs
        ]
    }


# =========================
# CREATE ALBUM（完全版）
# =========================

@router.post("")
def create_album(data: AlbumCreate):

    conn = get_connection()
    cur = conn.cursor()

    try:
        # =====================
        # ① artist取得 or 作成
        # =====================
        cur.execute("""
            SELECT id FROM artists
            WHERE LOWER(name) = LOWER(%s)
        """, (data.artist,))
        artist = cur.fetchone()

        if artist:
            artist_id = artist[0]
        else:
            cur.execute("""
                INSERT INTO artists(name, normalized_name)
                VALUES (%s,%s)
                RETURNING id
            """, (data.artist, data.artist.lower()))
            artist_id = cur.fetchone()[0]

        # =====================
        # ② album取得 or 作成
        # =====================
        album_id = None

        # 🔥 tracksある場合のみ既存チェック
        if data.tracks:
            cur.execute("""
                SELECT id FROM albums
                WHERE LOWER(name) = LOWER(%s)
                AND artist_id = %s
            """, (data.name, artist_id))

            album = cur.fetchone()

            if album:
                album_id = album[0]

        # =====================
        # 🔥 null対策
        # =====================
        cover_url = None if data.cover_url in [None, "null", ""] else data.cover_url
        release_date = None if data.release_date in [None, "null", ""] else data.release_date

        # 🔥 normalized_name（必須）
        normalized_name = data.name.lower()

        # =====================
        # 🔥 新規作成（tracks無しでもOK）
        # =====================
        if not album_id:
            cur.execute("""
                INSERT INTO albums(name, normalized_name, artist_id, cover_url, release_date)
                VALUES (%s,%s,%s,%s,%s)
                RETURNING id
            """, (data.name, normalized_name, artist_id, cover_url, release_date))

            album_id = cur.fetchone()[0]

        # =====================
        # ③ 既存track番号取得
        # =====================
        cur.execute("""
            SELECT track_number FROM songs
            WHERE album_id = %s
        """, (album_id,))

        cur.execute("""
        SELECT cover_url FROM albums
        WHERE id = %s
        """, (album_id,))
        album_cover = cur.fetchone()[0]
        existing_numbers = {r[0] for r in cur.fetchall() if r[0] is not None}

        # =====================
        # ④ tracks登録
        # =====================
        if data.tracks:
            for item in data.tracks:

                song_id = item.song_id
                track_number = item.track_number

                # ---- nullなら最小番号 ----
                if track_number is None:
                    n = 1
                    while n in existing_numbers:
                        n += 1
                    track_number = n

                existing_numbers.add(track_number)
                if album_cover:
                    cur.execute("""
                    UPDATE songs
                    SET album_id=%s,
                        track_number=%s,
                        cover_url=%s
                    WHERE id=%s
                    """, (album_id, track_number, album_cover, song_id))
                else:
                    cur.execute("""
                        UPDATE songs
                        SET album_id=%s,
                            track_number=%s
                        WHERE id=%s
                    """, (album_id, track_number, song_id))

        conn.commit()

        return {
            "status": "ok",
            "album_id": album_id
        }

    except Exception as e:
        conn.rollback()
        return {"error": str(e)}

    finally:
        cur.close()
        conn.close()

        
# =========================
# ADD SONGS TO ALBUM
# =========================

@router.post("/{album_id}/songs")
def add_songs_to_album(album_id: int, data: AddSongs):

    conn = get_connection()
    cur = conn.cursor()

    try:

        for i, song_id in enumerate(data.song_ids):

            # track_number自動付与
            cur.execute("""
                SELECT COALESCE(MAX(track_number), 0) + 1
                FROM songs
                WHERE album_id = %s
            """, (album_id,))

            track_number = cur.fetchone()[0]

            cur.execute("""
                UPDATE songs
                SET album_id = %s,
                    track_number = %s
                WHERE id = %s
            """, (album_id, track_number, song_id))

        conn.commit()

        return {"status": "ok"}

    except Exception as e:
        conn.rollback()
        return {"error": str(e)}

    finally:
        cur.close()
        conn.close()


# =========================
# REMOVE SONG FROM ALBUM
# =========================

@router.delete("/{album_id}/songs/{song_id}")
def remove_song_from_album(album_id: int, song_id: int):

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        UPDATE songs
        SET album_id = NULL,
            track_number = NULL
        WHERE id = %s AND album_id = %s
    """, (song_id, album_id))

    conn.commit()

    cur.close()
    conn.close()

    return {"status": "removed"}

