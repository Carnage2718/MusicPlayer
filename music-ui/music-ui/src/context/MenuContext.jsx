import { createContext, useContext, useState } from "react"
import SongMenu from "../components/MenuComponent"
const MenuContext = createContext()

export const useMenu = () => useContext(MenuContext)

export function MenuProvider({ children }) {

  const [menu, setMenu] = useState(null)

  const openMenu = (song, position) => {
    setMenu({ song, position })
  }

  const closeMenu = () => setMenu(null)

  return (
    <MenuContext.Provider value={{ openMenu, closeMenu }}>
      {children}

      {menu && (
        <SongMenu
          song={menu.song}
          position={menu.position}
          onClose={closeMenu}
        />
      )}

    </MenuContext.Provider>
  )
}