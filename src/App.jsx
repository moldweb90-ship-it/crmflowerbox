import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Inventory from './pages/Inventory'
import Products from './pages/Products'
import Settings from './pages/Settings'
import Categories from './pages/Categories'
import Supplies from './pages/Supplies'
import Stock from './pages/Stock'
import Expenses from './pages/Expenses'
import Sales from './pages/Sales'
import Customers from './pages/Customers'
import { StoreProvider } from './context/StoreContext'
import { AuthProvider } from './context/AuthContext'
import { PermissionProvider } from './context/PermissionContext'
import Login from './pages/Login'
import ProtectedRoute from './components/layout/ProtectedRoute'
import RequirePermission from './components/layout/RequirePermission'

function App() {
    return (
        <AuthProvider>
            <PermissionProvider>
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
                                <Route path="dashboard" element={<RequirePermission permission="dashboard"><Dashboard /></RequirePermission>} />
                                <Route path="sales" element={<RequirePermission permission="sales"><Sales /></RequirePermission>} />
                                <Route path="flowers" element={<RequirePermission permission="flowers"><Inventory mode="flowers" /></RequirePermission>} />
                                <Route path="goods" element={<RequirePermission permission="goods"><Inventory mode="goods" /></RequirePermission>} />
                                <Route path="products" element={<RequirePermission permission="products"><Products /></RequirePermission>} />
                                <Route path="categories" element={<RequirePermission permission="categories"><Categories /></RequirePermission>} />
                                <Route path="supplies" element={<RequirePermission permission="supplies"><Supplies /></RequirePermission>} />
                                <Route path="stock" element={<RequirePermission permission="stock"><Stock /></RequirePermission>} />
                                <Route path="expenses" element={<RequirePermission permission="expenses"><Expenses /></RequirePermission>} />
                                <Route path="customers" element={<RequirePermission permission="customers"><Customers /></RequirePermission>} />
                                <Route path="settings" element={<RequirePermission permission="settings"><Settings /></RequirePermission>} />
                            </Route>
                        </Routes>
                    </BrowserRouter>
                </StoreProvider>
            </PermissionProvider>
        </AuthProvider>
    )
}

export default App
