from fastapi import APIRouter, HTTPException, Query
import boto3, os
from botocore.client import Config
from app.database import get_connection
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

@router.get("/recent")
def list_recent_songs(limit: int = 20):

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
        ORDER BY s.created_at DESC
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

@router.get("/{song_id}")
def get_song_detail(song_id: int):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT id, title, stream_url, cover_url, created_at
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
        "created_at": song[4],
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
def increment_play_count(song_id: int):

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
        UPDATE songs
        SET play_count = play_count + 1
        WHERE id = %s
        """, (song_id,))

        # 🔥 履歴にも追加したい場合
        cur.execute("""
        INSERT INTO play_history (song_id)
        VALUES (%s)
        """, (song_id,))

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

