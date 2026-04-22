from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
load_dotenv()

from app.routers import songs
from app.routers import queue
from app.routers import artists
from app.routers import albums
from app.routers import playlists
from app.routers import analytics
from app.routers import upload
from app.routers import search

app = FastAPI(
    title="Music Streaming API",
    description="Private music streaming backend",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(songs.router)
app.include_router(queue.router)
app.include_router(artists.router)
app.include_router(albums.router)
app.include_router(playlists.router)
app.include_router(analytics.router)
app.include_router(upload.router)
app.include_router(search.router)


@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/")
def root():
    return {"message": "Music API running"}

