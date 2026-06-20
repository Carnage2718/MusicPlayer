from fastapi import APIRouter, HTTPException, Query, Depends
import boto3, os
from botocore.client import Config
from app.database import get_connection
from app.routers.auth import get_current_user
from app.models import GenreUpdate
from app.utils.url import build_cover_url  # 🔥 追加

router = APIRouter(prefix="/songs", tags=["songs"])

r2 = boto3.client(
    "s3",
    endpoint_url=os.getenv("R2_ENDPOINT_URL"),
    aws_access_key_id=os.getenv("R2_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("R2_SECRET_ACCESS_KEY"),
    region_name="auto",
    config=Config(signature_version="s3v4")
)

# =========================
# SONG LIST
# =========================

@router.get("")
def list_songs():

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT
            s.id,
            s.title,
            STRING_AGG(
                CASE WHEN sa.role = 'main' THEN a.name END,
                ', '
            ) AS main_artists,
            STRING_AGG(
                CASE WHEN sa.role = 'featuring' THEN a.name END,
                ', '
            ) AS ft_artists,
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
        LEFT JOIN song_artists sa ON s.id = sa.song_id
        LEFT JOIN artists a ON sa.artist_id = a.id
        GROUP BY s.id
        ORDER BY LOWER(s.title)
    """)

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
            "image": build_cover_url(r[5]),  # 🔥 ここ
            "url": r[6]
        }
        for r in rows
    ]


@router.get("/limit/100")
def list_songs():

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT
            s.cover_url
        FROM songs s
        WHERE
            s.cover_url IS NOT NULL
            AND s.cover_url <> ''
        ORDER BY RANDOM()
        LIMIT 100
    """)

    rows = cur.fetchall()

    cur.close()
    conn.close()

    return [
        {
            "image": build_cover_url(r[0])
        }
        for r in rows
    ]


@router.get("/recent")
def list_recent_songs(limit: int = 50):

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
        LEFT JOIN song_artists sa ON s.id = sa.song_id
        LEFT JOIN artists a ON sa.artist_id = a.id
        GROUP BY s.id
        ORDER BY s.updated_at DESC
        LIMIT %s
    """, (limit,))

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

@router.get("/genres")
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
        {"genres_id": r[0], "name": r[1]}
        for r in rows
    ]

@router.get("/{song_id}")
def get_song_detail(song_id: int):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT id, title, stream_url, cover_url, release_at
        FROM songs
        WHERE id = %s;
    """, (song_id,))

    song = cur.fetchone()

    if not song:
        cur.close()
        conn.close()
        return {"error": "Song not found"}

    # 🔥 修正済みSQL
    cur.execute("""
        SELECT a.id, a.name, sa.role
        FROM song_artists sa
        JOIN artists a ON sa.artist_id = a.id
        WHERE sa.song_id = %s;
    """, (song_id,))

    artist_rows = cur.fetchall()

    cur.close()
    conn.close()

    # 🔥 完全版artists
    artists = []

    for aid, name, role in artist_rows:
        artists.append({
            "id": aid,
            "name": name,
            "role": (role or "").lower()
        })

    return {
        "id": song[0],
        "title": song[1],
        "stream_url": song[2],
        "cover": build_cover_url(song[3]),
        "release_at": song[4],
        "artists": artists   # ← ここが最重要
    }

