import React, { useState, useEffect } from 'react'
import { useNavigate } from "react-router-dom";
import { Container, Button, Typography, Box, Alert, Paper, TextField, Link } from "@mui/material";
export default function Login() {
  const navigate = useNavigate();

  //check if already logged in;
  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_Server_URL || 'http://localhost:5000'}/api/forms`, {
          credentials: 'include'
        });
        if (response.ok) {
          navigate('/dashboard');
        }
      } catch (error) {
        console.error("Error checking login status:", error);
        //not authenticated, continue to login;
      }
    }
    checkLoginStatus();
  }, [navigate]);

  const handleLogin = () => {
    window.location.href = `${process.env.REACT_APP_Server_URL || 'http://localhost:5000'}/auth/airtable`;
  }
  return (
   <Container maxWidth="sm" sx={{ mt: 4 }}>
    <Box 
    display="flex"
    flexDirection="column"
    alignItems="center"
    justifyContent="center"
    height="100vh"
    >
    <Paper elevation={3} sx={{ p: 4, width: '100%', textAlign: 'center' }}>
      <Typography variant="h4" gutterBottom>
        Form Builder
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Sign in with Airtable to get started
      </Typography>
      <Button variant="contained" color="primary" onClick={handleLogin} size='large' fullWidth sx={{mt:2}}>
        Sign in with Airtable
      </Button>
    </Paper>
    
    
    

    </Box>
   </Container>
  )
}
