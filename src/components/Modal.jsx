import { useEffect } from 'react'

export function Modal({ title, sub, children, onClose, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose && onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="overlay" role="dialog" aria-modal="true" onMouseDown={(e) => {
      if (e.target === e.currentTarget && onClose) onClose()
    }}>
      <div className="modal" style={wide ? { width: 'min(760px, 100%)' } : undefined}>
        <h3>{title}</h3>
        {sub && <p className="sub">{sub}</p>}
        {children}
        {footer && <footer>{footer}</footer>}
      </div>
    </div>
  )
}

export function Confirm({ title, message, okLabel = 'OK', danger, onOk, onCancel }) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button className="btn ghost" onClick={onCancel}>Cancel</button>
          <button className={danger ? 'btn danger' : 'btn primary'} onClick={onOk}>{okLabel}</button>
        </>
      }
    >
      <p className="sub" style={{ marginTop: 8 }}>{message}</p>
    </Modal>
  )
}
