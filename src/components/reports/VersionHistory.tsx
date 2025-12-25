import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Button,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Divider,
  Chip,
  Alert,
  Snackbar,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  RestoreOutlined,
  CompareArrowsOutlined,
  VisibilityOutlined,
  InfoOutlined,
  CheckCircleOutline,
  WarningAmberOutlined
} from '@mui/icons-material';
import { formatDistanceToNow, format } from 'date-fns';
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
}

interface VersionHistoryProps {
  reportId: string;
  currentUserId: string;
  isAdmin: boolean;
  onVersionRestored?: () => void;
}

const VersionHistory: React.FC<VersionHistoryProps> = ({ 
  reportId, 
  currentUserId,
  isAdmin,
  onVersionRestored 
}) => {
  // State
  const [versions, setVersions] = useState<ReportVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<ReportVersion | null>(null);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [createBackup, setCreateBackup] = useState(true);
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'info'
  });

  // Fetch versions on component mount
  useEffect(() => {
    fetchVersions();
  }, [reportId]);

  // Fetch all versions for the report
  const fetchVersions = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.get<ReportVersion[]>(`/api/reports/versions?reportId=${reportId}`);
      // Sort versions by version number in descending order
      const sortedVersions = response.sort((a, b) => b.versionNumber - a.versionNumber);
      setVersions(sortedVersions);
    } catch (err) {
      console.error('Error fetching report versions:', err);
      setError('Failed to load version history. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle restore version
  const handleRestoreVersion = async () => {
    if (!selectedVersion) return;
    
    setRestoring(true);
    try {
      await apiClient.post('/api/reports/versions/restore', {
        reportId,
        versionId: selectedVersion.id,
        createBackup
      });
      
      // Show success notification
      setNotification({
        open: true,
        message: `Report successfully restored to version ${selectedVersion.versionNumber}`,
        severity: 'success'
      });
      
      // Refresh versions list
      await fetchVersions();
      
      // Notify parent component
      if (onVersionRestored) {
        onVersionRestored();
      }
    } catch (err) {
      console.error('Error restoring version:', err);
      setNotification({
        open: true,
        message: 'Failed to restore version. Please try again.',
        severity: 'error'
      });
    } finally {
      setRestoring(false);
      setRestoreDialogOpen(false);
    }
  };

  // Open restore dialog
  const openRestoreDialog = (version: ReportVersion) => {
    setSelectedVersion(version);
    setRestoreDialogOpen(true);
  };

  // Open version details dialog
  const openDetailsDialog = (version: ReportVersion) => {
    setSelectedVersion(version);
    setDetailsDialogOpen(true);
  };

  // Handle view version
  const handleViewVersion = (version: ReportVersion) => {
    window.open(`/reports/${reportId}/versions/${version.id}`, '_blank');
  };

  // Handle compare versions
  const handleCompareVersions = (version: ReportVersion) => {
    window.open(`/reports/compare?reportId=${reportId}&versionId=${version.id}`, '_blank');
  };

  // Close notification
  const handleCloseNotification = () => {
    setNotification({
      ...notification,
      open: false
    });
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
          onClick={fetchVersions}
        >
          Retry
        </Button>
      </Box>
    );
  }

  // Render empty state
  if (versions.length === 0) {
    return (
      <Box p={3} textAlign="center">
        <Typography variant="body1" color="text.secondary">
          No versions have been created for this report yet.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Create a version to save the current state of the report for future reference.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Version History</Typography>
        <Chip 
          label={`${versions.length} version${versions.length !== 1 ? 's' : ''}`} 
          color="primary" 
          size="small" 
        />
      </Box>

      <TableContainer component={Paper} elevation={0} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Version</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Created By</TableCell>
              <TableCell>Description</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {versions.map((version) => (
              <TableRow 
                key={version.id}
                sx={{
                  backgroundColor: version.isCurrentVersion ? 'action.hover' : 'inherit',
                  '&:hover': { backgroundColor: 'action.selected' }
                }}
              >
                <TableCell>
                  <Box display="flex" alignItems="center">
                    <Typography variant="body2">
                      {version.versionNumber}
                    </Typography>
                    {version.isCurrentVersion && (
                      <Tooltip title="Current Version">
                        <CheckCircleOutline 
                          fontSize="small" 
                          color="success" 
                          sx={{ ml: 1 }} 
                        />
                      </Tooltip>
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Tooltip title={format(new Date(version.createdAt), 'PPpp')}>
                    <Typography variant="body2">
                      {formatDistanceToNow(new Date(version.createdAt), { addSuffix: true })}
                    </Typography>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {version.createdBy.name}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      maxWidth: '200px', 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      whiteSpace: 'nowrap' 
                    }}
                  >
                    {version.description || <em>No description</em>}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Box>
                    <Tooltip title="View Version">
                      <IconButton 
                        size="small" 
                        onClick={() => handleViewVersion(version)}
                      >
                        <VisibilityOutlined fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    
                    <Tooltip title="Compare with Current">
                      <IconButton 
                        size="small" 
                        onClick={() => handleCompareVersions(version)}
                        disabled={version.isCurrentVersion}
                      >
                        <CompareArrowsOutlined fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    
                    <Tooltip title="Version Details">
                      <IconButton 
                        size="small" 
                        onClick={() => openDetailsDialog(version)}
                      >
                        <InfoOutlined fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    
                    <Tooltip title="Restore Version">
                      <span>
                        <IconButton 
                          size="small" 
                          onClick={() => openRestoreDialog(version)}
                          disabled={version.isCurrentVersion || (!isAdmin && version.createdBy.id !== currentUserId)}
                        >
                          <RestoreOutlined fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Restore Version Dialog */}
      <Dialog 
        open={restoreDialogOpen} 
        onClose={() => !restoring && setRestoreDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Restore Report Version
        </DialogTitle>
        <DialogContent>
          {selectedVersion && (
            <>
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  This will replace the current report content with version {selectedVersion.versionNumber}.
                  This action cannot be undone.
                </Typography>
              </Alert>
              
              <Typography variant="subtitle2" gutterBottom>
                Version Details:
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>Version:</strong> {selectedVersion.versionNumber}
                </Typography>
                <Typography variant="body2">
                  <strong>Created:</strong> {format(new Date(selectedVersion.createdAt), 'PPpp')}
                </Typography>
                <Typography variant="body2">
                  <strong>Created By:</strong> {selectedVersion.createdBy.name}
                </Typography>
                <Typography variant="body2">
                  <strong>Description:</strong> {selectedVersion.description || 'No description'}
                </Typography>
              </Box>
              
              <Divider sx={{ my: 2 }} />
              
              <FormControlLabel
                control={
                  <Switch 
                    checked={createBackup} 
                    onChange={(e) => setCreateBackup(e.target.checked)}
                    disabled={restoring}
                  />
                }
                label="Create backup of current version"
              />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                If enabled, the current report state will be saved as a new version before restoring.
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setRestoreDialogOpen(false)} 
            disabled={restoring}
          >
            Cancel
          </Button>
          <Button 
            variant="contained" 
            color="warning" 
            onClick={handleRestoreVersion}
            disabled={restoring}
            startIcon={restoring && <CircularProgress size={20} />}
          >
            {restoring ? 'Restoring...' : 'Restore Version'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Version Details Dialog */}
      <Dialog 
        open={detailsDialogOpen} 
        onClose={() => setDetailsDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Version Details
        </DialogTitle>
        <DialogContent>
          {selectedVersion && (
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Version {selectedVersion.versionNumber}
                {selectedVersion.isCurrentVersion && (
                  <Chip 
                    label="Current" 
                    color="success" 
                    size="small" 
                    sx={{ ml: 1 }} 
                  />
                )}
              </Typography>
              
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell component="th" scope="row" sx={{ width: '40%' }}>
                        <Typography variant="body2" fontWeight="bold">Version ID</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                          {selectedVersion.id}
                        </Typography>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">
                        <Typography variant="body2" fontWeight="bold">Created</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {format(new Date(selectedVersion.createdAt), 'PPpp')}
                        </Typography>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">
                        <Typography variant="body2" fontWeight="bold">Created By</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {selectedVersion.createdBy.name}
                        </Typography>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">
                        <Typography variant="body2" fontWeight="bold">Description</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {selectedVersion.description || <em>No description</em>}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
              
              <Box display="flex" gap={1}>
                <Button 
                  variant="outlined"
                  startIcon={<VisibilityOutlined />}
                  onClick={() => {
                    handleViewVersion(selectedVersion);
                    setDetailsDialogOpen(false);
                  }}
                >
                  View Version
                </Button>
                
                <Button 
                  variant="outlined"
                  startIcon={<CompareArrowsOutlined />}
                  onClick={() => {
                    handleCompareVersions(selectedVersion);
                    setDetailsDialogOpen(false);
                  }}
                  disabled={selectedVersion.isCurrentVersion}
                >
                  Compare
                </Button>
                
                <Button 
                  variant="outlined"
                  color="warning"
                  startIcon={<RestoreOutlined />}
                  onClick={() => {
                    setDetailsDialogOpen(false);
                    openRestoreDialog(selectedVersion);
                  }}
                  disabled={selectedVersion.isCurrentVersion || (!isAdmin && selectedVersion.createdBy.id !== currentUserId)}
                >
                  Restore
                </Button>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsDialogOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notifications */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
      >
        <Alert 
          onClose={handleCloseNotification} 
          severity={notification.severity}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default VersionHistory;
