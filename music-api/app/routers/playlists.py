from fastapi import APIRouter, Body, Query
from app.database import get_connection
from app.models import PlaylistCreate
from app.utils.url import build_cover_url
from app.utils.cover import (
    generate_random_cover,
    generate_smart_cover,
    save_cover_from_url,
    delete_cover_from_r2
)

router = APIRouter(prefix="/playlists", tags=["playlists"])

# =========================
# GET PLAYLISTS
# =========================
@router.get("")
def get_playlists():

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT 
            p.id,
            p.name,
            p.cover_url,
            COUNT(ps.song_id) as song_count
        FROM playlists p
        LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id
        GROUP BY p.id, p.name, p.cover_url
        ORDER BY p.id DESC
    """)

    rows = cur.fetchall()

    cur.close()
    conn.close()

    return [
        {
            "id": r[0],
            "name": r[1],
            "cover_url": build_cover_url(r[2]),
            "song_count": int(r[3])
        }
        for r in rows
    ]


# =========================
# CREATE PLAYLIST
# =========================
@router.post("")
def create_playlist(data: PlaylistCreate):

    conn = get_connection()
    cur = conn.cursor()

    cover_url = data.cover_url if data.cover_url else None
    song_ids = data.songs or []

    # =========================
    # 🎯 COVER処理（修正済）
    # =========================

    if cover_url:
        # 🔥 すでにR2パスならそのまま使う
        if cover_url.startswith("cover/"):
            pass
        else:
            # 外部URLのみ保存
            cover_url = save_cover_from_url(cover_url)

    # =========================
    # 自動生成
    # =========================

    if not cover_url:

        covers = []

        if song_ids:
            cur.execute("""
                SELECT cover_url
                FROM songs
                WHERE id = ANY(%s)
                AND cover_url IS NOT NULL
                LIMIT 4
            """, (song_ids,))

            covers = [
                build_cover_url(r[0])
                for r in cur.fetchall()
                if r[0]
            ]

        if covers:
            cover_url = generate_smart_cover(covers, data.name)
        else:
            cover_url = save_cover_from_url(generate_random_cover())

    # =========================
    # INSERT
    # =========================

    cur.execute("""
        INSERT INTO playlists (name, description, cover_url)
        VALUES (%s, %s, %s)
        RETURNING id;
    """, (
        data.name.strip(),
        (data.description or "").strip(),
        cover_url
    ))

    playlist_id = cur.fetchone()[0]

    # =========================
    # SONGS
    # =========================

    for i, song_id in enumerate(song_ids, start=1):
        cur.execute("""
            INSERT INTO playlist_songs (playlist_id, song_id, position)
            VALUES (%s, %s, %s)
        """, (playlist_id, song_id, i))

    conn.commit()
    cur.close()
    conn.close()

    return {
        "id": playlist_id,
        "name": data.name,
        "cover_url": cover_url
    }


# =========================
# DETAIL
# =========================
@router.get("/{playlist_id}")
def get_playlist_detail(playlist_id: int):

    conn = get_connection()
    cur = conn.cursor()

    # =========================
    # PLAYLIST
    # =========================
    cur.execute("""
        SELECT id, name, cover_url, description
        FROM playlists
        WHERE id = %s
    """, (playlist_id,))

    playlist = cur.fetchone()

    if not playlist:
        return {"message": "Playlist not found"}

    # =========================
    # SONGS（完全版）
    # =========================
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
            s.stream_url,
            ps.position

        FROM playlist_songs ps
        JOIN songs s ON ps.song_id = s.id
        LEFT JOIN song_artists sa ON sa.song_id = s.id
        LEFT JOIN artists a ON a.id = sa.artist_id

        WHERE ps.playlist_id = %s

        GROUP BY s.id, ps.position

        ORDER BY ps.position
    """, (playlist_id,))

    songs = cur.fetchall()

    cur.close()
    conn.close()

    return {
        "id": playlist[0],
        "name": playlist[1],
        "cover_url": build_cover_url(playlist[2]),
        "description": playlist[3],
        "songs":[
            {
                "id": r[0],
                "title": r[1],
                "main": r[2],
                "ft": r[3],
                "artists": r[4],
                "image": build_cover_url(r[5]),
                "url": r[6],
                "position": r[7]
            }
            for r in songs
        ]
    }


