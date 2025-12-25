'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Container,
  Typography,
  Paper,
  Button,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  IconButton,
  Pagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Tooltip,
  Divider
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  FilterList as FilterListIcon,
  Sort as SortIcon,
  MoreVert as MoreVertIcon,
  Download as DownloadIcon,
  Share as ShareIcon,
  Delete as DeleteIcon,
  FileCopy as CloneIcon
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';

// Types
interface Report {
  id: string;
  title: string;
  description?: string;
  company: {
    id: string;
    name: string;
  };
  warehouse: {
    id: string;
    name: string;
  };
  status: string;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    name: string;
  };
  type: string;
  sections: { id: string; title: string }[];
}

// Status chip component
const StatusChip = ({ status }: { status: string }) => {
  let color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' = 'default';
  
  switch (status.toLowerCase()) {
    case 'draft':
      color = 'default';
      break;
    case 'published':
      color = 'success';
      break;
    case 'archived':
      color = 'secondary';
      break;
    case 'in-review':
      color = 'info';
      break;
    case 'pending':
      color = 'warning';
      break;
    default:
      color = 'default';
  }
  
  return <Chip label={status} color={color} size="small" />;
};

// Report card component
const ReportCard = ({ report, onSelect, onMenuOpen }: { 
  report: Report, 
  onSelect: (id: string) => void,
  onMenuOpen: (event: React.MouseEvent<HTMLElement>, report: Report) => void
}) => {
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Typography variant="h6" component="div" sx={{ 
            cursor: 'pointer',
            '&:hover': { color: 'primary.main' },
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical'
          }} onClick={() => onSelect(report.id)}>
            {report.title}
          </Typography>
          <IconButton size="small" onClick={(e) => onMenuOpen(e, report)}>
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Box>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {report.description?.substring(0, 100) || 'No description provided'}
          {report.description && report.description.length > 100 ? '...' : ''}
        </Typography>
        
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          <Chip 
            label={report.company.name} 
            size="small" 
            variant="outlined" 
            sx={{ maxWidth: '100%', overflow: 'hidden' }}
          />
          <Chip 
            label={report.warehouse.name} 
            size="small" 
            variant="outlined" 
            sx={{ maxWidth: '100%', overflow: 'hidden' }}
          />
          <StatusChip status={report.status} />
        </Box>
        
        <Typography variant="caption" color="text.secondary" display="block">
          Created {formatDistanceToNow(new Date(report.createdAt), { addSuffix: true })}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          Updated {formatDistanceToNow(new Date(report.updatedAt), { addSuffix: true })}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          By {report.createdBy.name}
        </Typography>
      </CardContent>
      <CardActions>
        <Button size="small" onClick={() => onSelect(report.id)}>View Report</Button>
      </CardActions>
    </Card>
  );
};