@router.get("/{song_id}/stream")
def stream_song(song_id: int):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT stream_url
        FROM songs
        WHERE id = %s;
    """, (song_id,))

    row = cur.fetchone()

    cur.close()
    conn.close()

    if not row:
        return {"error": "Song not found"}

    r2_key = row[0]

    # R2から署名付きURLを生成
    signed_url = r2.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": os.getenv("R2_BUCKET"), 
            "Key": r2_key
        },
        ExpiresIn=300  # URLの有効期限（5分）
    )

    return {
        "stream_url": signed_url,
        "expires_in": 300
    }

@router.post("/{song_id}/play")
def increment_play_count(
    song_id: int,
    user=Depends(get_current_user)
):

    conn = get_connection()
    cur = conn.cursor()

    try:
        # play count
        cur.execute("""
        UPDATE songs
        SET play_count = play_count + 1
        WHERE id = %s
        """, (song_id,))

        # 直前履歴確認
        cur.execute("""
        SELECT song_id
        FROM play_history
        WHERE user_id=%s
        ORDER BY played_at DESC
        LIMIT 1
        """,(user, ))

        row = cur.fetchone()

        # 同じ曲連続防止
        if not row or row[0] != song_id:

            cur.execute("""
            INSERT INTO play_history (user_id, song_id)
            VALUES (%s, %s)
            """, (user, song_id,))

            cur.execute("""
            DELETE FROM play_history
            WHERE user_id=%s
            AND id NOT IN (
                SELECT id
                FROM play_history
                WHERE user_id=%s
                ORDER BY played_at DESC
                LIMIT 50
            )
            """,(user, user))

        conn.commit()

        return {"status": "ok"}

    finally:
        cur.close()
        conn.close()

@router.get("/{song_id}/monthly")
def monthly_play_count(song_id: int):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT DATE_TRUNC('month', played_at) AS month,
                COUNT(*)
        FROM play_history
        WHERE song_id = %s
        GROUP BY month
        ORDER BY month DESC;
    """, (song_id,))

    rows = cur.fetchall()

    cur.close()
    conn.close()

    return [{
        "month": row[0],
        "play_count": row[1]}
    for row in rows
    ]


@router.post("/{song_id}/favorite")
def add_favorite(song_id: int, favorite_type_id: int):

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO song_favorites (song_id, favorite_type_id)
        VALUES (%s, %s)
        ON CONFLICT DO NOTHING;
    """, (song_id, favorite_type_id))

    conn.commit()
    cur.close()
    conn.close()

    return {"message": "Favorite added"}

@router.delete("/{song_id}/favorite")
def remove_favorite(song_id: int, favorite_type_id: int):

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        DELETE FROM song_favorites
        WHERE song_id = %s AND favorite_type_id = %s;
    """, (song_id, favorite_type_id))

    conn.commit()
    cur.close()
    conn.close()

    return {"message": "Favorite removed"}

@router.get("/{song_id}/favorites")
def get_song_favorites(song_id: int):

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT ft.id, ft.name
        FROM song_favorites sf
        JOIN favorite_types ft
        ON sf.favorite_type_id = ft.id
        WHERE sf.song_id = %s;
    """, (song_id,))

    rows = cur.fetchall()
    cur.close()
    conn.close()

    return [
        {"favorite_type_id": r[0], "name": r[1]}
        for r in rows
    ]


@router.get("/favorites/types")
def get_favorite_types():

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT id, name
        FROM favorite_types
        ORDER BY id;
    """)

    rows = cur.fetchall()
    cur.close()
    conn.close()

    return [
        {"id": r[0], "name": r[1]}
        for r in rows
    ]

@router.get("/favorites/{favorite_type_id}/songs")
def get_songs_by_favorite(favorite_type_id: int):

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT s.id, s.title
        FROM song_favorites sf
        JOIN songs s
        ON sf.song_id = s.id
        WHERE sf.favorite_type_id = %s;
    """, (favorite_type_id,))

    rows = cur.fetchall()
    cur.close()
    conn.close()

    return [
        {"song_id": r[0], "title": r[1]}
        for r in rows
    ]

@router.post("/favorites/types")
def create_favorite_type(name: str):

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            INSERT INTO favorite_types (name)
            VALUES (%s)
            RETURNING id;
        """, (name,))

        new_id = cur.fetchone()[0]
        conn.commit()

    except Exception:
        conn.rollback()
        raise HTTPException(status_code=400, detail="Favorite type already exists")

    finally:
        cur.close()
        conn.close()

    return {"id": new_id, "name": name}

@router.delete("/favorites/types/{favorite_type_id}")
def delete_favorite_type(favorite_type_id: int):

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        DELETE FROM favorite_types
        WHERE id = %s;
    """, (favorite_type_id,))

    conn.commit()
    cur.close()
    conn.close()

    return {"message": "Favorite type deleted"}

@router.post("/{song_id}/genres")
def set_song_genres(song_id: int, data: GenreUpdate):

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            DELETE FROM song_genres 
            WHERE song_id = %s
        """, (song_id,))

        for genre_id in data.genre_ids:
            cur.execute("""
                INSERT INTO song_genres (song_id, genre_id)
                VALUES (%s, %s)
            """, (song_id, genre_id))

        conn.commit()

        return {"message": "Genres updated"}
    
    except Exception as e:
        conn.rollback()
        return {"error": str(e)}
    
    finally:
        cur.close()
        conn.close()

