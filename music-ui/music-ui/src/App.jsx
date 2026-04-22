import { useState } from "react"
import "./App.css"

import { SongsProvider, useSongs } from "./context/SongsContext"
import { MenuProvider } from "./context/MenuContext"

import HomeScreen from "./screens/HomeScreen"
import SearchScreen from "./screens/SearchScreen"
import LibraryScreen from "./screens/LibraryScreen"
import SongsScreen from "./screens/SongsScreen"
import PlaylistsScreen from "./screens/PlaylistsScreen"
import PlaylistScreen from "./screens/PlaylistScreen"
import CreatePlaylistScreen from "./screens/CreatePlaylistScreen"
import UploadScreen from "./screens/UploadScreen"
import QueueScreen from "./screens/QueueScreen"
import ArtistsScreen from "./screens/ArtistsScreen"
import ArtistScreen from "./screens/ArtistScreen"
import AlbumsScreen from "./screens/AlbumsScreen"
import AlbumScreen from "./screens/AlbumScreen"
import CreateAlbumScreen from "./screens/CreateAlbumScreen"
import GenreScreen from "./screens/GenreScreen"

import MiniPlayer from "./components/MiniPlayer"
import BottomNav from "./components/BottomNav"
import FullPlayer from "./components/FullPlayer"

function AppContent() {

  const {
    currentSong,
    isPlaying,
    setIsPlaying,
    progress,
    playSong,
    nextSong,
    prevSong
  } = useSongs()

  const [currentScreen, setCurrentScreen] = useState("home")
  const [selectedSong, setSelectedSong] = useState(null)
  const [selectedArtist, setSelectedArtist] = useState(null)
  const [selectedAlbum, setSelectedAlbum] = useState(null)
  const [selectedPlaylist, setSelectedPlaylist] = useState(null)
  const [isFullPlayer, setIsFullPlayer] = useState(false)

  const openArtist = (a) => {
    setSelectedArtist(a)
    setCurrentScreen("artist")
  }

  const openAlbum = (a) => {
    setSelectedAlbum(a)
    setCurrentScreen("album")
  }

  const openPlaylist = (p) => {
    setSelectedPlaylist(p)
    setCurrentScreen("playlist")
  }

  const openCreatePlaylist = (song) => {
    setSelectedSong(song || null)
    setCurrentScreen("createPlaylist")
  }

  /* =========================
     SCREEN SWITCH
  ========================= */

  const renderScreen = ()=>{

    switch(currentScreen){

      case "search":

        return(
          <SearchScreen
            onSelectSong={playSong}
            onOpenArtist={openArtist}
            onOpenAlbum={openAlbum}
          />
        )

      case "library":

        return(
          <LibraryScreen
            onSelectSong={playSong}
            openSongs={()=>setCurrentScreen("songs")}
            openArtists={()=>setCurrentScreen("artists")}
            openAlbums={()=>setCurrentScreen("albums")}
            openGenre={()=>setCurrentScreen("genre")}
            onOpenArtist={openArtist}
          />
        )

      case "songs":

        return(
          <SongsScreen
            onSelectSong={playSong}
            onOpenArtist={openArtist}
          />
        )
      
      case "playlists":

        return(
          <PlaylistsScreen
            onOpenPlaylist={openPlaylist}
            onOpenCreate={()=>setCurrentScreen("createPlaylist")}
          />
        )

      case "playlist":

        return(
          <PlaylistScreen
            playlist={selectedPlaylist}
            onSelectSong={playSong}
            onOpenArtist={openArtist}
          />
        )

      case "createPlaylist":

        return(
          <CreatePlaylistScreen
            onBack={() => {
              setSelectedSong(null)
              setCurrentScreen("playlists")
            }}
            onSelectSong={playSong}
            onOpenArtist={openArtist}
            initialSong={selectedSong}
          />
        )

      case "genre":
        return(
          <GenreScreen
            onSelectSong={playSong}
            onOpenArtist={openArtist}
          />
        )

      case "upload":

        return(
          <UploadScreen
            onOpenArtist={openArtist}
            onSelectSong={playSong}
          />
        )

      case "queue":

        return(
          <QueueScreen
            openFullPlayer={()=>setIsFullPlayer(true)}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
            onNext={nextSong}
            onPrev={prevSong}
            progress={progress}
            onSelectSong={playSong}
            onOpenArtist={openArtist}
          />
        )

      case "artists":
        
        return(
          <ArtistsScreen
            onOpenArtist={openArtist}
          />
        )

      case "artist":

        return(
          <ArtistScreen
            artistId={selectedArtist?.id}
            onSelectSong={playSong}
            onOpenAlbum={openAlbum}
            onOpenArtist={openArtist}
          />
        )
      
      case "albums":
        return(
          <AlbumsScreen
            onOpenAlbum={openAlbum}
            onOpenArtist={openArtist}
            onOpenCreate={()=>setCurrentScreen("createAlbum")}
          />
        )
      
      case "album":

        return(
          <AlbumScreen
            album={selectedAlbum}
            songs={selectedAlbum?.songs || []}
            onSelectSong={playSong}
            onOpenArtist={openArtist}
          />
        )
      
      case "createAlbum":

        return(
          <CreateAlbumScreen
            onBack={()=>setCurrentScreen("albums")}
          />
        )

      default:

        return(
          <HomeScreen
            onSelectSong={playSong}
            openAlbum={openAlbum}
            openArtist={openArtist}
          />
        )

    }

  }

  /* =========================
     UI
  ========================= */

  return(

    <div className="app-container">

      <div className="screen-container">

        {renderScreen()}

      </div>

      {/* MINI PLAYER */}

      {currentSong && !isFullPlayer && currentScreen !== "queue" &&(

        <MiniPlayer
          song={currentSong}
          isPlaying={isPlaying}
          setIsPlaying={setIsPlaying}
          onExpand={()=>setIsFullPlayer(true)}
          onOpenArtist={openArtist}
        />

      )}

      {/* BOTTOM NAV */}

      <BottomNav
        currentScreen={currentScreen}
        setCurrentScreen={setCurrentScreen}
        onExpand={()=>setIsFullPlayer(true)}
        onOpenArtist={openArtist}
        progress={progress}
        song={currentSong}
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying}
      />

      {/* FULL PLAYER */}

      {currentSong && isFullPlayer &&(

        <FullPlayer
          song={currentSong}
          isPlaying={isPlaying}
          setIsPlaying={setIsPlaying}
          progress={progress}
          setCurrentScreen={setCurrentScreen}
          onClose={()=>setIsFullPlayer(false)}
          onOpenArtist={openArtist}
        />

      )}

    </div>

  )
}

export default function App() {
  return (
    <SongsProvider>
      <MenuProvider>
        <AppContent />
      </MenuProvider>
    </SongsProvider>
  )
}