
import './App.css';
import { Routes, Route, Navigate } from "react-router-dom";
//themeprovider and create theme from material ui
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ProtectedRoute from './components/ProtectedRoute';
import FormBuilder from './pages/FormBuilder';
import FormResponses from './pages/FormResponses';
import PublicFormView from './pages/PublicFormView';
import EditForm from './pages/EditForm';


const theme = createTheme({
  palette: {
    primary: {
      main: "#1976d2",
    },
  },
});
function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Routes>
        <Route element={<Login />} path='/login' />
        <Route path='/forms/:formId/view' element={<PublicFormView />} />
        <Route
          path='/dashboard'
          element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
        />
        <Route path='/' element={<Navigate to='/dashboard' replace />} />
        <Route path='/forms/new' element={<ProtectedRoute><FormBuilder /></ProtectedRoute>} />
        <Route path='/forms/:formId/responses' element={<ProtectedRoute><FormResponses /></ProtectedRoute>} />
        <Route path='/forms/:formId/edit' element={<ProtectedRoute><EditForm /></ProtectedRoute>} />
      </Routes>
    </ThemeProvider>
  );
}

export default App;