@router.get("/by_genre")
def get_songs_by_genre(genre_ids: str):

    conn = get_connection()
    cur = conn.cursor()

    ids = [int(x) for x in genre_ids.split(",")]

    cur.execute("""
        SELECT DISTINCT s.id, s.title         
        FROM songs s
        JOIN song_genres sg ON s.id = sg.song_id
        WHERE sg.genre_id = ANY(%s::int[])
        ORDER BY s.title ASC
    """, (ids,))

    rows = cur.fetchall()

    cur.close()
    conn.close()

    return [
        {"song_id": r[0], "title": r[1]}
        for r in rows
    ]

@router.get("/{song_id}/screen")
def get_song_screen(
    song_id: int,
    user_id: int = Depends(get_current_user)
):

    conn = get_connection()
    cur = conn.cursor()

    try:

        # =========================
        # SONG
        # =========================

        cur.execute("""
            SELECT
                s.id,
                s.title,
                s.cover_url,
                s.album_id,
                s.release_at
            FROM songs s
            WHERE s.id = %s
        """, (song_id,))

        row = cur.fetchone()

        if not row:
            raise HTTPException(
                status_code=404,
                detail="Song not found"
            )

        song = {
            "id": row[0],
            "title": row[1],
            "cover_url": row[2],
            "album_id": row[3],
            "release_at": row[4]
        }

        # =========================
        # ARTISTS
        # =========================

        cur.execute("""
            SELECT
                a.id,
                a.name,
                sa.role
            FROM song_artists sa
            JOIN artists a
                ON a.id = sa.artist_id
            WHERE sa.song_id = %s
            ORDER BY
                CASE
                    WHEN sa.role='main' THEN 0
                    ELSE 1
                END,
                a.name
        """, (song_id,))

        artists = []

        for artist_id, name, role in cur.fetchall():

            artists.append({
                "id": artist_id,
                "name": name,
                "role": role
            })

        # =========================
        # GENRES
        # =========================

        cur.execute("""
            SELECT
                g.id,
                g.name
            FROM song_genres sg
            JOIN genres g
                ON g.id = sg.genre_id
            WHERE sg.song_id = %s
            ORDER BY g.name
        """, (song_id,))

        genres = []

        for genre_id, name in cur.fetchall():

            genres.append({
                "id": genre_id,
                "name": name
            })

        # =========================
        # ALBUM
        # =========================

        album = None

        if song["album_id"]:

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
                        ) FILTER (WHERE ar.id IS NOT NULL),
                        '[]'
                    ) AS artists

                FROM albums al

                LEFT JOIN album_artists aa
                    ON aa.album_id = al.id

                LEFT JOIN artists ar
                    ON ar.id = aa.artist_id

                WHERE al.id = %s

                GROUP BY
                    al.id,
                    al.name,
                    al.cover_url
            """,(song["album_id"],))

            row = cur.fetchone()

            if row:

                album = {
                    "id": row[0],
                    "name": row[1],
                    "image": build_cover_url(row[2]),
                    "artists": row[3] or []
                }

        # =========================
        # PLAYLISTS (USER ONLY)
        # =========================

        cur.execute("""
            SELECT
                p.id,
                p.name,
                p.cover_url,
                COUNT(ps2.song_id)

            FROM playlist_songs ps

            JOIN playlists p
                ON p.id = ps.playlist_id

            LEFT JOIN playlist_songs ps2
                ON ps2.playlist_id = p.id

            WHERE
                ps.song_id = %s
                AND p.user_id = %s

            GROUP BY
                p.id,
                p.name,
                p.cover_url

            ORDER BY p.name
        """, (song_id, user_id))

        playlists = []

        for playlist_id, name, cover_url, count in cur.fetchall():

            playlists.append({
                "id": playlist_id,
                "name": name,
                "cover_url": build_cover_url(cover_url),
                "song_count": count
            })

        # =========================
        # RESPONSE
        # =========================

        return {

            "id": song["id"],
            "title": song["title"],
            "image": build_cover_url(song["cover_url"]),

            "release_at": song["release_at"],

            "artists": artists,

            "genres": genres,

            "album": album,

            "playlists": playlists

        }

    finally:

        cur.close()
        conn.close()


