from fastapi import APIRouter, Body, Query
from app.database import get_connection
import random

router = APIRouter(prefix="/queue", tags=["queue"])


# =========================
# ユーティリティ
# =========================

def shuffle_ids(ids):
    for i in range(len(ids) - 1, 0, -1):
        j = random.randint(0, i)
        ids[i], ids[j] = ids[j], ids[i]
    return ids


def rotate_start(ids):
    if not ids:
        return ids
    idx = random.randint(0, len(ids) - 1)
    return ids[idx:] + ids[:idx]


def get_state(cur):
    cur.execute("SELECT current_index, loop_mode FROM playback_state WHERE id=1")
    row = cur.fetchone()

    if not row:
        cur.execute("""
            INSERT INTO playback_state (id, current_index, loop_mode)
            VALUES (1, 0, 'none')
        """)
        return (0, "none")

    return row


def set_index(cur, index):
    cur.execute(
        "UPDATE playback_state SET current_index=%s WHERE id=1",
        (index,)
    )


def reset_queue(cur, song_ids):
    cur.execute("DELETE FROM playback_queue")

    for i, s in enumerate(song_ids):
        cur.execute(
            """
            INSERT INTO playback_queue (song_id, position)
            VALUES (%s, %s)
            """,
            (s, i)
        )


def get_queue_ids(cur):
    cur.execute("""
        SELECT song_id
        FROM playback_queue
        ORDER BY position ASC
    """)
    return [r[0] for r in cur.fetchall()]


def build_queue(songs, shuffle=False):
    if not songs:
        return None, []

    if shuffle:
        random.shuffle(songs)

    current = songs[0]
    queue = songs[1:]

    return current, queue


def save_history(cur, song_id):
    # ① 追加
    cur.execute("""
        INSERT INTO play_history (song_id)
        VALUES (%s)
    """, (song_id,))

    # ② 50件制限
    cur.execute("""
        DELETE FROM play_history
        WHERE id NOT IN (
            SELECT id FROM play_history
            ORDER BY played_at DESC
            LIMIT 50
        )
    """)


def save_queue_context(
    cur,
    source_type,
    source_id,
    track_ids,
    original_order,
    shuffle_mode
):

    cur.execute("""
        DELETE FROM queue_context
    """)

    cur.execute("""
        INSERT INTO queue_context (
            source_type,
            source_id,
            track_ids,
            original_order,
            shuffle_mode
        )
        VALUES (%s, %s, %s, %s, %s)
    """, (
        source_type,
        source_id,
        track_ids,
        original_order,
        shuffle_mode
    ))


def get_latest_queue_context(cur):

    cur.execute("""
        SELECT
            source_type,
            source_id,
            track_ids,
            original_order,
            shuffle_mode
        FROM queue_context
        ORDER BY created_at DESC
        LIMIT 1
    """)

    row = cur.fetchone()

    if not row:
        return None

    return {
        "source_type": row[0],
        "source_id": row[1],
        "track_ids": row[2],
        "original_order": row[3],
        "shuffle_mode": row[4]
    }


def set_queue(cur, ids):

    cur.execute("DELETE FROM playback_queue")

    cur.executemany("""
        INSERT INTO playback_queue (song_id, position)
        VALUES (%s, %s)
    """, [(sid, i) for i, sid in enumerate(ids)])

    cur.execute("""
        UPDATE playback_state
        SET current_index = 0
    """)


def build_queue_response(ids):

    if not ids:
        return {
            "current": None,
            "queue": []
        }

    return {
        "current": ids[0],
        "queue": ids[1:]
    }


def update_queue_context(cur):

    ids = get_queue_ids(cur)

    ctx = get_latest_queue_context(cur)

    if not ctx:
        return

    cur.execute("""
        UPDATE queue_context
        SET
            track_ids = %s
        WHERE id = (
            SELECT id
            FROM queue_context
            ORDER BY created_at DESC
            LIMIT 1
        )
    """, (
        ids,
    ))


# =========================
# queue取得
# =========================

@router.get("")
def get_queue():

    conn = get_connection()
    cur = conn.cursor()

    try:
        ids = get_queue_ids(cur)
        state = get_state(cur)

        if not state:
            return {"current": None, "queue": []}

        current_index, _ = state

        current = None
        queue = []

        if ids and 0 <= current_index < len(ids):
            current = ids[current_index]
            queue = ids[current_index + 1:]

        return {
            "current": current,
            "queue": queue
        }

    finally:
        cur.close()
        conn.close()


