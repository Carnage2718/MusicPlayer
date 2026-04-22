from fastapi import APIRouter
from app.database import get_connection
from app.utils.url import build_cover_url

router = APIRouter(prefix="/artists",tags=["artists"])

@router.get("")
def get_artists():

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT 
            a.id,
            a.name,
            a.image_url,
            COUNT(s.id) as song_count
        FROM artists a
        LEFT JOIN song_artists sa ON sa.artist_id = a.id
        LEFT JOIN songs s ON s.id = sa.song_id
        GROUP BY a.id, a.name, a.image_url
    """)
    rows = cur.fetchall()

    cur.close()
    conn.close()

    return [
        {
            "id": r[0],
            "name": r[1],
            "image_url": build_cover_url(r[2]),
            "song_count": r[3]
        }
        for r in rows
    ]

@router.get("/{artist_id}")
def get_artist(artist_id: int):

    conn = get_connection()
    cur = conn.cursor()

    try:
        # =========================
        # ARTIST 基本情報（featuring含む）
        # =========================
        cur.execute("""
        SELECT 
            a.id,
            a.name,
            a.image_url,
            COUNT(DISTINCT sa.song_id) as song_count,
            COUNT(DISTINCT al.id) as album_count,
            COALESCE(SUM(s.play_count), 0) as total_plays
        FROM artists a
        LEFT JOIN song_artists sa ON sa.artist_id = a.id
        LEFT JOIN songs s ON s.id = sa.song_id
        LEFT JOIN albums al ON s.album_id = al.id
        WHERE a.id = %s
        GROUP BY a.id
        """, (artist_id,))

        artist = cur.fetchone()

        if not artist:
            return {"error": "Artist not found"}

        # =========================
        # TOP SONGS（featuring含む）
        # =========================
        cur.execute("""
        SELECT
            s.id,
            s.title,
            s.play_count,
            s.cover_url,
            STRING_AGG(
                CASE WHEN sa.role = 'main' THEN ar.name END,
                ', '
            ) AS main,
            STRING_AGG(
                CASE WHEN sa.role = 'featuring' THEN ar.name END,
                ', '
            ) AS ft,
            JSON_AGG(
                JSON_BUILD_OBJECT(
                    'id', ar.id,
                    'name', ar.name,
                    'role', sa.role
                )
            ) AS artists
        FROM songs s
        JOIN song_artists sa ON s.id = sa.song_id
        JOIN artists ar ON sa.artist_id = ar.id
        WHERE EXISTS (
            SELECT 1
            FROM song_artists sa2
            WHERE sa2.song_id = s.id
            AND sa2.artist_id = %s
        )
        GROUP BY s.id
        ORDER BY s.play_count DESC NULLS LAST
        LIMIT 5
        """, (artist_id,))

        top_songs = [
            {
                "song_id": r[0],
                "title": r[1],
                "play_count": r[2],
                "cover_url": build_cover_url(r[3]),
                "main": r[4],
                "ft": r[5],
                "artists": r[6],
            }
            for r in cur.fetchall()
        ]

        # =========================
        # ALL SONGS
        # =========================
        cur.execute("""
        SELECT
            s.id,
            s.title,
            s.play_count,
            s.cover_url,
            STRING_AGG(
                CASE WHEN sa.role = 'main' THEN ar.name END,
                ', '
            ) AS main,
            STRING_AGG(
                CASE WHEN sa.role = 'featuring' THEN ar.name END,
                ', '
            ) AS ft,
            JSON_AGG(
                JSON_BUILD_OBJECT(
                    'id', ar.id,
                    'name', ar.name,
                    'role', sa.role
                )
            ) AS artists
        FROM songs s
        JOIN song_artists sa ON s.id = sa.song_id
        JOIN artists ar ON sa.artist_id = ar.id
        WHERE EXISTS (
            SELECT 1
            FROM song_artists sa2
            WHERE sa2.song_id = s.id
            AND sa2.artist_id = %s
        )
        GROUP BY s.id
        ORDER BY LOWER(s.title)
        """, (artist_id,))

        all_songs = [
            {
                "song_id": r[0],
                "title": r[1],
                "cover_url": build_cover_url(r[3]),
                "main": r[4],
                "ft": r[5],
                "artists": r[6],
            }
            for r in cur.fetchall()
        ]

        # =========================
        # ALBUMS
        # =========================
        cur.execute("""
        SELECT id, name, cover_url
        FROM albums
        WHERE artist_id = %s
        ORDER BY id DESC
        """, (artist_id,))

        albums = [
            {
                "id": r[0],
                "title": r[1],
                "cover_url": build_cover_url(r[2])
            }
            for r in cur.fetchall()
        ]

        # =========================
        # RELATED
        # =========================
        cur.execute("""
        SELECT DISTINCT
            ar2.id,
            ar2.name,
            ar2.image_url

        FROM song_artists sa1
        JOIN song_artists sa2
            ON sa1.song_id = sa2.song_id
        JOIN artists ar2
            ON sa2.artist_id = ar2.id

        WHERE sa1.artist_id = %s
        AND sa2.artist_id != %s

        ORDER BY ar2.name
        """, (artist_id, artist_id))

        related = [
            {
                "id": r[0],
                "name": r[1],
                "cover_url": build_cover_url(r[2])
            }
            for r in cur.fetchall()
        ]

        return {
            "id": artist[0],
            "name": artist[1],
            "cover_url": build_cover_url(artist[2]),
            "song_count": artist[3],
            "album_count": artist[4],
            "total_plays": artist[5],
            "top_songs": top_songs,
            "all_songs": all_songs,
            "albums": albums,
            "related_artists": related
        }

    except Exception as e:
        print("Artist API error:", e)
        return {"error": "Server error"}

    finally:
        cur.close()
        conn.close()
        
