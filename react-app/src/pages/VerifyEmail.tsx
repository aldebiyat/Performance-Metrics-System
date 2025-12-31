import React, { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import './Auth.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setStatus('error');
        setMessage('Verification token is missing');
        return;
      }

      try {
        const response = await fetch(`${API_URL}/api/auth/verify-email?token=${encodeURIComponent(token)}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error?.message || 'Failed to verify email');
        }

        setStatus('success');
        setMessage(data.data?.message || 'Email verified successfully');

        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } catch (err) {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Failed to verify email');
      }
    };

    verifyEmail();
  }, [token, navigate]);

  if (!token) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1>Invalid Link</h1>
            <p>This verification link is invalid or has expired.</p>
          </div>
          <div className="auth-footer">
            <p>
              <Link to="/login">Go to Login</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Email Verification</h1>
        </div>

        {status === 'loading' && (
          <div className="auth-loading">
            <LoadingSpinner size="large" />
            <p>Verifying your email...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="auth-success">
            <p>{message}</p>
            <p>Redirecting to login...</p>
          </div>
        )}

        {status === 'error' && (
          <>
            <div className="auth-error">{message}</div>
            <div className="auth-footer">
              <p>
                Need a new verification link?{' '}
                <Link to="/login">Go to Login</Link> and request a new one.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;
