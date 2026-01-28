import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Inventory from './pages/Inventory'
import Products from './pages/Products'
import Settings from './pages/Settings'
import Categories from './pages/Categories'
import { StoreProvider } from './context/StoreContext'
import { AuthProvider } from './context/AuthContext'
import Login from './pages/Login'
import ProtectedRoute from './components/layout/ProtectedRoute'

function App() {
    return (
        <AuthProvider>
            <StoreProvider>
                <BrowserRouter>
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="/" element={
                            <ProtectedRoute>
                                <Layout />
                            </ProtectedRoute>
                        }>
                            <Route index element={<Navigate to="/dashboard" replace />} />
                            <Route path="dashboard" element={<Dashboard />} />
                            <Route path="flowers" element={<Inventory mode="flowers" />} />
                            <Route path="goods" element={<Inventory mode="goods" />} />
                            <Route path="products" element={<Products />} />
                            <Route path="categories" element={<Categories />} />
                            <Route path="settings" element={<Settings />} />
                        </Route>
                    </Routes>
                </BrowserRouter>
            </StoreProvider>
        </AuthProvider>
    )
}

export default App
