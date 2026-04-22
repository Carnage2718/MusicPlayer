from fastapi import APIRouter, Body
from app.database import get_connection
from app.models import ModeUpdate, MultiArtistQueue
from app.utils.url import build_cover_url
import random

router = APIRouter(prefix="/queue", tags=["queue"])

@router.get("")
def get_queue_only():

    conn = get_connection()
    cur = conn.cursor()
    
    try:

        cur.execute("""
        SELECT position
        FROM playback_queue
        WHERE is_current = true
        LIMIT 1
        """)

        row = cur.fetchone()

        if not row:
            current_pos = None
        else:
            current_pos = row[0]

        cur.execute("""
        SELECT
            q.song_id,
            q.position,
            s.title,
            s.cover_url,
            STRING_AGG(DISTINCT a.name, ', ') AS artist
        FROM playback_queue q
        JOIN songs s ON q.song_id = s.id
        LEFT JOIN song_artists sa ON s.id = sa.song_id
        LEFT JOIN artists a ON sa.artist_id = a.id
        GROUP BY
            q.song_id,
            q.position,
            s.title,
            s.cover_url
        ORDER BY q.position
        """)

        rows = cur.fetchall()

        if current_pos is None:

            return [
                {
                    "song_id":r[0],
                    "position":r[1],
                    "title":r[2],
                    "cover":build_cover_url(r[3]),
                    "artist":r[4]
                } 
                for r in rows
            ]

        return [
            {
                "song_id": r[0],
                "position": r[1],
                "title": r[2],
                "cover": build_cover_url(r[3]),
                "artist": r[4]
            }
            for r in rows if r[1] > current_pos
        ]

    finally:
        cur.close()
        conn.close()
        

# =========================
# FULL
# =========================
@router.get("/full")
def get_queue():

    conn = get_connection()
    cur = conn.cursor()

    try:
        # =========================
        # queue取得（artist除去）
        # =========================
        cur.execute("""
        SELECT
            q.song_id,
            q.position,
            q.is_current,
            s.title,
            s.cover_url
        FROM playback_queue q
        JOIN songs s ON q.song_id = s.id
        ORDER BY q.position
        """)

        rows = cur.fetchall()

        current = None
        current_position = None
        rows_data = []

        for r in rows:

            song_id = r[0]

            # 🔥 artist取得（ここが重要）
            cur.execute("""
            SELECT a.id, a.name, sa.role
            FROM song_artists sa
            JOIN artists a ON sa.artist_id = a.id
            WHERE sa.song_id = %s
            """, (song_id,))

            artist_rows = cur.fetchall()

            artists = []

            for aid, name, role in artist_rows:
                artists.append({
                    "id": aid,
                    "name": name,
                    "role": (role or "").lower()
                })

            song = {
                "song_id": song_id,
                "position": r[1],
                "title": r[3],
                "cover": build_cover_url(r[4]),
                "artists": artists   # 🔥 ここ
            }

            if r[2]:
                current = song
                current_position = r[1]

            rows_data.append(song)

        # =========================
        # safety
        # =========================
        if current is None and rows_data:
            current = rows_data[0]
            current_position = current["position"]

        # =========================
        # queue（Up Next）
        # =========================
        if current_position is None:
            queue = rows_data
        else:
            queue = [
                s for s in rows_data
                if s["position"] > current_position
            ]

        # =========================
        # history（同様に修正）
        # =========================
        cur.execute("""
        SELECT
            s.id,
            s.title,
            s.cover_url
        FROM play_history h
        JOIN songs s ON h.song_id = s.id
        GROUP BY s.id,s.title,s.cover_url
        ORDER BY MAX(h.played_at) DESC
        LIMIT 20
        """)

        history_rows = cur.fetchall()

        history = []

        for r in history_rows:

            song_id = r[0]

            cur.execute("""
            SELECT a.id, a.name, sa.role
            FROM song_artists sa
            JOIN artists a ON sa.artist_id = a.id
            WHERE sa.song_id = %s
            """, (song_id,))

            artist_rows = cur.fetchall()

            artists = []

            for aid, name, role in artist_rows:
                artists.append({
                    "id": aid,
                    "name": name,
                    "role": (role or "").lower()
                })

            history.append({
                "song_id": song_id,
                "title": r[1],
                "cover": build_cover_url(r[2]),
                "artists": artists   # 🔥 ここ
            })

        return {
            "current": current,
            "queue": queue,
            "history": history
        }

    finally:
        cur.close()
        conn.close()


