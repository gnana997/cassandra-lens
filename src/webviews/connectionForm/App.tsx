/**
 * Connection Form React App
 *
 * Multi-step form for creating/editing Cassandra connections.
 * Steps:
 * 1. Basic Connection Info (name, contact points, port, datacenter, keyspace)
 * 2. Authentication (optional username/password)
 * 3. SSL Configuration (optional SSL/TLS settings)
 * 4. Review & Test
 */

import { useState, useEffect } from 'react';

// Form state interface matching ConnectionProfile structure
interface FormState {
  id?: string;
  name: string;
  contactPoints: string[];
  port: number;
  localDatacenter: string;
  keyspace?: string;
  auth: {
    enabled: boolean;
    username?: string;
    password?: string;
  };
  ssl: {
    enabled: boolean;
    rejectUnauthorized?: boolean;
    caCertPath?: string;
  };
  advanced?: {
    useContactPointForAll?: boolean;
  };
}

// Form validation errors
interface FormErrors {
  name?: string;
  contactPoints?: string;
  port?: string;
  localDatacenter?: string;
  keyspace?: string;
  username?: string;
  password?: string;
  caCertPath?: string;
}

const App = () => {
  // Current step in the wizard (1-4)
  const [currentStep, setCurrentStep] = useState(1);

  // Form data
  const [form, setForm] = useState<FormState>({
    name: '',
    contactPoints: [''],
    port: 9042,
    localDatacenter: 'datacenter1',
    auth: { enabled: false },
    ssl: { enabled: false, rejectUnauthorized: true },
    advanced: { useContactPointForAll: false },
  });

  // Validation errors
  const [errors, setErrors] = useState<FormErrors>({});

  // Test connection result
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Loading states
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Contact points as comma-separated string for input
  const [contactPointsInput, setContactPointsInput] = useState('');

  // Load initial profile if editing
  useEffect(() => {
    if (window.initialProfile) {
      const profile = window.initialProfile;
      setForm({
        id: profile.id,
        name: profile.name || '',
        contactPoints: profile.contactPoints || [''],
        port: profile.port || 9042,
        localDatacenter: profile.localDatacenter || 'datacenter1',
        keyspace: profile.keyspace,
        auth: profile.auth || { enabled: false },
        ssl: profile.ssl || { enabled: false, rejectUnauthorized: true },
        advanced: profile.advanced || { useContactPointForAll: false },
      });
      setContactPointsInput((profile.contactPoints || ['']).join(', '));
    }

    // Listen for messages from extension
    window.addEventListener('message', handleExtensionMessage);
    return () => window.removeEventListener('message', handleExtensionMessage);
  }, []);

  // Handle messages from the extension
  const handleExtensionMessage = (event: MessageEvent) => {
    const message = event.data;

    switch (message.type) {
      case 'testResult':
        setIsTesting(false);
        setTestResult({
          success: message.success,
          message: message.message
        });
        break;

      case 'error':
        setIsSaving(false);
        setTestResult({
          success: false,
          message: message.message
        });
        break;

      case 'loadProfile':
        if (message.profile) {
          const profile = message.profile;
          setForm({
            id: profile.id,
            name: profile.name || '',
            contactPoints: profile.contactPoints || [''],
            port: profile.port || 9042,
            localDatacenter: profile.localDatacenter || 'datacenter1',
            keyspace: profile.keyspace,
            auth: profile.auth || { enabled: false },
            ssl: profile.ssl || { enabled: false, rejectUnauthorized: true },
            advanced: profile.advanced || { useContactPointForAll: false },
          });
          setContactPointsInput((profile.contactPoints || ['']).join(', '));
        }
        break;
    }
  };

  // Validate current step
  const validateStep = (step: number): boolean => {
    const newErrors: FormErrors = {};

    if (step === 1) {
      // Basic connection info
      if (!form.name.trim()) {
        newErrors.name = 'Connection name is required';
      }

      const contactPoints = contactPointsInput.split(',').map(cp => cp.trim()).filter(cp => cp);
      if (contactPoints.length === 0) {
        newErrors.contactPoints = 'At least one contact point is required';
      }

      if (form.port < 1 || form.port > 65535) {
        newErrors.port = 'Port must be between 1 and 65535';
      }

      if (!form.localDatacenter.trim()) {
        newErrors.localDatacenter = 'Local datacenter is required';
      }
    } else if (step === 2 && form.auth.enabled) {
      // Authentication
      if (!form.auth.username?.trim()) {
        newErrors.username = 'Username is required when authentication is enabled';
      }
      if (!form.auth.password?.trim()) {
        newErrors.password = 'Password is required when authentication is enabled';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle next button
  const handleNext = () => {
    if (validateStep(currentStep)) {
      // Update contact points array before moving to next step
      if (currentStep === 1) {
        setForm({
          ...form,
          contactPoints: contactPointsInput.split(',').map(cp => cp.trim()).filter(cp => cp)
        });
      }
      setCurrentStep(currentStep + 1);
    }
  };

  // Handle previous button
  const handlePrevious = () => {
    setCurrentStep(currentStep - 1);
    setErrors({});
  };

  // Handle test connection
  const handleTest = () => {
    if (!validateStep(currentStep)) {
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    // Update contact points before testing
    const testForm = {
      ...form,
      contactPoints: contactPointsInput.split(',').map(cp => cp.trim()).filter(cp => cp)
    };

    window.vscodeApi.postMessage({
      type: 'test',
      payload: testForm
    });
  };

  // Handle save connection
  const handleSave = () => {
    if (!validateStep(currentStep)) {
      return;
    }

    setIsSaving(true);

    // Update contact points before saving
    const saveForm = {
      ...form,
      contactPoints: contactPointsInput.split(',').map(cp => cp.trim()).filter(cp => cp)
    };

    window.vscodeApi.postMessage({
      type: 'save',
      payload: saveForm
    });
  };

  // Handle cancel
  const handleCancel = () => {
    window.vscodeApi.postMessage({ type: 'cancel' });
  };

  return (
    <div className="container">
      <div className="header">
        <h1>{form.id ? 'Edit Connection' : 'New Cassandra Connection'}</h1>
        <div className="steps">
          <span className={currentStep === 1 ? 'step active' : 'step'}>1. Basic Info</span>
          <span className={currentStep === 2 ? 'step active' : 'step'}>2. Authentication</span>
          <span className={currentStep === 3 ? 'step active' : 'step'}>3. SSL/TLS</span>
          <span className={currentStep === 4 ? 'step active' : 'step'}>4. Review</span>
        </div>
      </div>

      <div className="form">
        {/* Step 1: Basic Connection Info */}
        {currentStep === 1 && (
          <div className="step-content">
            <h2>Basic Connection Information</h2>

            <div className="form-group">
              <label htmlFor="name">Connection Name *</label>
              <input
                id="name"
                type="text"
                placeholder="Production Cluster"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={errors.name ? 'error' : ''}
              />
              {errors.name && <span className="error-message">{errors.name}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="contactPoints">Contact Points *</label>
              <input
                id="contactPoints"
                type="text"
                placeholder="10.0.1.10, 10.0.1.11, 10.0.1.12"
                value={contactPointsInput}
                onChange={(e) => setContactPointsInput(e.target.value)}
                className={errors.contactPoints ? 'error' : ''}
              />
              <span className="help-text">Comma-separated IP addresses or hostnames</span>
              {errors.contactPoints && <span className="error-message">{errors.contactPoints}</span>}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="port">Port *</label>
                <input
                  id="port"
                  type="number"
                  value={form.port}
                  onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 9042 })}
                  className={errors.port ? 'error' : ''}
                />
                {errors.port && <span className="error-message">{errors.port}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="datacenter">Local Datacenter *</label>
                <input
                  id="datacenter"
                  type="text"
                  placeholder="datacenter1"
                  value={form.localDatacenter}
                  onChange={(e) => setForm({ ...form, localDatacenter: e.target.value })}
                  className={errors.localDatacenter ? 'error' : ''}
                />
                {errors.localDatacenter && <span className="error-message">{errors.localDatacenter}</span>}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="keyspace">Default Keyspace (Optional)</label>
              <input
                id="keyspace"
                type="text"
                placeholder="my_keyspace"
                value={form.keyspace || ''}
                onChange={(e) => setForm({ ...form, keyspace: e.target.value || undefined })}
              />
              <span className="help-text">Auto-connect to this keyspace</span>
            </div>
          </div>
        )}

        {/* Step 2: Authentication */}
        {currentStep === 2 && (
          <div className="step-content">
            <h2>Authentication</h2>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.auth.enabled}
                  onChange={(e) => setForm({
                    ...form,
                    auth: { ...form.auth, enabled: e.target.checked }
                  })}
                />
                Enable authentication
              </label>
              <span className="help-text">Check if cluster requires username/password</span>
            </div>

            {form.auth.enabled && (
              <>
                <div className="form-group">
                  <label htmlFor="username">Username *</label>
                  <input
                    id="username"
                    type="text"
                    placeholder="cassandra"
                    value={form.auth.username || ''}
                    onChange={(e) => setForm({
                      ...form,
                      auth: { ...form.auth, username: e.target.value }
                    })}
                    className={errors.username ? 'error' : ''}
                  />
                  {errors.username && <span className="error-message">{errors.username}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="password">Password *</label>
                  <input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={form.auth.password || ''}
                    onChange={(e) => setForm({
                      ...form,
                      auth: { ...form.auth, password: e.target.value }
                    })}
                    className={errors.password ? 'error' : ''}
                  />
                  {errors.password && <span className="error-message">{errors.password}</span>}
                  <span className="help-text">Stored securely in VS Code Secret Storage</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 3: SSL/TLS */}
        {currentStep === 3 && (
          <div className="step-content">
            <h2>SSL/TLS Configuration</h2>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.ssl.enabled}
                  onChange={(e) => setForm({
                    ...form,
                    ssl: { ...form.ssl, enabled: e.target.checked }
                  })}
                />
                Enable SSL/TLS encryption
              </label>
              <span className="help-text">Encrypt connection to Cassandra cluster</span>
            </div>

            {form.ssl.enabled && (
              <>
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={form.ssl.rejectUnauthorized !== false}
                      onChange={(e) => setForm({
                        ...form,
                        ssl: { ...form.ssl, rejectUnauthorized: e.target.checked }
                      })}
                    />
                    Verify server certificate
                  </label>
                  <span className="help-text">Recommended for production (reject self-signed certs)</span>
                </div>

                <div className="form-group">
                  <label htmlFor="caCert">CA Certificate Path (Optional)</label>
                  <input
                    id="caCert"
                    type="text"
                    placeholder="/path/to/ca-cert.pem"
                    value={form.ssl.caCertPath || ''}
                    onChange={(e) => setForm({
                      ...form,
                      ssl: { ...form.ssl, caCertPath: e.target.value || undefined }
                    })}
                  />
                  <span className="help-text">Path to custom CA certificate</span>
                </div>
              </>
            )}

            <div className="form-group" style={{marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--vscode-panel-border)'}}>
              <h3 style={{marginBottom: '12px', fontSize: '14px'}}>Advanced Options</h3>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.advanced?.useContactPointForAll || false}
                  onChange={(e) => setForm({
                    ...form,
                    advanced: { ...form.advanced, useContactPointForAll: e.target.checked }
                  })}
                />
                Force all connections through contact point (VPN/Load Balancer mode)
              </label>
              <span className="help-text">
                Enable this when connecting through a VPN or load balancer where internal node IPs are not directly accessible.
                This prevents "ECONNRESET" errors by routing all traffic through your contact point hostname.
              </span>
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {currentStep === 4 && (
          <div className="step-content">
            <h2>Review Configuration</h2>

            <div className="review-section">
              <h3>Basic Information</h3>
              <div className="review-item">
                <span className="review-label">Name:</span>
                <span className="review-value">{form.name}</span>
              </div>
              <div className="review-item">
                <span className="review-label">Contact Points:</span>
                <span className="review-value">{contactPointsInput}</span>
              </div>
              <div className="review-item">
                <span className="review-label">Port:</span>
                <span className="review-value">{form.port}</span>
              </div>
              <div className="review-item">
                <span className="review-label">Datacenter:</span>
                <span className="review-value">{form.localDatacenter}</span>
              </div>
              {form.keyspace && (
                <div className="review-item">
                  <span className="review-label">Keyspace:</span>
                  <span className="review-value">{form.keyspace}</span>
                </div>
              )}
            </div>

            <div className="review-section">
              <h3>Authentication</h3>
              <div className="review-item">
                <span className="review-label">Enabled:</span>
                <span className="review-value">{form.auth.enabled ? 'Yes' : 'No'}</span>
              </div>
              {form.auth.enabled && (
                <div className="review-item">
                  <span className="review-label">Username:</span>
                  <span className="review-value">{form.auth.username}</span>
                </div>
              )}
            </div>

            <div className="review-section">
              <h3>SSL/TLS</h3>
              <div className="review-item">
                <span className="review-label">Enabled:</span>
                <span className="review-value">{form.ssl.enabled ? 'Yes' : 'No'}</span>
              </div>
              {form.ssl.enabled && (
                <>
                  <div className="review-item">
                    <span className="review-label">Verify Certificate:</span>
                    <span className="review-value">{form.ssl.rejectUnauthorized !== false ? 'Yes' : 'No'}</span>
                  </div>
                  {form.ssl.caCertPath && (
                    <div className="review-item">
                      <span className="review-label">CA Certificate:</span>
                      <span className="review-value">{form.ssl.caCertPath}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {form.advanced?.useContactPointForAll && (
              <div className="review-section">
                <h3>Advanced Options</h3>
                <div className="review-item">
                  <span className="review-label">VPN/Load Balancer Mode:</span>
                  <span className="review-value">Enabled</span>
                </div>
              </div>
            )}

            {testResult && (
              <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
                <strong>{testResult.success ? '✓ Connection Test Successful' : '✗ Connection Test Failed'}</strong>
                <p>{testResult.message}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer with navigation buttons */}
      <div className="footer">
        <button onClick={handleCancel} className="button secondary">
          Cancel
        </button>

        <div className="button-group">
          {currentStep > 1 && (
            <button onClick={handlePrevious} className="button secondary">
              Previous
            </button>
          )}

          {currentStep < 4 && (
            <button onClick={handleNext} className="button primary">
              Next
            </button>
          )}

          {currentStep === 4 && (
            <>
              <button
                onClick={handleTest}
                className="button secondary"
                disabled={isTesting || isSaving}
              >
                {isTesting ? 'Testing...' : 'Test Connection'}
              </button>
              <button
                onClick={handleSave}
                className="button primary"
                disabled={isTesting || isSaving}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
