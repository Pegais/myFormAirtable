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
                return(
                    <TextField
                        type="file"
                        
                        onChange={(e) => {
                            const files =Array.from(e.target.files);
                            //converting file to aray of files
                            const fileData = files.map(file => ({
                                url:URL.createObjectURL(file),
                                filename:file.name,
                                size:file.size,
                                type:file.type,
                            }));
                            handleAnswerChange(question.questionKey, fileData);
                        }}
                        required={question.required}
                        margin="normal"
                    />
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