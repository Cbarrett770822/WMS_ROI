import React, { useState, useEffect, MouseEvent, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Box, 
  Container, 
  Typography, 
  Paper, 
  Divider, 
  Button, 
  IconButton, 
  Tabs, 
  Tab, 
  CircularProgress,
  Breadcrumbs,
  Link,
  Tooltip,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import {
  Download as DownloadIcon,
  Share as ShareIcon,
  Print as PrintIcon,
  MoreVert as MoreVertIcon,
  History as HistoryIcon,
  FileCopy as CloneIcon,
  Compare as CompareIcon,
  Comment as CommentIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import VersionHistory from './VersionHistory';
import VersionComparison from './VersionComparison';
import VersionPreview from './VersionPreview';
import { useAuth } from '@/contexts/AuthContext';

// Types
interface ReportSection {
  id: string;
  title: string;
  content: string;
  charts?: ChartData[];
  tables?: TableData[];
}

interface ChartData {
  id: string;
  type: string;
  title: string;
  description: string;
  data: any;
  config: any;
}

interface TableData {
  id: string;
  title: string;
  description: string;
  headers: string[];
  rows: any[][];
}

interface ReportVersion {
  id: string;
  createdAt: string;
  createdBy: {
    id: string;
    name: string;
  };
  description: string;
}

interface ReportComment {
  id: string;
  text: string;
  createdAt: string;
  createdBy: {
    id: string;
    name: string;
  };
  sectionId?: string;
}

interface ReportData {
  id: string;
  title: string;
  description: string;
  company: {
    id: string;
    name: string;
  };
  warehouse: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    name: string;
  };
  status: string;
  sections: ReportSection[];
  sharedWith: {
    id: string;
    name: string;
  }[];
}

// Chart component placeholder
const ChartRenderer = ({ chartData }: { chartData: ChartData }) => {
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

// Table component placeholder
const TableRenderer = ({ tableData }: { tableData: TableData }) => {
  return (
    <Paper elevation={1} sx={{ p: 2, my: 2, overflowX: 'auto' }}>
      <Typography variant="h6">{tableData.title}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {tableData.description}
      </Typography>
      <div style={{ width: '100%', overflowX: 'auto' }}>
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
            {tableData.rows.map((row: string[], rowIndex: number) => (
              <tr key={rowIndex}>
                {row.map((cell: string, cellIndex: number) => (
                  <td key={cellIndex} style={{ border: '1px solid #ddd', padding: 8 }}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Paper>
  );
};

// Comments component
const CommentsPanel = ({ comments, reportId }: { comments: ReportComment[], reportId: string }) => {
  const [newComment, setNewComment] = useState('');
  
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>Comments</Typography>
      {comments.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No comments yet.</Typography>
      ) : (
        comments.map(comment => (
          <Paper key={comment.id} sx={{ p: 2, mb: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              {comment.createdBy.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
            </Typography>
            <Typography variant="body1" sx={{ mt: 1 }}>
              {comment.text}
            </Typography>
          </Paper>
        ))
      )}
      
      {/* Add comment form - will be implemented in future PR */}
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2">Add a comment</Typography>
        <textarea
          placeholder="Type your comment here..."
          style={{ 
            width: '100%', 
            padding: '8px', 
            marginTop: '8px',
            minHeight: '80px',
            borderRadius: '4px',
            border: '1px solid #ddd'
          }}
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
        />
        <Button 
          variant="contained" 
          size="small" 
          sx={{ mt: 1 }}
          disabled={!newComment.trim()}
        >
          Post Comment
        </Button>
      </Box>
    </Box>
  );
};
const ReportViewer = ({ reportId }: { reportId: string }) => {
  const router = useRouter();
  const { user, hasRole, hasPermission } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState<number>(0);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [showShareDialog, setShowShareDialog] = useState<boolean>(false);
  const [showVersionDialog, setShowVersionDialog] = useState<boolean>(false);
  const [versionDescription, setVersionDescription] = useState<string>('');
  const [creatingVersion, setCreatingVersion] = useState<boolean>(false);
  
  // Comments state
  const [comments, setComments] = useState<ReportComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState<boolean>(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  
  // Versions state
  const [versions, setVersions] = useState<ReportVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState<boolean>(false);
  const [versionsError, setVersionsError] = useState<string | null>(null);
  
  // Function to fetch report data
  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch report data from API
      const response = await fetch(`/api/reports/${reportId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch report: ${response.statusText}`);
      }
      
      const data = await response.json();
      setReport(data);
      
      if (data.sections && data.sections.length > 0) {
        setActiveSection(data.sections[0].id);
      }
    } catch (err) {
      console.error('Error fetching report:', err);
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch report data on component mount
  useEffect(() => {
    if (reportId) {
      fetchReport();
    }
  }, [reportId]);
  
  // Fetch comments
  useEffect(() => {
    const fetchComments = async () => {
      if (!reportId) return;
      
      setCommentsLoading(true);
      setCommentsError(null);
      
      try {
        // Fetch comments from API
        const response = await fetch(`/api/reports/${reportId}/comments`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch comments: ${response.statusText}`);
        }
        
        const data = await response.json();
        setComments(data);
      } catch (err) {
        console.error('Error fetching comments:', err);
        setCommentsError(err instanceof Error ? err.message : 'Failed to load comments');
      } finally {
        setCommentsLoading(false);
      }
    };
    
    if (reportId) {
      fetchComments();
    }
  }, [reportId]);
  
  // Function to fetch versions
  const fetchVersions = async () => {
    setVersionsLoading(true);
    setVersionsError(null);
    
    try {
      // Fetch versions from API
      const response = await fetch(`/api/reports/${reportId}/versions`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch versions: ${response.statusText}`);
      }
      
      const data = await response.json();
      setVersions(data);
    } catch (err) {
      console.error('Error fetching versions:', err);
      setVersionsError(err instanceof Error ? err.message : 'Failed to load versions');
    } finally {
      setVersionsLoading(false);
    }
  };
  
  // Fetch versions on component mount
  useEffect(() => {
    if (reportId) {
      fetchVersions();
    }
  }, [reportId]);
  
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };
  
  const handleMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setMenuAnchorEl(event.currentTarget);
  };
  
  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };
  
  const handleDownloadPDF = async () => {
    try {
      const response = await fetch(`/api/reports/${reportId}/export?format=pdf`, {
        method: 'GET',
      });
      
      if (!response.ok) {
        throw new Error('Failed to download PDF');
      }
      
      // Create a blob from the PDF stream
      const blob = await response.blob();
      
      // Create a link element and trigger download
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${report?.title || 'report'}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error downloading PDF:', error);
      // Handle error
    }
  };
  
  const handlePrint = () => {
    window.print();
  };
  
  const handleShare = () => {
    setShowShareDialog(true);
    handleMenuClose();
  };
  
  const handleClone = async () => {
    handleMenuClose();
    
    if (!report) return;
    
    try {
      const response = await fetch('/api/reports/clone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reportId }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to clone report: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Navigate to the new cloned report
      router.push(`/reports/${data.id}`);
    } catch (err) {
      console.error('Error cloning report:', err);
      alert(err instanceof Error ? err.message : 'Failed to clone report');
    }
  };
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }
  
  if (error) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography variant="h5" color="error">Error: {error}</Typography>
        <Typography variant="body1" sx={{ mt: 2, mb: 3 }}>
          There was a problem loading this report. Please try again or contact support if the issue persists.
        </Typography>
        <Button variant="contained" sx={{ mt: 2 }} onClick={() => router.push('/reports')}>
          Back to Reports
        </Button>
        <Button variant="outlined" sx={{ mt: 2, ml: 2 }} onClick={() => fetchReport()}>
          Try Again
        </Button>
      </Box>
    );
  }
  
  if (!report) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography variant="h5" color="error">Report not found or you don't have permission to view it.</Typography>
        <Button variant="contained" sx={{ mt: 2 }} onClick={() => router.push('/reports')}>
          Back to Reports
        </Button>
      </Box>
    );
  }
  
  const activeTabContent = () => {
    switch (tabValue) {
      case 0: // Report Content
        return (
          <Box>
            {report?.sections.map((section: ReportSection) => (
              <Box key={section.id} id={section.id} sx={{ mb: 4, scrollMarginTop: '64px' }}>
                <Typography variant="h5" sx={{ mb: 2 }}>{section.title}</Typography>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>{section.content}</Typography>
                
                {section.charts && section.charts.map((chart: ChartData) => (
                  <ChartRenderer key={chart.id} chartData={chart} />
                ))}
                
                {section.tables && section.tables.map((table: TableData) => (
                  <TableRenderer key={table.id} tableData={table} />
                ))}
              </Box>
            ))}
          </Box>
        );
      case 1: // Comments
        return (
          <Box>
            {commentsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress size={30} />
              </Box>
            ) : commentsError ? (
              <Box sx={{ p: 3 }}>
                <Typography color="error">{commentsError}</Typography>
                <Button variant="outlined" size="small" sx={{ mt: 1 }} onClick={() => {
                  setCommentsError(null);
                  const fetchComments = async () => {
                    try {
                      setCommentsLoading(true);
                      const response = await fetch(`/api/reports/${reportId}/comments`);
                      if (!response.ok) throw new Error('Failed to fetch comments');
                      const data = await response.json();
                      setComments(data);
                      setCommentsError(null);
                    } catch (error) {
                      setCommentsError(error instanceof Error ? error.message : 'Failed to load comments');
                    } finally {
                      setCommentsLoading(false);
                    }
                  };
                  fetchComments();
                }}>
                  Retry
                </Button>
              </Box>
            ) : (
              <CommentsPanel comments={comments} reportId={reportId} />
            )}
          </Box>
        );
      case 2: // Versions
        return (
          <Box>
            {versionsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress size={30} />
              </Box>
            ) : versionsError ? (
              <Box sx={{ p: 3 }}>
                <Typography color="error">{versionsError}</Typography>
                <Button variant="outlined" size="small" sx={{ mt: 1 }} onClick={fetchVersions}>
                  Retry
                </Button>
              </Box>
            ) : (
              <VersionHistory 
                reportId={reportId} 
                currentUserId={user?.id || ""}
                isAdmin={hasRole('admin')}
                onVersionRestored={() => {
                  // Refresh report data after version restore
                  fetchReport();
                  fetchVersions();
                }}
                onVersionCompare={(versionId1: string, versionId2: string) => {
                  // Navigate to version comparison view
                  router.push(`/reports/${reportId}/compare?v1=${versionId1}&v2=${versionId2}`);
                }}
                onVersionView={(versionId: string) => {
                  // Navigate to version preview view
                  router.push(`/reports/${reportId}/versions/${versionId}`);
                }}
              />
            )}
          </Box>
        );
      default:
        return null;
    }
  };
  
  // Check if user has edit permission based on user role/permissions
  const canEdit = hasPermission('edit:reports') || (report && user && report.createdBy.id === user.id);

  // Function to create a new version
  const handleCreateVersion = async (): Promise<void> => {
    if (!versionDescription.trim()) return;
    
    setCreatingVersion(true);
    
    try {
      const response = await fetch(`/api/reports/${reportId}/versions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ description: versionDescription }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create version: ${response.statusText}`);
      }
      
      // Refresh versions list
      await fetchVersions();
      
      // Close dialog and reset form
      setShowVersionDialog(false);
      setVersionDescription('');
    } catch (error) {
      console.error('Error creating version:', error);
      alert(error instanceof Error ? error.message : 'Failed to create version. Please try again.');
    } finally {
      setCreatingVersion(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link href="/reports" underline="hover" color="inherit">Reports</Link>
        <Typography color="text.primary">{report.title}</Typography>
      </Breadcrumbs>
      
      {/* Report Header */}
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="h4" sx={{ mb: 1 }}>{report.title}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Last updated {formatDistanceToNow(new Date(report.updatedAt), { addSuffix: true })} by {report.createdBy.name}
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Typography variant="body2">
                <strong>Company:</strong> {report.company.name}
              </Typography>
              <Typography variant="body2">
                <strong>Warehouse:</strong> {report.warehouse.name}
              </Typography>
              <Typography variant="body2">
                <strong>Status:</strong> {report.status}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Download PDF">
              <IconButton onClick={handleDownloadPDF}>
                <DownloadIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Share">
              <IconButton onClick={handleShare}>
                <ShareIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Print">
              <IconButton onClick={handlePrint}>
                <PrintIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Create Version">
              <IconButton onClick={() => setShowVersionDialog(true)}>
                <HistoryIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="More options">
              <IconButton onClick={handleMenuOpen}>
                <MoreVertIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        
        {report.description && (
          <Typography variant="body1" sx={{ mt: 2 }}>{report.description}</Typography>
        )}
      </Paper>
      
      {/* Table of Contents and Main Content */}
      <Box sx={{ display: 'flex', gap: 4 }}>
        {/* Left sidebar - Table of Contents */}
        <Box sx={{ width: 240, flexShrink: 0 }}>
          <Paper elevation={1} sx={{ p: 2, position: 'sticky', top: 20 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Table of Contents</Typography>
            <Box component="nav">
              {report.sections.map((section) => (
                <Box 
                  key={section.id} 
                  component="a" 
                  href={`#${section.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    setTabValue(0); // Switch to content tab
                    setActiveSection(section.id);
                    document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  sx={{ 
                    display: 'block', 
                    py: 1, 
                    textDecoration: 'none',
                    color: activeSection === section.id ? 'primary.main' : 'text.primary',
                    fontWeight: activeSection === section.id ? 'bold' : 'normal',
                    '&:hover': {
                      color: 'primary.main',
                    }
                  }}
                >
                  {section.title}
                </Box>
              ))}
            </Box>
            
            {/* Actions */}
            <Divider sx={{ my: 2 }} />
            <Button 
              startIcon={<CompareIcon />} 
              variant="outlined" 
              size="small" 
              fullWidth
              onClick={() => router.push(`/reports/compare?reportId=${reportId}`)}
            >
              Compare
            </Button>
          </Paper>
        </Box>
        
        {/* Main content */}
        <Box sx={{ flexGrow: 1 }}>
          <Paper elevation={1} sx={{ mb: 3 }}>
            <Tabs 
              value={tabValue} 
              onChange={handleTabChange}
              variant="fullWidth"
            >
              <Tab label="Content" />
              <Tab label={`Comments (${comments.length})`} />
              <Tab label={`Versions (${versions.length})`} />
            </Tabs>
            <Box sx={{ p: 3 }}>
              {activeTabContent()}
            </Box>
          </Paper>
        </Box>
      </Box>
      
      {/* Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleClone}>
          <CloneIcon fontSize="small" sx={{ mr: 1 }} />
          Clone Report
        </MenuItem>
        <MenuItem onClick={() => {
          handleMenuClose();
          router.push(`/reports/${reportId}/edit`);
        }}>
          <EditIcon fontSize="small" sx={{ mr: 1 }} />
          Edit Report
        </MenuItem>
      </Menu>
      
      {/* Share Dialog */}
      <Dialog open={showShareDialog} onClose={() => setShowShareDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Share Report</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Share this report with other users in your organization.
          </Typography>
          
          {/* Share form will be implemented in future PR */}
          <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1 }}>
            <Typography variant="body2">
              Currently shared with: {report.sharedWith.map(user => user.name).join(', ') || 'No one'}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowShareDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      
      {/* Create Version Dialog */}
      <Dialog open={showVersionDialog} onClose={() => setShowVersionDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Version</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Create a snapshot of the current report state that you can restore later.
          </Typography>
          
          <TextField
            placeholder="Version description (optional)"
            multiline
            rows={4}
            fullWidth
            variant="outlined"
            size="small"
            sx={{ mt: 1 }}
            value={versionDescription}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setVersionDescription(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowVersionDialog(false)} disabled={creatingVersion}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleCreateVersion}
            disabled={!versionDescription.trim() || creatingVersion}
          >
            {creatingVersion ? (
              <>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                Creating...
              </>
            ) : 'Create Version'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ReportViewer;
