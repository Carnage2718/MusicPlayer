from fastapi import APIRouter
from app.database import get_connection
from app.utils.url import build_cover_url

router = APIRouter(tags=["analytics"])

@router.get("/songs/popular")
def popular_songs(days: int = 30):

    conn = get_connection()
    cur = conn.cursor()

    try:

        cur.execute("""
        SELECT 
            s.id,
            s.title,
            s.cover_url,
            STRING_AGG(a.name, ', ') AS artist,
            COUNT(ph.song_id) AS plays
        FROM songs s
        LEFT JOIN play_history ph
            ON s.id = ph.song_id
            AND ph.played_at > NOW() - (%s * INTERVAL '1 days')
        LEFT JOIN song_artists sa
            ON s.id = sa.song_id
        LEFT JOIN artists a
            ON sa.artist_id = a.id
        GROUP BY s.id, s.title, s.cover_url
        ORDER BY plays DESC
        LIMIT 50
        """ ,(days,))

        rows = cur.fetchall()

        return [
            {
                "song_id": r[0],
                "title": r[1],
                "image": build_cover_url(r[2]),
                "artist": r[3],
                "plays": r[4]
            }
            for r in rows
        ]

    finally:
        cur.close()
        conn.close()


@router.get("/history")
def recent_history(limit: int = 50):

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT
            s.id,
            s.title,
            STRING_AGG(DISTINCT a.name, ', ') AS artist,
            s.cover_url,
            ph.played_at
        FROM play_history ph
        JOIN songs s
            ON ph.song_id = s.id
        LEFT JOIN song_artists sa
            ON s.id = sa.song_id
        LEFT JOIN artists a
            ON sa.artist_id = a.id
        GROUP BY s.id, s.title, s.cover_url, ph.played_at
        ORDER BY ph.played_at DESC
        LIMIT %s
    """, (limit,))

    rows = cur.fetchall()

    cur.close()
    conn.close()

    return [
        {
            "song_id": r[0],
            "title": r[1],
            "artist": r[2],
            "image": build_cover_url(r[3]),
            "played_at": r[4]
        }
        for r in rows
    ]


@router.post("/songs/history/add")
def add_history(song_id:int):

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO play_history (song_id)
        VALUES (%s)
    """,(song_id,))

    conn.commit()

    cur.close()
    conn.close()

    return {"status":"ok"}


@router.get("/songs/popular/yearly")
def yearly_ranking(year: int, limit: int = 20):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT s.id, s.title, COUNT(ph.id) as plays
        FROM songs s
        JOIN play_history ph ON s.id = ph.song_id
        WHERE EXTRACT(YEAR FROM ph.played_at) = %s
        GROUP BY s.id
        ORDER BY plays DESC
        LIMIT %s;
    """, (year, limit))

    rows = cur.fetchall()

    cur.close()
    conn.close()

    return [{
        "id": row[0],
        "title": row[1],
        "plays": row[2]
    } for row in rows]


@router.get("/songs/popular/monthly")
def monthly_ranking(year: int, month: int, limit: int =20):
    conn = get_connection()
    cur =conn.cursor()

    cur.execute("""
        SELECT s.id, s.title, COUNT(ph.id) as plays
        FROM songs s
        JOIN play_history ph ON s.id = ph.song_id
        WHERE EXTRACT(YEAR FROM ph.played_at) = %s AND EXTRACT(MONTH FROM ph.played_at) = %s
        GROUP BY s.id
        ORDER BY plays DESC
        LIMIT %s;
    """, (year, month, limit))

    rows = cur.fetchall()

    cur.close()
    conn.close()

    return [{
        "id": row[0],
        "title": row[1],
        "plays": row[2]
    } for row in rows]


@router.get("/songs/popular/alltime")
def alltime_ranking(limit: int =20):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT s.id, s.title, COUNT(ph.id) as plays
        FROM songs s
        JOIN play_history ph ON s.id = ph.song_id
        GROUP BY s.id
        ORDER BY plays DESC
        LIMIT %s;
    """,(limit,))

    rows = cur.fetchall()
    cur.close()
    conn.close()

    return[
        {"id": r[0], "title":r[1], "plays":r[2]}
        for r in rows
    ]


@router.post("/songs/snapshots/yearly")
def force_recreate_yearly_snapshot(year: int):

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("DELETE FROM yearly_snapshots WHERE year = %s;", (year,))

    cur.execute("""
        SELECT s.id, COUNT(ph.id) as plays
        FROM songs s
        JOIN play_history ph ON s.id = ph.song_id
        WHERE EXTRACT(YEAR FROM ph.played_at) = %s
        GROUP BY s.id
        ORDER BY plays DESC
        LIMIT 20;
    """, (year,))

    top_songs = cur.fetchall()

    for rank, row in enumerate(top_songs, start=1):
        cur.execute("""
            INSERT INTO yearly_snapshots (year, rank, song_id, play_count)
            VALUES (%s, %s, %s, %s);
        """, (year, rank, row[0], row[1]))

    conn.commit()
    cur.close()
    conn.close()

    return {
        "message": f"{year} snapshot created"
    }


