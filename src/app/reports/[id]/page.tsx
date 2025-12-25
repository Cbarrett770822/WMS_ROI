'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import ReportViewer from '@/components/reports/ReportViewer';

const ReportPage = () => {
  const params = useParams();
  const reportId = params.id as string;
  
  return <ReportViewer reportId={reportId} />;
};

export default ReportPage;