# =========================
# 再生（単曲）
# =========================

@router.post("/play/{song_id}")
def play_song(song_id: int):

    conn = get_connection()
    cur = conn.cursor()

    try:
        # 存在確認
        cur.execute("SELECT id FROM songs WHERE id=%s", (song_id,))
        if not cur.fetchone():
            return {"error": "song not found"}

        # 🔥 queueロック（これが重要）
        cur.execute("LOCK TABLE playback_queue IN EXCLUSIVE MODE")

        ids = get_queue_ids(cur)

        if song_id in ids:
            index = ids.index(song_id)

        else:
            # 🔥 position安全取得
            cur.execute("""
                SELECT COALESCE(MAX(position), -1) + 1
                FROM playback_queue
            """)
            next_pos = cur.fetchone()[0]

            cur.execute("""
                INSERT INTO playback_queue (song_id, position)
                VALUES (%s, %s)
            """, (song_id, next_pos))

            index = len(ids)

        set_index(cur, index)

        if not get_latest_queue_context(cur):

            ids = get_queue_ids(cur)

            save_queue_context(
                cur,
                source_type="manual",
                source_id=None,
                track_ids=ids,
                original_order=ids.copy(),
                shuffle_mode=False
            )

        else:
            update_queue_context(cur)

        conn.commit()

        return {"song_id": song_id}

    except Exception as e:
        conn.rollback()
        print("PLAY ERROR:", e)
        return {"error": str(e)}

    finally:
        cur.close()
        conn.close()
        
                
# =========================
# next
# =========================

@router.post("/next")
def next_song(
    ignore_repeat_one: bool =False
):

    conn = get_connection()
    cur = conn.cursor()

    try:

        ids = get_queue_ids(cur)
        current_index, loop_mode = get_state(cur)

        if not ids:
            return {"current": None, "queue": []}

        # repeat one
        if loop_mode == "one" and not ignore_repeat_one:
            return {
                "current": ids[current_index],
                "queue": ids[current_index + 1:]
            }

        current_song = ids[current_index]
        save_history(cur, current_song)

        next_index = current_index + 1

        # 通常next
        if next_index < len(ids):
            set_index(cur, next_index)
            conn.commit()

        # repeat all
        elif loop_mode == "all":
            conn.commit()
            return restart()
        else:
            return{"current": None, "queue": []}
        # 🔥 最後に統一して返す
        ids = get_queue_ids(cur)
        current_index, _ = get_state(cur)

        return {
            "current": ids[current_index],
            "queue": ids[current_index + 1:]
        }

    finally:
        cur.close()
        conn.close()


# =========================
# prev
# =========================

@router.post("/previous")
def prev_song():

    conn = get_connection()
    cur = conn.cursor()

    try:
        ids = get_queue_ids(cur)
        current_index, _ = get_state(cur)

        if not ids:
            return {"current": None, "queue": []}

        if current_index <= 0:
            new_index = 0
        else:
            new_index = current_index - 1

        set_index(cur, new_index)
        conn.commit()

        return {
            "current": ids[new_index],
            "queue": ids[new_index + 1:]
        }

    finally:
        cur.close()
        conn.close()
        
        
# =========================
# from_songs
# =========================

@router.post("/from_recent")
def queue_from_recent(limit: int = 100):

    conn = get_connection()
    cur = conn.cursor()

    try:
        # 🔥 最近追加された曲を取得
        cur.execute("""
            SELECT id
            FROM songs
            ORDER BY created_at DESC
            LIMIT %s
        """, (limit,))

        song_ids = [r[0] for r in cur.fetchall()]

        if not song_ids:
            return {"current": None, "queue": []}
        
        orginal_order = song_ids.copy()

        # 🔥 shuffle
        random.shuffle(song_ids)

        save_queue_context(
            cur,
            source_type="recent",
            source_id=None,
            track_ids=song_ids,
            original_order=orginal_order,
            shuffle_mode=True
        )

        # 🔥 queueリセット
        cur.execute("DELETE FROM playback_queue")

        cur.executemany("""
            INSERT INTO playback_queue (song_id, position)
            VALUES (%s, %s)
        """, [(sid, i) for i, sid in enumerate(song_ids)])

        # 🔥 current = 0
        cur.execute("""
            UPDATE playback_state
            SET current_index = 0
        """)

        conn.commit()

        return {
            "current": song_ids[0],
            "queue": song_ids[1:]
        }

    finally:
        cur.close()
        conn.close()