// Generate Report Dialog
const GenerateReportDialog = ({ open, onClose }: { open: boolean, onClose: () => void }) => {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [selectedAssessment, setSelectedAssessment] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [reportTitle, setReportTitle] = useState('');
  const [assessments, setAssessments] = useState<{ id: string, name: string }[]>([]);
  const [templates, setTemplates] = useState<{ id: string, name: string }[]>([]);
  const router = useRouter();
  
  // Fetch assessments and templates
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch completed assessments
        const assessmentsResponse = await fetch('/api/assessments?status=completed');
        if (assessmentsResponse.ok) {
          const assessmentsData = await assessmentsResponse.json();
          setAssessments(assessmentsData.map((a: any) => ({ id: a.id, name: a.name })));
        }
        
        // Fetch report templates
        const templatesResponse = await fetch('/api/report-templates?active=true');
        if (templatesResponse.ok) {
          const templatesData = await templatesResponse.json();
          setTemplates(templatesData.map((t: any) => ({ id: t.id, name: t.name })));
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    
    if (open) {
      fetchData();
    }
  }, [open]);
  
  const handleGenerateReport = async () => {
    try {
      setLoading(true);
      
      // Call API to generate report
      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assessmentId: selectedAssessment,
          templateId: selectedTemplate,
          title: reportTitle,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate report');
      }
      
      const data = await response.json();
      
      // Navigate to the new report
      router.push(`/reports/${data.id}`);
      onClose();
    } catch (error) {
      console.error('Error generating report:', error);
      // Handle error
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Generate New Report</DialogTitle>
      <DialogContent>
        {step === 1 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1" gutterBottom>Step 1: Select Assessment</Typography>
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel id="assessment-select-label">Assessment</InputLabel>
              <Select
                labelId="assessment-select-label"
                value={selectedAssessment}
                label="Assessment"
                onChange={(e) => setSelectedAssessment(e.target.value)}
              >
                {assessments.map((assessment) => (
                  <MenuItem key={assessment.id} value={assessment.id}>{assessment.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <Typography variant="subtitle1" gutterBottom>Step 2: Select Report Template</Typography>
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel id="template-select-label">Report Template</InputLabel>
              <Select
                labelId="template-select-label"
                value={selectedTemplate}
                label="Report Template"
                onChange={(e) => setSelectedTemplate(e.target.value)}
              >
                {templates.map((template) => (
                  <MenuItem key={template.id} value={template.id}>{template.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <Typography variant="subtitle1" gutterBottom>Step 3: Report Details</Typography>
            <TextField
              fullWidth
              label="Report Title"
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              margin="normal"
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          variant="contained" 
          onClick={handleGenerateReport}
          disabled={!selectedAssessment || !selectedTemplate || !reportTitle || loading}
        >
          {loading ? <CircularProgress size={24} /> : 'Generate Report'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Bulk Actions Dialog
const BulkActionsDialog = ({ 
  open, 
  onClose, 
  selectedReports, 
  action 
}: { 
  open: boolean, 
  onClose: () => void, 
  selectedReports: string[],
  action: 'delete' | 'share' | 'archive' | null
}) => {
  const [loading, setLoading] = useState(false);
  
  const handleAction = async () => {
    if (!action) return;
    
    try {
      setLoading(true);
      
      // Call API to perform bulk action
      const response = await fetch('/api/reports/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportIds: selectedReports,
          action: action,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to ${action} reports`);
      }
      
      // Close dialog and refresh list
      onClose();
      window.location.reload();
    } catch (error) {
      console.error(`Error performing ${action} action:`, error);
      // Handle error
    } finally {
      setLoading(false);
    }
  };
  
  const getActionText = () => {
    switch (action) {
      case 'delete':
        return 'Delete';
      case 'share':
        return 'Share';
      case 'archive':
        return 'Archive';
      default:
        return 'Perform Action';
    }
  };
  
  const getConfirmationMessage = () => {
    switch (action) {
      case 'delete':
        return `Are you sure you want to delete ${selectedReports.length} report(s)? This action cannot be undone.`;
      case 'share':
        return `Share ${selectedReports.length} report(s) with other users.`;
      case 'archive':
        return `Archive ${selectedReports.length} report(s)? Archived reports can be restored later.`;
      default:
        return '';
    }
  };
  
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{getActionText()} Reports</DialogTitle>
      <DialogContent>
        <Typography variant="body1">{getConfirmationMessage()}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          variant="contained" 
          color={action === 'delete' ? 'error' : 'primary'}
          onClick={handleAction}
          disabled={loading}
        >
          {loading ? <CircularProgress size={24} /> : getActionText()}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Main Reports Page component
const ReportsPage = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<Report[]>([]);
  const [filteredReports, setFilteredReports] = useState<Report[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [sortBy, setSortBy] = useState('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedReports, setSelectedReports] = useState<string[]>([]);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [bulkAction, setBulkAction] = useState<'delete' | 'share' | 'archive' | null>(null);
  
  const reportsPerPage = 9;
  
  // Fetch reports
  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true);
        // API call to fetch reports
        const response = await fetch('/api/reports');
        
        if (!response.ok) {
          throw new Error('Failed to fetch reports');
        }
        
        const data = await response.json();
        setReports(data);
        setFilteredReports(data);
        setTotalPages(Math.ceil(data.length / reportsPerPage));
      } catch (error) {
        console.error('Error fetching reports:', error);
        // Handle error state
      } finally {
        setLoading(false);
      }
    };
    
    fetchReports();
  }, []);
  
  // Apply filters and sorting
  useEffect(() => {
    let filtered = [...reports];
    
    // Apply search term
    if (searchTerm) {
      filtered = filtered.filter(report => 
        report.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (report.description && report.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        report.company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.warehouse.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(report => report.type === typeFilter);
    }
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(report => report.status.toLowerCase() === statusFilter.toLowerCase());
    }
    
    // Apply date filter
    const now = new Date();
    if (dateFilter === 'today') {
      filtered = filtered.filter(report => {
        const reportDate = new Date(report.updatedAt);
        return reportDate.toDateString() === now.toDateString();
      });
    } else if (dateFilter === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      filtered = filtered.filter(report => {
        const reportDate = new Date(report.updatedAt);
        return reportDate >= weekAgo;
      });
    } else if (dateFilter === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      filtered = filtered.filter(report => {
        const reportDate = new Date(report.updatedAt);
        return reportDate >= monthAgo;
      });
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      let valueA, valueB;
      
      if (sortBy === 'title') {
        valueA = a.title.toLowerCase();
        valueB = b.title.toLowerCase();
      } else if (sortBy === 'company') {
        valueA = a.company.name.toLowerCase();
        valueB = b.company.name.toLowerCase();
      } else if (sortBy === 'createdAt') {
        valueA = new Date(a.createdAt).getTime();
        valueB = new Date(b.createdAt).getTime();
      } else {
        // Default: updatedAt
        valueA = new Date(a.updatedAt).getTime();
        valueB = new Date(b.updatedAt).getTime();
      }
      
      if (sortOrder === 'asc') {
        return valueA > valueB ? 1 : -1;
      } else {
        return valueA < valueB ? 1 : -1;
      }
    });
    
    setFilteredReports(filtered);
    setTotalPages(Math.ceil(filtered.length / reportsPerPage));
    setPage(1); // Reset to first page when filters change
  }, [reports, searchTerm, typeFilter, statusFilter, dateFilter, sortBy, sortOrder]);
  
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };
  
  const handleTypeFilterChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setTypeFilter(event.target.value as string);
  };
  
  const handleStatusFilterChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setStatusFilter(event.target.value as string);
  };
  
  const handleDateFilterChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setDateFilter(event.target.value as string);
  };
  
  const handleSortChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setSortBy(event.target.value as string);
  };
  
  const toggleSortOrder = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };
  
  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
  };
  
  const handleReportSelect = (id: string) => {
    router.push(`/reports/${id}`);
  };
  
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, report: Report) => {
    setMenuAnchorEl(event.currentTarget);
    setSelectedReport(report);
  };
  
  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedReport(null);
  };
  
  const handleDeleteReport = async () => {
    if (!selectedReport) return;
    
    try {
      const response = await fetch(`/api/reports/${selectedReport.id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete report');
      }
      
      // Remove from list and close menu
      setReports(reports.filter(r => r.id !== selectedReport.id));
      handleMenuClose();
    } catch (error) {
      console.error('Error deleting report:', error);
      // Handle error
    }
  };
  
  const handleCloneReport = async () => {
    if (!selectedReport) return;
    
    try {
      const response = await fetch('/api/reports/clone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportId: selectedReport.id,
          includeComments: true,
          includeVersions: false,
          newName: `${selectedReport.title} - Copy`,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to clone report');
      }
      
      const data = await response.json();
      
      // Navigate to the new cloned report
      router.push(`/reports/${data.id}`);
      handleMenuClose();
    } catch (error) {
      console.error('Error cloning report:', error);
      // Handle error
    }
  };
  
  const handleShareReport = () => {
    // Implementation will be added in future PR
    handleMenuClose();
  };
  
  const handleBulkAction = (action: 'delete' | 'share' | 'archive') => {
    setBulkAction(action);
    setShowBulkDialog(true);
  };
  
  const paginatedReports = filteredReports.slice(
    (page - 1) * reportsPerPage,
    page * reportsPerPage
  );
  
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4">Reports</Typography>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />}
          onClick={() => setShowGenerateDialog(true)}
        >
          Generate New Report
        </Button>
      </Box>
      
      {/* Filters */}
      <Paper elevation={1} sx={{ p: 2, mb: 4 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Search Reports"
              variant="outlined"
              value={searchTerm}
              onChange={handleSearchChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          
          <Grid item xs={12} md={8}>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <FormControl variant="outlined" size="small" sx={{ minWidth: 120 }}>
                <InputLabel id="type-filter-label">Type</InputLabel>
                <Select
                  labelId="type-filter-label"
                  value={typeFilter}
                  onChange={handleTypeFilterChange}
                  label="Type"
                >
                  <MenuItem value="all">All Types</MenuItem>
                  <MenuItem value="assessment">Assessment</MenuItem>
                  <MenuItem value="roi">ROI</MenuItem>
                  <MenuItem value="recommendation">Recommendation</MenuItem>
                  <MenuItem value="custom">Custom</MenuItem>
                </Select>
              </FormControl>
              
              <FormControl variant="outlined" size="small" sx={{ minWidth: 120 }}>
                <InputLabel id="status-filter-label">Status</InputLabel>
                <Select
                  labelId="status-filter-label"
                  value={statusFilter}
                  onChange={handleStatusFilterChange}
                  label="Status"
                >
                  <MenuItem value="all">All Statuses</MenuItem>
                  <MenuItem value="draft">Draft</MenuItem>
                  <MenuItem value="published">Published</MenuItem>
                  <MenuItem value="archived">Archived</MenuItem>
                  <MenuItem value="in-review">In Review</MenuItem>
                </Select>
              </FormControl>
              
              <FormControl variant="outlined" size="small" sx={{ minWidth: 120 }}>
                <InputLabel id="date-filter-label">Date</InputLabel>
                <Select
                  labelId="date-filter-label"
                  value={dateFilter}
                  onChange={handleDateFilterChange}
                  label="Date"
                >
                  <MenuItem value="all">All Time</MenuItem>
                  <MenuItem value="today">Today</MenuItem>
                  <MenuItem value="week">This Week</MenuItem>
                  <MenuItem value="month">This Month</MenuItem>
                </Select>
              </FormControl>
              
              <FormControl variant="outlined" size="small" sx={{ minWidth: 120 }}>
                <InputLabel id="sort-by-label">Sort By</InputLabel>
                <Select
                  labelId="sort-by-label"
                  value={sortBy}
                  onChange={handleSortChange}
                  label="Sort By"
                >
                  <MenuItem value="updatedAt">Last Updated</MenuItem>
                  <MenuItem value="createdAt">Created Date</MenuItem>
                  <MenuItem value="title">Title</MenuItem>
                  <MenuItem value="company">Company</MenuItem>
                </Select>
              </FormControl>
              
              <Tooltip title={`Sort ${sortOrder === 'asc' ? 'Ascending' : 'Descending'}`}>
                <IconButton onClick={toggleSortOrder}>
                  <SortIcon sx={{ transform: sortOrder === 'desc' ? 'rotate(180deg)' : 'none' }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Grid>
        </Grid>
      </Paper>
      
      {/* Results */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : filteredReports.length === 0 ? (
        <Paper elevation={1} sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6">No reports found</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Try adjusting your search or filters, or create a new report.
          </Typography>
          <Button 
            variant="contained" 
            startIcon={<AddIcon />} 
            sx={{ mt: 3 }}
            onClick={() => setShowGenerateDialog(true)}
          >
            Generate New Report
          </Button>
        </Paper>
      ) : (
        <>
          {/* Bulk actions */}
          {selectedReports.length > 0 && (
            <Paper elevation={1} sx={{ p: 2, mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body1">
                {selectedReports.length} report(s) selected
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button 
                  size="small" 
                  variant="outlined"
                  startIcon={<ShareIcon />}
                  onClick={() => handleBulkAction('share')}
                >
                  Share
                </Button>
                <Button 
                  size="small" 
                  variant="outlined"
                  onClick={() => handleBulkAction('archive')}
                >
                  Archive
                </Button>
                <Button 
                  size="small" 
                  variant="outlined" 
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={() => handleBulkAction('delete')}
                >
                  Delete
                </Button>
              </Box>
            </Paper>
          )}
          
          {/* Report grid */}
          <Grid container spacing={3}>
            {paginatedReports.map((report) => (
              <Grid item key={report.id} xs={12} sm={6} md={4}>
                <ReportCard 
                  report={report} 
                  onSelect={handleReportSelect}
                  onMenuOpen={handleMenuOpen}
                />
              </Grid>
            ))}
          </Grid>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Pagination 
                count={totalPages} 
                page={page} 
                onChange={handlePageChange} 
                color="primary" 
              />
            </Box>
          )}
        </>
      )}
      
      {/* Report menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => {
          handleMenuClose();
          if (selectedReport) {
            router.push(`/reports/${selectedReport.id}`);
          }
        }}>
          View Report
        </MenuItem>
        <MenuItem onClick={handleCloneReport}>
          <CloneIcon fontSize="small" sx={{ mr: 1 }} />
          Clone Report
        </MenuItem>
        <MenuItem onClick={handleShareReport}>
          <ShareIcon fontSize="small" sx={{ mr: 1 }} />
          Share Report
        </MenuItem>
        <MenuItem onClick={() => {
          handleMenuClose();
          if (selectedReport) {
            router.push(`/reports/${selectedReport.id}/edit`);
          }
        }}>
          Edit Report
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleDeleteReport} sx={{ color: 'error.main' }}>
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          Delete Report
        </MenuItem>
      </Menu>
      
      {/* Generate Report Dialog */}
      <GenerateReportDialog 
        open={showGenerateDialog} 
        onClose={() => setShowGenerateDialog(false)} 
      />
      
      {/* Bulk Actions Dialog */}
      <BulkActionsDialog 
        open={showBulkDialog} 
        onClose={() => setShowBulkDialog(false)}
        selectedReports={selectedReports}
        action={bulkAction}
      />
    </Container>
  );
};

export default ReportsPage;
