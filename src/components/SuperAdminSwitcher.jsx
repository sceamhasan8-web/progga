// ─────────────────────────────────────────────────────────────
// SuperAdminSwitcher.jsx — Super Admin School Selection Screen & Controls
// ─────────────────────────────────────────────────────────────
// Exports:
//   1. SuperAdminLandingScreen — Full-page landing view for Super Admin after login to select active school portal
//   2. SuperAdminSwitcher — Persistent top navigation bar & floating role switcher
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useViewMode, VIEW_MODES } from '../context/ViewModeContext.jsx';
import { useSchoolProfile } from '../context/SchoolProfileContext.jsx';
import { getAllRegisteredSchools, useLiveSchoolData } from '../utils/schoolData.js';
import { getRegisteredSchoolsFromFirestore } from '../firebase/firestoreSchema.js';
import SchoolRegistrationWizard from './SchoolRegistrationWizard.jsx';
import '../super-admin.css';

/** Color map for user avatar backgrounds */
const ROLE_COLORS = {
  admin: '#8b5cf6',
  teacher: '#2563eb',
  student: '#06b6d4',
  principal: '#f59e0b',
};

/**
 * Get initials from a user name for avatar display.
 */
function getInitials(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
}

/**
 * Load all registered user accounts from localStorage.
 */
function loadAllUsers() {
  try {
    const raw = window.localStorage.getItem('schoolAppLocalUsers');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Object.values(parsed).filter((u) => u && u.userId);
  } catch {
    return [];
  }
}

/**
 * Custom hook to aggregate registered schools across localStorage & Firestore.
 */
