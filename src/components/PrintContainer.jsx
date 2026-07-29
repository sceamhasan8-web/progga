import React from 'react';
import { useSchoolProfile } from '../context/SchoolProfileContext.jsx';

/**
 * PrintContainer Component
 * Reusable wrapper that standardizes printable sections across the application.
 * Guarantees zero vertical overflow, 1-page fit policy, dynamic institution branding,
 * official footer signature blocks, and web-to-print engine compliance.
 */
export const PrintContainer = ({
  title,
  subtitle,
  schoolName,
  eiinNumber,
  location,
  branchName,
  logoUrl = '/greenfield_logo.png',
  orientation = 'portrait', // 'portrait' | 'landscape'
  singlePageFit = false,
  showWatermark = true,
  watermarkText,
  showFooter = true,
  signatures = ['Prepared By', 'Class Teacher', 'Principal / Headmaster'],
  footerNote = 'Official Document — Valid without physical seal if verified digitally.',
  showTriggerButton = true,
  triggerBtnText = '🖨️ Print Document / Save PDF',
  children,
  className = '',
}) => {
  let profileContext = null;
  try {
    profileContext = useSchoolProfile();
  } catch {
    // optional fallback if used outside context provider
  }
  const schoolProfile = profileContext?.schoolProfile;

  const activeSchoolName =
    schoolName ||
    schoolProfile?.schoolName ||
    (typeof window !== 'undefined'
      ? window.localStorage.getItem('schoolName')
      : null) ||
    'ScholasticBase';

  const activeEiinNumber =
    eiinNumber ||
    schoolProfile?.eiinNumber ||
    (typeof window !== 'undefined'
      ? window.localStorage.getItem('schoolEiinNumber')
      : null);

  const activeLocation =
    location ||
    schoolProfile?.location ||
    (typeof window !== 'undefined'
      ? window.localStorage.getItem('schoolLocation')
      : null);

  const currentDateStr = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const containerClasses = [
    'printable-area',
    'print-container',
    orientation === 'landscape' ? 'print-landscape' : '',
    singlePageFit ? 'print-single-page' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="print-wrapper-root">
      {/* Screen-Only Action Toolbar */}
      {showTriggerButton && (
        <div className="print-trigger-bar no-print">
          <div>
            <span style={{ fontWeight: 600, fontSize: 13, color: '#475569' }}>
              📄 Printable Document Ready ({orientation.toUpperCase()})
            </span>
          </div>
          <button
            type="button"
            className="print-trigger-btn print-allow"
            onClick={handlePrint}
          >
            {triggerBtnText}
          </button>
        </div>
      )}

      {/* Main Printable Document Layout */}
      <div className={containerClasses} data-print-container="true">
        {/* Dynamic Watermark */}
        {showWatermark && (
          <div className="print-watermark">
            {watermarkText || activeSchoolName}
          </div>
        )}

        {/* Standardized Header */}
        <header className="print-header">
          <div className="print-header-left">
            {logoUrl && (
              <img
                src={logoUrl}
                alt="School Logo"
                className="print-logo"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
            <div>
              <h1 className="print-institution-name">{activeSchoolName}</h1>
              {activeLocation && (
                <p className="print-school-location" style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                  📍 {activeLocation}
                </p>
              )}
              {activeEiinNumber && (
                <p className="print-eiin-number" style={{ margin: '2px 0 0', fontSize: '10pt', fontWeight: 600, color: '#334155' }}>
                  EIIN: {activeEiinNumber}
                </p>
              )}
              {branchName && (
                <p className="print-institution-meta">Branch: {branchName}</p>
              )}
            </div>
          </div>
          <div className="print-header-right">
            {title && <h2 className="print-title">{title}</h2>}
            {subtitle && <p className="print-subtitle">{subtitle}</p>}
            <p className="print-institution-meta" style={{ marginTop: 2 }}>
              Date: {currentDateStr}
            </p>
          </div>
        </header>

        <div className="print-header-divider" />

        {/* Printable Body Content */}
        <main className="print-body">{children}</main>

        {/* Official Footer & Signature Area */}
        {showFooter && (
          <footer className="print-footer">
            {signatures && signatures.length > 0 && (
              <div className="print-signatures-row">
                {signatures.map((sigLabel, idx) => (
                  <div key={idx} className="print-signature-item">
                    <div className="print-signature-line" />
                    <span className="print-signature-label">{sigLabel}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="print-footer-meta">
              <span>{footerNote}</span>
              <span>
                Generated: {currentDateStr} | Page 1 of 1
              </span>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
};

export default PrintContainer;