# =========================
# PLAY
# =========================
@router.post("/play/{song_id}")
def play_song(song_id: int):

    conn = get_connection()
    cur = conn.cursor()

    try:
        # =========================
        # 現在の曲取得
        # =========================
        cur.execute("""
        SELECT song_id, position
        FROM playback_queue
        WHERE is_current=true
        LIMIT 1
        """)
        current = cur.fetchone()

        if current:
            current_song_id, current_pos = current

            # 🔥 historyに追加（最重要）
            cur.execute("""
            INSERT INTO play_history(song_id)
            VALUES(%s)
            """, (current_song_id,))

        else:
            current_pos = 0

        # =========================
        # queueに存在するか確認
        # =========================
        cur.execute("""
        SELECT position
        FROM playback_queue
        WHERE song_id=%s
        """, (song_id,))
        exists = cur.fetchone()

        if not exists:
            # 🔥 currentより後ろに挿入
            cur.execute("""
            UPDATE playback_queue
            SET position = position + 1
            WHERE position > %s
            """, (current_pos,))

            cur.execute("""
            INSERT INTO playback_queue(song_id, position, is_current)
            VALUES(%s, %s, false)
            """, (song_id, current_pos + 1))

        # =========================
        # current更新
        # =========================
        cur.execute("UPDATE playback_queue SET is_current=false")

        cur.execute("""
        UPDATE playback_queue
        SET is_current=true
        WHERE song_id=%s
        """, (song_id,))

        conn.commit()

        return {"song_id": song_id}

    finally:
        cur.close()
        conn.close()

# =========================
# NEXT/PREVIOUS
# =========================
@router.post("/next")
def next_song():

    conn = get_connection()
    cur = conn.cursor()

    try:
        # current取得
        cur.execute("""
        SELECT song_id, position
        FROM playback_queue
        WHERE is_current=true
        LIMIT 1
        """)
        current = cur.fetchone()

        if not current:
            return {"error": "no current"}

        current_song_id, pos = current

        # 🔥 history追加（これが無いのが原因）
        cur.execute("""
        INSERT INTO play_history(song_id)
        VALUES(%s)
        """, (current_song_id,))

        # 次曲取得
        cur.execute("""
        SELECT song_id, position
        FROM playback_queue
        WHERE position > %s
        ORDER BY position
        LIMIT 1
        """, (pos,))

        next_row = cur.fetchone()

        if not next_row:
            cur.execute("""
            SELECT song_id, position
            FROM playback_queue
            ORDER BY position
            LIMIT 1
            """)
            next_row = cur.fetchone()

        next_song, next_pos = next_row

        # current更新
        cur.execute("UPDATE playback_queue SET is_current=false")

        cur.execute("""
        UPDATE playback_queue
        SET is_current=true
        WHERE position=%s
        """, (next_pos,))

        conn.commit()

        return {"song_id": next_song}

    finally:
        cur.close()
        conn.close()


@router.post("/previous")
def previous_song():

    conn = get_connection()
    cur = conn.cursor()

    try:
        # =========================
        # ① 現在の曲取得
        # =========================
        cur.execute("""
        SELECT song_id
        FROM playback_queue
        WHERE is_current = true
        LIMIT 1
        """)
        current = cur.fetchone()

        if not current:
            return {"error": "no current"}

        current_song_id = current[0]

        # =========================
        # ② historyの最新取得
        # =========================
        cur.execute("""
        SELECT song_id
        FROM play_history
        ORDER BY played_at DESC
        LIMIT 1
        """)
        row = cur.fetchone()

        if not row:
            return {"error": "no history"}

        prev_song_id = row[0]

        # =========================
        # ③ currentをhistoryに追加
        # =========================
        if current_song_id != prev_song_id:
            cur.execute("""
            INSERT INTO play_history (song_id)
            VALUES (%s)
            """, (current_song_id,))

        # =========================
        # ④ current切り替え（ここだけ）
        # =========================
        cur.execute("""
        UPDATE playback_queue
        SET is_current = false
        """)

        cur.execute("""
        UPDATE playback_queue
        SET is_current = true
        WHERE song_id = %s
        """, (prev_song_id,))

        conn.commit()

        return {"song_id": prev_song_id}

    finally:
        cur.close()
        conn.close()


