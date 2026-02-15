import os
import psycopg2
from flask import Flask
app = Flask(__name__)

@app.route("/")
def home():
    return "Music Player is running!"

if __name__ == "__main__":
    app.run()
    
@app.route("/initdb")
def initdb():
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
        artist_id INTEGER REFERENCES artists(id) ON DELETE CASCADE
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