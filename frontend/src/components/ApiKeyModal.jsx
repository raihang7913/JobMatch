import { useState, useEffect } from 'react'
import { X, Eye, EyeSlash, CheckCircle, XCircle, Info } from '@phosphor-icons/react'
import {
  testConnection,
  saveDirectConfig,
  save9RouterConfig,
  getStoredConfig,
  clearConfig,
  DIRECT_PROVIDERS,
} from '../api/llmClient'

export default function SetupModal({ isOpen, onClose, onSuccess }) {
  const [mode, setMode] = useState('direct')
  const [directProvider, setDirectProvider] = useState(DIRECT_PROVIDERS.OPENAI)
  const [directApiKey, setDirectApiKey] = useState('')
  const [nrUrl, setNrUrl] = useState('http://localhost:9090')
  const [nrApiKey, setNrApiKey] = useState('')
  const [nrModel, setNrModel] = useState('vip')
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      const config = getStoredConfig()
      if (config) {
        setMode(config.mode)
        if (config.mode === 'direct') {
          setDirectProvider(config.direct.provider)
          setDirectApiKey(config.direct.apiKey)
        } else {
          setNrUrl(config.ninerouter.baseUrl)
          setNrApiKey(config.ninerouter.apiKey)
          setNrModel(config.ninerouter.model)
        }
      }
      setShowKey(false)
      setTestResult(null)
      setError('')
    }
  }, [isOpen])

  const handleTest = async () => {
    if (mode === 'direct' && !directApiKey.trim()) {
      setError('Masukkan API key terlebih dahulu')
      return
    }
    if (mode === 'ninerouter' && !nrUrl.trim()) {
      setError('Masukkan 9Router URL')
      return
    }

    // Save first so testConnection can read it
    if (mode === 'direct') saveDirectConfig(directProvider, directApiKey)
    else save9RouterConfig(nrUrl, nrApiKey, nrModel)

    setTesting(true)
    setError('')
    setTestResult(null)

    const result = await testConnection()
    setTesting(false)
    setTestResult(result)

    if (!result.valid) setError(result.error || 'Gagal test koneksi')
  }

  const handleSave = () => {
    if (mode === 'direct') {
      if (!directApiKey.trim()) {
        setError('Masukkan API key')
        return
      }
      saveDirectConfig(directProvider, directApiKey)
    } else {
      if (!nrUrl.trim()) {
        setError('Masukkan 9Router URL')
        return
      }
      save9RouterConfig(nrUrl, nrApiKey, nrModel)
    }
    onSuccess?.()
    onClose()
  }

  const handleClear = () => {
    if (confirm('Yakin ingin menghapus konfigurasi AI?')) {
      clearConfig()
      setDirectApiKey('')
      setNrApiKey('')
      setTestResult(null)
      setError('')
      onClose()
    }
  }

  const handleClose = () => {
    setError('')
    setTestResult(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Setup AI Backend</h2>
          <button className="btn-icon" onClick={handleClose}>
            <X size={24} />
          </button>
        </div>

        <div className="modal-body">
          {/* Privacy */}
          <div className="info-box">
            <Info size={20} weight="fill" />
            <div>
              <strong>Privacy Notice:</strong>
              <p>
                Konfigurasi disimpan di browser Anda (localStorage) dan tidak pernah dikirim ke
                server kami.
              </p>
            </div>
          </div>

          {/* Mode Toggle */}
          <div className="form-group">
            <label>Mode</label>
            <div className="toggle-group">
              <button
                className={`toggle-btn ${mode === 'direct' ? 'active' : ''}`}
                onClick={() => setMode('direct')}
              >
                Direct Cloud
              </button>
              <button
                className={`toggle-btn ${mode === 'ninerouter' ? 'active' : ''}`}
                onClick={() => setMode('ninerouter')}
              >
                9Router (Local)
              </button>
            </div>
          </div>

          {/* ── Direct Mode Fields ── */}
          {mode === 'direct' && (
            <>
              <div className="form-group">
                <label>Provider</label>
                <select
                  value={directProvider}
                  onChange={(e) => setDirectProvider(e.target.value)}
                  className="input"
                >
                  <option value={DIRECT_PROVIDERS.OPENAI}>OpenAI (GPT)</option>
                  <option value={DIRECT_PROVIDERS.GEMINI}>Google Gemini</option>
                  <option value={DIRECT_PROVIDERS.CLAUDE}>Anthropic Claude</option>
                </select>
              </div>

              <div className="form-group">
                <label>API Key</label>
                <div className="input-with-icon">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={directApiKey}
                    onChange={(e) => {
                      setDirectApiKey(e.target.value)
                      setTestResult(null)
                      setError('')
                    }}
                    placeholder={
                      directProvider === 'openai'
                        ? 'sk-...'
                        : directProvider === 'gemini'
                          ? 'AIza...'
                          : 'sk-ant-...'
                    }
                    className="input"
                  />
                  <button className="btn-icon-inline" onClick={() => setShowKey(!showKey)}>
                    {showKey ? <EyeSlash size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div className="pricing-info">
                <strong>Estimasi Biaya:</strong>
                <ul>
                  {directProvider === 'openai' && <li>GPT-3.5-turbo: ~$0.002/optimasi</li>}
                  {directProvider === 'gemini' && <li>Gemini Flash: Gratis hingga 60 req/menit</li>}
                  {directProvider === 'claude' && <li>Claude Haiku: ~$0.001/optimasi</li>}
                </ul>
              </div>
            </>
          )}

          {/* ── 9Router Mode Fields ── */}
          {mode === 'ninerouter' && (
            <>
              <div className="form-group">
                <label>9Router URL</label>
                <input
                  type="text"
                  value={nrUrl}
                  onChange={(e) => {
                    setNrUrl(e.target.value)
                    setTestResult(null)
                    setError('')
                  }}
                  placeholder="http://localhost:9090"
                  className="input"
                />
              </div>

              <div className="form-group">
                <label>API Key (jika auth aktif)</label>
                <div className="input-with-icon">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={nrApiKey}
                    onChange={(e) => {
                      setNrApiKey(e.target.value)
                      setTestResult(null)
                      setError('')
                    }}
                    placeholder="Opsional"
                    className="input"
                  />
                  <button className="btn-icon-inline" onClick={() => setShowKey(!showKey)}>
                    {showKey ? <EyeSlash size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Model</label>
                <input
                  type="text"
                  value={nrModel}
                  onChange={(e) => {
                    setNrModel(e.target.value)
                    setTestResult(null)
                    setError('')
                  }}
                  placeholder="vip, openai/gpt-4o, cc/claude-opus-4-7"
                  className="input"
                />
                <span className="text-xs text-muted-foreground mt-1">
                  Combo: vip, mycodex | Single: openai/gpt-4o, cc/claude-opus-4-7
                </span>
              </div>

              <div className="api-key-links">
                <strong>Install 9Router:</strong>
                <ul>
                  <li>
                    <a
                      href="https://github.com/decolua/9router"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      github.com/decolua/9router
                    </a>
                  </li>
                </ul>
              </div>
            </>
          )}

          {/* Test Result */}
          {testResult && (
            <div className={`test-result ${testResult.valid ? 'success' : 'error'}`}>
              {testResult.valid ? (
                <>
                  <CheckCircle size={20} weight="fill" />
                  <span>
                    Connected!{' '}
                    {testResult.models?.length ? `(${testResult.models.length} models)` : ''}
                  </span>
                </>
              ) : (
                <>
                  <XCircle size={20} weight="fill" />
                  <span>Gagal koneksi</span>
                </>
              )}
            </div>
          )}

          {error && <div className="error-message">{error}</div>}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={handleTest} disabled={testing}>
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
          <button className="btn btn-danger" onClick={handleClear}>
            Clear
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
