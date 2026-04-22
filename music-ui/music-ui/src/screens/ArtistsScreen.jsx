import { useEffect, useRef, useState } from "react"
import API_BASE from "../api"
import ArtistCard from "../components/ArtistCard"
import AppHeader from "../components/AppHeader"
import "./SongsScreen.css"

export default function ArtistsScreen({
  onOpenArtist
}){

  const [artists,setArtists] = useState([])
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState(null)

  const letterRefs = useRef({})

  useEffect(()=>{

    const load = async()=>{

      try{

        const res = await fetch(`${API_BASE}/artists`)
        const data = await res.json()

        setArtists(data)

      }catch(err){
        setError("Failed to load artists")
      }finally{
        setLoading(false)
      }

    }

    load()

  },[])

  /* GROUP */
  const filtered = artists
    .filter(a => (a.song_count || 0) >= 2)
    .sort((a,b)=> (a.name || "").localeCompare(b.name || ""))

  const grouped = {}

  filtered.forEach(artist=>{
    const letter =
      /^[A-Z]/.test(artist.name?.[0]?.toUpperCase())
      ? artist.name[0].toUpperCase()
      : "#"

    if(!grouped[letter]) grouped[letter] = []
    grouped[letter].push(artist)
  })

  const alphabet = Object.keys(grouped).sort((a,b)=>{
    if(a === "#") return 1
    if(b === "#") return -1
    return a.localeCompare(b)
  })

  const jump = (letter) => {

    const el = letterRefs.current[letter]
    if (!el) return

    const headerHeight = 72

    requestAnimationFrame(() => {
      const y =
        el.getBoundingClientRect().top +
        window.scrollY -
        headerHeight - 8

      window.scrollTo({
        top: y,
        behavior: "smooth"
      })
    })
  }


  return(
    <div className="screen">

      <AppHeader title="Artists"/>

      {loading && <div className="loading">Loading...</div>}
      {error && <div className="error">{error}</div>}

      <div className="songs-list">

        {alphabet.map(letter=>(
          <div
            key={letter}
            ref={el => {
              if (el) letterRefs.current[letter] = el
            }}
          >

            <div className="songs-letter">{letter}</div>

            {grouped[letter].map(artist=>(
              <ArtistCard
                key={artist.id}
                artist={artist}
                onOpenArtist={onOpenArtist}
              />
            ))}

          </div>
        ))}

      </div>

      <div className="alphabet-bar">
        {alphabet.map(l => (
          <div
            key={l}
            className="alphabet-letter"
            onClick={()=>jump(l)}
          >
            {l}
          </div>
        ))}
      </div>

    </div>
  )
}