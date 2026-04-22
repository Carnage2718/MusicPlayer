from fastapi import APIRouter, Query
from app.database import get_connection
from app.models import AlbumCreate, AddSongs
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
            COALESCE(
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                    'id', ar.id,
                    'name', ar.name,
                    'role', aa.role
                    )
                )FILTER (WHERE ar.id IS NOT NULL),
                '[]'
            ) AS artists
        FROM albums al
        LEFT JOIN album_artists aa ON al.id = aa.album_id
        LEFT JOIN artists ar ON aa.artist_id = ar.id
                
        GROUP BY al.id
        ORDER BY al.name ASC
    """)

    rows = cur.fetchall()

    cur.close()
    conn.close()

    return [
        {
            "id": r[0],
            "name": r[1],
            "image": build_cover_url(r[2]),
            "artists": r[3] or []
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

    # =====================
    # ALBUM
    # =====================
    cur.execute("""
        SELECT 
            al.id,
            al.name,
            al.cover_url,
            al.release_date,

            COALESCE(
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'id', ar.id,
                        'name', ar.name,
                        'role', aa.role
                    )
                ) FILTER (WHERE ar.id IS NOT NULL),
                '[]'
            ) AS artists

        FROM albums al
        LEFT JOIN album_artists aa ON al.id = aa.album_id
        LEFT JOIN artists ar ON aa.artist_id = ar.id
                
        WHERE al.id = %s
        GROUP BY al.id
    """, (album_id,))

    album = cur.fetchone()

    if not album:
        cur.close()
        conn.close()
        return {"message": "Album not found"}

    # =====================
    # SONGS
    # =====================
    cur.execute("""
        SELECT 
            s.id, 
            s.title, 
            s.cover_url, 
            s.track_number,

            COALESCE(
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'id', ar.id,
                        'name', ar.name,
                        'role', sa.role
                    )
                ) FILTER (WHERE ar.id IS NOT NULL),
                '[]'
            ) AS artists

        FROM songs s
        LEFT JOIN song_artists sa ON s.id = sa.song_id
        LEFT JOIN artists ar ON sa.artist_id = ar.id

        WHERE s.album_id = %s
        GROUP BY s.id
        ORDER BY s.track_number ASC NULLS LAST
    """, (album_id,))
    
    songs = cur.fetchall()

    cur.close()
    conn.close()

    return {
        "id": album[0],
        "name": album[1],
        "image": build_cover_url(album[2]),
        "release_date": album[3],
        "artists": album[4] or [],
        "songs": [
            {
                "id": s[0],
                "title": s[1],
                "image": build_cover_url(s[2]),
                "track_number": s[3],
                "artists": s[4] or []
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
        # ① 基本情報
        # =====================
        cover_url = None if data.cover_url in [None, "null", ""] else data.cover_url
        release_date = None if data.release_date in [None, "null", ""] else data.release_date
        normalized_name = data.name.lower()

        # =====================
        # ② main artist取得（互換用）
        # =====================
        main_artist_id = None

        if not data.artists or len(data.artists) == 0:
            raise ValueError("artists is required")

        if data.artists and len(data.artists) > 0:
            first = data.artists[0]

            cur.execute("""
                SELECT id FROM artists WHERE LOWER(name)=LOWER(%s)
            """, (first.name,))
            row = cur.fetchone()

            if row:
                main_artist_id = row[0]
            else:
                cur.execute("""
                    INSERT INTO artists(name, normalized_name)
                    VALUES (%s,%s)
                    RETURNING id
                """, (first.name, first.name.lower()))
                main_artist_id = cur.fetchone()[0]

        # =====================
        # ③ album取得 or 作成
        # =====================

        album_id = None

        cur.execute("""
            SELECT id FROM albums
            WHERE LOWER(name)=LOWER(%s)
            AND artist_id = %s
        """, (data.name, main_artist_id))

        row = cur.fetchone()

        if row:
            album_id = row[0]

            # 🔥 UPDATE（ここが重要）
            cur.execute("""
                UPDATE albums
                SET cover_url = COALESCE(%s, cover_url),
                    release_date = COALESCE(%s, release_date)
                WHERE id = %s
            """, (cover_url, release_date, album_id))

        else:
            # 🔥 新規作成
            cur.execute("""
                INSERT INTO albums(name, normalized_name, artist_id, cover_url, release_date)
                VALUES (%s,%s,%s,%s,%s)
                RETURNING id
            """, (data.name, normalized_name, main_artist_id, cover_url, release_date))

            album_id = cur.fetchone()[0]

        
        # =====================
        # 🔥 既存artists削除（超重要）
        # =====================
        cur.execute("""
            DELETE FROM album_artists
            WHERE album_id = %s
        """, (album_id,))

        # =====================
        # ④ album_artists
        # =====================
        for i, artist in enumerate(data.artists):

            if artist.id is not None:
                artist_id = artist.id
            else:
                # 名前から取得 or 作成
                cur.execute("""
                    SELECT id FROM artists WHERE LOWER(name)=LOWER(%s)
                """, (artist.name,))
                row = cur.fetchone()

                if row:
                    artist_id = row[0]
                else:
                    cur.execute("""
                        INSERT INTO artists(name, normalized_name)
                        VALUES (%s,%s)
                        RETURNING id
                    """, (artist.name, artist.name.lower()))
                    artist_id = cur.fetchone()[0]

            cur.execute("""
                INSERT INTO album_artists(album_id, artist_id, role, position)
                VALUES (%s,%s,%s,%s)
            """, (
                album_id,
                artist_id,
                artist.role,
                i
            ))

        # =====================
        # ⑤ 既存track番号取得
        # =====================
        cur.execute("""
            SELECT track_number FROM songs
            WHERE album_id = %s
        """, (album_id,))
        existing_numbers = {r[0] for r in cur.fetchall() if r[0] is not None}

        # =====================
        # ⑥ cover取得
        # =====================
        cur.execute("""
            SELECT cover_url FROM albums WHERE id=%s
        """, (album_id,))
        album_cover = cur.fetchone()[0]

        # =====================
        # ⑦ tracks登録
        # =====================
        if data.tracks:
            for item in data.tracks:

                song_id = item.song_id
                track_number = item.track_number

                # 自動採番
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

