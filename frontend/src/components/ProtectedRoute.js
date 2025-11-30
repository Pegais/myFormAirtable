import React, { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
export default function ProtectedRoute({ children }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkLoginStatus = async () => {
            try {
                const response = await fetch(`${process.env.REACT_APP_Server_URL || 'http://localhost:5000'}/api/forms`, {
                    credentials: 'include'
                });
                setIsAuthenticated(response.ok);
            } catch (error) {
                console.error("Error checking login status:", error);
                setIsAuthenticated(false);
            } finally {
                setLoading(false);
            }
        }
        checkLoginStatus();
    }, []);


    if (loading) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><CircularProgress /></Box>
    }
    if (!isAuthenticated) {
        return <Navigate to='/login' replace />
    }
    return children;
}