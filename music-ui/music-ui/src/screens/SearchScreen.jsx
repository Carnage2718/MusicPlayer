import { useState, useEffect } from "react"
import API_BASE from "../api"
import AppHeader from "../components/AppHeader"
import { Music } from "lucide-react"
import "./SearchScreen.css"

export default function SearchScreen({
  onSelectSong,
  onOpenArtist,
  onOpenAlbum,
  onOpenPlaylist
}){

  const [query,setQuery] = useState("")
  const [data,setData] = useState(null)
  const [loading,setLoading] = useState(false)

  /* =========================
     SEARCH
  ========================= */

  useEffect(()=>{

    if(!query){
      setData(null)
      return
    }

    const timer = setTimeout(async()=>{

      try{
        setLoading(true)

        const res = await fetch(`${API_BASE}/search?q=${query}`)
        const json = await res.json()

        setData(json)

      }catch(e){
        console.error(e)
      }finally{
        setLoading(false)
      }

    },300)

    return ()=>clearTimeout(timer)

  },[query])

  /* =========================
     COVER
  ========================= */

  const renderCover = (item)=>{

    const src = item.image || item.cover

    if(src){
      return <img src={src} className="search-cover"/>
    }

    return(
      <div className="search-cover no-cover">
        <Music size={18}/>
      </div>
    )
  }

  /* =========================
     ITEM CLICK
  ========================= */

  const handleClick = (item,type)=>{

    if(type==="song"){
      onSelectSong(item)
    }

    if(type==="artist"){
      onOpenArtist({
        id: item.id,
        name: item.name
      })
    }

    if(type==="album"){
      onOpenAlbum(item)
    }

    if(type==="playlist"){
      onOpenPlaylist?.(item.id)
    }
  }

  return(

    <div className="search-screen">

      <AppHeader title="Search"/>

      {/* INPUT */}
      <div className="search-bar">
        <input
          placeholder="Search songs, artists, albums..."
          value={query}
          onChange={(e)=>setQuery(e.target.value)}
        />
      </div>

      <div className="search-scroll">

        {loading && <div className="search-loading">Searching...</div>}

        {data && (

          <>
            {/* SONGS */}
            {data.songs?.length>0 && (
              <Section title="Songs">
                {data.songs.map(s=>(
                  <Row
                    key={s.id}
                    item={s}
                    subtitle={s.artists}
                    onClick={()=>handleClick(s,"song")}
                    renderCover={renderCover}
                  />
                ))}
              </Section>
            )}

            {/* ARTISTS */}
            {data.artists?.length>0 && (
              <Section title="Artists">
                {data.artists.map(a=>(
                  <Row
                    key={a.id}
                    item={a}
                    onClick={()=>handleClick(a,"artist")}
                    renderCover={renderCover}
                  />
                ))}
              </Section>
            )}

            {/* ALBUMS */}
            {data.albums?.length>0 && (
              <Section title="Albums">
                {data.albums.map(a=>(
                  <Row
                    key={a.id}
                    item={a}
                    subtitle={a.artist}
                    onClick={()=>handleClick(a,"album")}
                    renderCover={renderCover}
                  />
                ))}
              </Section>
            )}

            {/* PLAYLISTS */}
            {data.playlists?.length>0 && (
              <Section title="Playlists">
                {data.playlists.map(p=>(
                  <Row
                    key={p.id}
                    item={p}
                    onClick={()=>handleClick(p,"playlist")}
                    renderCover={renderCover}
                  />
                ))}
              </Section>
            )}

          </>
        )}

      </div>

    </div>
  )
}

/* =========================
   SECTION
========================= */

function Section({title,children}){
  return(
    <div className="search-section">
      <div className="search-section-title">{title}</div>
      {children}
    </div>
  )
}

/* =========================
   ROW（Queue風）
========================= */

function Row({item,subtitle,onClick,renderCover}){
  return(
    <div className="search-row" onClick={onClick}>

      {renderCover(item)}

      <div className="search-info">
        <div className="search-title">
          {item.title || item.name}
        </div>

        {subtitle && (
          <div className="search-sub">
            {subtitle}
          </div>
        )}
      </div>

    </div>
  )
}