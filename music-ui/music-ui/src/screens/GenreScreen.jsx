import { useEffect, useState, useRef } from "react"
import { Play, Shuffle } from "lucide-react"
import API_BASE from "../api"
import SongCard from "../components/SongCard"
import AppHeader from "../components/AppHeader"
import { useSongs } from "../context/SongsContext"

import "./GenreScreen.css"

export default function GenreScreen(){

  const [genres,setGenres] = useState([])
  const [selected,setSelected] = useState(null)
  const [songs,setSongs] = useState([])

  const [isShuffle, setIsShuffle] = useState(true)
  const [isCreatingQueue, setIsCreatingQueue] = useState(false)

  const letterRefs = useRef({})

  /* =========================
     LOAD GENRES
  ========================= */

  useEffect(()=>{
    const load = async()=>{
      const res = await fetch(`${API_BASE}/genres`)
      const data = await res.json()
      setGenres(data)
      setSelected(data[0]?.id)
    }
    load()
  },[])

  /* =========================
     LOAD SONGS
  ========================= */

  useEffect(()=>{
    if(!selected) return

    const load = async()=>{
      const res = await fetch(`${API_BASE}/genres/${selected}/songs`)
      const data = await res.json()
      setSongs(data)
    }

    load()
  },[selected])

  /* =========================
     GROUP
  ========================= */

  const grouped = {}

  songs.forEach(s=>{
    const letter = /^[A-Z]/.test(s.title?.[0]?.toUpperCase())
      ? s.title[0].toUpperCase()
      : "#"

    if(!grouped[letter]) grouped[letter] = []
    grouped[letter].push(s)
  })

  const alphabet = Object.keys(grouped).sort()

  const jump = (l)=>{
    const el = letterRefs.current[l]
    if(!el) return

    window.scrollTo({
      top: el.offsetTop - 80,
      behavior:"smooth"
    })
  }


  const playGenre = async () => {
    if(isCreatingQueue) return

    setIsCreatingQueue(true)

    try{
        const res = await fetch(
        `${API_BASE}/queue/from_genre/${selected}?shuffle=${isShuffle}`,
        { method:"POST" }
        )

        const data = await res.json()

        setCurrentId(data.current)
        setIsPlaying(true)

        window.dispatchEvent(new Event("queueUpdated"))

    }finally{
        setIsCreatingQueue(false)
    }
  }

  /* =========================
     BG
  ========================= */

  const getBgClass = ()=>{
    return `genres-bg-${selected}`
  }

  return(
    <div className={`genres-screen ${getBgClass()}`}>

      <AppHeader title="Genres"/>

      {/* GENRE LIST */}
      <div className="genres-list">
        {genres.map(g=>(
          <div
            key={g.id}
            className={`genres-chip ${selected===g.name ? "active":""}`}
            onClick={()=>setSelected(g.id)}
          >
            {g.name}
          </div>
        ))}
      </div>

      {/* CONTROLS */}
      <div className="genres-controls">
        <button
          className="genres-play"
          onClick={playGenre}
        >
          <Play size={18}/>
          Play
        </button>

        <button
          className={`genres-shuffle ${isShuffle ? "active":""}`}
          onClick={()=>setIsShuffle(!isShuffle)}
        >
          <Shuffle size={18}/>
          Shuffle
        </button>
      </div>

      {/* SONG LIST */}
      <div className="genres-list-wrap">

        {alphabet.map(letter=>(
          <div
            key={letter}
            ref={el => letterRefs.current[letter] = el}
          >
            <div className="genres-letter">{letter}</div>

            {grouped[letter].map(song=>(
              <SongCard
                key={song.id}
                song={song}
              />
            ))}
          </div>
        ))}

      </div>

      {/* ALPHABET BAR */}
      <div className="genres-alphabet-bar">
        {alphabet.map(l=>(
          <div
            key={l}
            className="genres-alphabet-letter"
            onClick={()=>jump(l)}
          >
            {l}
          </div>
        ))}
      </div>

    </div>
  )
}