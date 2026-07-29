// ─────────────────────────────────────────────────────────────
// SuperAdminDashboard.jsx — Master Centralized Multi-School Branch Control System
// ─────────────────────────────────────────────────────────────
// Orchestrates Super Admin workflow between:
//   1. School Selection Hub (SuperAdminSchoolSelector)
//   2. Selected Branch Admin Panel (AdminDashboard with persistent Super Admin Header)
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useSchoolProfile } from '../context/SchoolProfileContext.jsx';
import { useViewMode } from '../context/ViewModeContext.jsx';
import SuperAdminSchoolSelector, { useRegisteredSchoolsList } from './SuperAdminSchoolSelector.jsx';
import AdminDashboard from './AdminDashboard.jsx';
import SchoolRegistrationWizard from './SchoolRegistrationWizard.jsx';
import '../super-admin.css';

export default function SuperAdminDashboard() {
  const { user, signOut } = useAuth();
  const { schoolProfile } = useSchoolProfile();
  const { setViewMode } = useViewMode();
  const navigate = useNavigate();
  const { schools: schoolsList } = useRegisteredSchoolsList();

  // Mode: 'directory' (School Selection Hub) vs 'branch' (Active Branch Admin Portal)
  const [viewModeState, setViewModeState] = useState('directory');
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const activeSchoolName = schoolProfile?.schoolName || 'ScholasticBase';
  const activeEiin = schoolProfile?.eiinNumber || '130743';
  const activeSchoolId = schoolProfile?.schoolId || schoolProfile?.schoolCode || 'SCHOLASTICBASE_DEFAULT';

  // Handle branch selection from selector
  const handleSelectBranch = (selectedSchool) => {
    setViewMode('admin');
    setViewModeState('branch');
  };

  // Return to School Selection Directory Hub
  const handleSwitchSchool = () => {
    setViewModeState('directory');
  };

  return (
    <div className="sa-master-dashboard-container">
      {/* ── PERSISTENT TOP CONTROL HEADER (Inside Branch Mode) ── */}
      {viewModeState === 'branch' && (
        <header className="sa-branch-control-header">
          <div className="sa-header-left">
            <span className="sa-header-badge">⚡ SUPER ADMIN CONTROL CENTER</span>
            <div className="sa-header-school-details">
              <span className="sa-header-icon">🏫</span>
              <div>
                <span className="sa-header-school-name">{activeSchoolName}</span>
                {(schoolProfile?.location || window.localStorage.getItem('schoolLocation')) && (
                  <span className="sa-header-school-location" style={{ display: 'block', fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>
                    📍 {schoolProfile?.location || window.localStorage.getItem('schoolLocation')}
                  </span>
                )}
              </div>
              <span className="sa-header-pill sa-pill-eiin">EIIN: {activeEiin}</span>
              <span className="sa-header-pill sa-pill-id">ID: {activeSchoolId}</span>
            </div>
          </div>

          <div className="sa-header-right">
            <button
              className="sa-bar-btn sa-bar-btn-primary sa-header-switch-btn"
              onClick={handleSwitchSchool}
              title="Return to Master School Directory Hub"
            >
              🔄 Switch School Branch ({schoolsList.length})
            </button>
            <button
              className="sa-bar-btn sa-bar-btn-secondary"
              onClick={() => setIsWizardOpen(true)}
              title="Provision a new school branch"
            >
              ➕ Provision Branch
            </button>
            <button
              className="sa-bar-btn sa-bar-btn-outline"
              onClick={signOut}
              title="Sign Out of Super Admin System"
            >
              🚪 Sign Out
            </button>
          </div>
        </header>
      )}

      {/* ── MAIN CONTENT VIEW ── */}
      <main className="sa-master-main-content">
        {viewModeState === 'directory' ? (
          <div className="sa-directory-view-wrapper">
            <SuperAdminSchoolSelector onSelectBranch={handleSelectBranch} />
          </div>
        ) : (
          <div className="sa-active-branch-wrapper">
            <AdminDashboard />
          </div>
        )}
      </main>

      {/* Provisioning Wizard modal accessible from top header */}
      <SchoolRegistrationWizard
        googleUser={user}
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onSuccess={() => {
          setIsWizardOpen(false);
        }}
      />
    </div>
  );
}
