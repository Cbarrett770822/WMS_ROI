import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Button,
  Divider,
  Chip,
  Breadcrumbs,
  Link,
  IconButton,
  Tooltip,
  Card,
  CardContent
} from '@mui/material';
import {
  ArrowBack,
  RestoreOutlined,
  CompareArrowsOutlined,
  InfoOutlined,
  HistoryOutlined
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import apiClient from '@/utils/apiClient';

interface ReportVersion {
  id: string;
  reportId: string;
  versionNumber: number;
  description: string;
  createdAt: string;
  createdBy: {
    id: string;
    name: string;
  };
  isCurrentVersion: boolean;
  content: any; // Report content
}

interface ReportSection {
  id: string;
  title: string;
  content: string;
  charts?: any[];
  tables?: any[];
}

interface VersionPreviewProps {
  reportId: string;
  versionId: string;
  currentUserId: string;
  isAdmin: boolean;
  onVersionRestored?: () => void;
  onBack?: () => void;
}

const VersionPreview: React.FC<VersionPreviewProps> = ({
  reportId,
  versionId,
  currentUserId,
  isAdmin,
  onVersionRestored,
  onBack
}) => {
  // State
  const [version, setVersion] = useState<ReportVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  
  const router = useRouter();

  // Fetch version on component mount
  useEffect(() => {
    fetchVersion();
  }, [reportId, versionId]);

  // Fetch version details
  const fetchVersion = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.get<ReportVersion>(`/api/reports/versions/${versionId}`);
      setVersion(response);
    } catch (err) {
      console.error('Error fetching version details:', err);
      setError('Failed to load version details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle restore version
  const handleRestoreVersion = async () => {
    if (!version) return;
    
    setRestoring(true);
    try {
      await apiClient.post('/api/reports/versions/restore', {
        reportId,
        versionId: version.id,
        createBackup: true
      });
      
      // Notify parent component
      if (onVersionRestored) {
        onVersionRestored();
      }
      
      // Navigate back to report view
      router.push(`/reports/${reportId}`);
    } catch (err) {
      console.error('Error restoring version:', err);
      setError('Failed to restore version. Please try again.');
      setRestoring(false);
    }
  };

  // Handle compare
  const handleCompare = () => {
    router.push(`/reports/compare?reportId=${reportId}&versionId=${versionId}`);
  };

  // Handle back
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.push(`/reports/${reportId}`);
    }
  };

  // Render chart component placeholder
  const renderChart = (chartData: any) => {
    return (
      <Paper elevation={1} sx={{ p: 2, my: 2 }}>
        <Typography variant="h6">{chartData.title}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {chartData.description}
        </Typography>
        <Box sx={{ height: 300, bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Chart visualization will be rendered here based on type: {chartData.type}
          </Typography>
        </Box>
      </Paper>
    );
  };

  // Render table component placeholder
  const renderTable = (tableData: any) => {
    return (
      <Paper elevation={1} sx={{ p: 2, my: 2, overflowX: 'auto' }}>
        <Typography variant="h6">{tableData.title}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {tableData.description}
        </Typography>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {tableData.headers.map((header: string, index: number) => (
                <th key={index} style={{ border: '1px solid #ddd', padding: 8, backgroundColor: '#f2f2f2' }}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableData.rows.map((row: any[], rowIndex: number) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} style={{ border: '1px solid #ddd', padding: 8 }}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Paper>
    );
  };

  // Render loading state
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" p={3}>
        <CircularProgress size={40} />
      </Box>
    );
  }

  // Render error state
  if (error) {
    return (
      <Box p={2}>
        <Alert severity="error">{error}</Alert>
        <Button 
          variant="outlined" 
          sx={{ mt: 2 }} 
          onClick={fetchVersion}
        >
          Retry
        </Button>
      </Box>
    );
  }

  // Render empty state
  if (!version) {
    return (
      <Box p={3} textAlign="center">
        <Alert severity="warning">Version not found.</Alert>
        <Button 
          variant="outlined" 
          sx={{ mt: 2 }} 
          onClick={handleBack}
          startIcon={<ArrowBack />}
        >
          Back to Report
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Breadcrumbs aria-label="breadcrumb">
          <Link 
            component="button"
            underline="hover"
            color="inherit"
            onClick={handleBack}
            sx={{ display: 'flex', alignItems: 'center' }}
          >
            <ArrowBack sx={{ mr: 0.5 }} fontSize="small" />
            Back to Report
          </Link>
          <Typography color="text.primary">Version {version.versionNumber}</Typography>
        </Breadcrumbs>
        
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h5">
            Version {version.versionNumber}
            {version.isCurrentVersion && (
              <Chip 
                label="Current" 
                color="success" 
                size="small" 
                sx={{ ml: 1 }} 
              />
            )}
          </Typography>
          
          <Box>
            <Tooltip title="Compare with Current">
              <IconButton 
                onClick={handleCompare}
                disabled={version.isCurrentVersion}
                color="primary"
              >
                <CompareArrowsOutlined />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="View Version History">
              <IconButton 
                onClick={() => router.push(`/reports/${reportId}/versions`)}
                color="primary"
              >
                <HistoryOutlined />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Restore this Version">
              <span>
                <IconButton 
                  onClick={handleRestoreVersion}
                  disabled={
                    version.isCurrentVersion || 
                    restoring || 
                    (!isAdmin && version.createdBy.id !== currentUserId)
                  }
                  color="warning"
                >
                  <RestoreOutlined />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>
      </Box>
      
      {/* Version Metadata */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            Version Information
          </Typography>
          
          <Box sx={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">Created:</Typography>
            <Typography variant="body2">
              {format(new Date(version.createdAt), 'PPpp')}
            </Typography>
            
            <Typography variant="body2" color="text.secondary">Created By:</Typography>
            <Typography variant="body2">{version.createdBy.name}</Typography>
            
            <Typography variant="body2" color="text.secondary">Description:</Typography>
            <Typography variant="body2">
              {version.description || <em>No description</em>}
            </Typography>
          </Box>
        </CardContent>
      </Card>
      
      {/* Report Content */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Report Content
        </Typography>
        
        {version.content && version.content.sections && version.content.sections.map((section: ReportSection, index: number) => (
          <Paper key={section.id || index} variant="outlined" sx={{ mb: 3, p: 3 }}>
            <Typography variant="h6" gutterBottom>
              {section.title}
            </Typography>
            
            <Divider sx={{ my: 2 }} />
            
            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
              {section.content}
            </Typography>
            
            {/* Charts */}
            {section.charts && section.charts.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Charts
                </Typography>
                {section.charts.map((chart, chartIndex) => (
                  <Box key={chart.id || chartIndex}>
                    {renderChart(chart)}
                  </Box>
                ))}
              </Box>
            )}
            
            {/* Tables */}
            {section.tables && section.tables.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Tables
                </Typography>
                {section.tables.map((table, tableIndex) => (
                  <Box key={table.id || tableIndex}>
                    {renderTable(table)}
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
        ))}
        
        {(!version.content || !version.content.sections || version.content.sections.length === 0) && (
          <Alert severity="info">
            This version does not contain any content sections.
          </Alert>
        )}
      </Box>
      
      {/* Footer Actions */}
      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between' }}>
        <Button 
          variant="outlined" 
          startIcon={<ArrowBack />}
          onClick={handleBack}
        >
          Back to Report
        </Button>
        
        {!version.isCurrentVersion && (
          <Button 
            variant="contained" 
            color="warning"
            startIcon={<RestoreOutlined />}
            onClick={handleRestoreVersion}
            disabled={restoring || (!isAdmin && version.createdBy.id !== currentUserId)}
          >
            {restoring ? 'Restoring...' : 'Restore this Version'}
          </Button>
        )}
      </Box>
    </Box>
  );
};

export default VersionPreview;
