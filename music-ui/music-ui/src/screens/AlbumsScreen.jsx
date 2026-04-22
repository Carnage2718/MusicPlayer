import React, { useEffect, useState, useRef } from "react"
import API_BASE from "../api"
import AppHeader from "../components/AppHeader"
import "./AlbumsScreen.css"
import { Music } from "lucide-react"
import textScroller from "../components/TextScroller"
import TextScroller from "../components/TextScroller"

export default function AlbumsScreen({ 
  onOpenAlbum,
  onOpenCreate,
  onOpenArtist }){

  const [albums,setAlbums] = useState([])
  const [loading,setLoading] = useState(true)
  const letterRefs = useRef({})

  useEffect(()=>{
    fetch(`${API_BASE}/albums`)
      .then(r=>r.json())
      .then(data=>{
        setAlbums(data)
        setLoading(false)
      })
      .catch(()=>{
        setLoading(false)
      })
  },[])

  const grouped = {}


  albums.forEach(a=>{
    const letter =
      /^[A-Z]/.test(a.name?.[0]?.toUpperCase())
      ? a.name[0].toUpperCase()
      : "#"

    if(!grouped[letter]) grouped[letter] = []
    grouped[letter].push(a)
  })

  const formatArtists = (artists = []) => {
    if (!artists.length) return ""

    const main = artists
      .filter(a => a.role === "main")
      .map(a => a.name)

    const ft = artists
      .filter(a => a.role === "featuring")
      .map(a => a.name)

    if (ft.length > 0) {
      return `${main.join(", ")} ft. ${ft.join(", ")}`
    }

    return main.join(", ")
  }

  const alphabet = Object.keys(grouped).sort((a,b)=>{
    if(a === "#") return 1
    if(b === "#") return -1
    return a.localeCompare(b)
  })

  const jump = (letter) => {

    const el = letterRefs.current[letter]
    if (!el) return

    const headerHeight = parseInt(
      getComputedStyle(document.documentElement)
        .getPropertyValue("--header-height")
    ) || 72

    requestAnimationFrame(() => {

      const y =
        el.getBoundingClientRect().top +
        window.scrollY -
        headerHeight -
        8

      window.scrollTo({
        top: y,
        behavior: "smooth"
      })

    })
  }


  return(
    <div className="screen">

      <AppHeader title="Albums"/>

      <div className="create-albums-wrap">
        <button
          className="create-albums-btn"
          onClick={onOpenCreate}
        >
          + CREATE ALBUM
        </button>
      </div>

      <div className="albums-alphabet-bar">
        {alphabet.map(l => (
          <div
            key={l}
            className="albums-alphabet-item"
            onClick={()=>jump(l)}
          >
            {l}
          </div>
        ))}
      </div>

      {loading && (
        <div className="albums-loading">Loading...</div>
      )}

      {!loading && (
        <div className="albums-screen-grid">

          {alphabet.flatMap(letter =>
            grouped[letter].map((album, index) => {

              const showLetter = index === 0

              return (
                <div
                  key={album.id}
                  className="albums-card"
                  onClick={()=>onOpenAlbum(album)}
                >

                  {/* 🔥 ここ */}
                  <div
                    ref={el => {
                      if(showLetter) letterRefs.current[letter] = el
                    }}
                    className={`albums-letter ${showLetter ? "show" : ""}`}
                  >
                    {letter}
                  </div>

                  <div className="albums-cover-wrap">
                    {album.image ? (
                      <img src={album.image} className="albums-cover-img"/>
                    ) : (
                      <div className="albums-cover-placeholder">
                        <Music size={72} className="albums-icon"/>
                      </div>
                    )}
                  </div>

                  <TextScroller
                    text={album.name}
                    className="album-title"
                  />

                  <div className="albums-artist">
                    {formatArtists(album.artists)}
                  </div>

                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}