@router.post("/from_songs")
def queue_from_songs(shuffle: bool = False):

    conn = get_connection()
    cur = conn.cursor()

    try:
        # 🔥 全曲取得（A-Z → # 並び）
        cur.execute("""
            SELECT id
            FROM songs
            ORDER BY
                CASE 
                    WHEN title ~ '^[A-Za-z]' THEN 0
                    ELSE 1
                END,
                LOWER(title)
        """)

        song_ids = [r[0] for r in cur.fetchall()]

        if not song_ids:
            return {"current": None, "queue": []}

        original_order = song_ids.copy()

        if shuffle:
            random.shuffle(song_ids)

        save_queue_context(
            cur,    
            source_type="songs",
            source_id=None,
            track_ids=song_ids,
            original_order=original_order,
            shuffle_mode=shuffle
        )

        # 🔥 queueリセット
        cur.execute("DELETE FROM playback_queue")

        # 🔥 INSERT
        cur.executemany("""
            INSERT INTO playback_queue (song_id, position)
            VALUES (%s, %s)
        """, [(sid, i) for i, sid in enumerate(song_ids)])

        # 🔥 current初期化
        cur.execute("""
            UPDATE playback_state
            SET current_index = 0
        """)

        conn.commit()

        return {
            "current": song_ids[0],
            "queue": song_ids[1:]
        }

    except Exception as e:
        conn.rollback()
        print("FROM_SONGS ERROR:", e)
        return {"error": str(e)}

    finally:
        cur.close()
        conn.close()


# =========================
# from_another
# =========================

@router.post("/from_playlist/{playlist_id}")
def queue_from_playlist(playlist_id: int, shuffle: bool = False):

    conn = get_connection()
    cur = conn.cursor()

    try:
        # 🔥 playlist順で取得
        cur.execute("""
            SELECT s.id
            FROM playlist_songs ps
            JOIN songs s ON s.id = ps.song_id
            WHERE ps.playlist_id = %s
            ORDER BY ps.position ASC
        """, (playlist_id,))

        song_ids = [r[0] for r in cur.fetchall()]

        if not song_ids:
            return {"current": None, "queue": []}

        orginal_order = song_ids.copy()

        if shuffle:
            random.shuffle(song_ids)
        
        
        # 🔥 queueリセット
        cur.execute("DELETE FROM playback_queue")

        # 🔥 INSERT
        cur.executemany("""
            INSERT INTO playback_queue (song_id, position)
            VALUES (%s, %s)
        """, [(sid, i) for i, sid in enumerate(song_ids)])

        save_queue_context(
            cur,
            source_type="playlist",
            source_id=playlist_id,
            track_ids=song_ids,
            original_order=orginal_order,
            shuffle_mode=shuffle
        )


        # 🔥 current初期化
        cur.execute("""
            UPDATE playback_state
            SET current_index = 0
        """)

        conn.commit()

        return {
            "current": song_ids[0],
            "queue": song_ids[1:]
        }

    except Exception as e:
        conn.rollback()
        print("FROM_PLAYLIST ERROR:", e)
        return {"error": str(e)}

    finally:
        cur.close()
        conn.close()


@router.post("/from_album/{album_id}")
def queue_from_album(album_id: int, shuffle: bool = True):

    conn = get_connection()
    cur = conn.cursor()

    try:
        # 🔥 トラック順取得
        cur.execute("""
            SELECT s.id
            FROM songs s
            WHERE s.album_id = %s
            ORDER BY s.track_number ASC
        """, (album_id,))

        song_ids = [r[0] for r in cur.fetchall()]

        if not song_ids:
            return {"current": None, "queue": []}

        original_order = song_ids.copy()

        if shuffle:
            random.shuffle(song_ids)

        # 🔥 queue更新
        cur.execute("DELETE FROM playback_queue")

        cur.executemany("""
            INSERT INTO playback_queue (song_id, position)
            VALUES (%s, %s)
        """, [(sid, i) for i, sid in enumerate(song_ids)])

        save_queue_context(
            cur,
            source_type="album",
            source_id=album_id,
            track_ids=song_ids,
            original_order=original_order,
            shuffle_mode=shuffle
        )

        cur.execute("""
            UPDATE playback_state
            SET current_index = 0
        """)

        conn.commit()

        return {
            "current": song_ids[0],
            "queue": song_ids[1:]
        }

    except Exception as e:
        conn.rollback()
        print("FROM_ALBUM ERROR:", e)
        return {"error": str(e)}

    finally:
        cur.close()
        conn.close()


