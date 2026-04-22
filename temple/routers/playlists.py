from fastapi import APIRouter, Body
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
    # 🎯 COVER生成（絶対にR2）
    # =========================

    # ① ユーザーアップロード
    if cover_url:
        cover_url = save_cover_from_url(cover_url)

    # ② 自動生成
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
            # 🔥 必ずR2アップロードされる
            cover_url = generate_smart_cover(covers, data.name)
        else:
            # 🔥 ランダム → R2保存
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
@router.post("/{playlist_id}/songs")
def add_song_to_playlist(playlist_id: int, song_id: int):

    conn = get_connection()
    cur = conn.cursor()

    # =========================
    # 現在の曲数取得
    # =========================
    cur.execute("""
        SELECT COUNT(*)
        FROM playlist_songs
        WHERE playlist_id = %s;
    """, (playlist_id,))
    
    count = cur.fetchone()[0]

    # =========================
    # position取得
    # =========================
    cur.execute("""
        SELECT COALESCE(MAX(position), 0)
        FROM playlist_songs
        WHERE playlist_id = %s;
    """, (playlist_id,))

    max_position = cur.fetchone()[0]

    # =========================
    # 曲追加
    # =========================
    cur.execute("""
        INSERT INTO playlist_songs (playlist_id, song_id, position)
        VALUES (%s, %s, %s);
    """, (playlist_id, song_id, max_position + 1))

    # =========================
    # 🎯 4曲以内ならcover再生成
    # =========================
    if count <= 4:
        cur.execute("""
            SELECT cover_url
            FROM playlists
            WHERE id = %s
        """, (playlist_id,))

        old_cover = cur.fetchone()[0]

        cur.execute("""
            SELECT s.cover_url
            FROM playlist_songs ps
            JOIN songs s ON ps.song_id = s.id
            WHERE ps.playlist_id = %s
            AND s.cover_url IS NOT NULL
            ORDER BY ps.position
            LIMIT 4
        """, (playlist_id,))

        covers = [
            build_cover_url(r[0])
            for r in cur.fetchall()
            if r[0]
        ]

        cur.execute("""
            SELECT name
            FROM playlists
            WHERE id = %s
        """, (playlist_id,))

        row = cur.fetchone()
        playlist_name = row[0] if row else "Playlist"

        if covers:
            new_cover = generate_smart_cover(covers, playlist_name)

            # 🔥 古いcover削除
            if old_cover and old_cover.startswith("cover/playlist/"):
                delete_cover_from_r2(old_cover)

            cur.execute("""
                UPDATE playlists
                SET cover_url = %s
                WHERE id = %s
            """, (new_cover, playlist_id))

    conn.commit()
    cur.close()
    conn.close()

    return {"message": "Song added"}


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