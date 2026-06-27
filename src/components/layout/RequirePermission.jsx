import React from 'react'
import { Navigate } from 'react-router-dom'
import { usePermissions } from '../../context/PermissionContext'

export default function RequirePermission({ permission, children }) {
    const { checkAccess, loading } = usePermissions()

    if (loading) {
        return <div style={{ padding: '2rem', textAlign: 'center' }}>Загрузка прав...</div>
    }

    if (!permission) return children

    if (!checkAccess(permission)) {
        return <Navigate to={checkAccess('my_deliveries') ? '/my-deliveries' : '/dashboard'} replace />
    }

    return children
}
