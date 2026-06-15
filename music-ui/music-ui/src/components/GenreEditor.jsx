import { useEffect, useState } from "react"
import { authfetch } from "../api"
import "./GenreEditor.css"

export default function GenreEditor({
  songId,
  selectedGenres = [],
  onClose,
  onSaved
}){

  const [genres,setGenres] = useState([])
  const [selected,setSelected] = useState([])
  const [loading,setLoading] = useState(true)

  useEffect(()=>{

    setSelected(
      selectedGenres.map(g=>g.id)
    )

  },[selectedGenres])

  useEffect(()=>{

    const load = async()=>{

      try{

        setLoading(true)

        const res =
          await authfetch("/songs/genres")

        const data =
          await res.json()

        setGenres(data)

      }catch(err){

        console.error(err)

      }finally{

        setLoading(false)

      }

    }

    load()

  },[])

  const toggleGenre = (genreId)=>{

    setSelected(prev=>{

      if(prev.includes(genreId)){

        return prev.filter(
          id=>id!==genreId
        )

      }

      return [...prev,genreId]

    })

  }

  const save = async()=>{

    try{

      await authfetch(
        `/songs/${songId}/genres`,
        {
          method:"POST",
          headers:{
            "Content-Type":"application/json"
          },
          body:JSON.stringify({
            genre_ids:selected
          })
        }
      )

      onSaved?.()
      onClose()

    }catch(err){

      console.error(err)

    }

  }

  return(

    <div
      className="editor-overlay"
      onClick={onClose}
    >

      <div
        className="editor-modal"
        onClick={e=>e.stopPropagation()}
      >

        <div className="editor-title">
          Genres
        </div>

        <div className="genre-selector">

          {loading ? (

            <div className="genre-loading">
              Loading...
            </div>

          ) : (
            genres.map(g=>(

              <button
                key={g.genres_id}
                className={
                  selected.includes(g.genres_id)
                  ? "genre-pill active"
                  : "genre-pill"
                }
                onClick={()=>
                  toggleGenre(g.genres_id)
                }
              >
                {g.name}
              </button>

            ))
            
          )}

        </div>

        <button
          className="editor-confirm"
          onClick={save}
        >
          Confirm
        </button>

      </div>

    </div>

  )

}