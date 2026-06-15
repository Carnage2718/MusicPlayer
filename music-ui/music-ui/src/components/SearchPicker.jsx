import { useEffect, useState, useRef } from "react"
import "./SearchPicker.css"
import { authfetch } from "../api"

import SongCard from "./SongCard"

export default function SearchPicker({

  open,
  type = "song",

  title,

  placeholder,

  onSelect,

  onClose,

  onOpenArtist,
  onOpenAlbum,
  onOpenPlaylist

}){

  const [query,setQuery] = useState("")
  const [results,setResults] = useState([])
  const [selectedIndex,setSelectedIndex] = useState(0)

  const inputRef = useRef()

  useEffect(()=>{

    if(!open) return

    setTimeout(()=>{
      inputRef.current?.focus()
    },50)

  },[open])

  useEffect(()=>{

    if(!query.trim()){

      setResults([])
      return

    }

    const timer = setTimeout(async ()=>{

      try{

        let endpoint = ""

        switch(type){

          case "song":
            endpoint = `/search/song?q=${encodeURIComponent(query)}`
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

        setResults(data || [])

      }catch(err){

        console.error(err)

      }

    },300)

    return ()=>clearTimeout(timer)

  },[query,type])

  useEffect(()=>{

    setSelectedIndex(0)

  },[results])

  const handleKeyDown = (e)=>{

    if(e.key === "ArrowDown"){

      setSelectedIndex(prev=>
        Math.min(prev+1, results.length-1)
      )
    }

    if(e.key === "ArrowUp"){

      setSelectedIndex(prev=>
        Math.max(prev-1,0)
      )
    }

    if(e.key === "Enter"){

      const item = results[selectedIndex]

      if(item){

        onSelect?.(item)

        closePicker()
      }
    }

    if(e.key === "Escape"){

      closePicker()
    }
  }

  const closePicker = ()=>{

    setQuery("")
    setResults([])
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

          {results.map((item,index)=>(

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

                  song={item}

                  onSelectSong={()=>{

                    onSelect?.(item)
                    closePicker()

                  }}

                  onOpenArtist={onOpenArtist}

                  showMenu={false}
                />

              )}

              {type === "playlist" && (

                <div
                  className="picker-playlist"
                  onClick={()=>{

                    onSelect?.(item)
                    closePicker()

                  }}
                >

                  {item.cover_url && (
                    <img
                      src={item.cover_url}
                      alt=""
                    />
                  )}

                  <span>
                    {item.name}
                  </span>

                </div>

              )}

            </div>

          ))}

        </div>

      </div>

    </div>
  )
}