# =========================
# ADD SONG
# =========================
@router.post("/{playlist_id}/add")
def add_song_to_playlist(
    playlist_id: int,
    song_id: int = Query(...)
):

    conn = get_connection()
    cur = conn.cursor()

    try:
        # =========================
        # 存在チェック
        # =========================
        cur.execute("SELECT id FROM songs WHERE id = %s", (song_id,))
        if not cur.fetchone():
            return {"error": "Song not found"}

        cur.execute("SELECT id FROM playlists WHERE id = %s", (playlist_id,))
        if not cur.fetchone():
            return {"error": "Playlist not found"}

        # =========================
        # すでに入ってるか（任意）
        # =========================
        cur.execute("""
            SELECT 1 FROM playlist_songs
            WHERE playlist_id = %s AND song_id = %s
        """, (playlist_id, song_id))

        if cur.fetchone():
            return {"message": "Already exists"}

        # =========================
        # 最後尾position取得
        # =========================
        cur.execute("""
            SELECT COALESCE(MAX(position), 0)
            FROM playlist_songs
            WHERE playlist_id = %s
        """, (playlist_id,))

        max_pos = cur.fetchone()[0]

        # =========================
        # INSERT
        # =========================
        cur.execute("""
            INSERT INTO playlist_songs (playlist_id, song_id, position)
            VALUES (%s, %s, %s)
        """, (playlist_id, song_id, max_pos + 1))

        conn.commit()

        return {
            "success": True,
            "position": max_pos + 1
        }

    except Exception as e:
        conn.rollback()
        print("ADD PLAYLIST ERROR:", e)
        return {"error": str(e)}

    finally:
        cur.close()
        conn.close()


# =========================
# REORDER
# =========================
@router.put("/{playlist_id}/reorder")
def reorder_playlist(playlist_id: int, song_orders: list[int] = Body(...)):

    conn = get_connection()
    cur = conn.cursor()

    for position, song_id in enumerate(song_orders, start=1):
        cur.execute("""
            UPDATE playlist_songs
            SET position = %s
            WHERE playlist_id = %s AND song_id = %s;
        """, (position, playlist_id, song_id))

    conn.commit()
    cur.close()
    conn.close()

    return {"message": "Playlist reordered"}


# =========================
# SEARCH
# =========================
@router.get("/search")
def search_playlists(q: str = ""):

    conn = get_connection()
    cur = conn.cursor()

    search = f"%{q.strip()}%"

    cur.execute("""
        SELECT id, name, cover_url
        FROM playlists
        WHERE name ILIKE %s
        ORDER BY name ASC
        LIMIT 50
    """, (search,))

    rows = cur.fetchall()

    cur.close()
    conn.close()

    return [
        {
            "id": r[0],
            "name": r[1],
            "cover_url": build_cover_url(r[2])
        }
        for r in rows
    ]



# =========================
# DELETE
# =========================
@router.delete("/{playlist_id}/remove")
def remove_song(
    playlist_id: int,
    song_id: int = Query(...)
):

    conn = get_connection()
    cur = conn.cursor()

    try:
        # =========================
        # ① position取得
        # =========================
        cur.execute("""
            SELECT position
            FROM playlist_songs
            WHERE playlist_id = %s AND song_id = %s
        """, (playlist_id, song_id))

        row = cur.fetchone()

        if not row:
            return {"message": "Not found"}

        removed_position = row[0]

        # =========================
        # ② DELETE
        # =========================
        cur.execute("""
            DELETE FROM playlist_songs
            WHERE playlist_id = %s AND song_id = %s
        """, (playlist_id, song_id))

        # =========================
        # ③ 詰める（超重要）
        # =========================
        cur.execute("""
            UPDATE playlist_songs
            SET position = position - 1
            WHERE playlist_id = %s
              AND position > %s
        """, (playlist_id, removed_position))

        conn.commit()

        return {
            "success": True,
            "removed_position": removed_position
        }

    except Exception as e:
        conn.rollback()
        print("REMOVE ERROR:", e)
        return {"error": str(e)}

    finally:
        cur.close()
        conn.close()