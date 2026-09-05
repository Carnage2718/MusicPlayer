import { useState } from "react"

import "./AppHeader.css"

import {
  useMusicMode,
  MUSIC_MODE
} from "../context/MusicModeContext.jsx"


export default function AppHeader({
  title,
  rightAction
}) {

  const { musicMode } = useMusicMode()

  const [
    showModeSelector,
    setShowModeSelector
  ] = useState(false)

  const [switchingMode,
    setSwitchingMode
  ] = useState(null)


  /* =========================
     MODE SELECT
  ========================= */

  const selectMode = (mode) => {

    localStorage.setItem(
      "musicMode",
      mode
    )

    setShowModeSelector(false)

    setSwitchingMode(mode)

    setTimeout(() => {
      window.location.reload()
    }, 700)

  }


  return (
    <>

      {/* =========================
          HEADER
      ========================= */}

      <div className="app-header">

        <div className="header-left">

          <button
            className="app-header-mode-button"
            onClick={() =>
              setShowModeSelector(true)
            }
            aria-label="Music mode"
          >

            <img
              src="/icon_nobackground.png"
              className="app-header-icon"
              alt="Music mode"
            />

          </button>


          <div className="main-title">
            {title}
          </div>

        </div>


        <div className="header-right">
          {rightAction}
        </div>

      </div>


      {/* =========================
          MUSIC MODE SELECTOR
      ========================= */}

      {showModeSelector && (

        <div
          className="music-mode-overlay"
          onClick={() =>
            setShowModeSelector(false)
          }
        >

          <div
            className="music-mode-selector"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            {/* TITLE */}

            <div className="music-mode-selector-title">
              Music Mode
            </div>


            {/* MODE BUTTONS */}

            <div className="music-mode-buttons">


              {/* =========================
                  ALL
              ========================= */}

              <button
                className={`music-mode-button mode-all ${
                  musicMode === MUSIC_MODE.ALL
                    ? "selected"
                    : ""
                }`}
                onClick={() =>
                  selectMode(MUSIC_MODE.ALL)
                }
                aria-label="All music"
              >

                <img
                  src="/icon_nobackground.png"
                  className="music-mode-icon"
                  alt=""
                />

                <span className="music-mode-label">
                  All
                </span>

              </button>


              {/* =========================
                  WESTERN
              ========================= */}

              <button
                className={`music-mode-button mode-western ${
                  musicMode === MUSIC_MODE.WESTERN
                    ? "selected"
                    : ""
                }`}
                onClick={() =>
                  selectMode(MUSIC_MODE.WESTERN)
                }
                aria-label="Western music"
              >

                <img
                  src="/icon_nobackground.png"
                  className="music-mode-icon"
                  alt=""
                />

                <span className="music-mode-label">
                  W-POP
                </span>

              </button>

              
              {/* =========================
                  JAPANESE
              ========================= */}

              <button
                className={`music-mode-button mode-japanese ${
                  musicMode === MUSIC_MODE.JAPANESE
                    ? "selected"
                    : ""
                }`}
                onClick={() =>
                  selectMode(MUSIC_MODE.JAPANESE)
                }
                aria-label="Japanese music"
              >

                <img
                  src="/icon_nobackground.png"
                  className="music-mode-icon"
                  alt=""
                />

                <span className="music-mode-label">
                  J-POP
                </span>

              </button>


            </div>

          </div>

        </div>

      )}

      {switchingMode && (

        <div
          className={`music-mode-transition mode-${switchingMode}`}
        >

          <img
            src="/icon_nobackground.png"
            className="music-mode-transition-icon"
            alt=""
          />

        </div>

      )}

    </>

  )
}