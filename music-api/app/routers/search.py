from fastapi import APIRouter, Query
from app.database import get_connection
from app.utils.url import build_cover_url  # 🔥 追加

router = APIRouter(prefix="/search", tags=["search"])

# =============================
# GLOBAL SEARCH（完全版）
# =============================
@router.get("")
def global_search(q: str = ""):

    conn = get_connection()
    cur = conn.cursor()

    keyword = f"{' '.join(q.strip().lower().split())}%"

    # =====================
    # SONGS（完全版）
    # =====================
    cur.execute("""
    SELECT 
        s.id,
        s.title,
        STRING_AGG(a.name, ', ') as artists,
        s.cover_url
    FROM songs s
    LEFT JOIN song_artists sa ON s.id = sa.song_id
    LEFT JOIN artists a ON sa.artist_id = a.id
    WHERE LOWER(REGEXP_REPLACE(s.title, '\s+', ' ', 'g'))
      LIKE %s
    GROUP BY s.id, s.title, s.cover_url
    ORDER BY s.title
    LIMIT 10
    """, (keyword, ))

    songs = cur.fetchall()

    # =====================
    # ALBUMS（安全版）
    # =====================
    cur.execute("""
        SELECT 
            al.id,
            al.name,
            ar.name,
            al.cover_url
        FROM albums al
        LEFT JOIN artists ar ON al.artist_id = ar.id
        WHERE LOWER(REGEXP_REPLACE(al.name, '\s+', ' ', 'g'))
            LIKE %s
        ORDER BY al.name
        LIMIT 10
    """, (keyword, ))

    albums = cur.fetchall()

    # =====================
    # PLAYLISTS
    # =====================
    cur.execute("""
        SELECT id, name, cover_url
        FROM playlists
        WHERE LOWER(REGEXP_REPLACE(name, '\s+', ' ', 'g'))
            LIKE %s
        ORDER BY name
        LIMIT 10
    """, (keyword,))

    playlists = cur.fetchall()

    # =====================
    # ARTISTS
    # =====================
    cur.execute("""
        SELECT id, name, image_url
        FROM artists
        WHERE LOWER(REGEXP_REPLACE(name, '\s+', ' ', 'g'))
            LIKE %s
        ORDER BY name
        LIMIT 10
    """, (keyword,))

    artists = cur.fetchall()

    cur.close()
    conn.close()

    return {
        "songs":[
            {
                "id": s[0],
                "title": s[1],
                "artists": s[2],
                "cover_url": build_cover_url(s[3])
            }
            for s in songs
        ],
        "albums":[
            {
                "id": a[0],
                "name": a[1],
                "artist": a[2],
                "cover_url": build_cover_url(a[3])
            }
            for a in albums
        ],
        "playlists":[
            {
                "id": p[0],
                "name": p[1],
                "cover_url": build_cover_url(p[2])
            }
            for p in playlists
        ],
        "artists":[
            {
                "id": ar[0],
                "name": ar[1],
                "cover_url": build_cover_url(ar[2])
            }
            for ar in artists
        ]
    }

# =========================
# SEARCH song
# =========================

