import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { formAPI } from '../axios.config';
import {
    Container,
    Typography,
    Box,
    Button,
    Paper,
    CircularProgress,
    Alert,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
export default function FormResponses() {
    const navigate = useNavigate();
    const { formId } = useParams();
    const [responses, setResponses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadResponses = async () => {
            try {
                setLoading(true);
                const response = await formAPI.getFormResponses(formId);
                setResponses(response.data.responses || []);
                setError(null);
            } catch (error) {
                console.error("Error loading responses:", error);
                setError(error.response?.data?.message || "Failed to load responses");
            } finally {
                setLoading(false);
            }
        };
        loadResponses();
    }, [formId]);

    const formDate = (datestring) => {
        return new Date(datestring).toLocaleDateString();
    };


    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress />
            </Box>
        );
    }
    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Button variant="contained"
                    color="primary"
                    startIcon={<ArrowBackIcon />}
                    onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
                <Typography variant="h4" gutterBottom>Form responses</Typography>
            </Box>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {responses.length === 0 ? (
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                    <Typography variant="body1" color="text.secondary">No responses yet</Typography>
                </Paper>
            ) : (
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Response ID</TableCell>
                                <TableCell>Submitted On</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Preview</TableCell>
                                
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {
                                responses.map((response) => (
                                    <TableRow key={response._id}>
                                        <TableCell>{response.airtableRecordId?.substring(0, 8) || response._id?.substring(0, 8)}...</TableCell>
                                        <TableCell>{formDate(response.createdAt)}</TableCell>
                                        <TableCell>
                                            <Chip label={response.status} color="success" size="small" />
                                        </TableCell>

                                        <TableCell>{
                                            Object.keys(response.preview || {}).map((key) => (
                                                <Box key={key} sx={{ mb: 0.5 }}>
                                                    <Typography variant="body2" color="text.secondary">{key}:</Typography>
                                                    <Typography variant="body2">{response.preview[key]}</Typography>
                                                </Box>
                                            ))

                                        }</TableCell>
                                       
                                    </TableRow>
                                ))
                            }
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Container>
    )
}