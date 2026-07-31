// ─────────────────────────────────────────────────────────────
// SuperAdminSchoolSelector.jsx — Interactive School Branch Directory Hub
// ─────────────────────────────────────────────────────────────
// Displays a structured list / summary cards of all registered school branches
// for the Super Admin, enabling seamless context switching and branch provisioning.
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSchoolProfile } from '../context/SchoolProfileContext.jsx';
import { useViewMode } from '../context/ViewModeContext.jsx';
import { getAllRegisteredSchools, removeSchoolFromRegistry } from '../utils/schoolData.js';
import { getRegisteredSchoolsFromFirestore, deleteSchoolPortalFromFirestore } from '../firebase/firestoreSchema.js';
import SchoolRegistrationWizard from './SchoolRegistrationWizard.jsx';
import useConfirm from '../hooks/useConfirm.js';
import '../super-admin.css';

/** Color map for user initials or avatar accents */
const ACCENT_COLORS = ['#8b5cf6', '#2563eb', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'];

/**
 * Get initials from a school name for logo fallback.
 */
function getInitials(name) {
  if (!name) return 'SCH';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
}

/**
 * Custom hook to aggregate registered schools across localStorage & Firestore.
 */
export function useRegisteredSchoolsList() {
  const [schools, setSchools] = useState(() => getAllRegisteredSchools());

  const refresh = useCallback(async () => {
    const localSchools = getAllRegisteredSchools();
    setSchools(localSchools);

    let deletedList = [];
    try {
      const rawDeleted = window.localStorage.getItem('progga_deleted_schools_registry');
      if (rawDeleted) deletedList = JSON.parse(rawDeleted).map((s) => String(s).toLowerCase());
    } catch {}

    const isDeleted = (item) => {
      if (!item) return false;
      const id = String(item.schoolId || item.id || item.schoolCode || '').trim().toLowerCase();
      const eiin = String(item.eiinNumber || item.eiin || '').trim().toLowerCase();
      const code = String(item.schoolCode || item.code || '').trim().toLowerCase();
      return (id && deletedList.includes(id)) || (eiin && deletedList.includes(eiin)) || (code && deletedList.includes(code));
    };

    try {
      const remoteSchools = await getRegisteredSchoolsFromFirestore();
      if (Array.isArray(remoteSchools) && remoteSchools.length > 0) {
        const mergedMap = new Map();
        localSchools.forEach((s) => {
          if (isDeleted(s)) return;
          const key = String(s.schoolId || s.schoolCode || s.eiinNumber || '').toLowerCase();
          if (key) mergedMap.set(key, s);
        });

        remoteSchools.forEach((r) => {
          if (isDeleted(r)) return;
          const key = String(r.schoolId || r.schoolCode || r.eiinNumber || r.id || '').toLowerCase();
          if (key) {
            const existing = mergedMap.get(key) || {};
            mergedMap.set(key, {
              ...existing,
              ...r,
              schoolId: r.schoolId || r.schoolCode || r.id || existing.schoolId || 'SCH',
              schoolCode: r.schoolCode || r.schoolId || r.id || existing.schoolCode || 'SCH',
              schoolName: r.schoolName || existing.schoolName || 'Remote School Branch',
              eiinNumber: r.eiinNumber || existing.eiinNumber || 'N/A',
              adminName: r.adminName || existing.adminName || 'Admin',
            });
          }
        });

        setSchools(Array.from(mergedMap.values()));
      }
    } catch (err) {
      console.warn('Could not fetch remote schools for directory:', err);
    }
  }, []);

  useEffect(() => {
    refresh();
    const handleUpdate = () => refresh();
    window.addEventListener('storage', handleUpdate);
    window.addEventListener('schoolDataUpdate', handleUpdate);
    return () => {
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('schoolDataUpdate', handleUpdate);
    };
  }, [refresh]);

  return { schools, setSchools, refresh };
}

export default function SuperAdminSchoolSelector({ onSelectBranch }) {
  const { user, signOut } = useAuth();
  const { schoolProfile, switchSchool } = useSchoolProfile();
  const { setViewMode } = useViewMode();
  const { schools: schoolsList, setSchools: setSchoolsList, refresh } = useRegisteredSchoolsList();
  const confirm = useConfirm();

  const [searchQuery, setSearchQuery] = useState('');
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const activeSchoolId = schoolProfile?.schoolId || schoolProfile?.schoolCode || 'PROGGA_DEFAULT';
  const activeEiin = schoolProfile?.eiinNumber || '130743';

  // Handle selecting a school branch
  const handleSelectSchool = (targetSchool) => {
    if (!targetSchool) return;

    // 1. Switch context in SchoolProfileContext & localStorage
    switchSchool(targetSchool);

    // 2. Set View Mode to Admin
    setViewMode('admin');

    // 3. Feedback toast
    setToastMessage(`Switched active context to ${targetSchool.schoolName}`);

    // 4. Safely defer parent view transition so context updates commit before unmounting
    setTimeout(() => {
      if (onSelectBranch) {
        onSelectBranch(targetSchool);
      }
    }, 0);
  };

  // Handle explicit school deletion with double-confirmation modal
  const handleDeleteSchool = async (e, targetSchool) => {
    if (e) e.stopPropagation();
    if (!targetSchool) return;

    const targetId = targetSchool.schoolId || targetSchool.schoolCode || targetSchool.id;
    const targetName = targetSchool.schoolName || 'School Branch';
    const targetEiin = targetSchool.eiinNumber || '';
    const isMasterDefault = targetSchool.isDefault || targetId === 'SCHOLASTICBASE_DEFAULT' || targetId === 'PROGGA_DEFAULT';

    if (isMasterDefault) {
      setToastMessage('Default master school branch cannot be deleted.');
      return;
    }

    const isConfirmed = await confirm({
      title: 'Delete School Branch',
      message: `Are you sure you want to delete "${targetName}" (EIIN: ${targetEiin || 'N/A'})? This will permanently remove this school branch from your School Branch Directory.`,
      confirmText: 'OK, Delete School',
      cancelText: 'Cancel',
    });

    if (isConfirmed) {
      // 1. Instant optimistic UI removal frame
      setSchoolsList((prev) => prev.filter((s) => {
        const sId = String(s.schoolId || s.schoolCode || s.id || '').trim().toLowerCase();
        const sEiin = String(s.eiinNumber || '').trim().toLowerCase();
        const sName = String(s.schoolName || s.name || '').trim().toLowerCase();

        const tId = String(targetId).trim().toLowerCase();
        const tEiin = String(targetEiin).trim().toLowerCase();
        const tName = String(targetName).trim().toLowerCase();

        if (tId && sId === tId) return false;
        if (tEiin && sEiin === tEiin) return false;
        if (tName && sName === tName) return false;
        return true;
      }));

      // 2. Local storage & blacklist purge
      removeSchoolFromRegistry(targetSchool);

      // 3. Firestore deletion with guaranteed Auth token
      deleteSchoolPortalFromFirestore(targetId).catch(() => {});

      // 4. Feedback toast
      setToastMessage(`School branch "${targetName}" deleted successfully.`);
    }
  };

  // Filter schools list
  const filteredSchools = schoolsList.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(s.schoolName || '').toLowerCase().includes(q) ||
      String(s.eiinNumber || '').toLowerCase().includes(q) ||
      String(s.schoolId || s.schoolCode || '').toLowerCase().includes(q) ||
      String(s.adminName || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="sa-landing-container">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="sa-toast-notification">
          <span className="sa-toast-icon">⚡</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Hero Header */}
      <div className="sa-landing-hero">
        <div className="sa-hero-left">
          <div className="sa-hero-badge">⚡ CENTRALIZED MULTI-SCHOOL CONTROL HUB</div>
          <h1 className="sa-hero-title">School Branch Directory</h1>
          <p className="sa-hero-subtitle">
            Welcome, <strong>{user?.name || user?.userId || 'Super Admin'}</strong>! Select any registered school branch below to enter and control its administrative portal.
          </p>
        </div>

        <div className="sa-hero-right">
          <button
            className="sa-bar-btn sa-bar-btn-secondary"
            onClick={() => setIsWizardOpen(true)}
          >
            ➕ Provision New Branch
          </button>
          <button
            className="sa-bar-btn sa-bar-btn-outline"
            onClick={signOut}
          >
            🚪 Sign Out
          </button>
        </div>
      </div>

      {/* Filter Bar & Quick Stats */}
      <div className="sa-landing-controls">
        <div className="sa-search-wrapper">
          <span className="sa-search-icon">🔍</span>
          <input
            type="text"
            className="sa-school-search-input"
            placeholder="Search by Branch Name, EIIN Number, School ID, or Admin Name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="sa-modal-stats-pills">
          <span className="sa-stats-pill sa-pill-purple">
            🏛️ {schoolsList.length} Total Registered Branches
          </span>
          <span className="sa-stats-pill sa-pill-emerald">
            ✅ Active: {schoolProfile?.schoolName}
          </span>
          <span className="sa-stats-pill sa-pill-blue">
            🔢 Active EIIN: {activeEiin}
          </span>
        </div>
      </div>

      {/* Schools Cards Grid */}
      <div className="sa-landing-grid">
        {filteredSchools.length === 0 ? (
          <div className="sa-empty-schools">
            <span className="sa-empty-icon">🏫</span>
            <h3>No School Branches Found</h3>
            <p>No registered school branches match your search "{searchQuery}".</p>
            <button
              className="sa-bar-btn sa-bar-btn-secondary"
              onClick={() => {
                setSearchQuery('');
                setIsWizardOpen(true);
              }}
            >
              ➕ Register New School Branch
            </button>
          </div>
        ) : (
          filteredSchools.map((sch, idx) => {
            const schId = sch.schoolId || sch.schoolCode || 'PROGGA_DEFAULT';
            const schEiin = sch.eiinNumber || 'N/A';
            const isActive = String(schId).toLowerCase() === String(activeSchoolId).toLowerCase() ||
              (schEiin !== 'N/A' && String(schEiin) === String(activeEiin));
            const accentColor = ACCENT_COLORS[idx % ACCENT_COLORS.length];
            const isDefaultMaster = sch.isDefault || schId === 'SCHOLASTICBASE_DEFAULT' || schId === 'PROGGA_DEFAULT';

            return (
              <div
                key={schId}
                className={`sa-school-card ${isActive ? 'sa-school-card-active' : ''}`}
                onClick={() => handleSelectSchool(sch)}
              >
                <div className="sa-card-top">
                  <div className="sa-school-logo-wrap" style={{ borderColor: accentColor }}>
                    <img
                      src={sch.logo || schoolProfile?.logo}
                      alt={sch.schoolName}
                      className="sa-school-card-logo"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <span className="sa-school-initials" style={{ color: accentColor }}>
                      {getInitials(sch.schoolName)}
                    </span>
                  </div>

                  <div className="sa-card-badges">
                    {isActive ? (
                      <span className="sa-badge sa-badge-active">ACTIVE BRANCH</span>
                    ) : (
                      <span className="sa-badge sa-badge-inactive">REGISTERED BRANCH</span>
                    )}
                    <span className="sa-badge sa-badge-type">
                      {String(sch.schoolType || 'Combined').toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="sa-card-content">
                  <h3 className="sa-card-school-name" title={sch.schoolName}>
                    {sch.schoolName}
                  </h3>
                  {(sch.location || sch.address) && (
                    <p className="sa-card-school-location" style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b', fontWeight: 500 }}>
                      📍 {sch.location || sch.address}
                    </p>
                  )}

                  <div className="sa-card-details-list">
                    <div className="sa-card-detail-item">
                      <span className="sa-detail-label">🔢 EIIN Number:</span>
                      <span className="sa-detail-value sa-font-mono">{schEiin}</span>
                    </div>

                    <div className="sa-card-detail-item">
                      <span className="sa-detail-label">🆔 School ID / Code:</span>
                      <span className="sa-detail-value sa-font-mono">{schId}</span>
                    </div>

                    <div className="sa-card-detail-item">
                      <span className="sa-detail-label">👤 Admin Contact:</span>
                      <span className="sa-detail-value">
                        {sch.adminName || 'ScholasticBase Admin'}
                        {sch.adminEmail ? ` (${sch.adminEmail})` : ''}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="sa-card-footer" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    type="button"
                    className={`sa-card-switch-btn ${isActive ? 'sa-btn-active-disabled' : 'sa-btn-switch-now'}`}
                    style={{ flex: 1 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectSchool(sch);
                    }}
                  >
                    {isActive ? '✓ ENTER ACTIVE SCHOOL PANEL' : '🚀 LOGIN TO THIS SCHOOL BRANCH'}
                  </button>
                  {!isDefaultMaster && (
                    <button
                      type="button"
                      className="sa-card-delete-btn"
                      title={`Delete ${sch.schoolName}`}
                      onClick={(e) => handleDeleteSchool(e, sch)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid #fecaca',
                        background: '#fef2f2',
                        color: '#dc2626',
                        fontWeight: '700',
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s ease',
                        flexShrink: 0,
                      }}
                    >
                      🗑️ Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Provisioning Wizard */}
      <SchoolRegistrationWizard
        googleUser={user}
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onSuccess={(provisioned) => {
          setIsWizardOpen(false);
          refresh();
          if (provisioned?.schoolProfile) {
            handleSelectSchool(provisioned.schoolProfile);
          }
        }}
      />
    </div>
  );
}