@router.get("/song")
def search_song_advanced(q: str = ""):

    conn = get_connection()
    cur = conn.cursor()

    q_clean = q.strip()

    q_prefix = f"{q_clean}%"
    q_word = f"% {q_clean}%"
    q_search = f"%{q_clean}%"

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

        WHERE
            (%s = '' OR s.title ILIKE %s OR s.title ILIKE %s OR s.title ILIKE %s)

        GROUP BY s.id

        ORDER BY
            MAX(
                CASE 
                    WHEN s.title ILIKE %s THEN 3
                    WHEN s.title ILIKE %s THEN 2
                    WHEN s.title ILIKE %s THEN 1
                    ELSE 0
                END
            ) DESC,
            s.title

        LIMIT 10
    """, (
        q_clean, q_prefix, q_word, q_search,
        q_prefix, q_word, q_search
    ))

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
# SEARCH artist
# =========================

@router.get("/artist")
def search_artists(q: str = Query("")):

    conn = get_connection()
    cur = conn.cursor()

    search = f"{q.strip()}%"

    cur.execute("""
        SELECT id, name
        FROM artists
        WHERE LOWER(REGEXP_REPLACE(name, '\s+', ' ', 'g'))
            LIKE LOWER(%s)
        ORDER BY name ASC
        LIMIT 5
    """, (search,))

    rows = cur.fetchall()

    cur.close()
    conn.close()

    return [
        {"id": r[0], "name": r[1]}
        for r in rows
    ]

# =========================
# SEARCH ALBUMS
# =========================

@router.get("/album")
def search_albums(q: str = Query("")):

    conn = get_connection()
    cur = conn.cursor()

    search = f"{q.strip()}%"   # 🔥 前方一致

    cur.execute("""
        SELECT al.id, al.name, ar.name, al.cover_url
        FROM albums al
        LEFT JOIN artists ar ON al.artist_id = ar.id
        WHERE LOWER(REGEXP_REPLACE(al.name, '\s+', ' ', 'g'))
            LIKE LOWER(%s)
        ORDER BY al.name ASC
        LIMIT 5
    """, (search,))

    rows = cur.fetchall()

    cur.close()
    conn.close()

    return [
        {
            "id": r[0],
            "name": r[1],
            "artist": r[2],
            "image": build_cover_url(r[3])
        }
        for r in rows
    ]



# =========================
# SEARCH SONG (sort artist)
# =========================

@router.get("/song/advanced")
def search_song_advanced(q: str = "", artist: str = ""):

    conn = get_connection()
    cur = conn.cursor()

    q_clean = q.strip()
    artist_clean = artist.strip()

    q_prefix = f"{q_clean}%"
    q_word = f"% {q_clean}%"
    q_search = f"%{q_clean}%"

    artist_prefix = f"{artist_clean}%"
    artist_word = f"% {artist_clean}%"

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

        WHERE
            (%s = '' OR s.title ILIKE %s OR s.title ILIKE %s)
        AND
            (%s = '' OR a.name ILIKE %s OR a.name ILIKE %s)

        GROUP BY s.id

        ORDER BY
            MAX(
                CASE 
                    WHEN s.title ILIKE %s THEN 3
                    WHEN s.title ILIKE %s THEN 2
                    WHEN s.title ILIKE %s THEN 1
                    ELSE 0
                END
            ) DESC,
            s.title

        LIMIT 10
    """, (
        q_clean, q_prefix, q_word,
        artist_clean, artist_prefix, artist_word,
        q_prefix, q_word, q_search
    ))

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


@router.get("/song/artist")
def get_songs_with_artist(
    q: str = Query(""),
    artist: str = Query(None)
):

    conn = get_connection()
    cur = conn.cursor()

    keyword = f"{q.strip().lower()}%"

    if artist:
        artist_list = [a.strip().lower() for a in artist.split(",") if a.strip()]

        conditions = " OR ".join([
            f"LOWER(ar2.name) LIKE %s" for _ in artist_list
        ])

        params = [keyword] + [f"{a}%" for a in artist_list]

        query = f"""
        SELECT 
            s.id,
            s.title,
            STRING_AGG(ar.name, ', ') as artists
        FROM songs s
        JOIN song_artists sa ON s.id = sa.song_id
        JOIN artists ar ON sa.artist_id = ar.id

        WHERE LOWER(REGEXP_REPLACE(s.title, '\s+', ' ', 'g'))
            LIKE %s

        AND EXISTS (
            SELECT 1
            FROM song_artists sa2
            JOIN artists ar2 ON sa2.artist_id = ar2.id
            WHERE sa2.song_id = s.id
            AND ({conditions})
        )

        GROUP BY s.id, s.title
        ORDER BY s.title ASC
        LIMIT 5
        """

        cur.execute(query, params)   
         
    else:
        cur.execute("""
        SELECT 
            s.id,
            s.title,
            STRING_AGG(ar.name, ', ') as artists
        FROM songs s
        JOIN song_artists sa ON s.id = sa.song_id
        JOIN artists ar ON sa.artist_id = ar.id

        WHERE LOWER(REGEXP_REPLACE(s.title, '\s+', ' ', 'g'))
            LIKE LOWER(%s)

        GROUP BY s.id, s.title
        ORDER BY s.title ASC
        LIMIT 5
        """, (f"{keyword}%",))

    rows = cur.fetchall()

    cur.close()
    conn.close()

    result = []

    for r in rows:
        artist_list = r[2].split(", ") if r[2] else []

        result.append({
            "id": r[0],
            "title": r[1],
            "artists": artist_list  # 👈 配列で返す
        })

    return result




