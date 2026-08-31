import { useEffect, useState } from "react"
import {
  Settings,
  Trash2,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Loader2
} from "lucide-react"

import AppHeader from "../components/AppHeader"

import {
  getDebugLogs,
  clearDebugLogs,
  DEBUG_TEXT
} from "../utils/DebugLogger"

import "./DebugLogScreen.css"


export default function DebugLogScreen({
  onBack
}) {

  const [logs, setLogs] = useState([])


  /* =========================
     LOAD LOGS
  ========================= */

  useEffect(() => {

    const loadLogs = () => {

      setLogs(
        getDebugLogs()
      )

    }

    loadLogs()

    const timer =
      setInterval(
        loadLogs,
        500
      )

    return () => {
      clearInterval(timer)
    }

  }, [])


  /* =========================
     CLEAR
  ========================= */

  const handleClear = () => {

    clearDebugLogs()

    setLogs([])

  }


  /* =========================
     FORMAT TIME
  ========================= */

  const formatTime = (time) => {

    if (!time) return ""

    try {

      return new Date(time)
        .toLocaleTimeString(
          [],
          {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
          }
        )

    } catch {

      return ""

    }

  }


  /* =========================
     STATUS
  ========================= */

  const getStatus = (log) => {

    if (log.error) {

      return {
        label: "ERROR",
        className: "error",
        icon: <AlertTriangle size={14} />
      }

    }

    if (log.complete) {

      return {
        label: "COMPLETE",
        className: "complete",
        icon: <CheckCircle2 size={14} />
      }

    }

    return {
      label: "ACTIVE",
      className: "active",
      icon: <Loader2 size={14} />
    }

  }


  /* =========================
     RENDER LOG
  ========================= */

  const renderLog = (log, index) => {

    const status =
      getStatus(log)


    /* =========================
       ERROR
    ========================= */

    if (log.error) {

      return (

        <div
          key={`${log.time}-${index}`}
          className="debug-log-card error"
        >

          <div className="debug-log-card-top">

            <div className="debug-log-event">

              <AlertTriangle
                size={13}
                className="debug-error-icon"
              />

              <span className="debug-log-type">
                ERROR
              </span>

              <span className="debug-log-number">
                {log.code}
              </span>

            </div>


            <div className="debug-log-status-badge error">

              ERROR

            </div>

          </div>


          <div className="debug-log-target">

            {log.target != null
              ? `target ${log.target}`
              : "target —"}

          </div>


          <div className="debug-log-error-message">

            {log.message}

          </div>


          <div className="debug-log-footer">

            <span>
              {formatTime(log.time)}
            </span>

            {log.name && (
              <span>
                {log.name}
              </span>
            )}

          </div>

        </div>

      )

    }


    /* =========================
       COMPLETE
    ========================= */

    if (log.complete) {

      return (

        <div
          key={`${log.id}-${index}`}
          className="debug-log-card complete"
        >

          <div className="debug-log-card-top">

            <div className="debug-log-event">

              <CheckCircle2
                size={13}
                className="debug-complete-icon"
              />

              <span className="debug-log-type">
                PLAY
              </span>

              <span className="debug-log-number">
                {log.id}
              </span>

            </div>


            <div className="debug-log-status-badge complete">

              COMPLETE

            </div>

          </div>


          <div className="debug-log-target">

            {log.target != null
              ? `target ${log.target}`
              : "target —"}

          </div>


          <div className="debug-log-progress">

            <div className="debug-progress-line complete-line">

              {DEBUG_TEXT[log.code] ||
                "play complete"}

            </div>

          </div>


          <div className="debug-log-footer">

            <span>
              {formatTime(log.time)}
            </span>

            <span>
              CODE {log.code}
            </span>

          </div>

        </div>

      )

    }

    /* =========================
      ACTIVE
    ========================= */

    return (

      <div
        key={`${log.id}-${index}`}
        className="debug-log-card active"
      >

        <div className="debug-log-card-top">

          <div className="debug-log-event">

            <Loader2
              size={13}
              className="debug-active-loader"
            />

            <span className="debug-log-type">
              PLAY
            </span>

            <span className="debug-log-number">
              {log.id}
            </span>

          </div>


          <div className="debug-log-status-badge active">
            ACTIVE
          </div>

        </div>


        <div className="debug-log-target">

          {log.target != null
            ? `target ${log.target}`
            : "target —"}

        </div>


        <div className="debug-log-progress">

          {log.logs?.map(
            (item, i) => (

              <div
                key={`${item.code}-${i}`}
                className="debug-progress-line"
              >

                {DEBUG_TEXT[item.code] ||
                  `code ${item.code}`}

              </div>

            )
          )}

        </div>


        <div className="debug-log-footer">

          <span>
            {formatTime(log.updatedAt)}
          </span>

          <span>
            LIVE
          </span>

        </div>

      </div>

    )

  }


  return (

    <div className="screen debug-log-screen">

      <AppHeader
        title="Debug"
        rightAction={
          <Settings size={20} />
        }
      />


      <div className="debug-log-container">


        {/* =========================
            HEADER
        ========================= */}

        <div className="debug-console-header">

          <div className="debug-console-heading">

            <div className="debug-console-icon">
              <Activity size={18} />
            </div>

            <div>

              <div className="debug-console-title">
                System Debug
              </div>

              <div className="debug-console-subtitle">
                PLAYBACK / QUEUE MONITOR
              </div>

            </div>

          </div>


          <div className="debug-console-actions">

            <button
              className="debug-clear-button"
              onClick={handleClear}
            >

              <Trash2 size={15} />

              CLEAR

            </button>


            <button
              className="debug-back-button"
              onClick={onBack}
            >

              BACK

            </button>

          </div>

        </div>


        {/* =========================
            STATUS BAR
        ========================= */}

        <div className="debug-system-bar">

          <div className="debug-system-status">

            <span className="debug-status-dot"></span>

            <span>
              SYSTEM ONLINE
            </span>

          </div>


          <div className="debug-log-count">

            {logs.length} EVENTS

          </div>

        </div>


        {/* =========================
            LOG LIST
        ========================= */}

        {logs.length === 0 ? (

          <div className="debug-log-empty">

            <div className="debug-empty-icon">

              <Activity size={30} />

            </div>

            <div className="debug-log-empty-title">
              NO EVENTS
            </div>

            <div className="debug-log-empty-text">
              Playback and queue events will appear here.
            </div>

          </div>

        ) : (

          <div className="debug-log-list">

            {logs
              .slice()
              .reverse()
              .map(renderLog)}

          </div>

        )}

      </div>

    </div>

  )

}