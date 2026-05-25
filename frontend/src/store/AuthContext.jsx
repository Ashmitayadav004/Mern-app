import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { authApi } from '../services/api';

const INACTIVITY_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours
const WARNING_BEFORE     = 5 * 60 * 1000;        // warn 5 min before logout

const AuthContext = createContext(null);

// ─── Granular Permission Modules ───────────────────────────────────────────
export const PERMISSION_MODULES = [
  {
    key: 'cases',
    label: 'Cases',
    icon: '📂',
    actions: ['view', 'create', 'edit', 'delete', 'advance_stage'],
  },
  {
    key: 'clients',
    label: 'Clients',
    icon: '👥',
    actions: ['view', 'create', 'edit', 'delete'],
  },
  {
    key: 'inventory',
    label: 'Inventory',
    icon: '🔄',
    actions: ['view', 'create', 'edit', 'delete'],
  },
  {
    key: 'accounting',
    label: 'Accounting',
    icon: '💼',
    actions: ['view', 'create_invoice', 'create_quote', 'record_payment', 'create_expense'],
  },
  {
    key: 'reports',
    label: 'Reports',
    icon: '📊',
    actions: ['view', 'export'],
  },
  {
    key: 'analytics',
    label: 'Analytics',
    icon: '📈',
    actions: ['view'],
  },
  {
    key: 'knowledge_base',
    label: 'Knowledge Base',
    icon: '📚',
    actions: ['view', 'create', 'delete'],
  },
  {
    key: 'recycle_bin',
    label: 'Recycle Bin',
    icon: '🗑️',
    actions: ['view', 'restore', 'permanent_delete'],
  },
  {
    key: 'settings',
    label: 'Settings',
    icon: '⚙️',
    actions: [
      'view',
      'edit_company',
      'edit_numbers',
      'edit_users',
      'edit_roles',
      'edit_stages',
      'edit_symptoms',
      'edit_failure_types',
      'edit_brands',
      'edit_payment_methods',
      'edit_whatsapp',
      'edit_razorpay',
      'edit_gst',
    ],
  },
  {
    key: 'users',
    label: 'User Management',
    icon: '👤',
    actions: ['view', 'create', 'edit', 'deactivate'],
  },
  {
    key: 'webhooks',
    label: 'Webhooks',
    icon: '🔗',
    actions: ['view', 'edit'],
  },
];

// Default full-access permissions (for admin role)
export function buildFullPermissions() {
  const perms = {};
  PERMISSION_MODULES.forEach(m => {
    perms[m.key] = {};
    m.actions.forEach(a => { perms[m.key][a] = true; });
  });
  return perms;
}

// Build empty permissions object (all false)
export function buildEmptyPermissions() {
  const perms = {};
  PERMISSION_MODULES.forEach(m => {
    perms[m.key] = {};
    m.actions.forEach(a => { perms[m.key][a] = false; });
  });
  return perms;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionWarning, setSessionWarning] = useState(false); // 5-min warning
  const lastActivityRef = useRef(Date.now());
  const intervalRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      authApi.me()
        .then(u => setUser(u))
        .catch(() => { localStorage.clear(); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (credentials) => {
    const data = await authApi.login(credentials);
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    setUser(data.user);
    return data.user;
  };

  // Set user from already-fetched login data (avoids double API call)
  const setLoggedIn = (userData) => {
    setUser(userData);
  };

  const logout = useCallback(async (reason) => {
    const refreshToken = localStorage.getItem('refreshToken');
    try { await authApi.logout(refreshToken); } catch {}
    localStorage.clear();
    if (reason === 'inactivity') localStorage.setItem('logout_reason', 'inactivity');
    setUser(null);
    setSessionWarning(false);
  }, []);

  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    setSessionWarning(false);
  }, []);

  // ── Inactivity watcher ──────────────────────────────────────────
  useEffect(() => {
    if (!user) { clearInterval(intervalRef.current); return; }

    const onActivity = () => { lastActivityRef.current = Date.now(); setSessionWarning(false); };
    const events = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, onActivity, { passive: true }));

    intervalRef.current = setInterval(() => {
      const idle = Date.now() - lastActivityRef.current;
      if (idle >= INACTIVITY_TIMEOUT) {
        logout('inactivity');
      } else if (idle >= INACTIVITY_TIMEOUT - WARNING_BEFORE) {
        setSessionWarning(true);
      }
    }, 30_000); // check every 30s

    return () => {
      events.forEach(e => window.removeEventListener(e, onActivity));
      clearInterval(intervalRef.current);
    };
  }, [user, logout]);

  // ─── Role Hierarchy Check (legacy, for broad checks) ──────────────
  const canAccess = (minRole) => {
    if (!user) return false;
    if (user.role === 'super_admin') return true;
    if (user.role === 'admin') return minRole !== 'super_admin';
    if (minRole === 'super_admin') return false;
    if (minRole === 'admin') return user.role === 'admin';

    // Use numeric hierarchy
    let hierarchy = { admin: 99, senior_engineer: 3, junior_engineer: 2, staff: 1, front_desk: 1, client: 0 };
    try {
      const customRoles = JSON.parse(localStorage.getItem('crm_roles') || '[]');
      if (customRoles.length > 0) {
        hierarchy = { admin: 99, super_admin: 999 };
        customRoles.forEach(r => { hierarchy[r.key || r.id] = r.level || 1; });
      }
    } catch {}
    return (hierarchy[user?.role] || 0) >= (hierarchy[minRole] || 0);
  };

  // ─── Granular Permission Check ─────────────────────────────────────
  // hasPermission('cases', 'view') → boolean
  const hasPermission = (module, action) => {
    if (!user) return false;
    // Super admin and admin always have full access
    if (user.role === 'super_admin' || user.role === 'admin') return true;

    // Check user's assigned permissions (stored on user object or localStorage)
    const userPerms = user.permissions || (() => {
      try { return JSON.parse(localStorage.getItem(`user_perms_${user.id}`) || 'null'); } catch { return null; }
    })();

    // If no permissions object exists at all, deny access for non-admin users.
    // The backend now resolves role-based permissions into user.permissions,
    // so if it's still null/empty, the user has no granted access.
    if (!userPerms || typeof userPerms !== 'object' || Object.keys(userPerms).length === 0) {
      return false;
    }
    return !!(userPerms[module] && userPerms[module][action]);
  };

  // ─── Role Flags ────────────────────────────────────────────────────────
  // isSuperAdmin — platform-level owner (RecoverLab team)
  const isSuperAdmin = user?.role === 'super_admin';
  // isOwner — per-tenant account owner (the admin who manages this lab's subscription)
  const isOwner = user?.role === 'admin';
  // isAdmin — isOwner OR isSuperAdmin (broad admin gate)
  const isAdmin = isOwner || isSuperAdmin;
  const tenantId = user?.tenantId || user?.tenant_id || user?.id;

  return (
    <AuthContext.Provider value={{
      user, loading, login, logout, setLoggedIn,
      canAccess, hasPermission,
      isSuperAdmin, isOwner, isAdmin, tenantId,
      sessionWarning, resetActivity,
      PERMISSION_MODULES, buildFullPermissions, buildEmptyPermissions,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
