import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import defaultLogo from '../greenfield_logo.png';
import { getSchoolProfile, saveSchoolProfile as saveSchoolProfileDoc } from '../firebase/firestoreSchema.js';
import { useAuth } from './AuthContext.jsx';
import { registerSchoolInRegistry } from '../utils/schoolData.js';

const SCHOOL_PROFILE_KEY = 'schoolAppProfile';

const defaultSchoolProfile = {
    schoolName: 'PROGGA The School',
    eiinNumber: '',
    location: '',
    logo: defaultLogo,
    adminName: 'Progga Admin',
    adminTitle: 'Administrator',
    adminEmail: 'sceamhasan8@gmail.com',
    adminPhone: '+880 1000-000000',
    language: 'en',
    branchNames: {
        primary: 'Primary School',
        secondary: 'High School',
        college: 'College',
    },
};

const SchoolProfileContext = createContext(null);

let cachedProfile = null;

const invalidateProfileCache = () => {
    cachedProfile = null;
};

const loadSchoolProfile = () => {
    if (cachedProfile !== null) return cachedProfile;
    try {
        const raw = window.localStorage.getItem(SCHOOL_PROFILE_KEY);
        const directName = window.localStorage.getItem('schoolName');
        const directEiin = window.localStorage.getItem('schoolEiinNumber');
        const directLocation = window.localStorage.getItem('schoolLocation');
        const directId = window.localStorage.getItem('schoolId');
        const directCode = window.localStorage.getItem('schoolCode');
        const parsed = raw ? JSON.parse(raw) : {};
        const activeSchoolName = parsed.schoolName || directName || defaultSchoolProfile.schoolName;
        const activeEiinNumber = parsed.eiinNumber || directEiin || defaultSchoolProfile.eiinNumber;
        const activeLocation = parsed.location !== undefined ? parsed.location : (directLocation || defaultSchoolProfile.location || '');
        const activeSchoolId = parsed.schoolId || directId || parsed.schoolCode || directCode || 'SCHOLASTICBASE_DEFAULT';
        const activeSchoolCode = parsed.schoolCode || directCode || parsed.schoolId || directId || 'SCHOLASTICBASE';

        let activeBranchNames = parsed.branchNames;
        if (!activeBranchNames) {
            const rawBranchNames = window.localStorage.getItem('schoolBranchNames');
            if (rawBranchNames) {
                try { activeBranchNames = JSON.parse(rawBranchNames); } catch {}
            }
        }

        const profile = {
            ...defaultSchoolProfile,
            ...parsed,
            schoolName: activeSchoolName,
            eiinNumber: activeEiinNumber,
            location: activeLocation,
            schoolId: activeSchoolId,
            schoolCode: activeSchoolCode,
            branchNames: {
                primary: activeBranchNames?.primary || defaultSchoolProfile.branchNames.primary,
                secondary: activeBranchNames?.secondary || defaultSchoolProfile.branchNames.secondary,
                college: activeBranchNames?.college || defaultSchoolProfile.branchNames.college,
            },
        };
        cachedProfile = profile;
        return profile;
    } catch {
        const directName = window.localStorage.getItem('schoolName');
        const directEiin = window.localStorage.getItem('schoolEiinNumber');
        const directLocation = window.localStorage.getItem('schoolLocation');
        const directId = window.localStorage.getItem('schoolId');
        const directCode = window.localStorage.getItem('schoolCode');
        const profile = {
            ...defaultSchoolProfile,
            schoolName: directName || defaultSchoolProfile.schoolName,
            eiinNumber: directEiin || defaultSchoolProfile.eiinNumber,
            location: directLocation || defaultSchoolProfile.location || '',
            schoolId: directId || directCode || 'PROGGA_DEFAULT',
            schoolCode: directCode || directId || 'PROGGA',
        };
        cachedProfile = profile;
        return profile;
    }
};

