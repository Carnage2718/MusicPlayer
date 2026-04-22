import { Home, ListMusic, Library, Upload, Search } from "lucide-react"
import "./BottomNav.css"

export default function BottomNav({ currentScreen, setCurrentScreen }) {

  const navItems = [
    { key: "home", icon: Home, label: "Home" },
    { key: "playlists", icon: ListMusic, label: "Playlist" },
    { key: "library", icon: Library, label: "Library" },
    { key: "upload", icon: Upload, label: "Upload" }
  ]

  return (
    <div className="bottom-nav">

      <div className="nav-group">

        {navItems.map(item => {

          const Icon = item.icon
          const active = currentScreen === item.key

          return (
            <button
              key={item.key}
              className={`nav-btn ${active ? "active" : ""}`}
              onClick={() => setCurrentScreen(item.key)}
            >

              <Icon size={22} />

              <span>{item.label}</span>

            </button>
          )

        })}

      </div>

      <button
        className={`nav-search ${currentScreen === "search" ? "active" : ""}`}
        onClick={() => setCurrentScreen("search")}
      >

        <Search size={24} />

        <span>Search</span>

      </button>

    </div>
  )
}