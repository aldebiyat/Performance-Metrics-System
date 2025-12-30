import React, { useState, useRef, useEffect } from 'react';
import { useExport } from '../hooks/useExport';
import { DateRange } from '../types';
import LoadingSpinner from './LoadingSpinner';
import './ExportButton.css';

interface ExportButtonProps {
  range: DateRange;
  category?: string;
}

const ExportButton: React.FC<ExportButtonProps> = ({ range, category = 'all' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { exportCSV, exportPDF, isExporting, error } = useExport(range);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExportCSV = async () => {
    await exportCSV(category);
    setIsOpen(false);
  };

  const handleExportPDF = async () => {
    await exportPDF(category);
    setIsOpen(false);
  };

  return (
    <div className="export-button-container" ref={dropdownRef}>
      <button
        className="export-button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExporting}
      >
        {isExporting ? (
          <>
            <LoadingSpinner size="small" />
            <span>Exporting...</span>
          </>
        ) : (
          <>
            <span className="export-icon">&#8595;</span>
            <span>Export</span>
          </>
        )}
      </button>

      {isOpen && !isExporting && (
        <div className="export-dropdown">
          <button className="export-option" onClick={handleExportCSV}>
            <span className="export-option-icon">&#128196;</span>
            <div className="export-option-text">
              <span className="export-option-title">Export as CSV</span>
              <span className="export-option-desc">Spreadsheet format</span>
            </div>
          </button>
          <button className="export-option" onClick={handleExportPDF}>
            <span className="export-option-icon">&#128203;</span>
            <div className="export-option-text">
              <span className="export-option-title">Export as PDF</span>
              <span className="export-option-desc">Report format</span>
            </div>
          </button>
        </div>
      )}

      {error && <div className="export-error">{error}</div>}
    </div>
  );
};

export default ExportButton;
