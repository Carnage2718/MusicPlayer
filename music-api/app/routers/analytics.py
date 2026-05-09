from fastapi import APIRouter, Depends
from app.database import get_connection
from app.routers.auth import get_current_user
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
def recent_history(
    limit: int = 50,
    user=Depends(get_current_user)
):
    
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT *
        FROM (
            SELECT
                s.id,
                s.title,
                s.cover_url,
                ph.played_at,

                COALESCE(
                    JSON_AGG(
                        JSON_BUILD_OBJECT(
                            'id', a.id,
                            'name', a.name,
                            'role', LOWER(sa.role)
                        )
                    ) FILTER (WHERE a.id IS NOT NULL),
                    '[]'
                ) AS artists

            FROM play_history ph

            JOIN songs s
                ON ph.song_id = s.id

            LEFT JOIN song_artists sa
                ON s.id = sa.song_id

            LEFT JOIN artists a
                ON sa.artist_id = a.id

            WHERE ph.user_id=%s

            GROUP BY
                s.id,
                s.title,
                s.cover_url,
                ph.played_at

            ORDER BY ph.played_at DESC
            LIMIT %s
        ) recent

        ORDER BY played_at ASC
    """, (user, limit))

    rows = cur.fetchall()

    cur.close()
    conn.close()

    return [
        {
            "song_id": r[0],
            "title": r[1],
            "image": build_cover_url(r[2]),
            "played_at": r[3],
            "artists":r[4]
        }
        for r in rows
    ]


@router.post("/songs/history/add")
def add_history(
    song_id:int,
    user=Depends(get_current_user)
):

    conn = get_connection()
    cur = conn.cursor()


    cur.execute("""
        INSERT INTO play_history (user_id, song_id)
        VALUES (%s, %s)
    """,(user, song_id))

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
def get_home(
    user=Depends(get_current_user)
):

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
        JOIN songs s
            ON ph.song_id = s.id
        WHERE ph.user_id=%s
        GROUP BY s.id, s.title, s.cover_url
        ORDER BY MAX(ph.played_at) DESC
        LIMIT 10
        """,(user,))

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
        SELECT 
            a.id,
            a.name,
            a.image_url,
            COUNT(DISTINCT s.id) as song_count
        FROM artists a
        LEFT JOIN song_artists sa ON sa.artist_id = a.id
        LEFT JOIN songs s ON s.id = sa.song_id
        GROUP BY a.id
        HAVING COUNT(DISTINCT s.id) >= 5
        ORDER BY RANDOM()
        LIMIT 10
        """)

        artists = [
            {
                "artist_id": r[0],
                "name": r[1],
                "image": build_cover_url(r[2]),
                "song_count": r[3]
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
        GROUP BY al.id
        ORDER BY RANDOM()
        LIMIT 10
        """)

        albums = [
            {
                "id": r[0],
                "name": r[1],
                "image": build_cover_url(r[2]),
                "artists": r[3]
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
