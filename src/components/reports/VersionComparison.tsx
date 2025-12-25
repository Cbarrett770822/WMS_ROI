import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  CircularProgress,
  Alert,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Tooltip,
  IconButton,
  ToggleButtonGroup,
  ToggleButton
} from '@mui/material';
import {
  CompareArrows,
  SwapHoriz,
  RestoreOutlined,
  VisibilityOutlined,
  ArrowForward,
  ArrowBack,
  DifferenceOutlined,
  FormatListBulleted,
  TableChart
} from '@mui/icons-material';
import { format } from 'date-fns';
import apiClient from '@/utils/apiClient';
import { diffLines, diffJson } from 'diff';

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

interface VersionComparisonProps {
  reportId: string;
  initialVersionId?: string;
  onVersionRestored?: () => void;
}

type ViewMode = 'unified' | 'split';
type ContentType = 'text' | 'data';

const VersionComparison: React.FC<VersionComparisonProps> = ({
  reportId,
  initialVersionId,
  onVersionRestored
}) => {
  // State
  const [versions, setVersions] = useState<ReportVersion[]>([]);
  const [leftVersionId, setLeftVersionId] = useState<string>('');
  const [rightVersionId, setRightVersionId] = useState<string>('');
  const [leftVersion, setLeftVersion] = useState<ReportVersion | null>(null);
  const [rightVersion, setRightVersion] = useState<ReportVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [contentType, setContentType] = useState<ContentType>('text');
  const [selectedSectionIndex, setSelectedSectionIndex] = useState(0);

  // Fetch versions on component mount
  useEffect(() => {
    fetchVersions();
  }, [reportId]);

  // Update selected versions when versions list changes
  useEffect(() => {
    if (versions.length > 0) {
      // Find current version
      const currentVersion = versions.find(v => v.isCurrentVersion);
      
      // Set right version to current version
      if (currentVersion) {
        setRightVersionId(currentVersion.id);
      }
      
      // Set left version to initial version or previous version
      if (initialVersionId && versions.find(v => v.id === initialVersionId)) {
        setLeftVersionId(initialVersionId);
      } else if (versions.length > 1) {
        // Find previous version
        const previousVersion = versions.find(v => !v.isCurrentVersion);
        if (previousVersion) {
          setLeftVersionId(previousVersion.id);
        }
      }
    }
  }, [versions, initialVersionId]);

  // Fetch version details when selected versions change
  useEffect(() => {
    if (leftVersionId && rightVersionId) {
      fetchVersionDetails();
    }
  }, [leftVersionId, rightVersionId]);

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

  // Fetch version details
  const fetchVersionDetails = async () => {
    setLoadingVersions(true);
    
    try {
      const [leftData, rightData] = await Promise.all([
        apiClient.get<ReportVersion>(`/api/reports/versions/${leftVersionId}`),
        apiClient.get<ReportVersion>(`/api/reports/versions/${rightVersionId}`)
      ]);
      
      setLeftVersion(leftData);
      setRightVersion(rightData);
    } catch (err) {
      console.error('Error fetching version details:', err);
      setError('Failed to load version details. Please try again.');
    } finally {
      setLoadingVersions(false);
    }
  };

  // Swap versions
  const handleSwapVersions = () => {
    const tempLeftId = leftVersionId;
    setLeftVersionId(rightVersionId);
    setRightVersionId(tempLeftId);
  };

  // Handle version change
  const handleVersionChange = (side: 'left' | 'right', versionId: string) => {
    if (side === 'left') {
      setLeftVersionId(versionId);
    } else {
      setRightVersionId(versionId);
    }
  };

  // Handle view mode change
  const handleViewModeChange = (
    event: React.MouseEvent<HTMLElement>,
    newMode: ViewMode | null
  ) => {
    if (newMode !== null) {
      setViewMode(newMode);
    }
  };

  // Handle content type change
  const handleContentTypeChange = (
    event: React.MouseEvent<HTMLElement>,
    newType: ContentType | null
  ) => {
    if (newType !== null) {
      setContentType(newType);
    }
  };

  // Handle section change
  const handleSectionChange = (index: number) => {
    setSelectedSectionIndex(index);
  };

  // Render diff for text content
  const renderTextDiff = (leftText: string, rightText: string) => {
    const parts = diffLines(leftText, rightText);
    
    return (
      <Box sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', fontSize: '0.875rem' }}>
        {parts.map((part, i) => (
          <Box 
            key={i}
            sx={{
              backgroundColor: part.added 
                ? 'rgba(0, 255, 0, 0.1)' 
                : part.removed 
                  ? 'rgba(255, 0, 0, 0.1)' 
                  : 'transparent',
              padding: '2px 0'
            }}
          >
            {part.value}
          </Box>
        ))}
      </Box>
    );
  };

  // Render diff for JSON data
  const renderDataDiff = (leftData: any, rightData: any) => {
    const parts = diffJson(leftData, rightData);
    
    return (
      <Box sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', fontSize: '0.875rem' }}>
        {parts.map((part, i) => (
          <Box 
            key={i}
            sx={{
              backgroundColor: part.added 
                ? 'rgba(0, 255, 0, 0.1)' 
                : part.removed 
                  ? 'rgba(255, 0, 0, 0.1)' 
                  : 'transparent',
              padding: '2px 0'
            }}
          >
            {typeof part.value === 'string' 
              ? part.value 
              : JSON.stringify(part.value, null, 2)}
          </Box>
        ))}
      </Box>
    );
  };

  // Render section content based on view mode and content type
  const renderSectionContent = () => {
    if (!leftVersion || !rightVersion) return null;
    
    const leftSections = leftVersion.content.sections || [];
    const rightSections = rightVersion.content.sections || [];
    
    const leftSection = leftSections[selectedSectionIndex] || { title: 'N/A', content: '' };
    const rightSection = rightSections[selectedSectionIndex] || { title: 'N/A', content: '' };
    
    if (viewMode === 'unified') {
      return (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            {rightSection.title || leftSection.title}
          </Typography>
          
          {contentType === 'text' ? (
            renderTextDiff(leftSection.content || '', rightSection.content || '')
          ) : (
            renderDataDiff(
              { charts: leftSection.charts || [], tables: leftSection.tables || [] },
              { charts: rightSection.charts || [], tables: rightSection.tables || [] }
            )
          )}
        </Paper>
      );
    }
    
    return (
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
            <Typography variant="subtitle1" gutterBottom>
              {leftSection.title || 'N/A'}
            </Typography>
            
            {contentType === 'text' ? (
              <Box sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', fontSize: '0.875rem' }}>
                {leftSection.content || 'No content'}
              </Box>
            ) : (
              <Box sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', fontSize: '0.875rem' }}>
                {JSON.stringify(
                  { charts: leftSection.charts || [], tables: leftSection.tables || [] },
                  null, 
                  2
                )}
              </Box>
            )}
          </Paper>
        </Grid>
        
        <Grid item xs={6}>
          <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
            <Typography variant="subtitle1" gutterBottom>
              {rightSection.title || 'N/A'}
            </Typography>
            
            {contentType === 'text' ? (
              <Box sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', fontSize: '0.875rem' }}>
                {rightSection.content || 'No content'}
              </Box>
            ) : (
              <Box sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', fontSize: '0.875rem' }}>
                {JSON.stringify(
                  { charts: rightSection.charts || [], tables: rightSection.tables || [] },
                  null, 
                  2
                )}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    );
  };

  // Render section navigation
  const renderSectionNavigation = () => {
    if (!leftVersion || !rightVersion) return null;
    
    const leftSections = leftVersion.content.sections || [];
    const rightSections = rightVersion.content.sections || [];
    
    // Combine sections from both versions
    const sectionTitles = new Set<string>();
    leftSections.forEach(section => sectionTitles.add(section.title));
    rightSections.forEach(section => sectionTitles.add(section.title));
    
    const uniqueSections = Array.from(sectionTitles);
    
    return (
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Sections
        </Typography>
        
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {uniqueSections.map((title, index) => {
            const leftHasSection = leftSections.some(s => s.title === title);
            const rightHasSection = rightSections.some(s => s.title === title);
            let chipColor: 'default' | 'primary' | 'success' | 'error' | 'warning' | 'info' = 'default';
            
            if (leftHasSection && rightHasSection) {
              chipColor = 'primary';
            } else if (leftHasSection) {
              chipColor = 'error'; // Removed in right
            } else if (rightHasSection) {
              chipColor = 'success'; // Added in right
            }
            
            return (
              <Chip 
                key={index}
                label={title}
                color={chipColor}
                variant={selectedSectionIndex === index ? 'filled' : 'outlined'}
                onClick={() => handleSectionChange(index)}
                size="small"
              />
            );
          })}
        </Box>
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
          onClick={fetchVersions}
        >
          Retry
        </Button>
      </Box>
    );
  }

  // Render empty state
  if (versions.length < 2) {
    return (
      <Box p={3} textAlign="center">
        <Alert severity="info">
          At least two versions are required to compare. Please create more versions.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={5}>
            <FormControl fullWidth size="small">
              <InputLabel id="left-version-label">Left Version</InputLabel>
              <Select
                labelId="left-version-label"
                value={leftVersionId}
                label="Left Version"
                onChange={(e) => handleVersionChange('left', e.target.value as string)}
              >
                {versions.map((version) => (
                  <MenuItem key={version.id} value={version.id}>
                    Version {version.versionNumber} - {format(new Date(version.createdAt), 'MMM d, yyyy')}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={2} sx={{ textAlign: 'center' }}>
            <IconButton onClick={handleSwapVersions} color="primary">
              <SwapHoriz />
            </IconButton>
          </Grid>
          
          <Grid item xs={5}>
            <FormControl fullWidth size="small">
              <InputLabel id="right-version-label">Right Version</InputLabel>
              <Select
                labelId="right-version-label"
                value={rightVersionId}
                label="Right Version"
                onChange={(e) => handleVersionChange('right', e.target.value as string)}
              >
                {versions.map((version) => (
                  <MenuItem key={version.id} value={version.id}>
                    Version {version.versionNumber} - {format(new Date(version.createdAt), 'MMM d, yyyy')}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Box>
      
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={handleViewModeChange}
            size="small"
          >
            <ToggleButton value="split">
              <Tooltip title="Split View">
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <ArrowBack fontSize="small" />
                  <ArrowForward fontSize="small" />
                </Box>
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="unified">
              <Tooltip title="Unified View">
                <DifferenceOutlined fontSize="small" />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
          
          <ToggleButtonGroup
            value={contentType}
            exclusive
            onChange={handleContentTypeChange}
            size="small"
            sx={{ ml: 2 }}
          >
            <ToggleButton value="text">
              <Tooltip title="Text Content">
                <FormatListBulleted fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="data">
              <Tooltip title="Charts & Tables">
                <TableChart fontSize="small" />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>
      
      {loadingVersions ? (
        <Box display="flex" justifyContent="center" alignItems="center" p={3}>
          <CircularProgress size={30} />
        </Box>
      ) : (
        <>
          {leftVersion && rightVersion && (
            <>
              <Box sx={{ mb: 3 }}>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Card variant="outlined">
                      <CardHeader
                        title={`Version ${leftVersion.versionNumber}`}
                        subheader={format(new Date(leftVersion.createdAt), 'PPpp')}
                        action={
                          <Chip 
                            label={leftVersion.isCurrentVersion ? 'Current' : 'Previous'} 
                            color={leftVersion.isCurrentVersion ? 'success' : 'default'} 
                            size="small" 
                          />
                        }
                        titleTypographyProps={{ variant: 'subtitle1' }}
                        subheaderTypographyProps={{ variant: 'body2' }}
                      />
                      <CardContent>
                        <Typography variant="body2" color="text.secondary">
                          Created by: {leftVersion.createdBy.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Description: {leftVersion.description || <em>No description</em>}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={6}>
                    <Card variant="outlined">
                      <CardHeader
                        title={`Version ${rightVersion.versionNumber}`}
                        subheader={format(new Date(rightVersion.createdAt), 'PPpp')}
                        action={
                          <Chip 
                            label={rightVersion.isCurrentVersion ? 'Current' : 'Previous'} 
                            color={rightVersion.isCurrentVersion ? 'success' : 'default'} 
                            size="small" 
                          />
                        }
                        titleTypographyProps={{ variant: 'subtitle1' }}
                        subheaderTypographyProps={{ variant: 'body2' }}
                      />
                      <CardContent>
                        <Typography variant="body2" color="text.secondary">
                          Created by: {rightVersion.createdBy.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Description: {rightVersion.description || <em>No description</em>}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Box>
              
              {renderSectionNavigation()}
              
              <Box sx={{ mb: 3 }}>
                {renderSectionContent()}
              </Box>
            </>
          )}
        </>
      )}
    </Box>
  );
};

export default VersionComparison;
