//local用　
// const API_BASE = "http://127.0.0.1:8000"


//online用　
// const API_BASE = "http://192.168.3.34:8000"

//Render用
//const API_BASE = "https://musicplayer-api-1ex5.onrender.com"


const API_BASE = "https://musicplayer-api-1ex5.onrender.com"

export default API_BASE

export const authfetch = (
  endpoint,
  options={}
) => {

  const token =
    localStorage.getItem("token")

  return fetch(
    `${API_BASE}${endpoint}`,
    {
      ...options,

      headers:{
        "Content-Type":"application/json",

        ...(options.headers || {}),

        Authorization:`Bearer ${token}`
      }
    }
  )
}