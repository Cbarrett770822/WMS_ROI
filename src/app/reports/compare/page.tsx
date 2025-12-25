'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Box,
  Container,
  Typography,
  Paper,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  CircularProgress,
  Tabs,
  Tab,
  Divider,
  Chip
} from '@mui/material';
import { ArrowBack, CompareArrows } from '@mui/icons-material';

// Types
interface ReportOption {
  id: string;
  title: string;
  updatedAt: string;
  company: {
    id: string;
    name: string;
  };
  warehouse: {
    id: string;
    name: string;
  };
}

interface VersionOption {
  id: string;
  description: string;
  createdAt: string;
  createdBy: {
    id: string;
    name: string;
  };
}

interface ComparisonResult {
  sectionId: string;
  sectionTitle: string;
  changes: {
    type: 'added' | 'removed' | 'modified' | 'unchanged';
    field: string;
    sourceValue?: any;
    targetValue?: any;
    diffDetails?: {
      added?: string[];
      removed?: string[];
      modified?: {
        field: string;
        sourceValue: any;
        targetValue: any;
      }[];
    };
  }[];
}

// Comparison display component
const ComparisonDisplay = ({ comparison }: { comparison: ComparisonResult[] }) => {
  const [activeSection, setActiveSection] = useState<string | null>(
    comparison.length > 0 ? comparison[0].sectionId : null
  );
  
  if (comparison.length === 0) {
    return (
      <Paper elevation={1} sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6">No differences found</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          The selected reports or versions are identical.
        </Typography>
      </Paper>
    );
  }
  
  const currentSection = comparison.find(section => section.sectionId === activeSection);
  
  return (
    <Box sx={{ display: 'flex', gap: 3 }}>
      {/* Section navigation */}
      <Paper elevation={1} sx={{ p: 2, width: 240, flexShrink: 0 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Sections</Typography>
        <Box component="nav">
          {comparison.map((section) => (
            <Box 
              key={section.sectionId} 
              onClick={() => setActiveSection(section.sectionId)}
              sx={{ 
                p: 1, 
                cursor: 'pointer',
                bgcolor: activeSection === section.sectionId ? 'action.selected' : 'transparent',
                borderRadius: 1,
                mb: 0.5,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                '&:hover': {
                  bgcolor: 'action.hover',
                }
              }}
            >
              <Typography variant="body2">
                {section.sectionTitle}
              </Typography>
              <Chip 
                label={section.changes.length} 
                size="small" 
                color={activeSection === section.sectionId ? "primary" : "default"}
              />
            </Box>
          ))}
        </Box>
      </Paper>
      
      {/* Changes display */}
      <Box sx={{ flexGrow: 1 }}>
        {currentSection ? (
          <Paper elevation={1} sx={{ p: 3 }}>
            <Typography variant="h5" sx={{ mb: 3 }}>{currentSection.sectionTitle}</Typography>
            
            {currentSection.changes.length === 0 ? (
              <Typography variant="body1">No changes in this section</Typography>
            ) : (
              currentSection.changes.map((change, index) => (
                <Box key={index} sx={{ mb: 3, pb: 3, borderBottom: index < currentSection.changes.length - 1 ? '1px solid #eee' : 'none' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Chip 
                      label={change.type} 
                      size="small" 
                      color={
                        change.type === 'added' ? 'success' :
                        change.type === 'removed' ? 'error' :
                        change.type === 'modified' ? 'warning' : 'default'
                      }
                      sx={{ mr: 1 }}
                    />
                    <Typography variant="subtitle1">{change.field}</Typography>
                  </Box>
                  
                  {change.type === 'modified' && (
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Paper elevation={0} sx={{ p: 2, bgcolor: '#ffebee', borderRadius: 1 }}>
                          <Typography variant="caption" color="text.secondary">Source</Typography>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                            {typeof change.sourceValue === 'object' 
                              ? JSON.stringify(change.sourceValue, null, 2) 
                              : change.sourceValue}
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={6}>
                        <Paper elevation={0} sx={{ p: 2, bgcolor: '#e8f5e9', borderRadius: 1 }}>
                          <Typography variant="caption" color="text.secondary">Target</Typography>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                            {typeof change.targetValue === 'object' 
                              ? JSON.stringify(change.targetValue, null, 2) 
                              : change.targetValue}
                          </Typography>
                        </Paper>
                      </Grid>
                    </Grid>
                  )}
                  
                  {change.type === 'added' && (
                    <Paper elevation={0} sx={{ p: 2, bgcolor: '#e8f5e9', borderRadius: 1 }}>
                      <Typography variant="caption" color="text.secondary">Added</Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {typeof change.targetValue === 'object' 
                          ? JSON.stringify(change.targetValue, null, 2) 
                          : change.targetValue}
                      </Typography>
                    </Paper>
                  )}
                  
                  {change.type === 'removed' && (
                    <Paper elevation={0} sx={{ p: 2, bgcolor: '#ffebee', borderRadius: 1 }}>
                      <Typography variant="caption" color="text.secondary">Removed</Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {typeof change.sourceValue === 'object' 
                          ? JSON.stringify(change.sourceValue, null, 2) 
                          : change.sourceValue}
                      </Typography>
                    </Paper>
                  )}
                  
                  {change.diffDetails && change.diffDetails.modified && change.diffDetails.modified.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>Detailed Changes</Typography>
                      {change.diffDetails.modified.map((detail, detailIndex) => (
                        <Box key={detailIndex} sx={{ mb: 1 }}>
                          <Typography variant="caption" color="text.secondary">{detail.field}</Typography>
                          <Grid container spacing={2}>
                            <Grid item xs={6}>
                              <Paper elevation={0} sx={{ p: 1, bgcolor: '#ffebee', borderRadius: 1 }}>
                                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                                  {typeof detail.sourceValue === 'object' 
                                    ? JSON.stringify(detail.sourceValue, null, 2) 
                                    : detail.sourceValue}
                                </Typography>
                              </Paper>
                            </Grid>
                            <Grid item xs={6}>
                              <Paper elevation={0} sx={{ p: 1, bgcolor: '#e8f5e9', borderRadius: 1 }}>
                                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                                  {typeof detail.targetValue === 'object' 
                                    ? JSON.stringify(detail.targetValue, null, 2) 
                                    : detail.targetValue}
                                </Typography>
                              </Paper>
                            </Grid>
                          </Grid>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              ))
            )}
          </Paper>
        ) : (
          <Typography variant="body1">Select a section to view changes</Typography>
        )}
      </Box>
    </Box>
  );
};

// Main component
const ReportComparePage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [loading, setLoading] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [reports, setReports] = useState<ReportOption[]>([]);
  const [sourceReport, setSourceReport] = useState<string>('');
  const [targetReport, setTargetReport] = useState<string>('');
  const [sourceVersions, setSourceVersions] = useState<VersionOption[]>([]);
  const [targetVersions, setTargetVersions] = useState<VersionOption[]>([]);
  const [sourceVersion, setSourceVersion] = useState<string>('current');
  const [targetVersion, setTargetVersion] = useState<string>('current');
  const [comparisonMode, setComparisonMode] = useState<'reports' | 'versions'>('reports');
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult[]>([]);
  
  // Load reports on initial render
  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/reports');
        
        if (!response.ok) {
          throw new Error('Failed to fetch reports');
        }
        
        const data = await response.json();
        setReports(data);
        
        // Check if reportId is in URL params
        const reportId = searchParams.get('reportId');
        if (reportId) {
          setSourceReport(reportId);
          setComparisonMode('versions');
          fetchVersions(reportId);
        }
      } catch (error) {
        console.error('Error fetching reports:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchReports();
  }, [searchParams]);
  
  // Fetch versions when source report changes
  const fetchVersions = async (reportId: string) => {
    try {
      const response = await fetch(`/api/reports/${reportId}/versions`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch versions');
      }
      
      const data = await response.json();
      setSourceVersions(data);
    } catch (error) {
      console.error('Error fetching versions:', error);
    }
  };
  
  // Fetch target versions when target report changes
  useEffect(() => {
    if (comparisonMode === 'reports' && targetReport) {
      const fetchTargetVersions = async () => {
        try {
          const response = await fetch(`/api/reports/${targetReport}/versions`);
          
          if (!response.ok) {
            throw new Error('Failed to fetch target versions');
          }
          
          const data = await response.json();
          setTargetVersions(data);
        } catch (error) {
          console.error('Error fetching target versions:', error);
        }
      };
      
      fetchTargetVersions();
    }
  }, [targetReport, comparisonMode]);
  
  // Handle source report change
  const handleSourceReportChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    const value = event.target.value as string;
    setSourceReport(value);
    setSourceVersion('current');
    fetchVersions(value);
  };
  
  // Handle target report change
  const handleTargetReportChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    const value = event.target.value as string;
    setTargetReport(value);
    setTargetVersion('current');
  };
  
  // Handle source version change
  const handleSourceVersionChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setSourceVersion(event.target.value as string);
  };
  
  // Handle target version change
  const handleTargetVersionChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setTargetVersion(event.target.value as string);
  };
  
  // Handle comparison mode change
  const handleModeChange = (event: React.SyntheticEvent, newValue: 'reports' | 'versions') => {
    setComparisonMode(newValue);
    setComparisonResult([]);
  };
  
  // Compare reports or versions
  const handleCompare = async () => {
    try {
      setComparing(true);
      
      let endpoint = '/api/reports/compare';
      let body;
      
      if (comparisonMode === 'reports') {
        body = {
          sourceReportId: sourceReport,
          targetReportId: targetReport,
          sourceVersionId: sourceVersion !== 'current' ? sourceVersion : undefined,
          targetVersionId: targetVersion !== 'current' ? targetVersion : undefined,
        };
      } else {
        body = {
          sourceReportId: sourceReport,
          sourceVersionId: sourceVersion !== 'current' ? sourceVersion : undefined,
          targetVersionId: targetVersion,
        };
      }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      
      if (!response.ok) {
        throw new Error('Failed to compare reports');
      }
      
      const data = await response.json();
      setComparisonResult(data);
    } catch (error) {
      console.error('Error comparing reports:', error);
    } finally {
      setComparing(false);
    }
  };
  
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
        <Button 
          startIcon={<ArrowBack />} 
          onClick={() => router.push('/reports')}
          sx={{ mr: 2 }}
        >
          Back to Reports
        </Button>
        <Typography variant="h4">Compare Reports</Typography>
      </Box>
      
      <Paper elevation={1} sx={{ p: 3, mb: 4 }}>
        <Tabs 
          value={comparisonMode} 
          onChange={handleModeChange}
          sx={{ mb: 3 }}
        >
          <Tab value="reports" label="Compare Two Reports" />
          <Tab value="versions" label="Compare Report Versions" />
        </Tabs>
        
        {comparisonMode === 'reports' ? (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>Source Report</Typography>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel id="source-report-label">Select Report</InputLabel>
                <Select
                  labelId="source-report-label"
                  value={sourceReport}
                  onChange={handleSourceReportChange}
                  label="Select Report"
                >
                  {reports.map((report) => (
                    <MenuItem key={report.id} value={report.id}>
                      {report.title} ({report.company.name})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              {sourceReport && (
                <FormControl fullWidth>
                  <InputLabel id="source-version-label">Select Version</InputLabel>
                  <Select
                    labelId="source-version-label"
                    value={sourceVersion}
                    onChange={handleSourceVersionChange}
                    label="Select Version"
                  >
                    <MenuItem value="current">Current Version</MenuItem>
                    {sourceVersions.map((version) => (
                      <MenuItem key={version.id} value={version.id}>
                        {version.description || `Version from ${new Date(version.createdAt).toLocaleDateString()}`}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>Target Report</Typography>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel id="target-report-label">Select Report</InputLabel>
                <Select
                  labelId="target-report-label"
                  value={targetReport}
                  onChange={handleTargetReportChange}
                  label="Select Report"
                >
                  {reports.map((report) => (
                    <MenuItem key={report.id} value={report.id}>
                      {report.title} ({report.company.name})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              {targetReport && (
                <FormControl fullWidth>
                  <InputLabel id="target-version-label">Select Version</InputLabel>
                  <Select
                    labelId="target-version-label"
                    value={targetVersion}
                    onChange={handleTargetVersionChange}
                    label="Select Version"
                  >
                    <MenuItem value="current">Current Version</MenuItem>
                    {targetVersions.map((version) => (
                      <MenuItem key={version.id} value={version.id}>
                        {version.description || `Version from ${new Date(version.createdAt).toLocaleDateString()}`}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Grid>
          </Grid>
        ) : (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>Report</Typography>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel id="source-report-label">Select Report</InputLabel>
                <Select
                  labelId="source-report-label"
                  value={sourceReport}
                  onChange={handleSourceReportChange}
                  label="Select Report"
                >
                  {reports.map((report) => (
                    <MenuItem key={report.id} value={report.id}>
                      {report.title} ({report.company.name})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>Compare Versions</Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <FormControl fullWidth>
                    <InputLabel id="source-version-label">Source Version</InputLabel>
                    <Select
                      labelId="source-version-label"
                      value={sourceVersion}
                      onChange={handleSourceVersionChange}
                      label="Source Version"
                    >
                      <MenuItem value="current">Current Version</MenuItem>
                      {sourceVersions.map((version) => (
                        <MenuItem key={version.id} value={version.id}>
                          {version.description || `Version from ${new Date(version.createdAt).toLocaleDateString()}`}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6}>
                  <FormControl fullWidth>
                    <InputLabel id="target-version-label">Target Version</InputLabel>
                    <Select
                      labelId="target-version-label"
                      value={targetVersion}
                      onChange={handleTargetVersionChange}
                      label="Target Version"
                      disabled={sourceVersions.length === 0}
                    >
                      {sourceVersion !== 'current' && <MenuItem value="current">Current Version</MenuItem>}
                      {sourceVersions
                        .filter(v => v.id !== sourceVersion)
                        .map((version) => (
                          <MenuItem key={version.id} value={version.id}>
                            {version.description || `Version from ${new Date(version.createdAt).toLocaleDateString()}`}
                          </MenuItem>
                        ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        )}
        
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Button
            variant="contained"
            startIcon={<CompareArrows />}
            onClick={handleCompare}
            disabled={
              comparing || 
              !sourceReport || 
              (comparisonMode === 'reports' && !targetReport) ||
              (comparisonMode === 'versions' && !targetVersion)
            }
            size="large"
          >
            {comparing ? <CircularProgress size={24} /> : 'Compare'}
          </Button>
        </Box>
      </Paper>
      
      {/* Comparison results */}
      {comparisonResult.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" sx={{ mb: 3 }}>Comparison Results</Typography>
          <ComparisonDisplay comparison={comparisonResult} />
        </Box>
      )}
    </Container>
  );
};

export default ReportComparePage;