@router.get("/songs/snapshots/yearly")
def get_or_create_yearly_snapshot(year: int):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT COUNT(*)
        FROM yearly_snapshots
        WHERE year = %s;
    """,(year,))

    exists = cur.fetchone()[0] 
    if exists == 0:
        cur.execute("""
            SELECT s.id, COUNT(ph.id) as plays
            FROM songs s
            JOIN play_history ph ON s.id = ph.song_id
            WHERE EXTRACT(YEAR FROM ph.played_at) = %s
            GROUP BY s.id
            ORDER BY plays DESC
            LIMIT 20;
        """, (year,))

        top_songs = cur.fetchall()

        for rank, row in enumerate(top_songs, start=1):
            cur.execute("""
                INSERT INTO yearly_snapshots (year, rank, song_id, play_count)
                VALUES (%s, %s, %s, %s);
            """, (year, rank, row[0], row[1]))

        conn.commit()

    cur.execute("""
        SELECT ys.rank, s.id, s.title, ys.play_count
        FROM yearly_snapshots ys
        JOIN songs s ON ys.song_id = s.id
        WHERE ys.year = %s
        ORDER BY ys.rank;
    """, (year,))

    rows = cur.fetchall()

    cur.close()
    conn.close()

    return [{
        "rank": r[0],
        "song_id": r[1],
        "title": r[2],
        "play_count": r[3]
    } for r in rows]


@router.get("/songs/snapshots/yearly_multi")
def multi_year_snapshot(years: str):
    year_list = [int(y.strip()) for y in years.split(",")]

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT ys.year, ys.rank, s.id, s.title, ys.play_count
        FROM yearly_snapshots ys
        JOIN songs s ON ys.song_id = s.id
        WHERE ys.year = ANY(%s::int[])
        ORDER BY ys.year DESC, ys.rank ASC;
    """, (year_list,))

    rows = cur.fetchall()

    cur.close()
    conn.close()

    result = {}

    for row in rows:
        year = row[0]
        if year not in result:
            result[year] = []

        result[year].append({
            "rank": row[1],
            "song_id": row[2],
            "title": row[3],
            "play_count": row[4]
        })

    return result


@router.get("/songs/snapshot/monthly")
def get_or_create_monthly_snapshot(year: int, month: int):

    conn = get_connection()
    cur = conn.cursor()

    # 存在確認
    cur.execute("""
        SELECT COUNT(*)
        FROM monthly_snapshots
        WHERE year = %s AND month = %s;
    """, (year, month))

    exists = cur.fetchone()[0]

    if exists == 0:
        cur.execute("""
            SELECT s.id, COUNT(ph.id) as plays
            FROM songs s
            JOIN play_history ph ON s.id = ph.song_id
            WHERE EXTRACT(YEAR FROM ph.played_at) = %s
              AND EXTRACT(MONTH FROM ph.played_at) = %s
            GROUP BY s.id
            ORDER BY plays DESC
            LIMIT 20;
        """, (year, month))

        top_songs = cur.fetchall()

        for rank, row in enumerate(top_songs, start=1):
            cur.execute("""
                INSERT INTO monthly_snapshots (year, month, rank, song_id, play_count)
                VALUES (%s, %s, %s, %s, %s);
            """, (year, month, rank, row[0], row[1]))

        conn.commit()

    # 取得
    cur.execute("""
        SELECT ms.rank, s.id, s.title, ms.play_count
        FROM monthly_snapshots ms
        JOIN songs s ON ms.song_id = s.id
        WHERE ms.year = %s AND ms.month = %s
        ORDER BY ms.rank;
    """, (year, month))

    rows = cur.fetchall()

    cur.close()
    conn.close()

    return [
        {
            "rank": r[0],
            "song_id": r[1],
            "title": r[2],
            "play_count": r[3]
        }
        for r in rows
    ]


@router.get("/songs/snapshot/monthly_multi")
def multi_month_snapshot(dates: str):

    date_list = [d.strip() for d in dates.split(",")]

    parsed = []
    for d in date_list:
        year, month = d.split("-")
        parsed.append((int(year), int(month)))

    conn = get_connection()
    cur = conn.cursor()

    result = {}

    for year, month in parsed:

        cur.execute("""
            SELECT COUNT(*)
            FROM monthly_snapshots
            WHERE year = %s AND month = %s;
        """, (year, month))

        exists = cur.fetchone()[0]

        if exists == 0:
            cur.execute("""
                SELECT s.id, COUNT(ph.id) as plays
                FROM songs s
                JOIN play_history ph ON s.id = ph.song_id
                WHERE EXTRACT(YEAR FROM ph.played_at) = %s
                  AND EXTRACT(MONTH FROM ph.played_at) = %s
                GROUP BY s.id
                ORDER BY plays DESC
                LIMIT 20;
            """, (year, month))

            top_songs = cur.fetchall()

            for rank, row in enumerate(top_songs, start=1):
                cur.execute("""
                    INSERT INTO monthly_snapshots (year, month, rank, song_id, play_count)
                    VALUES (%s, %s, %s, %s, %s);
                """, (year, month, rank, row[0], row[1]))

            conn.commit()

        cur.execute("""
            SELECT ms.rank, s.id, s.title, ms.play_count
            FROM monthly_snapshots ms
            JOIN songs s ON ms.song_id = s.id
            WHERE ms.year = %s AND ms.month = %s
            ORDER BY ms.rank;
        """, (year, month))

        rows = cur.fetchall()

        key = f"{year}-{month:02d}"

        result[key] = [
            {
                "rank": r[0],
                "song_id": r[1],
                "title": r[2],
                "play_count": r[3]
            }
            for r in rows
        ]

    cur.close()
    conn.close()

    return result


