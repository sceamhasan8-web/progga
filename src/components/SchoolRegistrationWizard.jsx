import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { provisionNewSchoolPortal } from '../firebase/firestoreSchema.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSchoolProfile } from '../context/SchoolProfileContext.jsx';
import { registerSchoolInRegistry } from '../utils/schoolData.js';
import defaultLogo from '../greenfield_logo.png';

export default function SchoolRegistrationWizard({ googleUser: propGoogleUser, isOpen, onClose, onSuccess }) {
  const navigate = useNavigate();
  const { user: authUser, provisionSchoolAdminSession } = useAuth();
  const { provisionSchoolProfile } = useSchoolProfile();
  const googleUser = propGoogleUser || authUser;

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    schoolName: '',
    location: '',
    schoolType: 'combined', // primary | secondary | college | combined
    eiinNumber: '',
    schoolCode: '',
    adminName: '',
    adminEmail: '',
    adminPhone: '',
    logo: defaultLogo,
  });

  // Pre-fill admin info from Google account when available
  useEffect(() => {
    if (googleUser) {
      setFormData((prev) => ({
        ...prev,
        adminName: prev.adminName || googleUser.displayName || '',
        adminEmail: prev.adminEmail || googleUser.email || '',
        logo: prev.logo || googleUser.photoURL || defaultLogo,
      }));
    }
  }, [googleUser]);

  if (!isOpen) return null;

  // Auto-generate a clean school code when school name changes if not manually set
  const handleSchoolNameChange = (e) => {
    const name = e.target.value;
    const generatedCode = name
      .toUpperCase()
      .replace(/[^\w\s]/gi, '')
      .split(/\s+/)
      .map((word) => word[0])
      .join('')
      .slice(0, 10);

    setFormData((prev) => ({
      ...prev,
      schoolName: name,
      schoolCode: prev.schoolCode ? prev.schoolCode : (generatedCode || 'SCH'),
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogoFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError('Image file size should be less than 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setFormData((prev) => ({ ...prev, logo: event.target?.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const validateStep = (currentStep) => {
    setError('');
    if (currentStep === 1) {
      if (!formData.schoolName.trim()) {
        setError('Please enter the official School Name.');
        return false;
      }
      if (!formData.eiinNumber.trim()) {
        setError('Please enter the official EIIN Number.');
        return false;
      }
      if (!formData.schoolCode.trim()) {
        setError('Please enter a unique School Code / ID.');
        return false;
      }
    } else if (currentStep === 2) {
      if (!formData.adminName.trim()) {
        setError('Please enter the Primary Administrator Name.');
        return false;
      }
      if (!formData.adminEmail.trim()) {
        setError('Please enter Administrator Email Address.');
        return false;
      }
      if (!formData.adminPhone.trim()) {
        setError('Please enter Administrator Contact Phone Number.');
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((prev) => Math.min(prev + 1, 3));
    }
  };

  const handleBack = () => {
    setError('');
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep(1) || !validateStep(2)) return;

    setLoading(true);
    setError('');

    try {
      // 1. Provision Firestore database records
      const provisioned = await provisionNewSchoolPortal({
        googleUser,
        schoolDetails: {
          ...formData,
          eiinNumber: formData.eiinNumber.trim(),
          schoolCode: formData.schoolCode.trim().toUpperCase(),
        },
      });

      // 2. Sync React Context and localStorage for active school profile
      provisionSchoolProfile(provisioned.schoolProfile);
      registerSchoolInRegistry(provisioned.schoolProfile);

      // 3. Establish active Admin user session in AuthContext & localStorage
      provisionSchoolAdminSession(provisioned.adminAccount);

      // 4. Initialize clean isolated local storage structures for the new school
      try {
        const schoolCode = provisioned.schoolProfile.schoolCode || provisioned.schoolProfile.schoolId || 'NEW_SCHOOL';
        const defaultClasses = provisioned.teacherPanel?.classes || [
          'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
          'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'
        ];
        const formattedClasses = defaultClasses.map((className, idx) => ({
          className,
          classNum: idx + 1,
          groups: ['Group A', 'Group B', 'Group C'],
          students: [],
          groupTeachers: {},
          groupHeadTeachers: {},
          groupSubjects: {},
          routines: {},
        }));

        let existingUsers = {};
        try {
          const raw = window.localStorage.getItem('schoolAppLocalUsers');
          if (raw) existingUsers = JSON.parse(raw);
        } catch {}
        const mergedUsers = { ...existingUsers, [provisioned.adminAccount.userId]: provisioned.adminAccount };

        // Save both active keys and school-scoped keys
        const keysToSet = {
          teacherPanelClasses: formattedClasses,
          teacherPanelTeachers: [],
          schoolAppTeachers: [],
          schoolAppStudentProfiles: [],
          schoolAppFeeData: {},
          schoolAppFeeTransactions: [],
          schoolAppLocalUsers: mergedUsers,
          teacherPanelTeacherRoutines: {},
          teacherPanelRoutineTimeSlots: [
            "৯:০০-৯:৫০", "৯:৫০-১০:৩৫", "১০:৩৫-১১:২০",
            "১১:২০-১২:০৫", "১২:০৫-১২:৫০", "১:৩০-২:১০", "২:১০-২:৫০"
          ],
          teacherPanelGroupSubjects: {},
        };

        Object.entries(keysToSet).forEach(([key, val]) => {
          const jsonVal = JSON.stringify(val);
          const cleanSchoolCode = String(schoolCode).trim().replace(/[^\w-]/g, '_');
          // Set tenant-isolated keys for the new school
          window.localStorage.setItem(`${key}_${cleanSchoolCode}`, jsonVal);
          window.localStorage.setItem(`school_${cleanSchoolCode}_${key}`, jsonVal);
        });

        // Always preserve global merged user accounts across all schools
        window.localStorage.setItem('schoolAppLocalUsers', JSON.stringify(mergedUsers));
      } catch (storageErr) {
        console.warn('Could not pre-populate local storage defaults for new school:', storageErr);
      }

      if (onSuccess) onSuccess(provisioned);

      // 5. Redirect directly to Admin Dashboard
      navigate('/admin', { replace: true });
    } catch (err) {
      console.error('School Provisioning Error:', err);
      setError(err.message || 'Failed to provision school portal. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sr-wizard-backdrop">
      <div className="sr-wizard-modal">
        {/* Wizard Header */}
        <div className="sr-wizard-header">
          <div className="sr-wizard-header-title">
            <h2>🏫 Create a New School Portal</h2>
            <p>Set up your isolated multi-tenant school dashboard in minutes</p>
          </div>
          <button className="sr-wizard-close-btn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="sr-wizard-progress">
          <div className={`sr-progress-step ${step >= 1 ? 'active' : ''}`}>
            <span className="sr-step-number">1</span>
            <span className="sr-step-label">School Identity</span>
          </div>
          <div className="sr-progress-line"></div>
          <div className={`sr-progress-step ${step >= 2 ? 'active' : ''}`}>
            <span className="sr-step-number">2</span>
            <span className="sr-step-label">Admin & Logo</span>
          </div>
          <div className="sr-progress-line"></div>
          <div className={`sr-progress-step ${step >= 3 ? 'active' : ''}`}>
            <span className="sr-step-number">3</span>
            <span className="sr-step-label">Provision Portal</span>
          </div>
        </div>

        {/* Form Body */}
        <div className="sr-wizard-body">
          {error && <div className="sr-wizard-error">{error}</div>}

          {/* STEP 1: School Identity */}
          {step === 1 && (
            <div className="sr-wizard-step-content">
              <div className="sr-field-group">
                <label htmlFor="schoolName">Official School Name *</label>
                <input
                  id="schoolName"
                  name="schoolName"
                  type="text"
                  placeholder="e.g. Jamalpur Kaliakair M.E.H Arif School"
                  value={formData.schoolName}
                  onChange={handleSchoolNameChange}
                  required
                />
              </div>

              <div className="sr-field-group">
                <label htmlFor="location">School Location / Address</label>
                <input
                  id="location"
                  name="location"
                  type="text"
                  placeholder="e.g. Kaliakair, Gazipur, Dhaka"
                  value={formData.location}
                  onChange={handleChange}
                />
              </div>

              <div className="sr-field-row">
                <div className="sr-field-group">
                  <label htmlFor="eiinNumber">EIIN Number *</label>
                  <input
                    id="eiinNumber"
                    name="eiinNumber"
                    type="text"
                    placeholder="e.g. 130743"
                    value={formData.eiinNumber}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="sr-field-group">
                  <label htmlFor="schoolCode">Unique School ID / Code *</label>
                  <input
                    id="schoolCode"
                    name="schoolCode"
                    type="text"
                    placeholder="e.g. JKMEHARIF"
                    value={formData.schoolCode}
                    onChange={handleChange}
                    style={{ textTransform: 'uppercase' }}
                    required
                  />
                </div>
              </div>

              <div className="sr-field-group">
                <label htmlFor="schoolType">School Branch / Institution Type *</label>
                <select id="schoolType" name="schoolType" value={formData.schoolType} onChange={handleChange}>
                  <option value="combined">Combined / Full School (Primary + Secondary + College)</option>
                  <option value="primary">Primary School (Class 1 to 5)</option>
                  <option value="secondary">Secondary School (Class 6 to 10)</option>
                  <option value="college">College / Higher Secondary (Class 11 & 12)</option>
                </select>
              </div>
            </div>
          )}

          {/* STEP 2: Admin & Logo */}
          {step === 2 && (
            <div className="sr-wizard-step-content">
              <div className="sr-field-group">
                <label htmlFor="adminName">Primary Administrator Name *</label>
                <input
                  id="adminName"
                  name="adminName"
                  type="text"
                  placeholder="Full name of school principal / admin"
                  value={formData.adminName}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="sr-field-row">
                <div className="sr-field-group">
                  <label htmlFor="adminEmail">Admin Email *</label>
                  <input
                    id="adminEmail"
                    name="adminEmail"
                    type="email"
                    placeholder="admin@school.edu.bd"
                    value={formData.adminEmail}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="sr-field-group">
                  <label htmlFor="adminPhone">Admin Phone / WhatsApp *</label>
                  <input
                    id="adminPhone"
                    name="adminPhone"
                    type="text"
                    placeholder="+880 1712-345678"
                    value={formData.adminPhone}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              {/* Logo Upload Section */}
              <div className="sr-field-group">
                <label>School Logo Upload</label>
                <div className="sr-logo-preview-box">
                  <img src={formData.logo} alt="School Logo Preview" className="sr-logo-img" />
                  <div className="sr-logo-upload-controls">
                    <input
                      id="logoFileInput"
                      type="file"
                      accept="image/*"
                      onChange={handleLogoFileChange}
                      style={{ display: 'none' }}
                    />
                    <button
                      type="button"
                      className="sr-btn-secondary"
                      onClick={() => document.getElementById('logoFileInput')?.click()}
                    >
                      📁 Upload Custom Logo
                    </button>
                    <span className="sr-logo-help">PNG or JPG up to 2MB</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Provision & Confirm */}
          {step === 3 && (
            <div className="sr-wizard-step-content">
              <div className="sr-summary-card">
                <h3>📋 Portal Provisioning Summary</h3>
                <div className="sr-summary-grid">
                  <div>
                    <strong>School Name:</strong> {formData.schoolName}
                  </div>
                  {formData.location && (
                    <div>
                      <strong>Location / Address:</strong> {formData.location}
                    </div>
                  )}
                  <div>
                    <strong>EIIN Number:</strong> {formData.eiinNumber}
                  </div>
                  <div>
                    <strong>School Code:</strong> {formData.schoolCode.toUpperCase()}
                  </div>
                  <div>
                    <strong>Branch / Type:</strong> {formData.schoolType.toUpperCase()}
                  </div>
                  <div>
                    <strong>Primary Admin:</strong> {formData.adminName}
                  </div>
                  <div>
                    <strong>Admin Email:</strong> {formData.adminEmail}
                  </div>
                  <div>
                    <strong>Google Account UID:</strong> {googleUser?.uid?.slice(0, 12)}...
                  </div>
                </div>
              </div>

              <div className="sr-provision-info-box">
                <span className="sr-info-icon">⚡</span>
                <div>
                  <h4>Automatic Cloud & Local Provisioning</h4>
                  <p>
                    Submitting will create an isolated Firestore portal database, set up your admin profile,
                    and initialize default branch structures.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Controls */}
        <div className="sr-wizard-footer">
          {step > 1 ? (
            <button type="button" className="sr-btn-secondary" onClick={handleBack} disabled={loading}>
              ← Back
            </button>
          ) : (
            <button type="button" className="sr-btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
          )}

          {step < 3 ? (
            <button type="button" className="sr-btn-primary" onClick={handleNext}>
              Next Step →
            </button>
          ) : (
            <button type="button" className="sr-btn-success" onClick={handleSubmit} disabled={loading}>
              {loading ? '🚀 PROVISIONING SCHOOL PORTAL...' : 'CREATE & OPEN PORTAL NOW'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