@router.put("/reorder")
def reorder_queue(ids: list[int] = Body(...)):

    conn = get_connection()
    cur = conn.cursor()

    try:

        # 現在再生曲取得
        cur.execute("""
        SELECT song_id, position
        FROM playback_queue
        WHERE is_current = true
        LIMIT 1
        """)

        row = cur.fetchone()

        if not row:
            return {"error": "no current song"}

        current_song, current_pos = row

        position = current_pos + 1

        for song_id in ids:

            if song_id == current_song:
                continue

            cur.execute("""
            UPDATE playback_queue
            SET position = %s
            WHERE song_id = %s
            """, (position, song_id))

            position += 1

        conn.commit()

        return {"status": "reordered"}

    finally:
        cur.close()
        conn.close()


# =========================
# SHUFFLE
# =========================
@router.post("/shuffle")
def shuffle_queue():

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
        SELECT song_id, position
        FROM playback_queue
        WHERE is_current=true
        LIMIT 1
        """)
        current_song, current_pos = cur.fetchone()

        cur.execute("""
        SELECT song_id
        FROM playback_queue
        WHERE position > %s
        """, (current_pos,))

        ids = [r[0] for r in cur.fetchall()]
        random.shuffle(ids)

        pos = current_pos + 1

        for song_id in ids:
            cur.execute("""
            UPDATE playback_queue
            SET position=%s
            WHERE song_id=%s
            """, (pos, song_id))
            pos += 1

        conn.commit()

        return {"status": "ok"}

    finally:
        cur.close()
        conn.close()


@router.post("/insert_next/{song_id}")
def insert_next(song_id:int):

    conn = get_connection()
    cur = conn.cursor()

    try:

        cur.execute("""
        SELECT position
        FROM playback_queue
        WHERE is_current=true
        LIMIT 1
        """)

        row = cur.fetchone()
        if not row :
            return {"error":"no current"}

        current_pos = row[0]

        cur.execute("""
        UPDATE playback_queue
        SET position=position+1
        WHERE position>%s
        AND is_current = false
        """,(current_pos,))

        cur.execute("""
        DELETE FROM playback_queue
        WHERE song_id = %s
        AND is_current = false
        """,(song_id,))

        cur.execute("""
        INSERT INTO playback_queue(song_id,position,is_current)
        VALUES(%s,%s,false)
        """,(song_id,current_pos+1))

        conn.commit()

        return {"status":"inserted"}

    finally:
        cur.close()
        conn.close()


@router.post("/insert/{position}/{song_id}")
def insert_at_position(position:int, song_id:int):

    conn = get_connection()
    cur = conn.cursor()

    try:

        # current位置
        cur.execute("""
        SELECT position FROM playback_queue
        WHERE is_current=true
        LIMIT 1
        """)
        current_pos = cur.fetchone()[0]

        # 🔥 currentより前は禁止
        if position <= current_pos:
            position = current_pos + 1

        # 既存削除（current以外）
        cur.execute("""
        DELETE FROM playback_queue
        WHERE song_id=%s AND is_current=false
        """,(song_id,))

        # ずらす
        cur.execute("""
        UPDATE playback_queue
        SET position = position + 1
        WHERE position >= %s
        """,(position,))

        # insert
        cur.execute("""
        INSERT INTO playback_queue(song_id,position,is_current)
        VALUES(%s,%s,false)
        """,(song_id,position))

        conn.commit()

        return {"status":"inserted"}

    finally:
        cur.close()
        conn.close()


# =========================
# 🔥 QUEUE生成（最重要）
# =========================
def create_queue(cur, song_ids, reset=False):

    if reset:
        # 全削除（shuffleなど）
        cur.execute("DELETE FROM playback_queue")

        for i, song_id in enumerate(song_ids, start=1):
            cur.execute("""
            INSERT INTO playback_queue(song_id, position, is_current)
            VALUES(%s,%s,%s)
            """, (song_id, i, i == 1))

        return

    # ===== 既存queueの最後position取得 =====
    cur.execute("""
    SELECT COALESCE(MAX(position), 0) FROM playback_queue
    """)
    offset = cur.fetchone()[0]

    # ===== current存在チェック =====
    cur.execute("""
    SELECT COUNT(*) FROM playback_queue WHERE is_current = true
    """)
    has_current = cur.fetchone()[0] > 0

    # ===== 追加 =====
    for i, song_id in enumerate(song_ids, start=1):
        cur.execute("""
        INSERT INTO playback_queue(song_id, position, is_current)
        VALUES(%s,%s,%s)
        """, (
            song_id,
            offset + i,
            False if has_current else (i == 1)
        ))


@router.post("/from_playlist/{playlist_id}")
def from_playlist(playlist_id: int):

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("DELETE FROM playback_queue")

        cur.execute("""
        SELECT song_id
        FROM playlist_songs
        WHERE playlist_id=%s
        ORDER BY position
        """, (playlist_id,))

        rows = cur.fetchall()

        if not rows:
            return {"message": "empty"}

        song_ids = [r[0] for r in rows]

        create_queue(cur, song_ids)

        conn.commit()

        return {"song_id": song_ids[0]}

    finally:
        cur.close()
        conn.close()


@router.post("/from_album/{album_id}")
def from_album(album_id: int):

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("DELETE FROM playback_queue")

        cur.execute("""
        SELECT id
        FROM songs
        WHERE album_id=%s
        ORDER BY track_number
        """, (album_id,))

        rows = cur.fetchall()

        song_ids = [r[0] for r in rows]

        create_queue(cur, song_ids)

        conn.commit()

        return {"song_id": song_ids[0]}

    finally:
        cur.close()
        conn.close()


@router.post("/from_artist/{artist_id}")
def from_artist(artist_id: int):

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("DELETE FROM playback_queue")

        cur.execute("""
        SELECT s.id
        FROM songs s
        JOIN song_artists sa ON s.id = sa.song_id
        WHERE sa.artist_id=%s
        ORDER BY s.title
        """, (artist_id,))

        rows = cur.fetchall()

        song_ids = [r[0] for r in rows]

        create_queue(cur, song_ids)

        conn.commit()

        return {"song_id": song_ids[0]}

    finally:
        cur.close()
        conn.close()


@router.get("/mode")
def get_playback_mode():
    
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT shuffle_mode, repeat_mode
        FROM playback_state
        LIMIT 1
    """)

    row = cur.fetchone()

    cur.close()
    conn.close()

    if not row:
        return {
            "shuffle": False,
            "repeat": "none"
        }

    return{
        "shuffle": row[0],
        "repeat": row[1]
    }


@router.post("/mode")
def set_playback_mode(mode: ModeUpdate):

    conn = get_connection()
    cur = conn.cursor()

    if mode.repeat not in ["none", "one", "all"]:
        return {"error": "Invalid repeat mode"}
    
    cur.execute("""
        UPDATE playback_state
        SET shuffle_mode = %s,
            repeat_mode = %s
    """, (mode.shuffle, mode.repeat))

    conn.commit()
    cur.close()
    conn.close()

    return {"message": "Playback mode updated"}


@router.post("/player/play")
def set_playing(is_playing: bool):

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        UPDATE playback_state
        SET is_playing = %s,
            updated_at = CURRENT_TIMESTAMP;
    """, (is_playing,))

    conn.commit()
    cur.close()
    conn.close()

    return {"is_playing": is_playing}



