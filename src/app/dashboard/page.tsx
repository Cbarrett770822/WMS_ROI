'use client';

import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Grid, 
  Paper, 
  Typography, 
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  CircularProgress,
  Chip,
  Avatar
} from '@mui/material';
import { 
  Assessment, 
  Warehouse, 
  Business, 
  TrendingUp, 
  Description,
  InsertChart,
  Schedule,
  MoreVert,
  ArrowForward
} from '@mui/icons-material';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, parseISO, differenceInDays } from 'date-fns';
import apiClient from '@/utils/apiClient';
import { useAuth } from '@/contexts/AuthContext';

// Types
interface ReportSummary {
  id: string;
  title: string;
  company: {
    id: string;
    name: string;
  };
  warehouse?: {
    id: string;
    name: string;
  };
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface AssessmentSummary {
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
  status: string;
  completedAt?: string;
  createdAt: string;
}

interface DashboardStats {
  totalReports: number;
  totalAssessments: number;
  totalCompanies: number;
  totalWarehouses: number;
  recentReports: ReportSummary[];
  recentAssessments: AssessmentSummary[];
  reportsByStatus: {
    status: string;
    count: number;
  }[];
  assessmentsByStatus: {
    status: string;
    count: number;
  }[];
}

// Dashboard component
const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { user } = useAuth();

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const data = await apiClient.get<DashboardStats>('/dashboard');
        setStats(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load dashboard data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Get status color
  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'draft':
        return '#FFA000'; // Amber
      case 'published':
      case 'completed':
        return '#4CAF50'; // Green
      case 'archived':
        return '#9E9E9E'; // Grey
      case 'in progress':
        return '#2196F3'; // Blue
      case 'pending':
        return '#FF5722'; // Deep Orange
      default:
        return '#757575'; // Grey
    }
  };

  // Format date with relative time
  const formatDate = (dateString: string): string => {
    const date = parseISO(dateString);
    const daysDiff = differenceInDays(new Date(), date);
    
    if (daysDiff === 0) {
      return 'Today';
    } else if (daysDiff === 1) {
      return 'Yesterday';
    } else if (daysDiff <= 7) {
      return `${daysDiff} days ago`;
    } else {
      return format(date, 'MMM d, yyyy');
    }
  };

  if (loading) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minHeight="80vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Paper 
          sx={{ 
            p: 4, 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            textAlign: 'center'
          }}
        >
          <Typography variant="h5" color="error" gutterBottom>
            {error}
          </Typography>
          <Button 
            variant="contained" 
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
        </Paper>
      </Container>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4" component="h1">
          Dashboard
        </Typography>
        <Box>
          <Typography variant="subtitle1">
            Welcome, {user?.name || 'User'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </Typography>
        </Box>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper 
            sx={{ 
              p: 2, 
              display: 'flex', 
              flexDirection: 'column',
              height: 140,
              bgcolor: '#E3F2FD',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <Box 
              sx={{ 
                position: 'absolute',
                right: -10,
                bottom: -15,
                opacity: 0.2
              }}
            >
              <Description sx={{ fontSize: 100 }} />
            </Box>
            <Typography component="h2" variant="h6" color="primary" gutterBottom>
              Reports
            </Typography>
            <Typography component="p" variant="h3">
              {stats.totalReports}
            </Typography>
            <Box sx={{ mt: 'auto', pt: 1 }}>
              <Link href="/reports" style={{ textDecoration: 'none' }}>
                <Typography variant="body2" color="primary" sx={{ display: 'flex', alignItems: 'center' }}>
                  View all reports <ArrowForward fontSize="small" sx={{ ml: 0.5 }} />
                </Typography>
              </Link>
            </Box>
          </Paper>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Paper 
            sx={{ 
              p: 2, 
              display: 'flex', 
              flexDirection: 'column',
              height: 140,
              bgcolor: '#E8F5E9',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <Box 
              sx={{ 
                position: 'absolute',
                right: -10,
                bottom: -15,
                opacity: 0.2
              }}
            >
              <Assessment sx={{ fontSize: 100 }} />
            </Box>
            <Typography component="h2" variant="h6" color="success.dark" gutterBottom>
              Assessments
            </Typography>
            <Typography component="p" variant="h3">
              {stats.totalAssessments}
            </Typography>
            <Box sx={{ mt: 'auto', pt: 1 }}>
              <Link href="/assessments" style={{ textDecoration: 'none' }}>
                <Typography variant="body2" color="success.dark" sx={{ display: 'flex', alignItems: 'center' }}>
                  View all assessments <ArrowForward fontSize="small" sx={{ ml: 0.5 }} />
                </Typography>
              </Link>
            </Box>
          </Paper>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Paper 
            sx={{ 
              p: 2, 
              display: 'flex', 
              flexDirection: 'column',
              height: 140,
              bgcolor: '#FFF8E1',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <Box 
              sx={{ 
                position: 'absolute',
                right: -10,
                bottom: -15,
                opacity: 0.2
              }}
            >
              <Business sx={{ fontSize: 100 }} />
            </Box>
            <Typography component="h2" variant="h6" color="warning.dark" gutterBottom>
              Companies
            </Typography>
            <Typography component="p" variant="h3">
              {stats.totalCompanies}
            </Typography>
            <Box sx={{ mt: 'auto', pt: 1 }}>
              <Link href="/companies" style={{ textDecoration: 'none' }}>
                <Typography variant="body2" color="warning.dark" sx={{ display: 'flex', alignItems: 'center' }}>
                  View all companies <ArrowForward fontSize="small" sx={{ ml: 0.5 }} />
                </Typography>
              </Link>
            </Box>
          </Paper>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Paper 
            sx={{ 
              p: 2, 
              display: 'flex', 
              flexDirection: 'column',
              height: 140,
              bgcolor: '#F3E5F5',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <Box 
              sx={{ 
                position: 'absolute',
                right: -10,
                bottom: -15,
                opacity: 0.2
              }}
            >
              <Warehouse sx={{ fontSize: 100 }} />
            </Box>
            <Typography component="h2" variant="h6" color="secondary.dark" gutterBottom>
              Warehouses
            </Typography>
            <Typography component="p" variant="h3">
              {stats.totalWarehouses}
            </Typography>
            <Box sx={{ mt: 'auto', pt: 1 }}>
              <Link href="/warehouses" style={{ textDecoration: 'none' }}>
                <Typography variant="body2" color="secondary.dark" sx={{ display: 'flex', alignItems: 'center' }}>
                  View all warehouses <ArrowForward fontSize="small" sx={{ ml: 0.5 }} />
                </Typography>
              </Link>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Recent Reports and Assessments */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6" component="h2">
                Recent Reports
              </Typography>
              <Link href="/reports" style={{ textDecoration: 'none' }}>
                <Button size="small" endIcon={<ArrowForward />}>
                  View All
                </Button>
              </Link>
            </Box>
            <Divider sx={{ mb: 2 }} />
            
            {stats.recentReports.length === 0 ? (
              <Box textAlign="center" py={4}>
                <Typography variant="body1" color="text.secondary">
                  No reports available
                </Typography>
              </Box>
            ) : (
              <List disablePadding>
                {stats.recentReports.map((report) => (
                  <React.Fragment key={report.id}>
                    <ListItem 
                      disablePadding 
                      sx={{ py: 1.5 }}
                      onClick={() => router.push(`/reports/${report.id}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <Avatar sx={{ bgcolor: getStatusColor(report.status), width: 32, height: 32 }}>
                          <InsertChart sx={{ fontSize: 18 }} />
                        </Avatar>
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography variant="body1" noWrap>
                            {report.title}
                          </Typography>
                        }
                        secondary={
                          <Box component="span" display="flex" alignItems="center" gap={1}>
                            <Typography variant="body2" color="text.secondary" noWrap>
                              {report.company.name}
                              {report.warehouse && ` - ${report.warehouse.name}`}
                            </Typography>
                            <Chip 
                              label={report.status} 
                              size="small"
                              sx={{ 
                                height: 20, 
                                fontSize: '0.7rem',
                                bgcolor: getStatusColor(report.status),
                                color: 'white'
                              }}
                            />
                          </Box>
                        }
                      />
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(report.updatedAt)}
                      </Typography>
                    </ListItem>
                    <Divider component="li" />
                  </React.Fragment>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6" component="h2">
                Recent Assessments
              </Typography>
              <Link href="/assessments" style={{ textDecoration: 'none' }}>
                <Button size="small" endIcon={<ArrowForward />}>
                  View All
                </Button>
              </Link>
            </Box>
            <Divider sx={{ mb: 2 }} />
            
            {stats.recentAssessments.length === 0 ? (
              <Box textAlign="center" py={4}>
                <Typography variant="body1" color="text.secondary">
                  No assessments available
                </Typography>
              </Box>
            ) : (
              <List disablePadding>
                {stats.recentAssessments.map((assessment) => (
                  <React.Fragment key={assessment.id}>
                    <ListItem 
                      disablePadding 
                      sx={{ py: 1.5 }}
                      onClick={() => router.push(`/assessments/${assessment.id}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <Avatar sx={{ bgcolor: getStatusColor(assessment.status), width: 32, height: 32 }}>
                          <Schedule sx={{ fontSize: 18 }} />
                        </Avatar>
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography variant="body1" noWrap>
                            {assessment.name}
                          </Typography>
                        }
                        secondary={
                          <Box component="span" display="flex" alignItems="center" gap={1}>
                            <Typography variant="body2" color="text.secondary" noWrap>
                              {assessment.company.name}
                              {assessment.warehouse && ` - ${assessment.warehouse.name}`}
                            </Typography>
                            <Chip 
                              label={assessment.status} 
                              size="small"
                              sx={{ 
                                height: 20, 
                                fontSize: '0.7rem',
                                bgcolor: getStatusColor(assessment.status),
                                color: 'white'
                              }}
                            />
                          </Box>
                        }
                      />
                      <Typography variant="caption" color="text.secondary">
                        {assessment.completedAt 
                          ? formatDate(assessment.completedAt)
                          : formatDate(assessment.createdAt)}
                      </Typography>
                    </ListItem>
                    <Divider component="li" />
                  </React.Fragment>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
        
        {/* Status Breakdowns */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, mt: 3 }}>
            <Typography variant="h6" component="h2" gutterBottom>
              Reports by Status
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={1} mt={2}>
              {stats.reportsByStatus.map((item) => (
                <Chip
                  key={item.status}
                  label={`${item.status}: ${item.count}`}
                  sx={{ 
                    bgcolor: getStatusColor(item.status),
                    color: 'white',
                    fontWeight: 500
                  }}
                />
              ))}
            </Box>
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, mt: 3 }}>
            <Typography variant="h6" component="h2" gutterBottom>
              Assessments by Status
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={1} mt={2}>
              {stats.assessmentsByStatus.map((item) => (
                <Chip
                  key={item.status}
                  label={`${item.status}: ${item.count}`}
                  sx={{ 
                    bgcolor: getStatusColor(item.status),
                    color: 'white',
                    fontWeight: 500
                  }}
                />
              ))}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Dashboard;
