import React, { useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getAccessToken } from '../../api/client';
import LoadingSpinner from '../../components/LoadingSpinner';
import './Admin.css';

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface ImportResponse {
  rowsImported?: number;
  rowsSkipped?: number;
  totalRows?: number;
  validRows?: number;
  errors: ValidationError[];
  preview?: ParsedRow[];
}

interface ParsedRow {
  category: string;
  metric_name: string;
  value: number;
  recorded_at: string;
}

type ImportStatus = 'idle' | 'validating' | 'importing' | 'success' | 'error';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

const DataImport: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<ParsedRow[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setFile(null);
    setStatus('idle');
    setPreview([]);
    setErrors([]);
    setImportResult(null);
    setErrorMessage(null);
  };

  const handleFileSelect = useCallback((selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      setErrorMessage('Please select a CSV file');
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setErrorMessage('File size must be less than 5MB');
      return;
    }

    setFile(selectedFile);
    setErrorMessage(null);
    setErrors([]);
    setImportResult(null);

    // Auto-validate on file selection
    validateFile(selectedFile);
  }, []);

  const validateFile = async (fileToValidate: File) => {
    setStatus('validating');
    setErrors([]);

    const formData = new FormData();
    formData.append('file', fileToValidate);
    formData.append('validateOnly', 'true');

    try {
      const response = await fetch(`${API_URL}/api/import/csv`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus('error');
        setErrorMessage(data.error?.message || 'Validation failed');
        return;
      }

      if (data.success && data.data) {
        setPreview(data.data.preview || []);
        setErrors(data.data.errors || []);
        setStatus('idle');

        if (data.data.errors && data.data.errors.length > 0) {
          setErrorMessage(`Found ${data.data.errors.length} validation error(s)`);
        }
      }
    } catch (error) {
      setStatus('error');
      setErrorMessage('Failed to validate file. Please try again.');
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setStatus('importing');
    setErrors([]);
    setImportResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_URL}/api/import/csv`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus('error');
        setErrorMessage(data.error?.message || 'Import failed');
        return;
      }

      if (data.success && data.data) {
        setImportResult(data.data);
        setErrors(data.data.errors || []);
        setStatus('success');
      }
    } catch (error) {
      setStatus('error');
      setErrorMessage('Failed to import file. Please try again.');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const downloadTemplate = async () => {
    try {
      const response = await fetch(`${API_URL}/api/import/template`, {
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to download template');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'metrics-import-template.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      setErrorMessage('Failed to download template');
    }
  };

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <div className="header-with-back">
          <Link to="/admin" className="back-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to Dashboard
          </Link>
        </div>
        <h1>Data Import</h1>
        <p className="admin-subtitle">Import metrics data from CSV files</p>
      </div>

      <div className="admin-section">
        <h2>CSV Format</h2>
        <p className="format-description">
          Your CSV file should contain the following columns: <code>category</code>, <code>metric_name</code>, <code>value</code>, <code>recorded_at</code>
        </p>
        <button onClick={downloadTemplate} className="template-button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download Template
        </button>
      </div>

      <div className="admin-section">
        <h2>Upload File</h2>

        <div
          className={`drop-zone ${isDragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileInputChange}
            style={{ display: 'none' }}
          />

          {file ? (
            <div className="file-info">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <div className="file-details">
                <span className="file-name">{file.name}</span>
                <span className="file-size">{(file.size / 1024).toFixed(1)} KB</span>
              </div>
              <button
                className="remove-file"
                onClick={(e) => {
                  e.stopPropagation();
                  resetState();
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="drop-zone-content">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <p>Drag and drop your CSV file here</p>
              <span>or click to browse</span>
            </div>
          )}
        </div>

        {status === 'validating' && (
          <div className="status-message validating">
            <LoadingSpinner size="small" />
            <span>Validating file...</span>
          </div>
        )}

        {errorMessage && (
          <div className="status-message error">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {preview.length > 0 && (
        <div className="admin-section">
          <h2>Preview (First 5 rows)</h2>
          <div className="preview-table-container">
            <table className="preview-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Metric Name</th>
                  <th>Value</th>
                  <th>Recorded At</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, index) => (
                  <tr key={index}>
                    <td>{row.category}</td>
                    <td>{row.metric_name}</td>
                    <td>{row.value}</td>
                    <td>{row.recorded_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {errors.length > 0 && (
        <div className="admin-section">
          <h2>Validation Errors ({errors.length})</h2>
          <div className="errors-list">
            {errors.slice(0, 10).map((error, index) => (
              <div key={index} className="error-item">
                <span className="error-row">Row {error.row}</span>
                <span className="error-field">{error.field}</span>
                <span className="error-message">{error.message}</span>
              </div>
            ))}
            {errors.length > 10 && (
              <p className="more-errors">...and {errors.length - 10} more errors</p>
            )}
          </div>
        </div>
      )}

      {file && status !== 'validating' && (
        <div className="admin-section">
          <div className="import-actions">
            <button
              className="action-button import-button"
              onClick={handleImport}
              disabled={status === 'importing'}
            >
              {status === 'importing' ? (
                <>
                  <LoadingSpinner size="small" />
                  Importing...
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  Import Data
                </>
              )}
            </button>
            <button className="action-button secondary" onClick={resetState}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {status === 'success' && importResult && (
        <div className="admin-section success-section">
          <div className="success-header">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <h2>Import Successful</h2>
          </div>
          <div className="import-summary">
            <div className="summary-item">
              <span className="summary-value">{importResult.rowsImported}</span>
              <span className="summary-label">Rows Imported</span>
            </div>
            <div className="summary-item">
              <span className="summary-value">{importResult.rowsSkipped}</span>
              <span className="summary-label">Rows Skipped</span>
            </div>
            <div className="summary-item">
              <span className="summary-value">{importResult.totalRows}</span>
              <span className="summary-label">Total Rows</span>
            </div>
          </div>
          <button className="action-button" onClick={resetState}>
            Import Another File
          </button>
        </div>
      )}
    </div>
  );
};

export default DataImport;
