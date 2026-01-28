import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function Login() {
    const [loginEmail, setLoginEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const { login } = useAuth()
    const navigate = useNavigate()

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setIsLoading(true)

        try {
            // Check for alias
            let emailToUse = loginEmail
            if (loginEmail === 'admin') {
                emailToUse = 'admin@crm.local'
            }

            await login(emailToUse, password)
            navigate('/dashboard')
        } catch (err) {
            setError(err.message === 'Invalid login credentials'
                ? 'Неверный логин или пароль'
                : 'Ошибка входа: ' + err.message)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #fbcfe8 0%, #dbeafe 100%)', // Pink to Blue soft gradient
            fontFamily: "'Montserrat', sans-serif"
        }}>
            <div style={{
                background: 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(10px)',
                padding: '3rem',
                borderRadius: '1.5rem',
                boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
                width: '100%',
                maxWidth: '400px',
                border: '1px solid rgba(255, 255, 255, 0.18)'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <h1 style={{ fontSize: '2rem', color: '#be185d', marginBottom: '0.5rem' }}>FlowerBox</h1>
                    <p style={{ color: '#64748b' }}>Вход в систему</p>
                </div>

                {error && (
                    <div style={{
                        background: '#fee2e2',
                        color: '#ef4444',
                        padding: '0.75rem',
                        borderRadius: '0.5rem',
                        marginBottom: '1.5rem',
                        fontSize: '0.875rem'
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#334155' }}>Логин</label>
                        <input
                            type="text"
                            className="input"
                            value={loginEmail}
                            onChange={(e) => setLoginEmail(e.target.value)}
                            placeholder="Введите логин (admin)"
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                background: 'white',
                                fontSize: '1rem'
                            }}
                            required
                        />
                    </div>

                    <div style={{ marginBottom: '2rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#334155' }}>Пароль</label>
                        <input
                            type="password"
                            className="input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Введите пароль"
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                background: 'white',
                                fontSize: '1rem'
                            }}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={isLoading}
                        style={{
                            width: '100%',
                            padding: '1rem',
                            fontSize: '1rem',
                            justifyContent: 'center'
                        }}
                    >
                        {isLoading ? 'Вход...' : 'Войти'}
                    </button>
                </form>
            </div>
        </div>
    )
}
