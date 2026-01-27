import React from 'react'
import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function Modal({ isOpen, onClose, title, children }) {
    if (!isOpen) return null

    return (
        <AnimatePresence>
            <div style={{
                position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)' }}
                    onClick={onClose}
                />
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="card"
                    style={{
                        position: 'relative',
                        width: '100%',
                        maxWidth: '500px',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        padding: 0,
                        backgroundColor: 'var(--bg-card)',
                        boxShadow: 'var(--shadow-md)'
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderBottom: '1px solid var(--border)' }}>
                        <h3 style={{ fontSize: '1.25rem' }}>{title}</h3>
                        <button onClick={onClose} style={{ padding: '0.25rem', borderRadius: '4px' }}>
                            <X size={20} />
                        </button>
                    </div>
                    <div style={{ padding: '1rem' }}>
                        {children}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    )
}
