import { useEffect, useRef, useState } from "react"
import { Shuffle, Play} from "lucide-react"
import API_BASE from "../api"
import SongCard from "../components/SongCard"
import SongMenu from "../components/MenuComponent"
import AppHeader from "../components/AppHeader"
import { useSongs } from "../context/SongsContext"

import "./SongsScreen.css"

export default function SongsScreen({
  onSelectSong,
  onOpenArtist
}){

  const [songs,setSongs] = useState([])
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState(null)
  const [isShuffle, setIsShuffle] = useState(true)
  const [isCreatingQueue, setIsCreatingQueue] = useState(false)

  const letterRefs = useRef({})

  const { playFrom } = useSongs()

  /* ======================
     LOAD SONGS
  ====================== */

  useEffect(()=>{

    const loadSongs = async()=>{

      try{

        const res = await fetch(`${API_BASE}/songs`)
        const data = await res.json()

        /* A-Z → # 並び */

        const sorted = data.sort((a,b)=>{

          const titleA = (a.title || "").toUpperCase()
          const titleB = (b.title || "").toUpperCase()

          const aSymbol = !/^[A-Z]/.test(titleA)
          const bSymbol = !/^[A-Z]/.test(titleB)

          if(aSymbol && !bSymbol) return 1
          if(!aSymbol && bSymbol) return -1

          return titleA.localeCompare(titleB)

        })

        setSongs(sorted)

      }catch(err){

        console.error("songs fetch error",err)
        setError("Failed to load songs")

      }finally{

        setLoading(false)

      }

    }

    loadSongs()

  },[])

  
  /* ======================
     from_songs
  ====================== */

  const playSongs = () => {
    playFrom(`${API_BASE}/queue/from_songs?shuffle=${isShuffle}`)
  }

  const toggleShuffle = () => {
    setIsShuffle(prev => !prev)
  }


  /* ======================
     GROUP SONGS
  ====================== */

  const grouped = {}

  songs.forEach(song=>{

    const letter =
      /^[A-Z]/.test(song.title?.[0]?.toUpperCase())
      ? song.title[0].toUpperCase()
      : "#"

    if(!grouped[letter]){
      grouped[letter] = []
    }

    grouped[letter].push(song)

  })

  /* A-Z → # */

  const alphabet = Object.keys(grouped).sort((a,b)=>{

    if(a === "#") return 1
    if(b === "#") return -1

    return a.localeCompare(b)

  })

  /* ======================
     JUMP TO LETTER
  ====================== */

  const jumpToLetter = (letter) => {

    const el = letterRefs.current[letter]
    if (!el) return

    const headerHeight = parseInt(
      getComputedStyle(document.documentElement)
        .getPropertyValue("--header-height")
    ) || 72

    const OFFSET = 12

    requestAnimationFrame(() => {

      const y =
        el.getBoundingClientRect().top +
        window.scrollY -
        headerHeight -
        OFFSET

      window.scrollTo({
        top: y,
        behavior: "smooth"
      })

    })
  }

  /* ======================
     UI
  ====================== */

  return(

    <div className="screen">

      <AppHeader title="Songs"/>

      
      <div className="songs-controls">

        <button 
          className="songs-play"
          onClick={playSongs}
          disabled={isCreatingQueue}
        >
          <Play size={18}/>
          {isCreatingQueue ? "Preparing..." : "Play"}
        </button>

        <button 
          className={`songs-shuffle ${isShuffle ? "active" : ""}`}
          onClick={toggleShuffle}
        >
          <Shuffle size={18}/>
          Shuffle
        </button>

      </div>

      {error &&(
        <div className="error">
          {error}
        </div>
      )}

      {loading &&(
        <div className="loading">
          Loading songs...
        </div>
      )}


      <div className="songs-list">

        {alphabet.map(letter=>(

          <div
            key={letter}
            ref={el => letterRefs.current[letter] = el}
          >

            {/* LETTER HEADER */}

            <div className="songs-letter">
              {letter}
            </div>

            {/* SONGS */}

            {grouped[letter].map(song=>{

              const id = song.song_id || song.id

              return(
                <div 
                  key={id}
                  className="songs-active"
                >

                  <SongCard
                    key={song.song_id || song.id}
                    song={{
                      id: song.song_id || song.id,
                      title: song.title,
                      main: song.main,
                      ft: song.ft,
                      artists: song.artists,
                      image: song.cover || song.image,
                      url: song.url
                    }}
                    onSelectSong={onSelectSong}
                    onOpenArtist={onOpenArtist}
                  />
                </div>
              )
            })}

            {!loading && songs.length > 0 && (
              <div className="songs-total">
                {songs.length} songs
              </div>
            )}

          </div>

        ))}

        {!loading && songs.length === 0 &&(
          <div className="songs-end">
            No songs found
          </div>
        )}

      </div>

      {/* ======================
         ALPHABET BAR
      ====================== */}

      <div className="alphabet-bar">

        {alphabet.map(letter=>(

          <div
            key={letter}
            className="alphabet-letter"
            onClick={()=>jumpToLetter(letter)}
          >
            {letter}
          </div>

        ))}

      </div>

    </div>

  )

}