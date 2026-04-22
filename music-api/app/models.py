from pydantic import BaseModel
from typing import Optional,List
from datetime import date

class ModeUpdate(BaseModel):
    shuffle: bool
    repeat: str


class MultiArtistQueue(BaseModel):
    artist_ids: List[int]
    shuffle: bool = False
    exclude_genres: List[str] = []


class GenreUpdate(BaseModel):
    genre_ids: List[int]


class PlaylistCreate(BaseModel):
    name: str
    description: str | None = None


class AddSongs(BaseModel):
    song_ids: list[int]


class TrackCreate(BaseModel):
    song_id: int
    track_number: Optional[int] = None



class ArtistInput(BaseModel):
    id: Optional[int] = None
    name: str
    role: str = "main"


class AlbumCreate(BaseModel):
    name: str
    artists: List[ArtistInput]
    cover_url: Optional[str] = None
    release_date: Optional[str] = None
    tracks: Optional[List[TrackCreate]] = []
    

class PlaylistCreate(BaseModel):
    name: str
    description: str | None = None
    cover_url: str | None = None
    songs: list[int] = []