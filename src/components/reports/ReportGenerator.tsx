import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  TextField, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  FormHelperText,
  Grid,
  Typography,
  CircularProgress,
  Autocomplete,
  Chip,
  Box
} from '@mui/material';
import { AddCircle, Close } from '@mui/icons-material';
import apiClient from '@/utils/apiClient';

// Types
interface Company {
  id: string;
  name: string;
}

interface Warehouse {
  id: string;
  name: string;
  location: string;
}

interface Template {
  id: string;
  name: string;
  description: string;
  sections: string[];
}

interface Assessment {
  id: string;
  name: string;
  company: {
    id: string;
    name: string;
  };
  warehouse?: {
    id: string;
    name: string;
  };
  completedAt: string;
}

interface ReportGeneratorProps {
  open: boolean;
  onClose: () => void;
  onReportGenerated: (reportId: string) => void;
}

const ReportGenerator: React.FC<ReportGeneratorProps> = ({ open, onClose, onReportGenerated }) => {
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [selectedAssessment, setSelectedAssessment] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState<string>('');

  // Data state
  const [companies, setCompanies] = useState<Company[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load initial data
  useEffect(() => {
    if (open) {
      fetchInitialData();
    }
  }, [open]);

  // Load warehouses when company changes
  useEffect(() => {
    if (selectedCompany) {
      fetchWarehouses(selectedCompany);
      fetchAssessments(selectedCompany, selectedWarehouse);
    } else {
      setWarehouses([]);
      setSelectedWarehouse('');
      setAssessments([]);
      setSelectedAssessment('');
    }
  }, [selectedCompany]);

  // Load assessments when warehouse changes
  useEffect(() => {
    if (selectedCompany) {
      fetchAssessments(selectedCompany, selectedWarehouse);
    }
  }, [selectedWarehouse]);

  // Fetch companies, templates, and tags
  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // Fetch in parallel
      const [companiesRes, templatesRes, tagsRes] = await Promise.all([
        apiClient.get<Company[]>('/companies'),
        apiClient.get<Template[]>('/templates'),
        apiClient.get<string[]>('/reports/tags')
      ]);
      
      setCompanies(companiesRes);
      setTemplates(templatesRes);
      setAvailableTags(tagsRes);
    } catch (error) {
      console.error('Error fetching initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch warehouses for a company
  const fetchWarehouses = async (companyId: string) => {
    try {
      const data = await apiClient.get<Warehouse[]>(`/companies/${companyId}/warehouses`);
      setWarehouses(data);
    } catch (error) {
      console.error('Error fetching warehouses:', error);
      setWarehouses([]);
    }
  };

  // Fetch assessments for a company and optional warehouse
  const fetchAssessments = async (companyId: string, warehouseId?: string) => {
    try {
      let url = `/assessments?companyId=${companyId}`;
      if (warehouseId) {
        url += `&warehouseId=${warehouseId}`;
      }
      
      const data = await apiClient.get<Assessment[]>(url);
      setAssessments(data);
    } catch (error) {
      console.error('Error fetching assessments:', error);
      setAssessments([]);
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }
    
    if (!selectedCompany) {
      newErrors.company = 'Company is required';
    }
    
    if (!selectedTemplate) {
      newErrors.template = 'Template is required';
    }
    
    if (!selectedAssessment) {
      newErrors.assessment = 'Assessment is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }
    
    setGenerating(true);
    try {
      const payload = {
        title,
        description,
        companyId: selectedCompany,
        warehouseId: selectedWarehouse || undefined,
        templateId: selectedTemplate,
        assessmentId: selectedAssessment,
        tags: selectedTags
      };
      
      const response = await apiClient.post<{ reportId: string }>('/reports/generate', payload);
      
      onReportGenerated(response.reportId);
      handleReset();
      onClose();
    } catch (error) {
      console.error('Error generating report:', error);
      setErrors({ submit: 'Failed to generate report. Please try again.' });
    } finally {
      setGenerating(false);
    }
  };

  // Reset form
  const handleReset = () => {
    setTitle('');
    setDescription('');
    setSelectedCompany('');
    setSelectedWarehouse('');
    setSelectedTemplate('');
    setSelectedAssessment('');
    setSelectedTags([]);
    setNewTag('');
    setErrors({});
  };

  // Handle tag addition
  const handleAddTag = () => {
    if (newTag && !selectedTags.includes(newTag)) {
      setSelectedTags([...selectedTags, newTag]);
      setNewTag('');
    }
  };

  // Handle tag deletion
  const handleDeleteTag = (tagToDelete: string) => {
    setSelectedTags(selectedTags.filter(tag => tag !== tagToDelete));
  };

  // Handle dialog close
  const handleClose = () => {
    handleReset();
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="report-generator-dialog-title"
    >
      <DialogTitle id="report-generator-dialog-title">
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Generate New Report</Typography>
          <Button 
            onClick={handleClose}
            color="inherit"
            startIcon={<Close />}
          >
            Close
          </Button>
        </Box>
      </DialogTitle>
      
      <DialogContent dividers>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
            <CircularProgress />
          </Box>
        ) : (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                label="Report Title"
                fullWidth
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                error={!!errors.title}
                helperText={errors.title}
                disabled={generating}
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                label="Description"
                fullWidth
                multiline
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={generating}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth required error={!!errors.company} disabled={generating}>
                <InputLabel id="company-select-label">Company</InputLabel>
                <Select
                  labelId="company-select-label"
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  label="Company"
                >
                  {companies.map((company) => (
                    <MenuItem key={company.id} value={company.id}>
                      {company.name}
                    </MenuItem>
                  ))}
                </Select>
                {errors.company && <FormHelperText>{errors.company}</FormHelperText>}
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth disabled={!selectedCompany || generating}>
                <InputLabel id="warehouse-select-label">Warehouse (Optional)</InputLabel>
                <Select
                  labelId="warehouse-select-label"
                  value={selectedWarehouse}
                  onChange={(e) => setSelectedWarehouse(e.target.value)}
                  label="Warehouse (Optional)"
                >
                  <MenuItem value="">
                    <em>None (Company-wide)</em>
                  </MenuItem>
                  {warehouses.map((warehouse) => (
                    <MenuItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.name} - {warehouse.location}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth required error={!!errors.template} disabled={generating}>
                <InputLabel id="template-select-label">Report Template</InputLabel>
                <Select
                  labelId="template-select-label"
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  label="Report Template"
                >
                  {templates.map((template) => (
                    <MenuItem key={template.id} value={template.id}>
                      {template.name}
                    </MenuItem>
                  ))}
                </Select>
                {errors.template && <FormHelperText>{errors.template}</FormHelperText>}
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth required error={!!errors.assessment} disabled={generating || !selectedCompany}>
                <InputLabel id="assessment-select-label">Assessment Data</InputLabel>
                <Select
                  labelId="assessment-select-label"
                  value={selectedAssessment}
                  onChange={(e) => setSelectedAssessment(e.target.value)}
                  label="Assessment Data"
                >
                  {assessments.map((assessment) => (
                    <MenuItem key={assessment.id} value={assessment.id}>
                      {assessment.name} ({new Date(assessment.completedAt).toLocaleDateString()})
                    </MenuItem>
                  ))}
                </Select>
                {errors.assessment && <FormHelperText>{errors.assessment}</FormHelperText>}
                {assessments.length === 0 && selectedCompany && (
                  <FormHelperText>
                    No completed assessments found for this company
                    {selectedWarehouse ? ' and warehouse' : ''}
                  </FormHelperText>
                )}
              </FormControl>
            </Grid>
            
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                Tags
              </Typography>
              <Box display="flex" alignItems="center" mb={2}>
                <Autocomplete
                  freeSolo
                  options={availableTags.filter(tag => !selectedTags.includes(tag))}
                  value={newTag}
                  onChange={(_, value) => setNewTag(value || '')}
                  onInputChange={(_, value) => setNewTag(value)}
                  disabled={generating}
                  sx={{ flexGrow: 1, mr: 1 }}
                  renderInput={(params) => (
                    <TextField 
                      {...params} 
                      label="Add Tag" 
                      size="small"
                      variant="outlined"
                    />
                  )}
                />
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleAddTag}
                  disabled={!newTag || generating}
                  startIcon={<AddCircle />}
                >
                  Add
                </Button>
              </Box>
              <Box display="flex" flexWrap="wrap" gap={1}>
                {selectedTags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    onDelete={() => handleDeleteTag(tag)}
                    disabled={generating}
                  />
                ))}
              </Box>
            </Grid>
            
            {errors.submit && (
              <Grid item xs={12}>
                <Typography color="error">{errors.submit}</Typography>
              </Grid>
            )}
          </Grid>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button 
          onClick={handleClose} 
          disabled={generating}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit}
          variant="contained" 
          color="primary"
          disabled={loading || generating}
          startIcon={generating && <CircularProgress size={20} />}
        >
          {generating ? 'Generating...' : 'Generate Report'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ReportGenerator;
