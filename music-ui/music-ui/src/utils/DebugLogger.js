const getUserId = () =>
  localStorage.getItem("user_id") || "unknown"

const getKey = () =>
  `debugLogs_${getUserId()}`


/* =========================
   PROGRESS CODE
========================= */

export const DEBUG_PROGRESS = {

  PLAYBACK: {

    CURRENT: 1,

    META_CACHE_HIT: 2,
    META_REQUEST: 3,
    META_LOADED: 4,

    STREAM_CACHE_HIT: 5,
    STREAM_REQUEST: 6,
    STREAM_RESPONSE: 7,
    STREAM_LOADED: 8,

    AUDIO_SRC_SET: 9,
    AUDIO_LOAD: 10,

    CANPLAY: 11,
    CANPLAYTHROUGH: 12,

    PLAY_REQUEST: 13,
    PLAY_START: 14,
    PLAYING: 15,

    HALF: 16,

    PAUSE: 17,
    WAITING: 18,
    STALLED: 19,
    SUSPEND: 20,

    SEEKING: 21,
    SEEKED: 22,

    ENDED: 23,

    COMPLETE: 24
  },


  QUEUE: {

    REQUEST: 101,
    RESPONSE: 102,
    CURRENT_RECEIVED: 103,
    APPLY: 104,
    COMPLETE: 105
  },


  PLAY_ACTION: {

    REQUEST: 201,
    RESPONSE: 202,
    APPLY: 203,
    COMPLETE: 204
  },


  SHUFFLE: {

    REQUEST: 301,
    RESPONSE: 302,
    APPLY: 303,
    COMPLETE: 304
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
    GENERATE: 2003,
    UPDATE: 2004,
    FIRST_PLAY: 2005,
    COMPLETE: 2006
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

  /* PLAYBACK */

  1: "current recognized",

  2: "meta cache hit",
  3: "meta request",
  4: "meta loaded",

  5: "stream cache hit",
  6: "stream request",
  7: "stream loaded",

  8: "audio src set",
  9: "audio load",

  10: "canplay",
  11: "canplaythrough",

  12: "play request",
  13: "play start",
  14: "playing",

  15: "50% history + play count",

  16: "pause",
  17: "waiting",
  18: "stalled",
  19: "suspend",

  20: "seeking",
  21: "seeked",

  22: "ended",

  23: "play complete",


  /* QUEUE */

  101: "next request",
  102: "next response",
  103: "next current received",
  104: "queue apply",
  105: "queue complete",


  /* PLAY ACTION */

  201: "play action request",
  202: "play action response",
  203: "play action apply",
  204: "play action complete",


  /* SHUFFLE */

  301: "shuffle request",
  302: "shuffle response",
  303: "shuffle apply",
  304: "shuffle complete"

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
  code,
  details = null
) => {

  if (!session) return

  const log = {
    code,
    time: now()
  }

  if (details) {
    log.details = details
  }

  session.logs.push(log)

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