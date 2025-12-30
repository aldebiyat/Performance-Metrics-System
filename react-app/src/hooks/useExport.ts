import { useState, useCallback } from 'react';
import { downloadFile } from '../api/client';
import { DateRange } from '../types';

interface UseExportReturn {
  exportCSV: (category?: string) => Promise<void>;
  exportPDF: (category?: string) => Promise<void>;
  isExporting: boolean;
  error: string | null;
}

export const useExport = (range: DateRange = '30d'): UseExportReturn => {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportCSV = useCallback(async (category: string = 'all') => {
    setIsExporting(true);
    setError(null);

    try {
      const filename = `metrics-${category}-${range}-${new Date().toISOString().split('T')[0]}.csv`;
      await downloadFile(`/api/export/csv?category=${category}&range=${range}`, filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  }, [range]);

  const exportPDF = useCallback(async (category: string = 'all') => {
    setIsExporting(true);
    setError(null);

    try {
      const filename = `metrics-report-${category}-${range}-${new Date().toISOString().split('T')[0]}.pdf`;
      await downloadFile(`/api/export/pdf?category=${category}&range=${range}`, filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  }, [range]);

  return { exportCSV, exportPDF, isExporting, error };
};

export default useExport;
