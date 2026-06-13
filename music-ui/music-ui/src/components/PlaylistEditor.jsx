import { useEffect, useState } from "react"
import { authfetch } from "../api"
import "./PlaylistEditor.css"

export default function PlaylistEditor({
  songId,
  onClose,
  onSaved
}){

  const [playlists,setPlaylists] =
    useState([])

  const [selected,setSelected] =
    useState([])

  useEffect(()=>{

    load()

  },[])

  const load = async()=>{

    try{

      const res =
        await authfetch("/playlists")

      const data =
        await res.json()

      setPlaylists(data)

      const included =
        await authfetch(
          `/songs/${songId}/playlists`
        )

      const includedData =
        await included.json()

      setSelected(
        includedData.map(p=>p.id)
      )

    }catch(err){

      console.error(err)

    }

  }

  const togglePlaylist = (id)=>{

    setSelected(prev=>{

      if(prev.includes(id)){

        return prev.filter(
          x=>x!==id
        )

      }

      return [...prev,id]

    })

  }

  const save = async()=>{

    try{

      for(const playlist of playlists){

        const isSelected =
          selected.includes(playlist.id)

        const wasIncluded =
          playlist.included

        if(isSelected && !wasIncluded){

          await authfetch(
            `/playlists/${playlist.id}/add?song_id=${songId}`,
            {
              method:"POST"
            }
          )

        }

        if(!isSelected && wasIncluded){

          await authfetch(
            `/playlists/${playlist.id}/remove?song_id=${songId}`,
            {
              method:"DELETE"
            }
          )

        }

      }

      onSaved?.()
      onClose()

    }catch(err){

      console.error(err)

    }

  }

  return(

    <div
      className="playlist-editor-overlay"
      onClick={onClose}
    >

      <div
        className="playlist-editor-modal"
        onClick={e=>e.stopPropagation()}
      >

        <div className="playlist-editor-title">
          Playlists
        </div>

        <div className="playlist-selector">

          {playlists.map(p=>(

            <button
              key={p.id}
              className={
                selected.includes(p.id)
                ? "playlist-pill active"
                : "playlist-pill"
              }
              onClick={()=>
                togglePlaylist(p.id)
              }
            >
              {p.name}
            </button>

          ))}

        </div>

        <button
          className="playlist-editor-confirm"
          onClick={save}
        >
          Confirm
        </button>

      </div>

    </div>

  )

}