const saveSchoolProfile = (profile) => {
    invalidateProfileCache();
    try {
        window.localStorage.setItem(SCHOOL_PROFILE_KEY, JSON.stringify(profile));
        if (profile?.schoolName) {
            window.localStorage.setItem('schoolName', profile.schoolName);
        }
        if (profile?.eiinNumber !== undefined) {
            window.localStorage.setItem('schoolEiinNumber', profile.eiinNumber);
        }
        if (profile?.location !== undefined) {
            window.localStorage.setItem('schoolLocation', profile.location);
        }
        if (profile?.schoolId) {
            window.localStorage.setItem('schoolId', profile.schoolId);
        }
        if (profile?.schoolCode) {
            window.localStorage.setItem('schoolCode', profile.schoolCode);
        }
        if (profile?.branchNames) {
            window.localStorage.setItem('schoolBranchNames', JSON.stringify(profile.branchNames));
        }
    } catch {
        // Ignore storage failures so the app can keep running.
    }
};

const loadSchoolProfileFromFirestore = (schoolId) => getSchoolProfile(schoolId);
const saveSchoolProfileToFirestore = (profile) => saveSchoolProfileDoc(profile, profile?.schoolId || profile?.schoolCode || profile?.eiinNumber);

export function SchoolProfileProvider({ children }) {
    const [schoolProfile, setSchoolProfileState] = useState(loadSchoolProfile);
    const { user } = useAuth();

    useEffect(() => {
        // FIX #4: 'storage' event only fires in OTHER tabs, not the current one.
        // We also need to listen to the custom 'schoolDataUpdate' event dispatched
        // by signIn() and writeStorage() within the same tab.
        const handleStorageChange = (e) => {
            if (
                !e.key ||   // CustomEvent has no key — treat as a full refresh signal
                e.key === SCHOOL_PROFILE_KEY ||
                e.key === 'schoolName' ||
                e.key === 'schoolEiinNumber' ||
                e.key === 'schoolLocation' ||
                e.key === 'schoolId' ||
                e.key === 'schoolCode'
            ) {
                invalidateProfileCache();
                setSchoolProfileState(loadSchoolProfile());
            }
        };

        const handleCustomUpdate = () => {
            invalidateProfileCache();
            setSchoolProfileState(loadSchoolProfile());
        };

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('schoolDataUpdate', handleCustomUpdate);  // same-tab updates
        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('schoolDataUpdate', handleCustomUpdate);
        };
    }, []);

    useEffect(() => {
        // Guard: resolve the target school ID before attempting any Firestore reads.
        // On Netlify cold-starts the Firebase Auth token isn't established yet, so
        // firing a Firestore read against PROGGA_DEFAULT (or empty) would fail with
        // permission-denied and leave the profile in a broken state.
        const targetSchoolId =
            user?.schoolId ||
            user?.schoolCode ||
            user?.eiinNumber ||
            window.localStorage.getItem('schoolId');

        // Skip sync entirely when no real school context is available yet.
        if (!targetSchoolId || targetSchoolId === 'PROGGA_DEFAULT') return;

        let active = true;

        const syncSchoolProfile = async () => {
            try {
                const remoteProfile = await loadSchoolProfileFromFirestore(targetSchoolId);
                if (!active || !remoteProfile) return;

                const nextProfile = {
                    ...defaultSchoolProfile,
                    ...remoteProfile,
                    schoolName: remoteProfile.schoolName || window.localStorage.getItem('schoolName') || defaultSchoolProfile.schoolName,
                    eiinNumber: remoteProfile.eiinNumber || window.localStorage.getItem('schoolEiinNumber') || defaultSchoolProfile.eiinNumber,
                    location: remoteProfile.location !== undefined ? remoteProfile.location : (window.localStorage.getItem('schoolLocation') || defaultSchoolProfile.location || ''),
                };
                setSchoolProfileState(nextProfile);
                saveSchoolProfile(nextProfile);
            } catch (err) {
                console.warn('Could not load school profile from Firestore. Using local cache.', err);
            }
        };

        syncSchoolProfile();
        return () => {
            active = false;
        };
    }, [user?.schoolId, user?.schoolCode, user?.eiinNumber]);

    const persistProfile = (profile) => {
        saveSchoolProfile(profile);
        saveSchoolProfileToFirestore(profile).catch((err) => {
            console.warn('Could not save school profile to Firestore. Local cache was updated.', err);
        });
    };

    const setSchoolProfile = (updates) => {
        if (!user || (user.role !== 'admin' && !user.isSuperAdmin)) {
            console.warn('Unauthorized: Changing school profile configurations is restricted to the admin / super admin role.');
            return;
        }
        setSchoolProfileState((current) => {
            const nextProfile = { ...current, ...updates };
            persistProfile(nextProfile);
            return nextProfile;
        });
    };

    const resetSchoolProfile = () => {
        if (!user || (user.role !== 'admin' && !user.isSuperAdmin)) {
            console.warn('Unauthorized: Resetting school profile configurations is restricted to the admin / super admin role.');
            return;
        }
        setSchoolProfileState(defaultSchoolProfile);
        persistProfile(defaultSchoolProfile);
    };

    const provisionSchoolProfile = (profile) => {
        const nextProfile = { ...defaultSchoolProfile, ...profile };
        setSchoolProfileState(nextProfile);
        saveSchoolProfile(nextProfile);
        try {
            registerSchoolInRegistry(nextProfile);
        } catch {}
        saveSchoolProfileToFirestore(nextProfile).catch((err) => {
            console.warn('Could not save school profile to Firestore on provisioning.', err);
        });
        return nextProfile;
    };

    /**
     * Switch active school context (Super Admin multi-school control).
     * Updates active schoolProfile state, localStorage, and notifies listeners.
     */
    const switchSchool = (schoolObj) => {
        if (!schoolObj) return;
        const nextProfile = {
            ...defaultSchoolProfile,
            ...schoolObj,
            schoolId: schoolObj.schoolId || schoolObj.schoolCode || schoolObj.eiinNumber || 'PROGGA_DEFAULT',
            schoolCode: schoolObj.schoolCode || schoolObj.schoolId || 'PROGGA',
            schoolName: schoolObj.schoolName || defaultSchoolProfile.schoolName,
            eiinNumber: schoolObj.eiinNumber || defaultSchoolProfile.eiinNumber,
            location: schoolObj.location || schoolObj.address || defaultSchoolProfile.location || '',
            branchNames: {
                primary: schoolObj.branchNames?.primary || defaultSchoolProfile.branchNames.primary,
                secondary: schoolObj.branchNames?.secondary || defaultSchoolProfile.branchNames.secondary,
                college: schoolObj.branchNames?.college || defaultSchoolProfile.branchNames.college,
            },
        };

        setSchoolProfileState(nextProfile);
        saveSchoolProfile(nextProfile);
        
        try {
            registerSchoolInRegistry(nextProfile);
        } catch {}

        try {
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('schoolDataUpdate'));
            }
        } catch {}

        return nextProfile;
    };

    const value = useMemo(
        () => ({
            schoolProfile,
            setSchoolProfile,
            provisionSchoolProfile,
            switchSchool,
            resetSchoolProfile,
            defaultSchoolProfile,
        }),
        [schoolProfile]
    );

    return (
        <SchoolProfileContext.Provider value={value}>
            {children}
        </SchoolProfileContext.Provider>
    );
}

export function useSchoolProfile() {
    const context = useContext(SchoolProfileContext);
    if (!context) {
        console.warn('[SchoolProfileContext] useSchoolProfile was called outside of SchoolProfileProvider. Returning safe fallback context.');
        return {
            schoolProfile: defaultSchoolProfile,
            setSchoolProfile: () => {},
            provisionSchoolProfile: () => defaultSchoolProfile,
            switchSchool: () => defaultSchoolProfile,
            resetSchoolProfile: () => {},
            defaultSchoolProfile,
        };
    }
    return context;
}
