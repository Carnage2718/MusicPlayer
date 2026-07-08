import { useEffect, useState, useRef } from "react"
import { Music } from "lucide-react"
import { authfetch } from "../api"
import SongCard from "./SongCard"
import "./SearchPicker.css"

export default function SearchPicker({

  open,
  type = "",

  title,
  placeholder,

  defaultArtist ="",

  onSelect,

  autoClose = true,

  onClose,

  onOpenArtist,
  onOpenAlbum,
  onOpenPlaylist,

}){

  const [query,setQuery] = useState("")
  const [artist,setArtist] = useState(defaultArtist || "")
  const [results,setResults] = useState([])
  const [globalResults,setGlobalResults] = useState({
    songs: [],
    artists: [],
    albums: [],
    playlists: []
  })

  const flatGlobalResults = [

    ...globalResults.songs.map(i => ({
      ...i,
      type:"song"
    })),

    ...globalResults.artists.map(i => ({
      ...i,
      type:"artist"
    })),

    ...globalResults.albums.map(i => ({
      ...i,
      type:"album"
    })),

    ...globalResults.playlists.map(i => ({
      ...i,
      type:"playlist"
    }))
  ]

  const currentResults =
    type === "global"
      ? flatGlobalResults
      : results

  const [selectedIndex,setSelectedIndex] = useState(0)

  const inputRef = useRef()

  const renderCover = (item)=>{

    const src =
      item.image ||
      item.cover_url ||
      item.image_url

    if(src){

      return (
        <img
          src={src}
          className="picker-cover"
        />
      )
    }

    return(
      <div className="picker-cover no-cover">
        <Music size={18}/>
      </div>
    )
  }


  useEffect(()=>{

    if(!open) return

    setTimeout(()=>{
      inputRef.current?.focus()
    },50)

  },[open])


  useEffect(()=>{

    if(open){

      setArtist(defaultArtist || "")

    }

  },[open, defaultArtist])

  useEffect(()=>{

    if(open) return

    setQuery("")
    setResults([])

    setGlobalResults({
      songs: [],
      artists: [],
      albums: [],
      playlists: []
    })

    setSelectedIndex(0)

  },[open])


  useEffect(()=>{

    if(!query.trim()){

      if(type === "global"){
        setGlobalResults({
          songs: [],
          artists: [],
          albums: [],
          playlists: []
        })
      }else{
        setResults([])
      }

      return
    }

    const timer = setTimeout(async ()=>{

      try{

        let endpoint = ""

        switch(type){

          case "global":
            endpoint = 
            `/search?q=${encodeURIComponent(query)}`
            break

          case "song":
            endpoint = `/search/song/artist?q=${encodeURIComponent(query)}&artist=${encodeURIComponent(artist)}`
            break

          case "artist":
            endpoint = `/search/artist?q=${encodeURIComponent(query)}`
            break

          case "album":
            endpoint = `/search/album?q=${encodeURIComponent(query)}`
            break

          case "playlist":
            endpoint = `/playlists/search?q=${encodeURIComponent(query)}`
            break

          default:
            return
        }

        const res = await authfetch(endpoint)
        const data = await res.json()

        if (type === "global"){
          setGlobalResults(data || {
            songs: [],
            artists: [],
            albums: [],
            playlists: []
          })
          
        }else{

          setResults(data || [])
        }

      }catch(err){

        console.error(err)

      }

    },300)

    return ()=>clearTimeout(timer)

  },[query,type, artist])


  useEffect(()=>{

    setSelectedIndex(0)

  },[query, type])


  const handleKeyDown = (e)=>{

    if(e.key === "ArrowDown"){

      setSelectedIndex(prev=>
        Math.min(prev+1, currentResults.length-1)
      )
    }

    if(e.key === "ArrowUp"){

      setSelectedIndex(prev=>
        Math.max(prev-1,0)
      )
    }

    if(e.key === "Enter"){

      const item = currentResults[selectedIndex]

      selectItem(
        currentResults[selectedIndex]
      )
    }

    if(e.key === "Escape"){

      closePicker()
    }
  }

  const selectItem = (item)=>{

    if(!item) return

    onSelect?.(item)

    if(autoClose){
      closePicker()
    }
  }

  const closePicker = ()=>{

    setQuery("")
    setResults([])

    setGlobalResults({
      songs: [],
      artists:[],
      albums:[],
      playlists: []
    })

    setSelectedIndex(0)

    onClose?.()
  }


  if(!open) return null

  return(

    <div
      className="picker-overlay"
      onClick={closePicker}
    >

      <div
        className="picker-panel"
        onClick={(e)=>e.stopPropagation()}
      >

        <div className="picker-header">

          <span>
            {title || `Search ${type}`}
          </span>

          {type === "song" && (

            <input
              className="picker-artist-filter"
              placeholder="Artist"
              value={artist}
              onChange={(e)=>
                setArtist(e.target.value)
              }
            />

          )}

          <button
            onClick={closePicker}
          >
            ×
          </button>

        </div>

        <input
          ref={inputRef}
          value={query}
          placeholder={
            placeholder ||
            `Search ${type}...`
          }
          onChange={(e)=>
            setQuery(e.target.value)
          }
          onKeyDown={handleKeyDown}
        />

        <div className="picker-results">

          {type === "global" &&

            currentResults.map((item,index)=>(

              <>

                {(index === 0 ||
                  currentResults[index - 1].type !== item.type) && (

                  <div className="picker-section-title">
                    {item.type === "song" && "Songs"}
                    {item.type === "artist" && "Artists"}
                    {item.type === "album" && "Albums"}
                    {item.type === "playlist" && "Playlists"}
                  </div>

                )}

                <div
                  key={`${item.type}-${item.id}`}
                  className={
                    index===selectedIndex
                      ? "picker-active"
                      : ""
                  }
                >

                  {/* SONG */}
                  {item.type === "song" && (
                    <SongCard
                      song={item}
                      onSelectSong={()=>{
                        onSelect?.(item)
                        closePicker()
                      }}
                      onOpenArtist={onOpenArtist}
                      showMenu={false}
                    />
                  )}

                  {/* ARTIST */}
                  {item.type === "artist" && (
                    <SearchEntityRow
                      item={item}
                      type="artist"
                      onClick={()=>{
                        onSelect?.(item)
                        closePicker()
                      }}
                    />
                  )}

                  {/* ALBUM */}
                  {item.type === "album" && (
                    <SearchEntityRow
                      item={item}
                      type="album"
                      onClick={()=>{
                        onSelect?.(item)
                        closePicker()
                      }}
                    />
                  )}

                  {/* PLAYLIST */}
                  {item.type === "playlist" && (
                    <SearchEntityRow
                      item={item}
                      type="playlist"
                      onClick={()=>{
                        onSelect?.(item)
                        closePicker()
                      }}
                    />
                  )}

                </div>

              </>

            ))
          }

          {type !== "global" &&
            results.map((item,index)=>(

              <div
                key={item.id}
                className={
                  index === selectedIndex
                    ? "picker-active"
                    : ""
                }
              >

                {type === "song" && (

                  <SongCard
                    song={{
                      ...item,
                      image: item.cover_url
                    }}
                    onSelectSong={()=>{
                      selectItem(item)
                    }}
                    onOpenArtist={onOpenArtist}
                    showMenu={false}
                  />
                )}
              </div>
            ))
          }

        </div>

      </div>

    </div>
  )
}


function SearchEntityRow({
  item,
  type,
  onClick
}){

  const cover =
    item.cover_url ||
    item.image ||
    item.image_url

  return(

    <div
      className="picker-entity-row"
      onClick={onClick}
    >

      {cover ? (

        <img
          src={cover}
          className="picker-entity-cover"
        />

      ) : (

        <div className="picker-entity-cover no-cover">
          <Music size={18}/>
        </div>

      )}

      <div className="picker-entity-info">

        <div className="picker-entity-title">
          {item.title || item.name}
        </div>

        <div className="picker-entity-sub">

          {type === "artist" &&
            "Artist"}

          {type === "album" &&
            (item.artist || "Album")}

          {type === "playlist" &&
            "Playlist"}

        </div>

      </div>

    </div>

  )
}