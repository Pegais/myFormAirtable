import React,{useState,useEffect} from 'react';
import { 
    Container,
    Typography,
    Box,
    Button,
    Stepper,
    Step,
    StepLabel,
    Paper,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TextField,
    Checkbox,
    FormControlLabel,
    CircularProgress,
    Alert,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    IconButton
} from '@mui/material';
import { formAPI } from '../axios.config';
import { Delete as DeleteIcon, FrontHand, Save as SaveIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';


const steps = ['Select Base', 'Select Table', 'Configure Fields', 'Review and Save'];
export default function FormBuilder() {
    const navigate = useNavigate();
    const [activeStep, setActiveStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    //step 1: Bases;
    const [bases, setBases] = useState([]);
    const [selectedBase, setSelectedBase] = useState('');

    //Step2: Tables;
    const [tables, setTables] = useState([]);
    const [selectedTable, setSelectedTable] = useState('');

    //step3:Fields;
    const [fields, setFields] = useState([]);
    const [selectedFields, setSelectedFields] = useState([]);

    //step 4: Form details;
    const [formName, setFormName] = useState('');

    //load based on mounting;
    useEffect(() => {
        loadBases();
    }, []);


    const loadBases = async () => {
        try {
            setLoading(true);
            const response = await formAPI.getBases();
            setBases(response.data.bases || []);
            setError(null);
        } catch (error) {
            console.error("Error loading bases:", error);
            setError("Failed to load bases");
        } finally {
            setLoading(false);
        };
    };

    const handleBaseSelection = async (baseId) => {
        setSelectedBase(baseId);
        setSelectedTable('');
        setTables([]);
        setFields([]);
        setSelectedFields([]);

        try {
            setLoading(true);
            const response = await formAPI.getTablesInBase(baseId);
            setTables(response.data.tables || []);
        } catch (error) {
            console.error("Error loading tables:", error);
            setError("Failed to load tables");
        } finally {
            setLoading(false);
        }
    };

    const handleTableSelection = async (tableId) => {
        setSelectedTable(tableId);
        setFields([]);
        setSelectedFields([]);

        try {
            setLoading(true);
            const response = await formAPI.getFieldsInTable(selectedBase, tableId);
            setFields(response.data.fields || []);
            console.log("fields structure:", response.data.fields[0]);
            
        } catch (error) {
            console.error("Error loading fields:", error);
            setError("Failed to load fields");
        } finally {
            setLoading(false);
        }
    };

    const handleFieldSelection = async (field) => {
        const isSelected = selectedFields.find(f => f.airtableFieldId === field.id);
        if (isSelected) {

            setSelectedFields(selectedFields.filter(f => f.airtableFieldId !== field.id));
        } else {
            const questionKey = field.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
            let options =undefined;
            if(field.type === 'singleSelect' || field.type === 'multipleSelects'){
                options = field.options?.choices || field.choices || [];
            }
            setSelectedFields([...selectedFields, {
                questionKey: questionKey || `field_${field.id}`,
                airtableFieldId: field.id,
                label: field.name,
                type: field.type,
                options: options, //adding options to the question;
                required: false,
                conditionalLogicRules: null,
            }]);
        }
    };


    const handleFieldUpdate = (airtableFieldId, updates) => {
        setSelectedFields(selectedFields.map(f => f.airtableFieldId === airtableFieldId ? { ...f, ...updates } : f));
    };

    const handleNext = () => {
        if (activeStep === 0 && !selectedBase) {
            setError("Please select a base");
            return;
        }
        if (activeStep === 1 && !selectedTable) {
            setError("Please select a table");
            return;
        }
        if (activeStep === 2 && selectedFields.length === 0) {
            setError("Please select at least one field");
            return;
        }
        if (activeStep === 3 && !formName.trim()) {
            setError("Please enter a form name");
            return;
        }
        setError(null);
        setActiveStep(prev => prev + 1);
    };
    const handleBack = () => {
        setError(null);
        setActiveStep(prev => prev - 1);
    };

    const handleSave = async () => {
        try {
            setLoading(true);
            setError(null);
            const formData = {
                formName: formName.trim(),
                baseId: selectedBase,
                tableId: selectedTable,
                questions: selectedFields,
            };
            const response = await formAPI.createForm(formData);
            navigate(`/dashboard`);

        } catch (error) {
            setError(error.response?.data?.error || "Failed to create form");
            console.error(error);

        } finally {
            setLoading(false);
        }

    };


    const renderStepContent = () => {

        switch (activeStep) {

            // case 0: select base;
            case 0:
                return (
                    <Box sx={{ mt: 2 }}>
                        <Typography variant="h6" gutterBottom>Select AirtableBase</Typography>
                        {
                            loading ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                                    <CircularProgress />
                                </Box>
                            ) : (
                                <FormControl fullWidth>
                                    <InputLabel id="base-select-label">Select Base</InputLabel>
                                    <Select labelId="base-select-label" id="base-select"
                                        value={selectedBase}
                                        onChange={(e) => handleBaseSelection(e.target.value)}>
                                        {
                                            bases.map((base) => (
                                                <MenuItem key={base.id} value={base.id}>{base.name}</MenuItem>
                                            ))
                                        }
                                    </Select>
                                </FormControl>
                            )
                        }


                    </Box>
                );
            //select table;
            case 1:
                return (
                    <Box sx={{ mt: 2 }}>
                        <Typography variant="h6" gutterBottom>Select Table</Typography>
                        {
                            loading ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                                    <CircularProgress />
                                </Box>
                            ) : (
                                <FormControl fullWidth>
                                    <InputLabel id="table-select-label">Select Table</InputLabel>
                                    <Select labelId="table-select-label" id="table-select"
                                        value={selectedTable}
                                        onChange={(e) => handleTableSelection(e.target.value)}>
                                        {
                                            tables.map((table) => (
                                                <MenuItem key={table.id} value={table.id}>{table.name}</MenuItem>
                                            ))
                                        }
                                    </Select>
                                </FormControl>
                            )
                        }
                    </Box>
                )
            //configure fields;
            case 2:
                return (
                    <Box sx={{ mt: 2 }}>
                        <Typography variant="h6" gutterBottom>Configure Fields</Typography>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                            Select the fields you want to include in your form.
                        </Typography>
                        {
                            loading ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                                    <CircularProgress />
                                </Box>
                            ) : (
                                <List>
                                    {fields.map((field) => {
                                        const isSelected = selectedFields.find(f => f.airtableFieldId === field.id);
                                        return (
                                            <ListItem key={field.id} sx={{ cursor: 'pointer', '&:hover': { backgroundColor: '#f0f0f0' } }} onClick={() => handleFieldSelection(field)}>
                                                <FormControlLabel control={<Checkbox checked={isSelected} onChange={() => handleFieldSelection(field)} />} label={field.name} />
                                                <Typography variant="body2" color="text.secondary">{field.type}</Typography>
                                            </ListItem>
                                        )
                                    })}
                                </List>
                            )}
                        {
                            selectedFields.length > 0 && (
                                <Box sx={{ mt: 4 }}>
                                    <Typography variant="h6" gutterBottom>Configure Selected Fields</Typography>
                                    {
                                        selectedFields.map((field) => (
                                            <Paper key={field.airtableFieldId} sx={{ p: 2, mb: 2, border: '1px solid #e0e0e0' }}>
                                                <TextField label="Question Label" value={field.label} onChange={(e) => handleFieldUpdate(field.airtableFieldId, { label: e.target.value })}
                                                    fullWidth sx={{ mb: 2 }} />
                                                <FormControlLabel
                                                    control={<Checkbox checked={field.required} onChange={(e) => handleFieldUpdate(field.airtableFieldId, { required: e.target.checked })} />}
                                                    label="Required"
                                                />
                                                <Typography variant="caption" display='block' color='text.secondary' sx={{ mb: 1 }}>Question Key :{field.questionKey}</Typography>
                                            </Paper>
                                        ))}
                                </Box>
                            )
                        }
                    </Box>
                );

            //review and save;
            case 3:
                return (
                    <Box sx={{ mt: 2 }}>
                        <Typography variant="h6" gutterBottom>Review Form Details</Typography>
                        <TextField
                            label="Form Name"
                            value={formName}
                            onChange={(e) => setFormName(e.target.value)}
                            fullWidth
                            sx={{ mb: 2 }}
                            required
                        />
                        <Paper sx={{ p: 2, mb: 2 }}>
                            <Typography variant='subtitle2'>Base:</Typography>
                            <Typography>{bases.find(b => b.id === selectedBase)?.name || selectedBase}</Typography>
                        </Paper>
                        <Paper sx={{ p: 2, mb: 2 }}>
                            <Typography variant='subtitle2'>Table:</Typography>
                            <Typography>{tables.find(t => t.id === selectedTable)?.name || selectedTable}</Typography>
                        </Paper>
                        <Paper sx={{ p: 2, mb: 2 }}>
                            <Typography variant='subtitle2'>Selected Fields({selectedFields.length}):</Typography>
                            {
                                selectedFields.map((field) => (
                                    <Typography key={field.airtableFieldId}>
                                        {field.label} - {field.type} - {field.required && '*'}</Typography>
                                ))
                            }
                        </Paper>
                    </Box>
                );
            default:
                return null;
        }
    }

    return (
        <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
            <Typography variant="h4" component='h1'>Create New Form</Typography>
            <Stepper activeStep={activeStep} sx={{ mb: 4, mt: 4 }}>
                {steps.map((label) => (
                    <Step key={label}>
                        <StepLabel>{label}</StepLabel>
                    </Step>
                ))}
            </Stepper>
            <Paper sx={{ p: 3 }}>
                {
                    error && (<Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>)
                }
                {
                    renderStepContent()
                }
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
                    <Button variant="outlined" onClick={handleBack} disabled={activeStep === 0}>Back</Button>
                    <Button variant="contained" disabled={loading} onClick={activeStep === steps.length - 1 ? handleSave : handleNext}>
                        {loading ? <CircularProgress size={20} sx={{ mr: 1 }} /> : activeStep === steps.length - 1 ? 'Save Form' : 'Next'}
                    </Button>
                </Box>

            </Paper>
        </Container>
    )
}