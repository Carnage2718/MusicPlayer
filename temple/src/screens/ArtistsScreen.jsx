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

        const sorted = data.sort((a,b)=>{
          return (a.name || "").localeCompare(b.name || "")
        })

        setArtists(sorted)

      }catch(err){
        setError("Failed to load artists")
      }finally{
        setLoading(false)
      }

    }

    load()

  },[])

  /* GROUP */
  const grouped = {}

  artists.forEach(artist=>{
    const letter =
      /^[A-Z]/.test(artist.name?.[0]?.toUpperCase())
      ? artist.name[0].toUpperCase()
      : "#"

    if(!grouped[letter]) grouped[letter] = []
    grouped[letter].push(artist)
  })

  const alphabet = Object.keys(grouped).sort()

  return(
    <div className="screen">

      <AppHeader title="Artists"/>

      {loading && <div className="loading">Loading...</div>}
      {error && <div className="error">{error}</div>}

      <div className="songs-list">

        {alphabet.map(letter=>(
          <div key={letter}>

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

    </div>
  )
}