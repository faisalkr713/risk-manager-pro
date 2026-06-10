import React, { useState, useRef } from 'react';
import { calculateRisk, getDefaultContractSpec, formatCurrency, formatPrice } from '../utils/calculations';
import { CalcResult } from '../types';
import { ASSET_TYPES, API_BASE } from '../constants';

const ScreenshotAnalyzer: React.FC<{ onUpgrade?: () => void }> = ({ onUpgrade }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inputs
  const [assetType, setAssetType] = useState('Forex');
  const [direction, setDirection] = useState<'BUY' | 'SELL'>('BUY');
  const [entryPrice, setEntryPrice] = useState('');
  const [stopLossPrice, setStopLossPrice] = useState('');
  const [takeProfitPrice, setTakeProfitPrice] = useState('');
  const [riskAmount, setRiskAmount] = useState('5');
  const [leverage, setLeverage] = useState('100');
  const [accountBalance, setAccountBalance] = useState('470');

  const [result, setResult] = useState<CalcResult | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = e => setImageUrl(e.target?.result as string);
    reader.readAsDataURL(file);
    setResult(null);
    setAiAnalysis('');
    setAiError('');
  };

  const runAiAnalysis = async () => {
    if (!imageUrl) return;
    setAiLoading(true);
    setAiError('');
    setAiAnalysis('');
    try {
      const base64 = imageUrl.split(',')[1];
      const mimeType = imageUrl.split(';')[0].split(':')[1];
      const token = localStorage.getItem('rmp_token');
      const res = await fetch(`${API_BASE}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      });
      const data = await res.json() as { analysis?: string; error?: string; limitReached?: boolean };
      if (data.limitReached) {
        setAiError('Free plan: 1 analysis/month used. Upgrade to Pro for unlimited.');
        if (onUpgrade) onUpgrade();
      } else if (data.error) {
        setAiError(data.error);
      } else {
        setAiAnalysis(data.analysis ?? '');
      }
    } catch {
      setAiError('Analysis failed. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find(i => i.type.startsWith('image'));
    if (item) {
      const file = item.getAsFile();
      if (file) handleFile(file);
    }
  };

  const analyze = () => {
    const entry = parseFloat(entryPrice);
    const sl = parseFloat(stopLossPrice);
    const tp = parseFloat(takeProfitPrice);
    const risk = parseFloat(riskAmount);
    const lev = parseFloat(leverage) || 1;
    const bal = parseFloat(accountBalance) || 0;

    if (isNaN(entry) || isNaN(sl) || isNaN(risk)) return;

    const spec = getDefaultContractSpec(assetType);
    const tpDistance = Math.abs(tp - entry);
    const slDistance = Math.abs(entry - sl);
    const rrRatio = slDistance > 0 && !isNaN(tp) ? tpDistance / slDistance : 2;

    const res = calculateRisk({
      assetType,
      direction,
      entryPrice: entry,
      stopLossPrice: sl,
      riskAmount: risk,
      rewardRiskRatio: rrRatio,
      leverage: lev,
      contractSize: spec.contractSize,
      tickSize: spec.tickSize,
      tickValue: spec.tickValue,
      accountBalance: bal,
    });

    if (!isNaN(tp) && tp > 0) {
      res.takeProfit = tp;
      res.rrRatio = Math.round(rrRatio * 100) / 100;
      res.potentialProfit = Math.abs(res.quantity * (tp - entry));
    }

    setResult(res);
  };

  const inputStyle: React.CSSProperties = {
    background: '#121212',
    border: '1px solid #3A3A3A',
    borderRadius: 8,
    color: '#FFFFFF',
    fontSize: 13,
    padding: '9px 11px',
    width: '100%',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    color: '#B0B0B0',
    fontSize: 11,
    fontWeight: 500,
    marginBottom: 4,
    display: 'block',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  };

  return (
    <div
      style={{ padding: 24, maxWidth: 1100 }}
      onPaste={handlePaste}
    >
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ color: '#FFFFFF', fontSize: 24, fontWeight: 700, margin: 0 }}>Screenshot Analyzer</h1>
        <p style={{ color: '#666', fontSize: 13, margin: '4px 0 0' }}>Upload a chart screenshot and manually input prices to calculate risk</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>
        {/* Left: Image */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? '#2979FF' : '#3A3A3A'}`,
              borderRadius: 12,
              background: dragOver ? 'rgba(41,121,255,0.05)' : '#1E1E1E',
              minHeight: imageUrl ? 'auto' : 220,
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                alt="Chart screenshot"
                style={{ width: '100%', borderRadius: 10, display: 'block' }}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📷</div>
                <p style={{ color: '#B0B0B0', margin: 0, fontWeight: 600 }}>Drop chart screenshot here</p>
                <p style={{ color: '#555', fontSize: 12, margin: '8px 0 0' }}>or click to browse • also supports Ctrl+V paste</p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          {imageUrl && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={runAiAnalysis} disabled={aiLoading} style={{ ...primaryBtn, flex: 1, opacity: aiLoading ? 0.7 : 1 }}>
                {aiLoading ? '🤖 Analyzing...' : '🤖 AI Analyze Chart'}
              </button>
              <button onClick={() => { setImageUrl(null); setResult(null); setAiAnalysis(''); }} style={ghostBtn}>
                Remove
              </button>
            </div>
          )}

          {/* AI Analysis Result */}
          {aiError && (
            <div style={{ background: '#200A10', border: '1px solid #FF174430', borderRadius: 12, padding: 16 }}>
              <p style={{ color: '#FF1744', margin: 0, fontSize: 13 }}>⚠ {aiError}</p>
            </div>
          )}
          {aiAnalysis && (
            <div style={{ background: '#0A1628', border: '1px solid #2979FF30', borderRadius: 12, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <span style={{ fontSize: 20 }}>🤖</span>
                <h3 style={{ color: '#2979FF', margin: 0, fontSize: 15, fontWeight: 700 }}>AI Chart Analysis</h3>
              </div>
              <div style={{ color: '#C0C0C0', fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                {aiAnalysis}
              </div>
            </div>
          )}

          {/* Results */}
          {result && (
            <div style={{ background: '#1E1E1E', borderRadius: 12, padding: 20, border: '1px solid #2A2A2A' }}>
              <h2 style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 600, margin: '0 0 16px' }}>Analysis Results</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                <ResultBox label="Stop Distance" value={formatPrice(result.stopDistance)} />
                <ResultBox label="RR Ratio" value={`1:${result.rrRatio}`} color="#2979FF" />
                <ResultBox label="Quantity" value={result.quantity.toLocaleString()} />
                <ResultBox label="Lot Size" value={result.lotSize.toFixed(4)} />
                <ResultBox label="Margin Required" value={formatCurrency(result.marginRequired)} color="#FFD600" />
                <ResultBox label="Risk %" value={`${result.riskPercent.toFixed(2)}%`} color={result.riskPercent > 2 ? '#FF1744' : '#00C853'} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ background: '#0A2010', borderRadius: 10, padding: '12px 16px', border: '1px solid #00C85330', textAlign: 'center' }}>
                  <div style={{ color: '#00C853', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Potential Profit</div>
                  <div style={{ color: '#00C853', fontWeight: 700, fontSize: 22, fontFamily: 'monospace' }}>+{formatCurrency(result.potentialProfit)}</div>
                </div>
                <div style={{ background: '#200A10', borderRadius: 10, padding: '12px 16px', border: '1px solid #FF174430', textAlign: 'center' }}>
                  <div style={{ color: '#FF1744', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Potential Loss</div>
                  <div style={{ color: '#FF1744', fontWeight: 700, fontSize: 22, fontFamily: 'monospace' }}>-{formatCurrency(result.potentialLoss)}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Inputs */}
        <div style={{ background: '#1E1E1E', borderRadius: 12, padding: 20, border: '1px solid #2A2A2A', height: 'fit-content' }}>
          <h2 style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 600, margin: '0 0 20px' }}>Trade Parameters</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>Asset Type</label>
              <select value={assetType} onChange={e => setAssetType(e.target.value)} style={inputStyle}>
                {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Direction</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['BUY', 'SELL'] as const).map(d => (
                  <button
                    key={d}
                    onClick={() => setDirection(d)}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: 8,
                      border: direction === d
                        ? `2px solid ${d === 'BUY' ? '#00C853' : '#FF1744'}`
                        : '2px solid #2A2A2A',
                      background: direction === d
                        ? `${d === 'BUY' ? '#00C853' : '#FF1744'}20`
                        : '#121212',
                      color: direction === d
                        ? (d === 'BUY' ? '#00C853' : '#FF1744')
                        : '#B0B0B0',
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    {d === 'BUY' ? '▲ BUY' : '▼ SELL'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={labelStyle}>Entry Price *</label>
              <input
                type="number"
                value={entryPrice}
                onChange={e => setEntryPrice(e.target.value)}
                style={inputStyle}
                step="any"
                placeholder="e.g. 1.08500"
              />
            </div>

            <div>
              <label style={labelStyle}>Stop Loss Price *</label>
              <input
                type="number"
                value={stopLossPrice}
                onChange={e => setStopLossPrice(e.target.value)}
                style={inputStyle}
                step="any"
                placeholder="e.g. 1.08000"
              />
            </div>

            <div>
              <label style={labelStyle}>Take Profit Price</label>
              <input
                type="number"
                value={takeProfitPrice}
                onChange={e => setTakeProfitPrice(e.target.value)}
                style={inputStyle}
                step="any"
                placeholder="e.g. 1.09500 (optional)"
              />
            </div>

            <div>
              <label style={labelStyle}>Risk Amount ($) *</label>
              <input
                type="number"
                value={riskAmount}
                onChange={e => setRiskAmount(e.target.value)}
                style={inputStyle}
                step="0.01"
                min="0"
              />
            </div>

            <div>
              <label style={labelStyle}>Leverage</label>
              <input
                type="number"
                value={leverage}
                onChange={e => setLeverage(e.target.value)}
                style={inputStyle}
                min="1"
              />
            </div>

            <div>
              <label style={labelStyle}>Account Balance ($)</label>
              <input
                type="number"
                value={accountBalance}
                onChange={e => setAccountBalance(e.target.value)}
                style={inputStyle}
                step="0.01"
              />
            </div>

            <button
              onClick={analyze}
              disabled={!entryPrice || !stopLossPrice || !riskAmount}
              style={{
                ...primaryBtn,
                width: '100%',
                opacity: (!entryPrice || !stopLossPrice || !riskAmount) ? 0.5 : 1,
                cursor: (!entryPrice || !stopLossPrice || !riskAmount) ? 'not-allowed' : 'pointer',
                padding: '12px',
                fontSize: 15,
              }}
            >
              Analyze Trade
            </button>

            {!imageUrl && (
              <p style={{ color: '#555', fontSize: 11, textAlign: 'center', margin: 0 }}>
                Upload a screenshot above to visualize your trade setup
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ResultBox: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color = '#FFFFFF' }) => (
  <div style={{ background: '#121212', borderRadius: 8, padding: '10px 12px' }}>
    <div style={{ color: '#555', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
    <div style={{ color, fontWeight: 700, fontFamily: 'monospace', fontSize: 15 }}>{value}</div>
  </div>
);

const primaryBtn: React.CSSProperties = { background: '#2979FF', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', padding: '10px 20px', fontSize: 14, fontWeight: 700 };
const ghostBtn: React.CSSProperties = { background: 'transparent', border: '1px solid #3A3A3A', borderRadius: 8, color: '#B0B0B0', cursor: 'pointer', padding: '8px 16px', fontSize: 13, fontWeight: 600 };

export default ScreenshotAnalyzer;
