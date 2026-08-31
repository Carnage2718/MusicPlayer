const getUserId = () =>
  localStorage.getItem("user_id") || "unknown"

const getKey = () =>
  `debugLogs_${getUserId()}`


/* =========================
   PROGRESS CODE
========================= */

export const DEBUG_PROGRESS = {

  PLAYBACK: {
    LOADING: 101,
    PLAY_START: 102,
    HALF: 103,
    COMPLETE: 104
  },

  QUEUE: {
    REQUEST: 201,
    RESPONSE: 202,
    APPLY: 203,
    COMPLETE: 204
  },

  PLAY_ACTION: {
    REQUEST: 301,
    COMPLETE: 302
  },

  SHUFFLE: {
    REQUEST: 401,
    COMPLETE: 402
  }

}


/* =========================
   ERROR CODE
========================= */

export const DEBUG_ERROR = {

  PLAYBACK: {
    META: 1001,
    STREAM: 1002,
    PLAY: 1003,
    AUDIO: 1004,
    HALF: 1005
  },

  QUEUE: {
    REQUEST: 2001,
    RESPONSE: 2002,
    APPLY: 2003
  },

  PLAY_ACTION: {
    REQUEST: 3001
  },

  SHUFFLE: {
    REQUEST: 4001
  }

}


/* =========================
   TEXT
========================= */

export const DEBUG_TEXT = {

  101: "loading",
  102: "play start",
  103: "50% history + play count",
  104: "play complete",

  201: "queue request",
  202: "queue response",
  203: "queue apply",
  204: "queue complete",

  301: "play action request",
  302: "play action complete",

  401: "shuffle request",
  402: "shuffle complete"

}


/* =========================
   STORAGE
========================= */

const read = () => {

  try {

    return JSON.parse(
      localStorage.getItem(getKey()) || "[]"
    )

  } catch {

    return []

  }

}


const write = logs => {

  localStorage.setItem(
    getKey(),
    JSON.stringify(logs)
  )

}


const now = () =>
  new Date().toISOString()


/* =========================
   SESSION
========================= */

let sequence = 0

export const debugStart = (
  type,
  target = null
) => {

  sequence += 1

  return {

    id: sequence,

    type,

    target,

    logs: [],

    startedAt: now()

  }

}


/* =========================
   PROGRESS
========================= */

export const debugProgress = (
  session,
  code
) => {

  if (!session) return

  session.logs.push({
    code,
    time: now()
  })

  saveActive(session)

}


/* =========================
   ACTIVE
========================= */

const saveActive = session => {

  const logs = read()

  const active = {

    id: session.id,

    type: session.type,

    target: session.target,

    active: true,

    logs: session.logs,

    updatedAt: now()

  }

  const index =
    logs.findIndex(
      x => x.id === session.id
    )

  if (index >= 0) {

    logs[index] = active

  } else {

    logs.push(active)

  }

  write(logs)

}


/* =========================
   COMPLETE
========================= */

export const replaceWithComplete = (
  session,
  code
) => {

  if (!session) return

  const logs = read()

  const filtered =
    logs.filter(
      x => x.id !== session.id
    )

  filtered.push({

    id: session.id,

    type: session.type,

    target: session.target,

    code,

    complete: true,

    time: now()

  })

  write(filtered)

}


/* =========================
   ERROR
========================= */

export const debugError = (
  type,
  code,
  error,
  target = null
) => {

  const logs = read()

  logs.push({

    type,

    target,

    error: true,

    code,

    message:
      error?.message ||
      String(error),

    name:
      error?.name ||
      null,

    time: now()

  })

  write(logs)

}


/* =========================
   READ
========================= */

export const getDebugLogs = () =>
  read()


/* =========================
   CLEAR
========================= */

export const clearDebugLogs = () => {

  localStorage.removeItem(
    getKey()
  )

}