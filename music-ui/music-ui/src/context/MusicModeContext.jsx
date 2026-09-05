import {
  createContext,
  useContext,
  useEffect,
  useState
} from "react"

const MusicModeContext = createContext()


/* =========================
   SONG TYPE
========================= */

export const SONG_TYPE = {
  WESTERN: 0,
  JAPANESE: 1
}


/* =========================
   MUSIC MODE
========================= */

export const MUSIC_MODE = {
  ALL: "all",
  WESTERN: "western",
  JAPANESE: "japanese"
}


/* =========================
   MODE CONFIG
========================= */

const MODE_CONFIG = {

  [MUSIC_MODE.ALL]: {
    songType: null,
    theme: "all"
  },

  [MUSIC_MODE.WESTERN]: {
    songType: SONG_TYPE.WESTERN,
    theme: "western"
  },

  [MUSIC_MODE.JAPANESE]: {
    songType: SONG_TYPE.JAPANESE,
    theme: "japanese"
  }

}


/* =========================
   PROVIDER
========================= */

export function MusicModeProvider({ children }) {

  const [musicMode, setMusicModeState] = useState(() => {

    const saved =
      localStorage.getItem("musicMode")

    if (
      saved === MUSIC_MODE.ALL ||
      saved === MUSIC_MODE.WESTERN ||
      saved === MUSIC_MODE.JAPANESE
    ) {
      return saved
    }

    return MUSIC_MODE.ALL

  })


  /* =========================
     SAVE MODE
  ========================= */

  useEffect(() => {

    localStorage.setItem(
      "musicMode",
      musicMode
    )

  }, [musicMode])


  /* =========================
     CHANGE MODE
  ========================= */

  const setMusicMode = (mode) => {

    if (
      mode !== MUSIC_MODE.ALL &&
      mode !== MUSIC_MODE.WESTERN &&
      mode !== MUSIC_MODE.JAPANESE
    ) {
      return
    }

    setMusicModeState(mode)

  }


  /* =========================
     CURRENT CONFIG
  ========================= */

  const config =
    MODE_CONFIG[musicMode]


  return (

    <MusicModeContext.Provider
      value={{

        musicMode,

        setMusicMode,

        songType: config.songType,

        theme: config.theme

      }}
    >

      {children}

    </MusicModeContext.Provider>

  )

}


/* =========================
   HOOK
========================= */

export function useMusicMode() {

  const context =
    useContext(MusicModeContext)

  if (!context) {

    throw new Error(
      "useMusicMode must be used inside MusicModeProvider"
    )

  }

  return context

}