@router.post("/from_artist/{artist_id}")
def queue_from_artist(artist_id: int, shuffle: bool = False):

    conn = get_connection()
    cur = conn.cursor()

    try:
        # 🔥 DBでソートまで完結
        cur.execute("""
            SELECT s.id
            FROM songs s
            JOIN song_artists sa ON sa.song_id = s.id
            WHERE sa.artist_id = %s
            ORDER BY
                CASE 
                    WHEN s.title ~ '^[A-Za-z]' THEN 0
                    ELSE 1
                END,
                LOWER(s.title)
        """, (artist_id,))

        song_ids = [r[0] for r in cur.fetchall()]

        if not song_ids:
            return {"current": None, "queue": []}

        original_order = song_ids.copy()

        if shuffle:
            random.shuffle(song_ids)

        # 🔥 超高速INSERT（ここ重要）
        cur.execute("DELETE FROM playback_queue")

        cur.executemany("""
            INSERT INTO playback_queue (song_id, position)
            VALUES (%s, %s)
        """, [(sid, i) for i, sid in enumerate(song_ids)])

        save_queue_context(
            cur,
            source_type="artist",
            source_id=artist_id,
            track_ids=song_ids,
            original_order=original_order,
            shuffle_mode=shuffle
        )

        cur.execute("""
            UPDATE playback_state
            SET current_index = 0
        """)

        conn.commit()

        return {
            "current": song_ids[0],
            "queue": song_ids[1:]
        }

    except Exception as e:
        conn.rollback()
        print("FROM_ARTIST ERROR:", e)
        return {"error": str(e)}

    finally:
        cur.close()
        conn.close()


@router.post("/from_genre/{genre_id}")
def queue_from_genre(genre_id: int, shuffle: bool = False):

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT s.id
            FROM songs s
            JOIN song_genres sg ON sg.song_id = s.id
            WHERE sg.genre_id = %s
            ORDER BY
                CASE 
                    WHEN s.title ~ '^[A-Za-z]' THEN 0
                    ELSE 1
                END,
                LOWER(s.title)
        """, (genre_id,))

        song_ids = [r[0] for r in cur.fetchall()]

        if not song_ids:
            return {"current": None, "queue": []}
        
        original_order = song_ids.copy()

        if shuffle:
            random.shuffle(song_ids)

        cur.execute("DELETE FROM playback_queue")

        cur.executemany("""
            INSERT INTO playback_queue (song_id, position)
            VALUES (%s, %s)
        """, [(sid, i) for i, sid in enumerate(song_ids)])
        
        save_queue_context(
            cur,
            source_type="genre",
            source_id=genre_id,
            track_ids=song_ids,
            original_order=original_order,
            shuffle_mode=shuffle
        )

        cur.execute("""
            UPDATE playback_state
            SET current_index = 0
        """)

        conn.commit()

        return {
            "current": song_ids[0],
            "queue": song_ids[1:]
        }

    finally:
        cur.close()
        conn.close()


# =========================
# shuffle（現在queue）
# =========================

@router.post("/shuffle")
def shuffle_queue():

    conn = get_connection()
    cur = conn.cursor()

    try:
        ids = get_queue_ids(cur)
        current_index, _ = get_state(cur)

        if not ids:
            return {"status": "empty"}

        current = ids[current_index]
        rest = ids[current_index + 1:]

        rest = shuffle_ids(rest)

        new_ids = ids[:current_index + 1] + rest

        reset_queue(cur, new_ids)

        update_queue_context(cur)

        conn.commit()

        return {
            "current": current,
            "queue": rest
        }

    finally:
        cur.close()
        conn.close()


# =========================
# reorder
# =========================

@router.put("/reorder")
def reorder(ids: list[int] = Body(...)):

    conn = get_connection()
    cur = conn.cursor()

    try:
        current_index, _ = get_state(cur)
        current_id = get_queue_ids(cur)[current_index]

        new_ids = [current_id] + [i for i in ids if i != current_id]

        reset_queue(cur, new_ids)
        update_queue_context(cur)
        set_index(cur, 0)

        conn.commit()

        ids = get_queue_ids(cur)
        current_index, _ = get_state(cur)

        return {
            "current": ids[current_index],
            "queue": ids[current_index + 1:]
        }

    finally:
        cur.close()
        conn.close()


# =========================
# mode
# =========================

@router.post("/mode")
def set_mode(loop: str):

    conn = get_connection()
    cur = conn.cursor()

    try:
        if loop not in ["none", "one", "all"]:
            return {"error": "invalid"}

        cur.execute(
            "UPDATE playback_state SET loop_mode=%s WHERE id=1",
            (loop,)
        )

        conn.commit()

        return {"loop": loop}

    finally:
        cur.close()
        conn.close()

@router.get("/mode")
def get_mode():

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT loop_mode
            FROM playback_state
            WHERE id=1
        """)

        row = cur.fetchone()

        return {
            "loop": row[0] if row else "none"
        }

    finally:
        cur.close()
        conn.close()


