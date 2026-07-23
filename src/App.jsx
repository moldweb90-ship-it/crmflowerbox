import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Inventory from './pages/Inventory'
import Products from './pages/Products'
import Settings from './pages/Settings'
import Categories from './pages/Categories'
import Supplies from './pages/Supplies'
import Suppliers2 from './pages/Suppliers'
import Stock from './pages/Stock'
import Expenses from './pages/Expenses'
import Sales from './pages/Sales'
import Showcase from './pages/Showcase'
import Customers from './pages/Customers'
import Reminders from './pages/Reminders'
import Employees from './pages/Employees'
import Analytics from './pages/Analytics'
import Couriers from './pages/Couriers'
import MyDeliveries from './pages/MyDeliveries'
import Claims from './pages/Claims'
import { StoreProvider } from './context/StoreContext'
import { AuthProvider } from './context/AuthContext'
import { PermissionProvider } from './context/PermissionContext'
import Login from './pages/Login'
import ProtectedRoute from './components/layout/ProtectedRoute'
import RequirePermission from './components/layout/RequirePermission'

function DisableNumberInputWheel() {
    useEffect(() => {
        const handleWheel = event => {
            const input = event.target
            if (
                input instanceof HTMLInputElement &&
                input.type === 'number' &&
                document.activeElement === input
            ) {
                input.blur()
            }
        }

        document.addEventListener('wheel', handleWheel, { capture: true, passive: true })
        return () => document.removeEventListener('wheel', handleWheel, true)
    }, [])

    return null
}

function App() {
    return (
        <AuthProvider>
            <PermissionProvider>
                <StoreProvider>
                    <DisableNumberInputWheel />
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
                                <Route path="showcase" element={<RequirePermission permission="showcase"><Showcase /></RequirePermission>} />
                                <Route path="flowers" element={<RequirePermission permission="flowers"><Inventory mode="flowers" /></RequirePermission>} />
                                <Route path="goods" element={<RequirePermission permission="goods"><Inventory mode="goods" /></RequirePermission>} />
                                <Route path="products" element={<RequirePermission permission="products"><Products /></RequirePermission>} />
                                <Route path="categories" element={<RequirePermission permission="categories"><Categories /></RequirePermission>} />
                                <Route path="supplies" element={<RequirePermission permission="supplies"><Supplies /></RequirePermission>} />
                                <Route path="suppliers" element={<Suppliers2 />} />
                                <Route path="stock" element={<RequirePermission permission="stock"><Stock /></RequirePermission>} />
                                <Route path="expenses" element={<RequirePermission permission="expenses"><Expenses /></RequirePermission>} />
                                <Route path="customers" element={<RequirePermission permission="customers"><Customers /></RequirePermission>} />
                                <Route path="claims" element={<RequirePermission permission="claims"><Claims /></RequirePermission>} />
                                <Route path="reminders" element={<RequirePermission permission="customers"><Reminders /></RequirePermission>} />
                                <Route path="employees" element={<RequirePermission permission="employees"><Employees /></RequirePermission>} />
                                <Route path="couriers" element={<RequirePermission permission="couriers"><Couriers /></RequirePermission>} />
                                <Route path="my-deliveries" element={<RequirePermission permission="my_deliveries"><MyDeliveries /></RequirePermission>} />
                                <Route path="analytics" element={<RequirePermission permission="analytics"><Analytics /></RequirePermission>} />
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
