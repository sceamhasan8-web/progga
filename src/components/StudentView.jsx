import React, { useEffect, useState, Component } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { getResultsForStudent, subscribeToTeacherPanelData } from '../firebase/firestoreSchema.js';
import { getLocalResults, saveLocalResults } from '../firebase/localPersistence.js';
import { getBangladeshGradeInfo } from '../utils/bangladeshGrading.js';
import { useSchoolProfile } from '../context/SchoolProfileContext.jsx';
import { SCHOOL_BRANCHES, getBranchKeyByClass, filterClassesByBranch, sortClasses } from '../utils/schoolResolver.js';
import PrintContainer from './PrintContainer.jsx';
import { useViewMode } from '../context/ViewModeContext.jsx';
import SuperAdminSwitcher from './SuperAdminSwitcher.jsx';
import { useLiveSchoolData } from '../utils/schoolData.js';
import StudentFeePortal from './StudentFeePortal.jsx';
import { getStudentFeeRecord, evaluateFeeStatus, formatBDT } from '../utils/feeResolver.js';
import AddNoticeModal from './AddNoticeModal.jsx';
import NotificationBell from './NotificationBell.jsx';
import ScholasticBaseLogo from './ScholasticBaseLogo.jsx';
import { getNotices, canUserAccessNotice, addNotice, subscribeToNoticeUpdates, normalizeRoles } from '../utils/noticeStorage.js';

/* ─────────────────────────────────────────────────────────────
   React Error Boundary Component to prevent Blank/Black Screens
   ───────────────────────────────────────────────────────────── */
class StudentViewErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('StudentView Error Boundary caught a rendering error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '48px 24px',
          textAlign: 'center',
          background: '#020617',
          color: '#f8fafc',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Inter, system-ui, sans-serif'
        }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '16px'
          }}>⚠️</div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 8px 0', color: '#f8fafc' }}>
            Student Portal Rendering Error
          </h2>
          <p style={{ color: '#94a3b8', maxWidth: '480px', margin: '0 0 24px 0', fontSize: '14px', lineHeight: 1.6 }}>
            {this.state.error?.message || 'An unexpected runtime error occurred while loading the student portal.'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{
              padding: '12px 24px',
              borderRadius: '10px',
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)'
            }}
          >
            Reload Student Portal
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ─────────────────────────────────────────────────────────────
   SVG Icon helpers
   ───────────────────────────────────────────────────────────── */
const HamburgerIcon = () => (
  <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" viewBox="0 0 24 24">
    <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);
const BellIcon = () => (
  <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);
const ChevronRight = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);
const ChevronLeft = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);
const LogoutIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