# =========================
# add
# =========================
@router.post("/add")
def add_to_queue(song_id: int = Query(...)):

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("SELECT id FROM songs WHERE id=%s", (song_id,))
        if not cur.fetchone():
            return {"error": "song not found"}

        cur.execute("SELECT COALESCE(MAX(position), -1) FROM playback_queue")
        last = cur.fetchone()[0]

        cur.execute("""
            INSERT INTO playback_queue (song_id, position)
            VALUES (%s, %s)
        """, (song_id, last + 1))

        update_queue_context(cur)

        conn.commit()

        # 🔥 追加（重要）
        ids = get_queue_ids(cur)
        current_index, _ = get_state(cur)

        current = ids[current_index] if ids else None
        queue = ids[current_index + 1:] if ids else []

        return {
            "current": current,
            "queue": queue
        }

    finally:
        cur.close()
        conn.close()


# =========================
# add_next
# =========================

@router.post("/add_next")
def add_next(song_id: int = Query(...)):

    conn = get_connection()
    cur = conn.cursor()

    try:
        # 曲存在確認
        cur.execute("SELECT 1 FROM songs WHERE id=%s", (song_id,))
        if not cur.fetchone():
            return {"error": "song not found"}

        ids = get_queue_ids(cur)
        current_index, _ = get_state(cur)

        cur.execute("""
            SELECT COUNT(*) FROM playback_queue
        """)
        count = cur.fetchone()[0]

        insert_pos = min(current_index + 1, count)

        cur.execute("""
            UPDATE playback_queue
            SET position = position + 1
            WHERE id IN (
                SELECT id FROM playback_queue
                WHERE position >= %s
                ORDER BY position DESC
            )
        """, (insert_pos,))

        # 🔥 insert
        cur.execute("""
            INSERT INTO playback_queue (song_id, position)
            VALUES (%s, %s)
        """, (song_id, insert_pos))

        conn.commit()

        # 🔥 正規化（軽量版）
        cur.execute("""
            UPDATE playback_queue
            SET position = sub.new_pos
            FROM (
                SELECT id,
                       ROW_NUMBER() OVER (ORDER BY position) - 1 AS new_pos
                FROM playback_queue
            ) sub
            WHERE playback_queue.id = sub.id
        """)

        update_queue_context(cur)

        conn.commit()

        ids = get_queue_ids(cur)
        current_index, _ = get_state(cur)

        return {
            "current": ids[current_index] if ids else None,
            "queue": ids[current_index + 1:] if ids else []
        }

    finally:
        cur.close()
        conn.close()


# =========================
# repeat_all
# =========================
@router.post("/restart")
def restart():

    conn = get_connection()
    cur = conn.cursor()

    try:

        ctx = get_latest_queue_context(cur)

        if not ctx:
            return {"current": None, "queue": []}

        if ctx["shuffle_mode"]:
            ids = ctx["track_ids"].copy()

        else:
            ids = ctx["track_ids"]

        set_queue(cur, ids)

        conn.commit()

        return build_queue_response(ids)

    finally:
        cur.close()
        conn.close()




