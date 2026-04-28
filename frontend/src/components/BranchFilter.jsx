import React, { useEffect, useState } from 'react';
import { useApp } from '../context';
import { api } from '../api';

export default function BranchFilter({ value, onChange }) {
  const { t, user } = useApp();
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    api('/api/auth/branches').then(setBranches).catch(() => {});
  }, []);

  if (user?.role === 'branch_user') return null;

  return (
    <select value={value || ''} onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}>
      <option value="">{t('allBranches')}</option>
      {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
    </select>
  );
}
