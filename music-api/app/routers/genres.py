from fastapi import APIRouter
from app.database import get_connection
from app.utils.url import build_cover_url

router = APIRouter(prefix="/genres", tags=["genres"])

# =========================
# GENRE LIST
# =========================

@router.get("")
def get_genres():

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT id, name
        FROM genres
        ORDER BY name ASC
    """)

    rows = cur.fetchall()

    cur.close()
    conn.close()

    return [
        {
            "id": r[0],
            "name": r[1]
        }
        for r in rows
    ]


# =========================
# SONGS BY GENRE
# =========================

@router.get("/{genre_id}/songs")
def get_songs_by_genre(genre_id: int):

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT
            s.id,
            s.title,
            STRING_AGG(
                CASE WHEN sa.role = 'main' THEN a.name END,
                ', '
            ) AS main,
            STRING_AGG(
                CASE WHEN sa.role = 'featuring' THEN a.name END,
                ', '
            ) AS ft,
            JSON_AGG(
                JSON_BUILD_OBJECT(
                    'id', a.id,
                    'name', a.name,
                    'role', sa.role
                )
            ) AS artists,
            s.cover_url,
            s.stream_url
        FROM songs s
        JOIN song_genres sg ON sg.song_id = s.id
        LEFT JOIN song_artists sa ON s.id = sa.song_id
        LEFT JOIN artists a ON sa.artist_id = a.id
        WHERE sg.genre_id = %s
        GROUP BY s.id
        ORDER BY LOWER(s.title)
    """, (genre_id,))

    rows = cur.fetchall()

    cur.close()
    conn.close()

    return [
        {
            "id": r[0],
            "title": r[1],
            "main": r[2],
            "ft": r[3],
            "artists": r[4],
            "image": build_cover_url(r[5]),
            "url": r[6]
        }
        for r in rows
    ]


# =========================
# SET SONG GENRES
# =========================

@router.post("/{song_id}")
def set_song_genres(song_id: int, genre_ids: list[int]):

    conn = get_connection()
    cur = conn.cursor()

    try:
        # 一旦削除
        cur.execute("""
            DELETE FROM song_genres
            WHERE song_id = %s
        """, (song_id,))

        # 再登録
        for gid in genre_ids:
            cur.execute("""
                INSERT INTO song_genres (song_id, genre_id)
                VALUES (%s, %s)
            """, (song_id, gid))

        conn.commit()

        return {"status": "ok"}

    except Exception as e:
        conn.rollback()
        return {"error": str(e)}

    finally:
        cur.close()
        conn.close()
        