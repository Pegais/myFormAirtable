import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box, Button,
  Paper, TextField,
  Link, Alert, Card,
  CardContent, CardActions, IconButton,
  Grid, Divider, CircularProgress,
} from '@mui/material';
import { Add as AddIcon, Visibility, List,Share as ShareIcon,Delete as DeleteIcon,Edit as EditIcon } from '@mui/icons-material';
import{Snackbar,Tooltip}from '@mui/material';
import { formAPI } from '../axios.config';

export default function Dashboard() {
  const navigate = useNavigate();
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [snackbarOpen, setSnackbarOpen] = useState({open:false,message:''});
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchForms = async () => {
      try {
        setLoading(true);
        const response = await formAPI.getForms();
        setForms(response.data.forms || []);
        setError(null);
      } catch (error) {
        console.error("Error fetching forms:", error);
        setError('Failed to fetch forms');
      } finally {
        setLoading(false);
      }
    }
    fetchForms();
  }, [])

 

  //create a new form;
  const handleCreateForm = () => {
    navigate('/forms/new');
  }

  const handleViewForm = (formId) => {
    navigate(`/forms/${formId}/view`);
  }

  const handleViewResponses = (formId) => {
    navigate(`/forms/${formId}/responses`);
  }
  const handleDeleteForm = async (formId) => {
    if(!window.confirm('Are you sure you want to delete this form? This action cannot be undone.')){
      return;
    }
    try {
      await formAPI.deleteForm(formId);
      setSnackbarOpen({open:true,message:'Form deleted successfully'});
      //refresh form list;
      const response = await formAPI.getForms();
      setForms(response.data.forms || []);
    } catch (error) {
      console.error("error deleting form:",error);
      setSnackbarOpen({open:true,message:error.response?.data?.message || 'Failed to delete form'});
    }
  }

  const handleShareForm = (formId) => {
    const shareUrl = `${window.location.origin}/forms/${formId}/view`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setSnackbarOpen({open:true,message:'Share link copied to clipboard'});
    }).catch((error) => {
      console.error("error copying share link:",error);
      setSnackbarOpen({open:true,message:'Failed to copy share link'});
    });
  }

  const handleEditForm = (formId) => {
    navigate(`/forms/${formId}/edit`);
  }
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    )
  }


  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" gutterBottom>My Forms</Typography>
        <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={handleCreateForm}>
          Create New Form
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {forms.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="body1" color="text.secondary">No forms created yet</Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {forms.map((form) => (
            <Grid item xs={12} sm={6} md={4} key={form._id}>
              <Card>
                <CardContent>
                  <Typography variant="h6" component="h2" gutterBottom>{form.formName}</Typography>
                  <Typography variant="body2" color="text.secondary" >
                    {form.questions?.length || 0} questions
                  </Typography>
                  <Typography variant="caption" color="text.secondary" >
                    Created on: {new Date(form.createdAt).toLocaleDateString()}
                  </Typography>
                </CardContent>
                <CardActions>
                  <Box>

                  <Button size='small' onClick={() => handleViewForm(form._id)} startIcon={<Visibility />}>
                    View
                  </Button>
                  <Button size='small' onClick={() => handleViewResponses(form._id)} startIcon={<List />}>
                    Responses
                  </Button>
                  </Box>
                  <Box>
                    <Button size='small' onClick={() => handleShareForm(form._id)} startIcon={<ShareIcon/>}>
                      Share
                    </Button>
                    <Button size='small' onClick={() => handleDeleteForm(form._id)} startIcon={<DeleteIcon/>} color='error'></Button>
                    <Button size='small' onClick={() => handleEditForm(form._id)} startIcon={<EditIcon/>}></Button>
                  </Box>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )
      }
      <Snackbar open={snackbarOpen.open} 
      autoHideDuration={3000} 
      onClose={() => setSnackbarOpen({open:false,...snackbarOpen})} 
      message={snackbarOpen.message} />
    </Container>
  )
}