function useRegisteredSchoolsList() {
  const [schools, setSchools] = useState(() => getAllRegisteredSchools());

  const refresh = useCallback(async () => {
    const localSchools = getAllRegisteredSchools();
    setSchools(localSchools);

    try {
      const remoteSchools = await getRegisteredSchoolsFromFirestore();
      if (Array.isArray(remoteSchools) && remoteSchools.length > 0) {
        const mergedMap = new Map();
        localSchools.forEach((s) => mergedMap.set(String(s.schoolId || s.schoolCode || s.eiinNumber).toLowerCase(), s));

        remoteSchools.forEach((r) => {
          const key = String(r.schoolId || r.schoolCode || r.eiinNumber || r.id || '').toLowerCase();
          if (key) {
            const existing = mergedMap.get(key) || {};
            mergedMap.set(key, {
              ...existing,
              ...r,
              schoolId: r.schoolId || r.schoolCode || r.id || existing.schoolId || 'SCH',
              schoolCode: r.schoolCode || r.schoolId || r.id || existing.schoolCode || 'SCH',
              schoolName: r.schoolName || existing.schoolName || 'Remote School',
              eiinNumber: r.eiinNumber || existing.eiinNumber || 'N/A',
              adminName: r.adminName || existing.adminName || 'Admin',
            });
          }
        });

        setSchools(Array.from(mergedMap.values()));
      }
    } catch (err) {
      console.warn('Could not fetch remote schools for switcher:', err);
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

  return { schools, refresh };
}

import SuperAdminSchoolSelector from './SuperAdminSchoolSelector.jsx';

// ─────────────────────────────────────────────────────────────
// 1. FULL-PAGE SUPER ADMIN SCHOOL SELECTION SCREEN
// ─────────────────────────────────────────────────────────────
export const SuperAdminLandingScreen = SuperAdminSchoolSelector;

// ─────────────────────────────────────────────────────────────
// 2. PERSISTENT SUPER ADMIN TOP NAVIGATION BAR & FLOATING OVERLAY
// ─────────────────────────────────────────────────────────────
export default function SuperAdminSwitcher() {
  const { user } = useAuth();
  const { schoolProfile } = useSchoolProfile();
  const {
    viewMode,
    setViewMode,
    isSuperAdmin,
    canSwitch,
    isImpersonating,
    impersonatedUser,
    impersonate,
    stopImpersonating,
  } = useViewMode();

  const navigate = useNavigate();
  const location = useLocation();
  const { students = [], teachers = [], counts = {} } = useLiveSchoolData() || {};

  const { schools: schoolsList } = useRegisteredSchoolsList();

  const [isOpen, setIsOpen] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [allUsers, setAllUsers] = useState([]);
  const dropdownRef = useRef(null);

  // Load users when dropdown is open
  useEffect(() => {
    if (isOpen) {
      const registeredUsers = loadAllUsers() || [];
      const registeredIds = new Set(registeredUsers.map((u) => String(u?.userId || u?.email || '').toLowerCase()));

      const safeStudents = Array.isArray(students) ? students : [];
      const extraStudents = safeStudents
        .filter((s) => s && !registeredIds.has(String(s.id || s.userId || '').toLowerCase()))
        .map((s) => ({
          userId: s.id || s.userId,
          name: s.name || 'Student',
          role: 'student',
          classNum: s.classNum,
          className: s.className || '',
          roll: s.roll || '',
          profilePic: s.profilePic || null,
          phone: s.phone || '',
          address: s.address || '',
        }));

      const safeTeachers = Array.isArray(teachers) ? teachers : [];
      const extraTeachers = safeTeachers
        .filter((t) => t && !registeredIds.has(String(t.email || t.userId || t.id || '').toLowerCase()))
        .map((t) => ({
          userId: t.id || t.userId || t.email,
          name: t.name || 'Teacher',
          role: 'teacher',
          email: t.email || '',
          subject: t.subject || '',
          phone: t.phone || '',
          profilePic: t.profilePic || null,
        }));

      setAllUsers([...registeredUsers, ...extraStudents, ...extraTeachers]);
    }
  }, [isOpen, students, teachers]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handlePanelSwitch = useCallback((mode) => {
    setViewMode(mode);
    navigate(`/${mode}`, { replace: true });
    setIsOpen(false);
  }, [setViewMode, navigate]);

  const handleImpersonate = useCallback((userProfile) => {
    impersonate(userProfile);
    setIsOpen(false);
    setUserSearchQuery('');
    const role = String(userProfile.role || 'student').toLowerCase();
    navigate(`/${role}`, { replace: true });
  }, [impersonate, navigate]);

  // Don't render top bar if not authorized or on full super admin landing screen
  if (!canSwitch || location.pathname === '/super-admin') return null;

  const isPrincipal = user?.role === 'principal' && !isSuperAdmin;
  const currentView = VIEW_MODES.find((v) => v.key === viewMode) || VIEW_MODES[0];
  const popupTitle = isSuperAdmin ? '⚡ Super Admin' : isPrincipal ? '🏛️ Principal Switcher' : '🛡️ Admin Switcher';
  const activeSchoolId = schoolProfile?.schoolId || schoolProfile?.schoolCode || 'PROGGA_DEFAULT';
  const activeEiin = schoolProfile?.eiinNumber || '130743';

  const filteredUsers = allUsers.filter((u) => {
    const uid = String(u.userId || '').toLowerCase();
    if (u.isSuperAdmin || u.role === 'admin' || uid === 'admin' || uid === 'siam' || uid === 'super') return false;
    if (isPrincipal && (u.role === 'principal' || String(u.userId || '').toLowerCase().startsWith('prn-'))) return false;
    if (!userSearchQuery.trim()) return true;
    const q = userSearchQuery.toLowerCase();
    return (
      String(u.name || '').toLowerCase().includes(q) ||
      String(u.userId || '').toLowerCase().includes(q) ||
      String(u.role || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="sa-switcher-wrapper">
      {/* ── Persistent Top Navigation Bar ─────────────────── */}
      {isSuperAdmin && (
        <div className={`sa-persistent-top-bar ${isImpersonating ? 'sa-bar-has-banner' : ''}`}>
          <div className="sa-top-bar-left">
            <span className="sa-top-bar-badge">⚡ SUPER ADMIN</span>
            <div className="sa-top-bar-school-info">
              <span className="sa-school-icon">🏫</span>
              <div>
                <span className="sa-school-name">{schoolProfile?.schoolName || 'ScholasticBase'}</span>
                {(schoolProfile?.location || window.localStorage.getItem('schoolLocation')) && (
                  <span className="sa-school-location" style={{ display: 'block', fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>
                    📍 {schoolProfile?.location || window.localStorage.getItem('schoolLocation')}
                  </span>
                )}
              </div>
              <span className="sa-school-eiin">EIIN: {activeEiin}</span>
              <span className="sa-school-id-pill">ID: {activeSchoolId}</span>
            </div>
          </div>

          <div className="sa-top-bar-right">
            <button
              className="sa-bar-btn sa-bar-btn-primary"
              onClick={() => navigate('/super-admin')}
              title="Return to Master School Selection Screen"
            >
              🔄 Switch School ({schoolsList.length})
            </button>
            <button
              className="sa-bar-btn sa-bar-btn-outline"
              onClick={() => handlePanelSwitch('admin')}
              title="Go to Admin Dashboard"
            >
              🛡️ Admin Panel
            </button>
          </div>
        </div>
      )}

      {/* ── Impersonation Banner ─────────────────────────── */}
      {isImpersonating && impersonatedUser && (
        <div className="sa-impersonation-banner">
          <span className="sa-banner-icon">👤</span>
          <span>
            Viewing as <strong>{impersonatedUser.name || impersonatedUser.userId}</strong>
            {' '}({impersonatedUser.role || 'user'})
          </span>
          <button className="sa-banner-exit" onClick={stopImpersonating}>
            ✕ Exit Impersonation
          </button>
        </div>
      )}

      {/* ── Floating Switcher & Role Selector ────────────── */}
      <div
        className={`sa-switcher ${isSuperAdmin ? 'sa-has-top-bar' : ''} ${isImpersonating ? 'sa-has-banner' : ''}`}
        ref={dropdownRef}
      >
        <button
          className="sa-toggle-btn"
          onClick={() => setIsOpen(!isOpen)}
          title={`${popupTitle} — Switch Panel & Impersonate`}
        >
          <span
            className="sa-indicator-dot"
            style={{ color: currentView.color, backgroundColor: currentView.color }}
          />
          <span className="sa-toggle-icon">{currentView.icon}</span>
          <span className="sa-toggle-label">{currentView.label}</span>
          <span className={`sa-toggle-chevron ${isOpen ? 'sa-open' : ''}`}>▼</span>
        </button>

        <div className={`sa-dropdown ${isOpen ? 'sa-visible' : ''}`}>
          <div className="sa-dropdown-header">
            <p className="sa-dropdown-title">{popupTitle}</p>
            <p className="sa-dropdown-subtitle">
              Active: <strong>{schoolProfile?.schoolName}</strong> (EIIN: {activeEiin})
            </p>
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
              <span style={{ background: 'rgba(6,182,212,0.12)', color: '#0284c7', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '700' }}>
                👨‍🎓 {counts.totalStudents} Students
              </span>
              <span style={{ background: 'rgba(37,99,235,0.12)', color: '#2563eb', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '700' }}>
                👨‍🏫 {counts.totalTeachers} Teachers
              </span>
            </div>
          </div>

          {isSuperAdmin && (
            <div className="sa-dropdown-school-box">
              <button
                className="sa-dropdown-school-btn"
                onClick={() => {
                  setIsOpen(false);
                  navigate('/super-admin');
                }}
              >
                <span>🏫 Master School Switcher ({schoolsList.length} Schools)</span>
                <span className="sa-arrow">→</span>
              </button>
            </div>
          )}

          <div className="sa-panel-list">
            {VIEW_MODES.filter((mode) => (isPrincipal && mode.key === 'admin' ? false : true)).map((mode) => (
              <button
                key={mode.key}
                className={`sa-panel-btn ${viewMode === mode.key ? 'sa-active' : ''}`}
                onClick={() => handlePanelSwitch(mode.key)}
              >
                <span className="sa-panel-icon">{mode.icon}</span>
                <span className="sa-panel-label">{mode.label}</span>
              </button>
            ))}
          </div>

          <div className="sa-divider" />

          <div className="sa-impersonate-section">
            <p className="sa-impersonate-title">👤 Impersonate User Account</p>
            <input
              className="sa-impersonate-search"
              type="text"
              placeholder="Search by name, ID, or role…"
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
              autoComplete="off"
            />

            <div className="sa-user-list">
              {filteredUsers.length === 0 ? (
                <div className="sa-no-results">
                  {userSearchQuery ? 'No users found' : 'No users registered'}
                </div>
              ) : (
                filteredUsers.slice(0, 30).map((u) => (
                  <button
                    key={u.userId}
                    className="sa-user-item"
                    onClick={() => handleImpersonate(u)}
                    title={`Impersonate ${u.name || u.userId}`}
                  >
                    <span
                      className="sa-user-avatar"
                      style={{ background: ROLE_COLORS[u.role] || '#64748b' }}
                    >
                      {getInitials(u.name)}
                    </span>
                    <span className="sa-user-info">
                      <span className="sa-user-name">{u.name || u.userId}</span>
                      <span className="sa-user-role">
                        {u.role || 'user'}
                        {u.className ? ` · ${u.className}` : ''}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