/* Bottom-nav icons */
const HomeNavIcon = ({ active }) => <svg width="22" height="22" fill={active ? '#2563eb' : 'none'} stroke={active ? '#2563eb' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>;
const NoticeNavIcon = ({ active }) => <svg width="22" height="22" fill="none" stroke={active ? '#2563eb' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>;
const CalendarNavIcon = ({ active }) => <svg width="22" height="22" fill="none" stroke={active ? '#2563eb' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
const MsgNavIcon = ({ active }) => <svg width="22" height="22" fill={active ? '#2563eb' : 'none'} stroke={active ? '#2563eb' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
const ProfileNavIcon = ({ active }) => <svg width="22" height="22" fill="none" stroke={active ? '#2563eb' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;

/* Sidebar-size icons */
const SBHomeIcon = () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>;
const SBStudentIcon = () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
const SBTeacherIcon = () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
const SBExamIcon = () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2" /><line x1="9" y1="7" x2="15" y2="7" /><line x1="9" y1="11" x2="15" y2="11" /><line x1="9" y1="15" x2="13" y2="15" /></svg>;
const SBRoutineIcon = () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
const SBFeeIcon = () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>;
const SBNoticeIcon = () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>;
const SBCalendarIcon = () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
const SBMsgIcon = () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
const SBProfileIcon = () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;

/* Large card icons */
const CardStudentIcon = () => <svg width="26" height="26" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
const CardTeacherIcon = () => <svg width="26" height="26" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
const CardExamIcon = () => <svg width="26" height="26" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2" /><line x1="9" y1="7" x2="15" y2="7" /><line x1="9" y1="11" x2="15" y2="11" /><line x1="9" y1="15" x2="13" y2="15" /></svg>;
const CardRoutineIcon = () => <svg width="26" height="26" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
const CardFeeIcon = () => <svg width="26" height="26" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>;

/* ─────────────────────────────────────────────────────────────
   Static Menu Items & Timetable Schedule Data
   ───────────────────────────────────────────────────────────── */
const menuItems = [
  { id: 'student_info', title: 'Student Info', color: '#4a90e2', Icon: CardStudentIcon, SBIcon: SBStudentIcon },
  { id: 'student_directory', title: 'Student Directory', color: '#7c3aed', Icon: CardStudentIcon, SBIcon: SBStudentIcon },
  { id: 'teachers_directory', title: 'Teachers Directory', color: '#38b26e', Icon: CardTeacherIcon, SBIcon: SBTeacherIcon },
  { id: 'exam_result', title: 'Result', color: '#8b5cf6', Icon: CardExamIcon, SBIcon: SBExamIcon },
  { id: 'class_routine', title: 'Class & Routine', color: '#f97316', Icon: CardRoutineIcon, SBIcon: SBRoutineIcon },
  { id: 'fee_management', title: 'Fee Management', color: '#0ea5a4', Icon: CardFeeIcon, SBIcon: SBFeeIcon },
];

const tabItems = [
  { id: 'home', label: 'Home', NavIcon: HomeNavIcon, SBIcon: SBHomeIcon },
  { id: 'notice', label: 'Notice', NavIcon: NoticeNavIcon, SBIcon: SBNoticeIcon },
  { id: 'calendar', label: 'Calendar', NavIcon: CalendarNavIcon, SBIcon: SBCalendarIcon },
  { id: 'messages', label: 'Messages', NavIcon: MsgNavIcon, SBIcon: SBMsgIcon },
  { id: 'profile', label: 'Profile', NavIcon: ProfileNavIcon, SBIcon: SBProfileIcon },
];

const defaultRoutineSlots = [
  { time: '08:30 AM - 09:15 AM', subject: 'Mathematics', instructor: 'Mohammad Rahim', room: 'Room 201', color: '#2563eb' },
  { time: '09:15 AM - 10:00 AM', subject: 'English Language', instructor: 'Anika Sultana', room: 'Room 201', color: '#7c3aed' },
  { time: '10:00 AM - 10:45 AM', subject: 'Bangla Literature', instructor: 'Dr. Shahin Alam', room: 'Room 201', color: '#16a34a' },
  { time: '10:45 AM - 11:15 AM', subject: 'Tiffin & Recess Break', instructor: 'School Assembly Ground', room: 'Cafeteria', color: '#f59e0b' },
  { time: '11:15 AM - 12:00 PM', subject: 'General Science', instructor: 'Kamrul Hasan', room: 'Science Lab', color: '#0ea5e9' },
  { time: '12:00 PM - 12:45 PM', subject: 'ICT & Computer Studies', instructor: 'Nasrin Akter', room: 'ICT Lab', color: '#06b6d4' },
];

const calendarEvents = [
  { date: 'Jul 25', title: 'Mid-Term Examinations Begin', desc: 'All classes across standard testing slots.' },
  { date: 'Aug 01', title: 'Summer Academic Break', desc: 'School closed until Aug 15.' },
  { date: 'Aug 20', title: 'Parent-Teacher Conference (PTC)', desc: 'Report card distribution from 10:00 AM.' },
  { date: 'Sep 05', title: "Teacher's Day Celebration", desc: 'Cultural activities and half-day classes.' },
];

/* ─────────────────────────────────────────────────────────────
   Greeting Helper
   ───────────────────────────────────────────────────────────── */
const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
};



/* ─────────────────────────────────────────────────────────────
   Detail Content Renderer Component
   ───────────────────────────────────────────────────────────── */
function DetailContent({
  section,
  user,
  results,
  loading,
  error,
  liveTeachers = [],
  liveStudents = [],
  studentProfile = null,
}) {
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [teacherSearchQuery, setTeacherSearchQuery] = useState('');

  const currentProfile = studentProfile || (liveStudents.find(s => {
    const sId = String(s.id || s.userId || s.studentId || '').trim().toLowerCase();
    const uId = String(user?.userId || user?.id || '').trim().toLowerCase();
    return sId && uId && sId === uId;
  })) || null;

  // 1. Student Info Section
  if (section === 'student_info') {
    const activeStudent = currentProfile || {
      name: user?.name || 'Student Profile',
      id: user?.userId || 'STU-1001',
      userId: user?.userId || 'STU-1001',
      className: user?.className || 'Class Ten',
      roll: user?.roll || '01',
      phone: user?.phone || 'N/A',
      fatherName: user?.fatherName || 'N/A',
      motherName: user?.motherName || 'N/A',
      address: user?.address || 'N/A',
      status: 'Active ✓',
    };

    const sId = activeStudent.id || activeStudent.userId || user?.userId || 'STU-1001';
    const cls = activeStudent.className || 'Class Ten';
    const rec = getStudentFeeRecord(sId, cls);
    const evalRes = evaluateFeeStatus(rec, cls);

    return (
      <div className="sv-detail-grid sv-detail-grid--single">
        <PrintContainer
          title="Student Identification & Profile Card"
          subtitle={`ID: ${sId}`}
          singlePageFit={true}
          signatures={['Guardian Signature', 'Class Teacher', 'Principal / Headmaster']}
        >
          <div className="sv-detail-panel print-card-box" style={{ border: 'none' }}>
            <div className="sv-info-row">
              <span className="sv-info-label">Full Name</span>
              <span className="sv-info-value">{activeStudent.name || user?.name || 'Student'}</span>
            </div>
            <div className="sv-info-row">
              <span className="sv-info-label">Student ID</span>
              <span className="sv-info-value">{sId}</span>
            </div>
            <div className="sv-info-row">
              <span className="sv-info-label">Current Grade / Class</span>
              <span className="sv-info-value">{activeStudent.className || (activeStudent.classNum ? `Class ${activeStudent.classNum}` : 'Class Ten')}</span>
            </div>
            <div className="sv-info-row">
              <span className="sv-info-label">Roll Number</span>
              <span className="sv-info-value">{activeStudent.roll ? `#${activeStudent.roll}` : 'N/A'}</span>
            </div>
            <div className="sv-info-row">
              <span className="sv-info-label">Phone</span>
              <span className="sv-info-value">{activeStudent.phone || 'N/A'}</span>
            </div>
            <div className="sv-info-row">
              <span className="sv-info-label">Father's Name</span>
              <span className="sv-info-value">{activeStudent.fatherName || 'N/A'}</span>
            </div>
            <div className="sv-info-row">
              <span className="sv-info-label">Mother's Name</span>
              <span className="sv-info-value">{activeStudent.motherName || 'N/A'}</span>
            </div>
            <div className="sv-info-row">
              <span className="sv-info-label">Address</span>
              <span className="sv-info-value">{activeStudent.address || 'N/A'}</span>
            </div>
            <div className="sv-info-row">
              <span className="sv-info-label">Outstanding Dues</span>
              <span className="sv-info-value" style={{ color: (evalRes?.grandTotalOutstanding || 0) > 0 ? '#dc2626' : '#16a34a', fontWeight: 800 }}>
                {formatBDT(evalRes?.grandTotalOutstanding || 0)} ({evalRes?.status || 'Paid'})
              </span>
            </div>
            <div className="sv-info-row" style={{ borderBottom: 'none' }}>
              <span className="sv-info-label">Enrollment Status</span>
              <span className="sv-info-value" style={{ color: '#16a34a', fontWeight: 700 }}>{activeStudent.status || 'Active ✓'}</span>
            </div>
          </div>
        </PrintContainer>
      </div>
    );
  }

  // 2. Student Directory Section
  if (section === 'student_directory') {
    const filteredStudents = (liveStudents || []).filter(s => {
      const className = s.className || (s.classNum ? `Class ${s.classNum}` : '');
      const branch = getBranchKeyByClass(className);

      if (selectedBranch !== 'all' && branch !== selectedBranch) {
        return false;
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const sName = String(s.name || '').toLowerCase();
        const sId = String(s.id || s.userId || '').toLowerCase();
        const sClass = String(className).toLowerCase();
        return sName.includes(query) || sId.includes(query) || sClass.includes(query);
      }

      return true;
    });

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#1a2e4a' }}>
              🎓 Global Student Directory ({filteredStudents.length})
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>
              Browse students across branches and classes.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search by name, ID, or class..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                width: '220px',
              }}
            />
          </div>
        </div>

        {/* Branch Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { key: 'all', label: 'All Branches' },
            { key: 'primary', label: `${SCHOOL_BRANCHES.primary?.emoji || '🏫'} ${SCHOOL_BRANCHES.primary?.shortName || 'Primary School'}` },
            { key: 'secondary', label: `${SCHOOL_BRANCHES.secondary?.emoji || '🎓'} ${SCHOOL_BRANCHES.secondary?.shortName || 'High School'}` },
            { key: 'college', label: `${SCHOOL_BRANCHES.college?.emoji || '🏛️'} ${SCHOOL_BRANCHES.college?.shortName || 'College'}` },
          ].map(b => (
            <button
              key={b.key}
              onClick={() => setSelectedBranch(b.key)}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                border: selectedBranch === b.key ? '2px solid #2563eb' : '1px solid #cbd5e1',
                background: selectedBranch === b.key ? '#eff6ff' : '#ffffff',
                color: selectedBranch === b.key ? '#1d4ed8' : '#475569',
                fontWeight: selectedBranch === b.key ? 700 : 500,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {b.label}
            </button>
          ))}
        </div>

        {/* Directory Grid */}
        <div className="sv-detail-grid">
          {filteredStudents.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '36px', background: '#f8fafc', borderRadius: '12px', color: '#94a3b8' }}>
              📭 No student records match the selected filter.
            </div>
          ) : (
            filteredStudents.map((s, i) => {
              const sId = s.id || s.userId || `STU-${i + 1}`;
              const cls = s.className || (s.classNum ? `Class ${s.classNum}` : 'Class One');
              const rec = getStudentFeeRecord(sId, cls);
              const evalRes = evaluateFeeStatus(rec, cls);

              return (
                <div key={sId || i} className="sv-detail-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                    <div className="sv-teacher-avatar" style={{ background: '#06b6d4' }}>
                      {s.name ? s.name.charAt(0).toUpperCase() : 'S'}
                    </div>
                    <div>
                      <p className="tp-detail-name" style={{ margin: 0, fontWeight: 700 }}>{s.name || 'Student'}</p>
                      <p className="tp-detail-sub" style={{ color: '#0891b2', margin: '2px 0 0', fontWeight: 600 }}>
                        {cls} {s.roll ? `· Roll #${s.roll}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="sv-teacher-meta" style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, color: '#475569' }}>
                    <span>🆔 ID: {sId}</span>
                    {s.phone && <span>📞 Phone: {s.phone}</span>}
                    <span style={{ fontWeight: 700, color: (evalRes?.grandTotalOutstanding || 0) > 0 ? '#dc2626' : '#16a34a' }}>
                      💳 Dues: {formatBDT(evalRes?.grandTotalOutstanding || 0)} ({evalRes?.status || 'Paid'})
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // 3. Teachers Directory Section
  if (section === 'teachers_directory') {
    const filteredTeachers = (liveTeachers || []).filter(t => {
      if (!teacherSearchQuery.trim()) return true;
      const q = teacherSearchQuery.toLowerCase();
      return String(t.name || '').toLowerCase().includes(q) || String(t.subject || '').toLowerCase().includes(q);
    });

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#1a2e4a' }}>
              👨‍🏫 Global Teachers Directory ({filteredTeachers.length})
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>
              Connect with your teachers and course instructors.
            </p>
          </div>
          <input
            type="text"
            placeholder="Search teacher name or subject..."
            value={teacherSearchQuery}
            onChange={e => setTeacherSearchQuery(e.target.value)}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              width: '240px',
            }}
          />
        </div>

        <div className="sv-detail-grid">
          {filteredTeachers.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '36px', background: '#f8fafc', borderRadius: '12px', color: '#94a3b8' }}>
              📭 No teacher records found in directory.
            </div>
          ) : (
            filteredTeachers.map((t, i) => (
              <div key={t.email || t.id || i} className="sv-detail-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                  {t.profilePic ? (
                    <img src={t.profilePic} alt={t.name} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div className="sv-teacher-avatar" style={{ background: '#2563eb' }}>
                      {t.name ? t.name.charAt(0).toUpperCase() : 'T'}
                    </div>
                  )}
                  <div>
                    <p className="tp-detail-name" style={{ margin: 0, fontWeight: 700 }}>{t.name || 'Teacher'}</p>
                    <p className="tp-detail-sub" style={{ color: '#2563eb', margin: '2px 0 0', fontWeight: 600 }}>
                      {t.subject || 'General Teacher'}
                    </p>
                  </div>
                </div>
                <div className="sv-teacher-meta" style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, color: '#475569' }}>
                  <span>📍 Office/Room: {t.room || 'Room 101'}</span>
                  <span>✉ Email: {t.email || 'N/A'}</span>
                  {t.phone && <span>📞 Phone: {t.phone}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // 4. Academic Exam Results Section
  if (section === 'exam_result') return (
    <div className="sv-detail-grid sv-detail-grid--single">
      <div className="sv-detail-panel">
        {loading ? (
          <p style={{ color: '#64748b', fontSize: 14, textAlign: 'center', padding: 24 }}>Loading exam results…</p>
        ) : error ? (
          <p style={{ color: '#ef4444', fontSize: 14, textAlign: 'center', padding: 24 }}>{error}</p>
        ) : !results || results.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 24px' }}>
            <p style={{ color: '#94a3b8', fontSize: 14, margin: 0 }}>📭 No academic results recorded yet.</p>
            <p style={{ color: '#cbd5e1', fontSize: 13, margin: '8px 0 0' }}>Your results will appear here once published by class teachers.</p>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#1a2e4a', margin: '0 0 12px', textTransform: 'uppercase' }}>📊 Academic Marks Summary</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                <div style={{ background: '#f0f9ff', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #2563eb' }}>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 4px', fontWeight: '600' }}>Total Subjects</p>
                  <p style={{ fontSize: '20px', fontWeight: '700', color: '#2563eb', margin: 0 }}>{results.length}</p>
                </div>
                <div style={{ background: '#f0fdf4', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #16a34a' }}>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 4px', fontWeight: '600' }}>Passed</p>
                  <p style={{ fontSize: '20px', fontWeight: '700', color: '#16a34a', margin: 0 }}>{results.filter(r => r.status === 'Pass').length}</p>
                </div>
                <div style={{ background: '#fef2f2', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #dc2626' }}>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 4px', fontWeight: '600' }}>Failed</p>
                  <p style={{ fontSize: '20px', fontWeight: '700', color: '#dc2626', margin: 0 }}>{results.filter(r => r.status === 'Fail').length}</p>
                </div>
              </div>
            </div>

            <div className="tp-table-container tp-table-responsive">
              <table className="sv-table" style={{ marginTop: '16px' }}>
                <thead>
                  <tr>
                    <th className="sv-th">Subject</th>
                    <th className="sv-th" style={{ textAlign: 'center' }}>Marks</th>
                    <th className="sv-th" style={{ textAlign: 'center' }}>Grade</th>
                    <th className="sv-th" style={{ textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((res, i) => {
                    const gradeInfo = getBangladeshGradeInfo(res.marks || 0);
                    const grade = gradeInfo.grade;
                    const gradeColor = gradeInfo.color;
                    const status = gradeInfo.status;
                    return (
                      <tr key={res.id || i} style={{ borderBottomColor: '#e2e8f0' }}>
                        <td className="sv-td" style={{ fontWeight: 600, color: '#1a2e4a' }}>{res.subject || res.classId || 'Subject'}</td>
                        <td className="sv-td" style={{ textAlign: 'center', fontSize: '15px', fontWeight: '700', color: '#2563eb' }}>{res.marks || 0}/100</td>
                        <td className="sv-td" style={{ textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: '4px',
                            background: gradeColor,
                            color: '#fff',
                            fontSize: '13px',
                            fontWeight: '700',
                            minWidth: '32px',
                          }}>
                            {grade}
                          </span>
                        </td>
                        <td className="sv-td" style={{ textAlign: 'center' }}>
                          <span className={`sv-badge sv-badge--${status === 'Pass' ? 'pass' : 'fail'}`} style={{
                            background: status === 'Pass' ? '#d1fae5' : '#fee2e2',
                            color: status === 'Pass' ? '#065f46' : '#7f1d1d',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '600',
                          }}>
                            {status || 'N/A'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // 5. Class Routine Section
  if (section === 'class_routine') return (
    <div className="sv-detail-grid">
      {defaultRoutineSlots.map((r, i) => (
        <div key={i} className="sv-detail-card" style={{ borderLeft: `4px solid ${r.color}` }}>
          <p style={{ fontSize: 12, color: r.color, fontWeight: 700, margin: '0 0 6px' }}>{r.time}</p>
          <p className="tp-detail-name" style={{ margin: '0 0 4px', fontWeight: 700 }}>{r.subject}</p>
          <p className="tp-detail-sub" style={{ margin: '0 0 4px', color: '#475569' }}>Instructor: {r.instructor}</p>
          <p className="tp-detail-email" style={{ margin: 0, color: '#64748b', fontSize: 12 }}>📍 Location: {r.room}</p>
        </div>
      ))}
    </div>
  );

  // 6. Fee Management Section
  if (section === 'fee_management') return (
    <StudentFeePortal currentStudent={currentProfile || user} />
  );

  return null;
}

/* ═════════════════════════════════════════════════════════════
   Main StudentView Component
   ═════════════════════════════════════════════════════════════ */
function StudentViewContent() {
  const { user, signOut } = useAuth();
  const { effectiveUser } = useViewMode();
  const activeUser = effectiveUser || user;
  const { schoolProfile } = useSchoolProfile();
  const { students: liveStudents, teachers: liveTeachers } = useLiveSchoolData();
  
  // Safe Fallback School Profile Object
  const profile = schoolProfile || {
    schoolName: 'ScholasticBase',
    logo: '',
    adminEmail: 'admin@scholasticbase.edu',
  };

  const [studentProfile, setStudentProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [activeSection, setActiveSection] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const activeSchoolId = profile?.schoolId || 'PROGGA_DEFAULT';
  const [notices, setNotices] = useState(() =>
    getNotices(activeSchoolId).filter(n => canUserAccessNotice(n, 'student'))
  );
  const [showAddNotice, setShowAddNotice] = useState(false);
  const [highlightedNoticeId, setHighlightedNoticeId] = useState(null);

  useEffect(() => {
    const syncNotices = () => {
      const all = getNotices(activeSchoolId);
      setNotices(all.filter(n => canUserAccessNotice(n, 'student')));
    };
    syncNotices();
    const unsub = subscribeToNoticeUpdates(syncNotices, activeSchoolId);
    return () => unsub();
  }, [activeSchoolId]);

  // Results state
  const [results, setResults] = useState(() => {
    try {
      const cached = getLocalResults();
      return (activeUser?.userId && cached[activeUser.userId]) ? cached[activeUser.userId] : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load student profile across all array/object storage structures
  useEffect(() => {
    const loadProfile = () => {
      try {
        const raw = window.localStorage.getItem('schoolAppStudentProfiles');
        if (!raw) {
          setStudentProfile(null);
          return;
        }

        const parsed = JSON.parse(raw);
        const uId = String(activeUser?.userId || activeUser?.id || '').trim().toLowerCase();
        if (!uId) return;

        let matched = null;
        if (Array.isArray(parsed)) {
          matched = parsed.find(s => String(s?.id || s?.userId || s?.studentId || '').trim().toLowerCase() === uId);
        } else if (typeof parsed === 'object') {
          const matchedKey = Object.keys(parsed).find(k => k.trim().toLowerCase() === uId);
          if (matchedKey) matched = parsed[matchedKey];
        }

        setStudentProfile(matched || null);
      } catch {
        setStudentProfile(null);
      }
    };

    loadProfile();
    window.addEventListener('storage', loadProfile);
    return () => window.removeEventListener('storage', loadProfile);
  }, [activeUser?.userId, activeUser?.id]);

  // Fetch results when section === 'exam_result'
  useEffect(() => {
    if (activeSection === 'exam_result' && activeUser?.userId) {
      const fetchResults = async () => {
        setLoading(true);
        setError('');
        try {
          const marks = await getResultsForStudent(activeUser.userId);
          setResults(marks || []);
          const stored = getLocalResults() || {};
          saveLocalResults({ ...stored, [activeUser.userId]: marks || [] });
        } catch {
          const stored = getLocalResults() || {};
          setResults(stored[activeUser?.userId] || []);
          setError('Unable to load live results. Displaying cached data.');
        } finally {
          setLoading(false);
        }
      };
      fetchResults();
    }
  }, [activeSection, activeUser?.userId]);

  const isHome = activeTab === 'home';

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setActiveSection(null);
    setMenuOpen(false);
  };

  const handleCardClick = (id) => {
    setActiveTab('home');
    setActiveSection(id);
  };

  const handleSidebarClick = (id) => {
    const isMenu = menuItems.some((m) => m.id === id);
    if (id === 'home') {
      setActiveTab('home');
      setActiveSection(null);
    } else if (isMenu) {
      setActiveTab('home');
      setActiveSection(id);
    } else {
      handleTabChange(id);
    }
    setMenuOpen(false);
  };

  const activeSidebarId = activeSection ?? (activeTab !== 'home' ? activeTab : 'home');
  const sectionMeta = menuItems.find((m) => m.id === activeSection);

  const displayUser = studentProfile || activeUser || {};

  return (
    <div className="tp-shell">
      {/* Super Admin Switcher Bar */}
      <SuperAdminSwitcher />

      {/* ── MOBILE DRAWER OVERLAY ── */}
      <div className={`tp-drawer-overlay ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(false)}>
          <div className="tp-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="tp-drawer-brand">
              {profile.logo ? <img src={profile.logo} alt="Logo" className="tp-drawer-logo" /> : <ScholasticBaseLogo variant="mark" size={32} />}
              <div>
                <p className="tp-drawer-title">Menu</p>
                <p className="tp-drawer-school">{profile.schoolName || 'ScholasticBase'}</p>
                {(profile.location || window.localStorage.getItem('schoolLocation')) && (
                  <p className="tp-drawer-location" style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b', fontWeight: 500 }}>
                    📍 {profile.location || window.localStorage.getItem('schoolLocation')}
                  </p>
                )}
              </div>
            </div>
            <div className="tp-drawer-nav">
              <button
                className={`tp-sidebar-nav-item${activeSidebarId === 'home' ? ' active' : ''}`}
                onClick={() => handleSidebarClick('home')}
              >
                <SBHomeIcon /> Home
              </button>
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  className={`tp-sidebar-nav-item${activeSidebarId === item.id ? ' active' : ''}`}
                  onClick={() => handleSidebarClick(item.id)}
                >
                  <item.SBIcon /> {item.title}
                </button>
              ))}
              {tabItems.filter((t) => t.id !== 'home').map((tab) => (
                <button
                  key={tab.id}
                  className={`tp-sidebar-nav-item${activeSidebarId === tab.id ? ' active' : ''}`}
                  onClick={() => handleSidebarClick(tab.id)}
                >
                  <tab.SBIcon /> {tab.label}
                </button>
              ))}
            </div>
            <div className="tp-drawer-bottom" style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p className="tp-drawer-label" style={{ margin: 0 }}>Signed in as</p>
              <p className="tp-drawer-name" style={{ margin: 0 }}>{displayUser.name || displayUser.userId || 'Student'}</p>
              <p className="tp-drawer-role" style={{ margin: 0 }}>Role: {displayUser.role || 'student'}</p>
              <button className="tp-drawer-signout" onClick={signOut} style={{ margin: '8px 0 0' }}>Sign Out</button>
            </div>
          </div>
        </div>

      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="tp-sidebar">
        <div className="tp-sidebar-brand">
          {profile.logo ? <img src={profile.logo} alt="Logo" className="tp-sidebar-crest" /> : <ScholasticBaseLogo variant="mark" size={32} />}
          <div>
            <span className="tp-sidebar-school">{profile.schoolName || 'ScholasticBase'}</span>
            {(profile.location || window.localStorage.getItem('schoolLocation')) && (
              <span className="tp-sidebar-location" style={{ display: 'block', fontSize: 12, color: '#64748b', fontWeight: 400, marginTop: 2 }}>
                📍 {profile.location || window.localStorage.getItem('schoolLocation')}
              </span>
            )}
          </div>
        </div>

        <nav className="tp-sidebar-nav">
          <button
            className={`tp-sidebar-nav-item${activeSidebarId === 'home' ? ' active' : ''}`}
            onClick={() => handleSidebarClick('home')}
          >
            <SBHomeIcon /> Home
          </button>

          <p className="sv-sidebar-section-label">ACADEMICS</p>
          {menuItems.map((item) => (
            <button
              key={item.id}
              className={`tp-sidebar-nav-item${activeSidebarId === item.id ? ' active' : ''}`}
              onClick={() => handleSidebarClick(item.id)}
            >
              <item.SBIcon /> {item.title}
            </button>
          ))}

          <p className="sv-sidebar-section-label">MORE</p>
          {tabItems.filter((t) => t.id !== 'home').map((tab) => (
            <button
              key={tab.id}
              className={`tp-sidebar-nav-item${activeSidebarId === tab.id ? ' active' : ''}`}
              onClick={() => handleSidebarClick(tab.id)}
            >
              <tab.SBIcon /> {tab.label}
            </button>
          ))}
        </nav>

        <div className="tp-sidebar-bottom" style={{ marginTop: 'auto' }}>
          <div className="tp-sidebar-divider" />

          <div className="tp-sidebar-user-info" style={{ padding: '0 4px', marginBottom: 8 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#1a2e4a', margin: '0 0 2px' }}>
              {displayUser.name || displayUser.userId || 'Student'}
            </p>
            <p style={{ fontSize: 11.5, color: '#94a3b8', margin: 0, textTransform: 'capitalize' }}>
              {displayUser.role || 'student'}
            </p>
          </div>
          <button className="tp-sidebar-signout" onClick={signOut}>
            <LogoutIcon /> Sign Out
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT AREA ── */}
      <main className="tp-main">

        {/* Topbar */}
        <div className="tp-topbar">
          <button className="tp-icon-btn tp-hamburger" onClick={() => setMenuOpen(true)} aria-label="Menu">
            <HamburgerIcon />
          </button>

          <div className="tp-topbar-greeting">
            <h2>{getGreeting()}, {displayUser.name || 'Student'}!</h2>
            <p>Learn &nbsp;•&nbsp; Grow &nbsp;•&nbsp; Succeed</p>
          </div>

          <div className="tp-topbar-right">
            <NotificationBell
              userRole="student"
              userId={activeUser?.userId || 'student'}
              activeSchoolId={activeSchoolId}
              onSelectNotice={(noticeId) => {
                setActiveTab('notice');
                setHighlightedNoticeId(noticeId);
                setTimeout(() => {
                  const el = document.getElementById(`notice-${noticeId}`);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 100);
              }}
            />
          </div>
        </div>

        {/* ── HOME: Section Detail View ── */}
        {isHome && activeSection !== null && (
          <div className="sv-content-area">
            <div className="tp-section-header">
              <button
                className="tp-back-btn"
                onClick={() => setActiveSection(null)}
                title="Back to Overview"
                aria-label="Back to Overview"
              >
                <ChevronLeft />
              </button>
              <div className="tp-section-header-info">
                <div className="tp-breadcrumbs" aria-label="Breadcrumb">
                  <button type="button" className="tp-crumb-link" onClick={() => setActiveSection(null)}>Home</button>
                  <span className="tp-crumb-separator">/</span>
                  <span className="tp-crumb-current">{sectionMeta?.title || 'Student Info'}</span>
                </div>
                <h2 className="tp-section-title">{sectionMeta?.title}</h2>
              </div>
            </div>
            <DetailContent
              section={activeSection}
              user={activeUser}
              results={results}
              loading={loading}
              error={error}
              liveTeachers={liveTeachers}
              liveStudents={liveStudents}
              studentProfile={studentProfile}
            />
          </div>
        )}

        {/* ── HOME: Menu Overview ── */}
        {isHome && activeSection === null && (
          <>
            <div className="tp-hero">
              <div className="tp-greeting">
                <h1>{getGreeting()}</h1>
                <p>“অগাধ ধন সম্পদের চেয়ে একজন সুশিক্ষিত সন্তানের মুল্য অনেক বেশি”</p>
              </div>
              <div className="tp-school-brand">
                {profile.logo && <img src={profile.logo} alt="Logo" className="tp-crest" />}
                <div>
                  <span className="tp-school-name">{profile.schoolName || 'ScholasticBase'}</span>
                  {(profile.location || window.localStorage.getItem('schoolLocation')) && (
                    <span className="tp-school-location" style={{ display: 'block', fontSize: 12, color: '#64748b', fontWeight: 500, marginTop: 2 }}>
                      📍 {profile.location || window.localStorage.getItem('schoolLocation')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="tp-cards-grid">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  className="tp-menu-card"
                  onClick={() => handleCardClick(item.id)}
                >
                  <div className="tp-card-icon" style={{ background: item.color }}>
                    <item.Icon />
                  </div>
                  <div className="tp-card-text">
                    <p className="tp-card-title">{item.title}</p>
                  </div>
                  <div className="tp-card-chevron"><ChevronRight /></div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── Notice Board Tab ── */}
        {activeTab === 'notice' && (
          <div className="sv-content-area" style={{ padding: '24px clamp(16px, 3vw, 32px)' }}>
            <div className="tp-notice-toolbar">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <h2 className="sv-page-title" style={{ margin: 0, fontSize: 22 }}>📢 Notice Board</h2>
                <span className="tp-roster-badge" style={{ background: '#dbeafe', color: '#1e40af', borderColor: '#bfdbfe', fontSize: 13, padding: '4px 12px', borderRadius: 20, fontWeight: 700 }}>
                  {notices.length} Notice{notices.length !== 1 ? 's' : ''}
                </span>
              </div>
              <button className="tp-add-student-btn" style={{ background: '#2563eb', margin: 0 }} onClick={() => setShowAddNotice(true)}>+ Add Notice</button>
            </div>

            <div className="sv-notice-grid">
              {notices.map((n, i) => (
                <div key={i} className="sv-notice-card">
                  <div className="tp-notice-header">
                    <h3 className="sv-notice-title">{n.title}</h3>
                    <span className="sv-notice-date">{n.date}</span>
                  </div>
                  <p className="sv-notice-desc">{n.desc}</p>
                  {n.fileData && (
                    <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: '1px dashed #e2e8f0' }}>
                      <a href={n.fileData} download={n.fileName || `notice-${i}`} style={{ color: '#2563eb', fontWeight: 700, fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        📎 Download Attachment
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {showAddNotice && (
              <AddNoticeModal
                onClose={() => setShowAddNotice(false)}
                onAdd={(notice) => { setNotices(prev => [notice, ...prev]); setShowAddNotice(false); }}
              />
            )}
          </div>
        )}

        {/* ── Event Calendar Tab ── */}
        {activeTab === 'calendar' && (
          <div className="sv-content-area">
            <h2 className="sv-page-title">📅 Event Calendar</h2>
            <div className="sv-calendar-grid">
              {calendarEvents.map((ev, i) => (
                <div key={i} className="sv-calendar-card">
                  <div className="sv-calendar-badge">
                    <span>{ev.date.split(' ')[0]}</span>
                    <span style={{ fontSize: 20, fontWeight: 800 }}>{ev.date.split(' ')[1]}</span>
                  </div>
                  <div>
                    <h3 className="sv-calendar-title">{ev.title}</h3>
                    <p className="sv-calendar-desc">{ev.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Messages Tab ── */}
        {activeTab === 'messages' && (
          <div className="sv-content-area">
            <h2 className="sv-page-title">💬 Messages & Announcements</h2>
            <div style={{ textAlign: 'center', padding: '48px 24px', background: '#f8fafc', borderRadius: '12px', color: '#94a3b8' }}>
              📭 No new messages or direct notifications at this time.
            </div>
          </div>
        )}

        {/* ── Profile Tab ── */}
        {activeTab === 'profile' && (
          <div className="sv-content-area">
            <h2 className="sv-page-title">👤 My Account Profile</h2>
            <div className="sv-profile-card">
              {displayUser?.profilePic ? (
                <img src={displayUser.profilePic} alt={displayUser.name || 'User'} className="sv-profile-avatar-img" />
              ) : (
                <div className="sv-profile-avatar">{(displayUser.name || displayUser.userId || 'S').charAt(0).toUpperCase()}</div>
              )}
              <h3 className="sv-profile-name">{displayUser.name || 'Student'}</h3>
              <p className="sv-profile-role">{displayUser.role || 'student'} Portal</p>
              <div className="sv-profile-info">
                <div className="sv-info-row">
                  <span className="sv-info-label">User ID</span>
                  <span className="sv-info-value">{displayUser.userId || displayUser.id || 'N/A'}</span>
                </div>
                {displayUser.className && (
                  <div className="sv-info-row">
                    <span className="sv-info-label">Class / Grade</span>
                    <span className="sv-info-value">{displayUser.className}</span>
                  </div>
                )}
                {displayUser.roll && (
                  <div className="sv-info-row">
                    <span className="sv-info-label">Roll Number</span>
                    <span className="sv-info-value">#{displayUser.roll}</span>
                  </div>
                )}
                {displayUser.birthday && (
                  <div className="sv-info-row">
                    <span className="sv-info-label">Date of Birth</span>
                    <span className="sv-info-value">{displayUser.birthday}</span>
                  </div>
                )}
                {typeof displayUser.email === 'string' && displayUser.email.trim() && displayUser.email.includes('@') && !displayUser.email.toLowerCase().includes('@progga.edu') && !displayUser.email.toLowerCase().includes('@scholasticbase.edu') && !displayUser.email.toLowerCase().includes('@greenfield.edu') ? (
                  <div className="sv-info-row" style={{ borderBottom: 'none' }}>
                    <span className="sv-info-label">Linked Account Email</span>
                    <span className="sv-info-value">{displayUser.email.trim()}</span>
                  </div>
                ) : null}
              </div>
              <button className="sv-signout-btn" onClick={signOut}>LOG OUT</button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

export default function StudentView() {
  return (
    <StudentViewErrorBoundary>
      <StudentViewContent />
    </StudentViewErrorBoundary>
  );
}
