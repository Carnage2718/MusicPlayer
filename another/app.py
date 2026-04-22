import os
import psycopg2
from psycopg2 import pool
from flask import Flask, request, redirect, jsonify

app = Flask(__name__)

# ===============================
# DB POOL
# ===============================

db_pool = pool.SimpleConnectionPool(
    1,
    10,
    os.environ["DB_URL"],
    sslmode="require"
)

def get_connection():
    return db_pool.getconn()

def release_connection(conn):
    db_pool.putconn(conn)


# ===============================
# HOME
# ===============================

@app.route("/")
def home():
    return "Music Player API Running"


# ===============================
# INIT DATABASE
# ===============================

@app.route("/initdb")
def initdb():

    conn = get_connection()
    cur = conn.cursor()

    try:

        cur.execute("""
        CREATE TABLE IF NOT EXISTS songs (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            release_year INTEGER,
            stream_url TEXT,
            original_url TEXT,
            cover_url TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        cur.execute("""
        CREATE TABLE IF NOT EXISTS artists (
            id SERIAL PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        cur.execute("""
        CREATE TABLE IF NOT EXISTS song_artists (
            id SERIAL PRIMARY KEY,
            song_id INTEGER REFERENCES songs(id) ON DELETE CASCADE,
            artist_id INTEGER REFERENCES artists(id) ON DELETE CASCADE,
            role TEXT NOT NULL CHECK (role IN ('main','featured'))
        );
        """)

        conn.commit()

    finally:
        cur.close()
        release_connection(conn)

    return "Database initialized"


# ===============================
# ADD SONG
# ===============================

@app.route("/api/add_song", methods=["POST"])
def add_song():

    data = request.json

    title = data["title"]
    artist_name = data["artist"]

    conn = get_connection()
    cur = conn.cursor()

    try:

        cur.execute("""
        INSERT INTO songs (title)
        VALUES (%s)
        RETURNING id
        """, (title,))

        song_id = cur.fetchone()[0]

        cur.execute(
            "SELECT id FROM artists WHERE name=%s",
            (artist_name,)
        )

        result = cur.fetchone()

        if result:
            artist_id = result[0]
        else:
            cur.execute("""
            INSERT INTO artists (name)
            VALUES (%s)
            RETURNING id
            """, (artist_name,))
            artist_id = cur.fetchone()[0]

        cur.execute("""
        INSERT INTO song_artists (song_id, artist_id, role)
        VALUES (%s,%s,'main')
        """, (song_id, artist_id))

        conn.commit()

    finally:
        cur.close()
        release_connection(conn)

    return jsonify({"status":"ok"})


# ===============================
# SONG LIST
# ===============================

@app.route("/api/songs")
def songs():

    conn = get_connection()
    cur = conn.cursor()

    try:

        cur.execute("""
        SELECT s.id, s.title, a.name
        FROM songs s
        JOIN song_artists sa ON s.id = sa.song_id
        JOIN artists a ON sa.artist_id = a.id
        """)

        rows = cur.fetchall()

        result = []

        for r in rows:
            result.append({
                "id": r[0],
                "title": r[1],
                "artist": r[2]
            })

    finally:
        cur.close()
        release_connection(conn)

    return jsonify(result)


# ===============================
# HISTORY
# ===============================

@app.route("/api/songs/history")
def songs_history():

    conn = get_connection()
    cur = conn.cursor()

    try:

        cur.execute("""
        SELECT s.id, s.title, a.name
        FROM songs s
        JOIN song_artists sa ON s.id = sa.song_id
        JOIN artists a ON sa.artist_id = a.id
        ORDER BY s.created_at DESC
        LIMIT 10
        """)

        rows = cur.fetchall()

        result = []

        for r in rows:
            result.append({
                "song_id": r[0],
                "title": r[1],
                "artist": r[2]
            })

    finally:
        cur.close()
        release_connection(conn)

    return jsonify(result)


# ===============================
# ARTISTS
# ===============================

@app.route("/api/artists")
def artists():

    conn = get_connection()
    cur = conn.cursor()

    try:

        cur.execute("""
        SELECT id, name
        FROM artists
        ORDER BY name
        """)

        rows = cur.fetchall()

        result = []

        for r in rows:
            result.append({
                "artist_id": r[0],
                "name": r[1]
            })

    finally:
        cur.close()
        release_connection(conn)

    return jsonify(result)


# ===============================
# SERVER
# ===============================

if __name__ == "__main__":
    app.run(debug=True)