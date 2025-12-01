import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Container,
    Typography,
    Box,
    Button,
    Paper,
    TextField,
    FormControl,
    FormControlLabel,
    Checkbox,
    Radio,
    RadioGroup,
    FormLabel,
    CircularProgress,
    Alert,
    Select,
    MenuItem,
    InputLabel
} from '@mui/material';
import { formAPI } from '../axios.config';
import { shouldShowQuestion } from '../utils/conditionalLogic';


export default function PublicFormView() {
    const { formId } = useParams();
    const navigate = useNavigate();
    const [form, setForm] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [answers, setAnswers] = useState({});
    const [uploadingFiles, setUploadingFiles] = useState({});


    useEffect(() => {
        const loadForm = async () => {
            try {
                setLoading(true);
                const response = await formAPI.getFormForPublicView(formId);
                setForm(response.data.form);
                setError(null);
            } catch (error) {
                console.error("Error loading form:", error);
                setError(error.response?.data?.message || "Failed to load form");
            } finally {
                setLoading(false);
            }
        }
        loadForm();
    }, [formId]);

    //handling answer changes;
    const handleAnswerChange = (questionKey, value) => {
        setAnswers(prev => {
            const newAnswers = { ...prev, [questionKey]: value };

            // re-evalaute visibility after answer change;
            return newAnswers;

        });

    };


    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setSubmitting(true);
            setError(null);
            await formAPI.submitFormResponse(formId, answers);
            setSuccess(true);
            setAnswers({});
            setTimeout(() => {
                navigate('/')
            }, 2000)
        } catch (error) {
            console.error("Error submitting form:", error);
            setError(error.response?.data?.message || "Failed to submit form");
        } finally {
            setSubmitting(false);
        }
    };



    const renderQuestionInput = (question) => {
        const value = answers[question.questionKey] || '';
        switch (question.type) {
            case 'singleLineText':
                return (
                    <TextField
                        fullWidth
                        value={value}
                        onChange={(e) => handleAnswerChange(question.questionKey, e.target.value)}
                        required={question.required}
                        margin="normal"
                    />
                );

            case 'multilineText':
                return (
                    <TextField
                        multiline
                        rows={4}
                        fullWidth
                        value={value}
                        onChange={(e) => handleAnswerChange(question.questionKey, e.target.value)}
                        required={question.required}
                        margin="normal"
                    />
                );

            case 'singleSelect':
                //assuming  options come from aritable fields definition;
                //we need to fetch the options from airtable or store them in forms;
                return (
                    <FormControl fullWidth margin="normal">
                        <InputLabel>Select an option</InputLabel>
                        <Select
                            value={value}
                            onChange={(e) => handleAnswerChange(question.questionKey, e.target.value)}
                            required={question.required}

                        >
                            <MenuItem value="">None</MenuItem>
                            {
                                question?.options && question.options.length > 0 ? (
                                    question.options.map((option) => {
                                        //handle both format :{id,name } and string;
                                        const optionValue =typeof option === 'string' ? option : (option.id || option.name ||option);
                                        const optionLabel = typeof option === 'string' ? option : (option.name || option.name || option);
                                        return(
                                            <MenuItem key={optionValue} value={optionValue}>{optionLabel}</MenuItem>
                                        )
                                    })
                                ):(
                                    <MenuItem value="">No option available</MenuItem>
                                )
                            }
                        </Select>
                    </FormControl>
                );
            case 'multipleSelects':
                const selectedValues = Array.isArray(value) ? value : [];
                const options = question?.options || [];
                if(options.length === 0){
                    return(
                        <Typography variant="body2" color="text.secondary">No options available</Typography>
                    )
                }
                return (
                    <FormControl fullWidth margin="normal">
                        {
                            options.map((option, idx) => {
                                const optionValue = option.id || option;
                                const optionLabel = option.name || option;
                                const isChecked = selectedValues.includes(optionValue);
                                return(
                                    <FormControlLabel
                                    key={idx}
                                    control={<Checkbox checked={isChecked}
                                     onChange={(e) => handleAnswerChange(question.questionKey, isChecked ? selectedValues.filter(val => val !== optionValue) : [...selectedValues, optionValue])} />}
                                    label={optionLabel}
                                    
                                    >

                                    </FormControlLabel>
                                )
                            })
                        }

                    </FormControl>
                );
            case 'multipleAttachments':
                const attachmentValue = Array.isArray(value) && value.length > 0 ? value[0] : null;
                const isUploading = uploadingFiles[question.questionKey] || false;
                return (
                    <Box>
                        <TextField
                            type="file"
                            inputProps={{ multiple: false }}
                            onChange={async (e) => {
                                const files = Array.from(e.target.files);
                                if (files.length === 0) return;

                                setUploadingFiles(prev => ({ ...prev, [question.questionKey]: true }));
                                setError(null);

                                try {
                                    // Upload only the first file (single attachment)
                                    const file = files[0];
                                    const uploadResult = await formAPI.uploadFile(formId, file);
                                    
                                    const uploadedFile = {
                                        url: uploadResult.data.file.url,
                                        filename: uploadResult.data.file.filename
                                    };

                                    // Store as array with single file (for backend processing)
                                    handleAnswerChange(question.questionKey, [uploadedFile]);
                                } catch (uploadError) {
                                    console.error("Error uploading file:", uploadError);
                                    setError(uploadError.response?.data?.message || "Failed to upload file");
                                } finally {
                                    setUploadingFiles(prev => ({ ...prev, [question.questionKey]: false }));
                                    // Reset file input
                                    e.target.value = '';
                                }
                            }}
                            required={question.required && !attachmentValue}
                            margin="normal"
                            disabled={isUploading}
                            fullWidth
                        />
                        {isUploading && (
                            <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                                <CircularProgress size={20} sx={{ mr: 1 }} />
                                <Typography variant="body2" color="text.secondary">Uploading...</Typography>
                            </Box>
                        )}
                        {attachmentValue && (
                            <Box sx={{ mt: 1 }}>
                                <Typography variant="body2" color="text.secondary" gutterBottom>
                                    Uploaded file:
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                                    <Typography variant="body2" sx={{ mr: 1 }}>
                                        {attachmentValue.filename || 'File'}
                                    </Typography>
                                    <Button
                                        size="small"
                                        color="error"
                                        onClick={() => {
                                            handleAnswerChange(question.questionKey, []);
                                        }}
                                    >
                                        Remove
                                    </Button>
                                </Box>
                            </Box>
                        )}
                    </Box>
                )
            default:
                return <Typography variant="body2" color="text.secondary">Unsupported question type: {question.type}</Typography>;
        }
    };


    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress />
            </Box>
        );
    }
    if (error && !form) {
        return (
            <Container maxWidth="md" sx={{ mt: 4 }}>
                <Alert severity="error">{error}</Alert>
            </Container>
        );
    }
    if (success) {
        return (
            <Container maxWidth="md" sx={{ mt: 4 }}>
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                    <Alert severity="success">Form submitted successfully!</Alert>

                </Paper>

            </Container>
        );
    }
    if (!form) return null;

    //filter the visible question  based on conditional logic;
    const visibleQuestions = form.questions.filter(question => {
        const rules = question.conditionalLogicRules;
        return shouldShowQuestion(rules, answers);
    });
    return (
        <Container maxWidth="md" sx={{ mt: 4 }}>
            <Paper sx={{ p: 4 }}>
                <Typography variant="h5" gutterBottom>{form.formName}</Typography>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                <form onSubmit={handleSubmit}>
                    {
                        visibleQuestions.map((question, index) => (
                            <Box key={question._id || index} mb={3}>
                                <Typography variant="h6">{question.label}
                                    {question.required && <span style={{ color: 'red', marginLeft: 4 }}>*</span>}
                                </Typography>
                                {renderQuestionInput(question)}
                            </Box>
                        ))
                    }
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 4 }}>
                        <Button variant="contained" type="submit" disabled={submitting}>
                            {submitting ? <CircularProgress size={20} sx={{ mr: 1 }} /> : 'Submit'}
                        </Button>
                    </Box>
                </form>
            </Paper>
        </Container>

    );
}