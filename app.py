import os
import psycopg2
from flask import Flask, request, redirect
app = Flask(__name__)
from psycopg2 import pool

bd_pool = pool.SimpleConnectionPool(1,10, os.environ["DATABASE_URL"], sslmode="require")

def get_connection():
    return bd_pool.getconn()

def release_connection(conn):
    bd_pool.putconn(conn)

@app.route("/")
def home():
    return "Music Player is running!"

if __name__ == "__main__":
    app.run()
    
@app.route("/initdb")
def initdb():
    conn = get_connection()
    cur = conn.cursor()

    #songs
    cur.execute("""
    CREATE TABLE IF NOT EXISTS songs (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        release_year INTEGER,
        stream_url TEXT NOT NULL,
        original_url TEXT,
        cover_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    #artists
    cur.execute("""
    CREATE TABLE IF NOT EXISTS artists (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    #song_artists
    cur.execute("""
    CREATE TABLE IF NOT EXISTS song_artists (
        id SERIAL PRIMARY KEY,
        song_id INTEGER REFERENCES songs(id) ON DELETE CASCADE,
        artist_id INTEGER REFERENCES artists(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('main', 'featured'))
    );
    """)

    #favorite_types
    cur.execute("""
    CREATE TABLE IF NOT EXISTS favorite_types (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL
    );
    """)

    #song_favorites
    cur.execute("""
    CREATE TABLE IF NOT EXISTS song_favorites (
        id SERIAL PRIMARY KEY,
        song_id INTEGER REFERENCES songs(id) ON DELETE CASCADE,
        favorite_type_id INTEGER REFERENCES favorite_types(id)
    );
    """)

    conn.commit()
    cur.close()
    conn.close()

    return "Database Initialized Successfully!"

@app.route("/add_song", methods=["GET", "POST"])
def add_song():
    if request.method == "POST":
        title = request.form["title"]
        artist_name = request.form["artist"]

        conn = get_connection()
        cur = conn.cursor()

        try:
            # ① 曲を追加
            cur.execute("""
                INSERT INTO songs (title)
                VALUES (%s)
                RETURNING id;
            """, (title,))

            song_id = cur.fetchone()[0]

            # ② アーティスト取得 or 作成
            cur.execute("SELECT id FROM artists WHERE name = %s;", (artist_name,))
            result = cur.fetchone()

            if result:
                artist_id = result[0]
            else:
                cur.execute("""
                    INSERT INTO artists (name)
                    VALUES (%s)
                    RETURNING id;
                """, (artist_name,))
                artist_id = cur.fetchone()[0]

            # ③ 紐付け
            cur.execute("""
                INSERT INTO song_artists (song_id, artist_id, role)
                VALUES (%s, %s, 'main');
            """, (song_id, artist_id))

            conn.commit()
        finally:
            cur.close()
            release_connection(conn)

        return redirect("/add_song")

    return """
        <h2>Add Song</h2>
        <form method="POST">
            Title: <input name="title"><br>
            Artist: <input name="artist"><br>
            <button type="submit">Add</button>
        </form>
    """

@app.route("/songs")
def list_songs():
    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT s.title, a.name
            FROM songs s
            JOIN song_artists sa ON s.id = sa.song_id
            JOIN artists a ON sa.artist_id = a.id;
        """)
        songs = cur.fetchall()
    finally:
        cur.close()
        release_connection(conn)
    
    return "<br>".join([f"{song[0]}-{song[1]}" for song in songs])