@router.get("/home")
def get_home():

    conn = get_connection()
    cur = conn.cursor()

    try:

        # =====================
        # recent
        # =====================

        cur.execute("""
        SELECT
            s.id,
            s.title,
            s.cover_url
        FROM play_history ph
        JOIN songs s ON ph.song_id = s.id
        GROUP BY s.id, s.title, s.cover_url
        ORDER BY MAX(ph.played_at) DESC
        LIMIT 10
        """)

        rows = cur.fetchall()

        recent = []

        for r in rows:

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

            recent.append({
                "song_id": song_id,
                "title": r[1],
                "image": build_cover_url(r[2]),
                "artists": artists
            })


        # =====================
        # trending
        # =====================

        cur.execute("""
        SELECT
            s.id,
            s.title,
            s.cover_url,
            COUNT(ph.song_id) AS plays
        FROM songs s
        LEFT JOIN play_history ph ON s.id = ph.song_id
        GROUP BY s.id,s.title,s.cover_url
        ORDER BY plays DESC
        LIMIT 10
        """)

        rows = cur.fetchall()

        trending = []

        for r in rows:

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

            trending.append({
                "song_id": song_id,
                "title": r[1],
                "image": build_cover_url(r[2]),
                "artists": artists
            })

            
        # =====================
        # artists
        # =====================

        cur.execute("""
        SELECT id,name, image_url
        FROM artists
        ORDER BY RANDOM()
        LIMIT 10
        """)

        artists = [
            {
                "artist_id": r[0],
                "name": r[1],
                "image": build_cover_url(r[2])
            }
            for r in cur.fetchall()
        ]


        # =====================
        # albums
        # =====================

        cur.execute("""
        SELECT 
            al.id,
            al.name,
            al.cover_url,
            ar.name,
            ar.id AS artist_id
        FROM albums al
                    JOIN artists ar ON al.artist_id = ar.id
        ORDER BY RANDOM()
        LIMIT 10
        """)

        albums = [
            {
                "id": r[0],
                "name": r[1],
                "image": build_cover_url(r[2]),
                "artist": r[3],
                "artist_id": r[4]
            }
            for r in cur.fetchall()
        ]


        return {
            "recent": recent,
            "trending": trending,
            "artists": artists,
            "albums": albums
        }

    finally:
        cur.close()
        conn.close()


@router.get("/init")
def init_data():

    conn = get_connection()
    cur = conn.cursor()

    try:

        # songs

        cur.execute("""
        SELECT
            s.id,
            s.title,
            s.cover_url,
            STRING_AGG(a.name, ', ') AS artist
        FROM songs s
        LEFT JOIN song_artists sa ON s.id = sa.song_id
        LEFT JOIN artists a ON sa.artist_id = a.id
        GROUP BY s.id,s.title,s.cover_url
        """)

        songs = [
            {
                "song_id": r[0],
                "title": r[1],
                "image": build_cover_url(r[2]),
                "artist": r[3]
            }
            for r in cur.fetchall()
        ]


        # queue

        cur.execute("""
        SELECT
            q.song_id,
            q.position
        FROM playback_queue q
        ORDER BY position
        """)

        queue = [
            {
                "song_id": r[0],
                "position": r[1]
            }
            for r in cur.fetchall()
        ]


        # current

        cur.execute("""
        SELECT song_id
        FROM playback_queue
        WHERE is_current = true
        LIMIT 1
        """)

        row = cur.fetchone()

        current = row[0] if row else None


        return {
            "songs": songs,
            "queue": queue,
            "current": current
        }

    finally:

        cur.close()
        conn.close()

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

@router.post("/songs/shuffle")
def shuffle_queue():

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
        SELECT id
        FROM songs
        ORDER BY RANDOM()
        LIMIT 50
        """)

        rows = cur.fetchall()
        song_ids = [r[0] for r in rows]

        create_queue(cur, song_ids, reset=True)

        conn.commit()

        return {
            "song_id": song_ids[0]
        }

    finally:
        cur.close()
        conn.close()
        
@router.post("/songs/shuffle/{limit}")
def shuffle_queue_limit(limit: int):

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
        SELECT id
        FROM songs
        ORDER BY RANDOM()
        LIMIT %s
        """, (limit,))

        rows = cur.fetchall()
        song_ids = [r[0] for r in rows]

        create_queue(cur, song_ids, reset=True)

        conn.commit()

        return {
            "song_id": song_ids[0],
            "total": len(song_ids)
        }

    finally:
        cur.close()
        conn.close()