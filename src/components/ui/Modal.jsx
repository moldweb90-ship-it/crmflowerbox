import React, { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function Modal({ isOpen, onClose, title, children, maxWidth = '500px', closeOnOverlayClick = true }) {
    const panelRef = useRef(null)

    useEffect(() => {
        if (!isOpen) return

        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'

        requestAnimationFrame(() => {
            panelRef.current?.scrollTo({ top: 0, left: 0 })
        })

        return () => {
            document.body.style.overflow = previousOverflow
        }
    }, [isOpen])

    return (
        <AnimatePresence>
            {isOpen && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 140, display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.48)', backdropFilter: 'blur(6px)' }}
                        onClick={() => closeOnOverlayClick && onClose()}
                    />
                    <motion.div
                        ref={panelRef}
                        initial={{ y: 18, scale: 0.98, opacity: 0 }}
                        animate={{ y: 0, scale: 1, opacity: 1 }}
                        exit={{ y: 18, scale: 0.98, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 360, damping: 32 }}
                        className="card app-modal-panel"
                        style={{
                            position: 'relative',
                            width: '100%',
                            maxWidth: maxWidth,
                            maxHeight: '90vh',
                            overflowY: 'auto',
                            padding: 0,
                            backgroundColor: 'var(--bg-card)',
                            boxShadow: 'var(--shadow-md)',
                            margin: '1rem',
                            WebkitOverflowScrolling: 'touch'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="app-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderBottom: '1px solid var(--border)' }}>
                            <h3 style={{ fontSize: '1.25rem' }}>{title}</h3>
                            <button onClick={onClose} style={{ padding: '0.25rem', borderRadius: '4px' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="app-modal-body" style={{ padding: '1rem' }}>
                            {children}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}
