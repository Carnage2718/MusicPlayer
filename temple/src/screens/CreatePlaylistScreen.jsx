import { useState, useEffect, useRef } from "react"
import API_BASE from "../api"
import AppHeader from "../components/AppHeader"
import "./CreatePlaylistScreen.css"
import { Music } from "lucide-react"
import SongCard from "../components/SongCard"

export default function CreatePlaylistScreen({ onBack }){

  const [name,setName] = useState("")
  const [songQuery,setSongQuery] = useState("")
  const [artistFilter,setArtistFilter] = useState("")
  const [songResults,setSongResults] = useState([])
  const [tracks,setTracks] = useState([])
  const [selectedSong,setSelectedSong] = useState(null)
  const [highlightIndex,setHighlightIndex] = useState(0)
  const [lockSearch, setLockSearch] = useState(false)

  const songRef = useRef()
  const artistRef = useRef()
  const addBtnRef = useRef()
  const fileRef = useRef()
  const resultRefs = useRef([])

  const [coverFile,setCoverFile] = useState(null)
  const [coverUrl,setCoverUrl] = useState(null)

  /* =========================
     SEARCH
  ========================= */

  useEffect(()=>{
    if(lockSearch) return

    if(songQuery || artistFilter){
      fetch(`${API_BASE}/search/song/advanced?q=${songQuery}&artist=${artistFilter}`)
        .then(r=>r.json())
        .then(data=>{
          setSongResults(data)
          setHighlightIndex(0)
        })
    }else{
      setSongResults([])
    }
  },[songQuery,artistFilter])

  /* =========================
     KEY CONTROL（🔥 Albumと同じ）
  ========================= */

  const handleKey = (e, list, onSelect, nextRef)=>{

    if(e.key === "Tab"){

      if(!list.length) return

      e.preventDefault()
      e.stopPropagation()

      setHighlightIndex(prev => {
        const next = (prev + 1) % list.length

        setTimeout(()=>{
          resultRefs.current[next]?.focus()
        },0)

        return next
      })
    }

    if(e.key === "Enter"){
      e.preventDefault()

      const selected = list[highlightIndex] || list[0]

      if(selected){
        onSelect(selected)
      }

      if(nextRef){
        setTimeout(()=> nextRef.current?.focus(),0)
      }
    }
  }
  /* =========================
     SELECT
  ========================= */

  const selectSong = (s)=>{
    setLockSearch(true)

    setSongQuery("")
    setSelectedSong(null)

    setTracks(prev => {
      if(prev.find(t => t.song_id === s.id)) return prev

      return [
        ...prev,
        {
          song_id: s.id,
          title: s.title
        }
      ]
    })

    setSongResults([])

    setTimeout(()=>{
      setLockSearch(false)

      // 🔥ここでフォーカス（超重要）
      songRef.current?.focus()
    },0)
  }

  const addSongDirect = (song)=>{

    if(!song) return

    if(tracks.find(t => t.song_id === song.id)) return

    setTracks(prev => [
      ...prev,
      {
        song_id: song.id,
        title: song.title
      }
    ])

    setSongQuery("")
    setSongResults([])
  }

  /* =========================
     ADD SONG
  ========================= */

  const addSong = ()=>{

    if(!selectedSong) return

    if(tracks.find(t => t.song_id === selectedSong.id)) return

    setTracks([
      ...tracks,
      {
        song_id: selectedSong.id,
        title: selectedSong.title
      }
    ])

    setSelectedSong(null)
    setSongQuery("")
    setSongResults([])

    setTimeout(()=> songRef.current?.focus(),0)
  }

  /* =========================
     REMOVE
  ========================= */

  const removeSong = (i)=>{
    const updated = [...tracks]
    updated.splice(i,1)
    setTracks(updated)
  }

  /* =========================
     CREATE
  ========================= */

  const createPlaylist = async()=>{

    let uploaded = null

    if(coverFile){
      const fd = new FormData()
      fd.append("file",coverFile)

      const res = await fetch(`${API_BASE}/upload/cover`,{
        method:"POST",
        body:fd
      })

      const data = await res.json()
      uploaded = data.url
    }

    await fetch(`${API_BASE}/playlists`,{
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({
        name,
        cover_url: uploaded,
        songs: tracks.map(t=>t.song_id)
      })
    })

    onBack()
  }

  /* =========================
     UI
  ========================= */

  return(
    <div className="screen">

      <AppHeader title="Create Playlist" onBack={onBack}/>

      <div className="create-playlist-form">

        <div className="create-playlist-hero">

          <div className="create-playlist-left">

            <input
              placeholder="Playlist name"
              value={name}
              onChange={e=>setName(e.target.value)}
            />

            <input
              ref={songRef}
              placeholder="Search song..."
              value={songQuery}
              onChange={e=>setSongQuery(e.target.value)}
              onKeyDown={(e)=>handleKey(e,songResults,selectSong,addBtnRef)}
            />

            <input
              ref={artistRef}
              placeholder="Filter by artist"
              value={artistFilter}
              onChange={e=>setArtistFilter(e.target.value)}
              onKeyDown={(e)=>handleKey(e,songResults,selectSong,addBtnRef)}
            />

            <button
              ref={addBtnRef}
              className="add-btn"
              disabled={!selectedSong}
              onClick={addSong}
              onKeyDown={(e)=>{
                if(e.key === "Enter"){
                  e.preventDefault()
                  addSong()
                }
              }}
            >
              ADD
            </button>

          </div>

          <div className="create-playlist-right">

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{display:"none"}}
              onChange={(e)=>{
                const f = e.target.files[0]
                if(f){
                  setCoverFile(f)
                  setCoverUrl(URL.createObjectURL(f))
                }
              }}
            />

            <div
              className="create-playlist-cover-wrap"
              onClick={()=>fileRef.current?.click()}
            >
              {coverUrl ? (
                <img src={coverUrl}/>
              ) : (
                <div className="create-playlist-placeholder">
                  <Music size={40}/>
                  Auto cover
                </div>
              )}
            </div>

            <button className="submit-btn" onClick={createPlaylist}>
              CREATE
            </button>

          </div>

        </div>

        {/* TRACK */}
        <div className="track-list">
          {tracks.map((t,i)=>(
            <div key={i} className="track-item">
              <span>{t.title}</span>
              <div onClick={()=>removeSong(i)}>✕</div>
            </div>
          ))}
        </div>

        {/* SEARCH RESULT */}
        {songResults.length > 0 && (
          <div className="search-result">

            {songResults.map((s,i)=>(
              <div
                key={s.id}
                ref={el => resultRefs.current[i] = el}
                tabIndex={0}
                onFocus={()=>setHighlightIndex(i)}
                onClick={()=>selectSong(s)}
                onKeyDown={(e)=>{
                  if(e.key === "Enter"){
                    e.preventDefault()
                    selectSong(s)
                  }
                }}
                className={`search-item ${i === highlightIndex ? "selected" : ""}`}
              >
                <SongCard
                  song={{
                    id: s.id,
                    title: s.title,
                    main: s.main,
                    ft: s.ft ? s.ft.split(", ") : [],
                    artists: s.artists || [],
                    image: s.image,
                    url: s.url
                  }}
                />
              </div>
            ))}

          </div>
        )}

      </div>

    </div>
  )
}