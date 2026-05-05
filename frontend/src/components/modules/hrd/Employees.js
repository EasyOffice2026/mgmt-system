// src/components/modules/hrd/Employees.js
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import { useLang } from '../../../contexts/LangContext';
import { useAuth } from '../../../contexts/AuthContext';
import toast from 'react-hot-toast';
import {
  Modal, StatusBadge, DownloadButtons, AttachZone, CameraZone,
  EmptyState, Spinner, InfoRow, KpiCard, useConfirm
} from '../../layout/SharedComponents';

const AVATAR_COLORS = ['#2563a8','#2e7d52','#c0392b','#d4830a','#534ab7','#0f6e56','#185fa5'];

const EMPTY_EMP = {
  full_name:'', full_name_ar:'', nationality:'', civil_id:'', civil_id_expiry:'',
  passport_no:'', passport_expiry:'', mobile:'', email:'', date_of_birth:'',
  gender:'Male', marital_status:'Single', department_id:'', designation:'',
  employment_type:'full_time', join_date:'', contract_end_date:'',
  basic_salary:0, housing_allowance:0, transport_allowance:0, other_allowance:0,
  bank_name:'', iban:'', residency_no:'', residency_expiry:'',
  work_permit_no:'', work_permit_expiry:'', health_card_no:'', health_card_expiry:'',
  emergency_contact_name:'', emergency_contact_mobile:'', emergency_contact_relation:'',
  status:'active', notes:''
};

export default function Employees() {
  const { t } = useLang();
  const { profile, user } = useAuth();
  const { confirm, Dialog } = useConfirm();
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [viewItem, setViewItem] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY_EMP);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('employees').select('*, departments(name, name_ar)').order('created_at', { ascending: false });
    if (search) q = q.or(`full_name.ilike.%${search}%,employee_no.ilike.%${search}%`);
    if (deptFilter) q = q.eq('department_id', deptFilter);
    const { data, error } = await q;
    if (!error) setEmployees(data || []);
    setLoading(false);
  }, [search, deptFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    supabase.from('departments').select('*').then(({ data }) => setDepartments(data || []));
  }, []);

  const totalSalary = emp => (emp.basic_salary || 0) + (emp.housing_allowance || 0) + (emp.transport_allowance || 0) + (emp.other_allowance || 0);

  function initials(name) {
    return (name || '').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  }

  function f(k, v) { setForm(prev => ({ ...prev, [k]: v })); }

  async function handleSave() {
    if (!form.full_name.trim() || !form.join_date) {
      toast.error(t('required'));
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, created_by: profile?.id || user?.id };
      if (editItem) {
        const { error } = await supabase.from('employees').update(payload).eq('id', editItem.id);
        if (error) throw error;
      } else {
        const { data: noData } = await supabase.rpc('next_employee_no');
        const { error } = await supabase.from('employees').insert({ ...payload, employee_no: noData });
        if (error) throw error;
      }
      toast.success(t('employeeSaved'));
      setShowAdd(false); setEditItem(null); setForm(EMPTY_EMP);
      load();
    } catch (err) {
      toast.error(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    const ok = await confirm(t('delete') + '?');
    if (!ok) return;
    const { error } = await supabase.from('employees').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Deleted'); load(); }
  }

  function openEdit(e) { setForm({ ...e }); setEditItem(e); setShowAdd(true); }

  const counts = {
    total: employees.length,
    active: employees.filter(e => e.status === 'active').length,
    leave: employees.filter(e => e.status === 'leave').length,
    totalPayroll: employees.reduce((s, e) => s + totalSalary(e), 0)
  };

  const getRows = () => employees.map(e => [e.employee_no, e.full_name, e.nationality, e.designation, e.departments?.name || '', totalSalary(e), e.status]);

  return (
    <div>
      <Dialog />
      <div className="page-header">
        <div>
          <div className="page-title">{t('hrd')}</div>
          <div className="page-subtitle">{employees.length} {t('totalEmployees').toLowerCase()}</div>
        </div>
        <div className="action-btns">
          <DownloadButtons title="Employees" columns={[t('employeeNo'), t('fullName'), t('nationality'), t('designation'), t('department'), t('totalSalary'), t('status')]} getRows={getRows} />
          <button className="btn btn-primary" onClick={() => { setForm(EMPTY_EMP); setEditItem(null); setShowAdd(true); }}>
            + {t('addEmployee')}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        <KpiCard label={t('totalEmployees')} value={counts.total} icon="👥" color="blue" />
        <KpiCard label={t('active')} value={counts.active} icon="✅" color="green" />
        <KpiCard label={t('onLeave')} value={counts.leave} icon="🌴" color="amber" />
        <KpiCard label={t('monthlyPayroll')} value={`KD ${counts.totalPayroll.toLocaleString()}`} icon="💳" color="teal" />
      </div>

      {/* Filters */}
      <div className="search-bar">
        <input placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 300 }} />
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} style={{ width: 180 }}>
          <option value="">{t('allEmployees')}</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {/* Employee Cards Grid */}
      {loading ? <Spinner /> : employees.length === 0 ? <EmptyState icon="🏢" /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {employees.map((e, i) => {
            const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
            const sal = totalSalary(e);
            return (
              <div key={e.id} className="emp-card" onClick={() => setViewItem(e)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="emp-avatar" style={{ background: color }}>{initials(e.full_name)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.full_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>{e.designation || '—'}</div>
                  </div>
                  <StatusBadge status={e.status} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12 }}>
                  <div><span style={{ color: 'var(--text2)' }}>{t('employeeNo')}: </span><span className="tag">{e.employee_no}</span></div>
                  <div><span style={{ color: 'var(--text2)' }}>{t('department')}: </span><strong>{e.departments?.name || '—'}</strong></div>
                  <div><span style={{ color: 'var(--text2)' }}>{t('nationality')}: </span>{e.nationality || '—'}</div>
                  <div><span style={{ color: 'var(--text2)' }}>{t('totalSalary')}: </span><strong style={{ color: 'var(--primary-light)' }}>KD {sal}</strong></div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text2)' }}>{t('joinDate')}: {e.join_date}</span>
                  <div className="action-btns" onClick={ev => ev.stopPropagation()}>
                    <button className="btn btn-outline btn-sm" onClick={() => openEdit(e)}>✏️</button>
                    <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(e.id)}>🗑</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={showAdd} onClose={() => { setShowAdd(false); setEditItem(null); }} title={`👤 ${editItem ? t('edit') : t('addEmployee')}`} size="modal-lg"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => { setShowAdd(false); setEditItem(null); }}>{t('cancel')}</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? '...' : t('save')}</button>
          </>
        }
      >
        {/* Personal */}
        <div className="section-label">🧑 {t('personalInfo')}</div>
        <div className="form-grid">
          <div className="form-group"><label className="field-label">{t('fullName')} *</label><input value={form.full_name} onChange={e => f('full_name', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">الاسم بالعربي</label><input value={form.full_name_ar || ''} onChange={e => f('full_name_ar', e.target.value)} dir="rtl" /></div>
          <div className="form-group"><label className="field-label">{t('nationality')}</label><input value={form.nationality || ''} onChange={e => f('nationality', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('gender')}</label>
            <select value={form.gender} onChange={e => f('gender', e.target.value)}>
              <option value="Male">{t('male')}</option><option value="Female">{t('female')}</option>
            </select>
          </div>
          <div className="form-group"><label className="field-label">{t('dateOfBirth')}</label><input type="date" value={form.date_of_birth || ''} onChange={e => f('date_of_birth', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('maritalStatus')}</label>
            <select value={form.marital_status} onChange={e => f('marital_status', e.target.value)}>
              <option value="Single">{t('single')}</option><option value="Married">{t('married')}</option>
              <option value="Divorced">{t('divorced')}</option><option value="Widowed">{t('widowed')}</option>
            </select>
          </div>
          <div className="form-group"><label className="field-label">{t('mobileNo')}</label><input value={form.mobile || ''} onChange={e => f('mobile', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('emailAddress')}</label><input type="email" value={form.email || ''} onChange={e => f('email', e.target.value)} /></div>
        </div>

        {/* Employment */}
        <hr className="divider" />
        <div className="section-label">📋 {t('employmentInfo')}</div>
        <div className="form-grid">
          <div className="form-group"><label className="field-label">{t('department')}</label>
            <select value={form.department_id || ''} onChange={e => f('department_id', e.target.value)}>
              <option value="">—</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="field-label">{t('designation')}</label><input value={form.designation || ''} onChange={e => f('designation', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('employmentType')}</label>
            <select value={form.employment_type} onChange={e => f('employment_type', e.target.value)}>
              <option value="full_time">{t('fullTime')}</option>
              <option value="part_time">{t('partTime')}</option>
              <option value="contract">{t('contractType')}</option>
            </select>
          </div>
          <div className="form-group"><label className="field-label">{t('status')}</label>
            <select value={form.status} onChange={e => f('status', e.target.value)}>
              <option value="active">{t('active')}</option><option value="inactive">{t('inactive')}</option>
              <option value="leave">{t('onLeave')}</option><option value="terminated">{t('terminated')}</option>
            </select>
          </div>
          <div className="form-group"><label className="field-label">{t('joinDate')} *</label><input type="date" value={form.join_date || ''} onChange={e => f('join_date', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('contractEndDate')}</label><input type="date" value={form.contract_end_date || ''} onChange={e => f('contract_end_date', e.target.value)} /></div>
        </div>

        {/* Salary */}
        <hr className="divider" />
        <div className="section-label">💰 {t('salaryAllowances')}</div>
        <div className="form-grid">
          <div className="form-group"><label className="field-label">{t('basicSalary')} (KD)</label><input type="number" value={form.basic_salary || ''} onChange={e => f('basic_salary', parseFloat(e.target.value) || 0)} /></div>
          <div className="form-group"><label className="field-label">{t('housingAllowance')} (KD)</label><input type="number" value={form.housing_allowance || ''} onChange={e => f('housing_allowance', parseFloat(e.target.value) || 0)} /></div>
          <div className="form-group"><label className="field-label">{t('transportAllowance')} (KD)</label><input type="number" value={form.transport_allowance || ''} onChange={e => f('transport_allowance', parseFloat(e.target.value) || 0)} /></div>
          <div className="form-group"><label className="field-label">{t('otherAllowance')} (KD)</label><input type="number" value={form.other_allowance || ''} onChange={e => f('other_allowance', parseFloat(e.target.value) || 0)} /></div>
          <div className="form-group">
            <label className="field-label">{t('totalSalary')}</label>
            <input readOnly value={`KD ${((form.basic_salary||0)+(form.housing_allowance||0)+(form.transport_allowance||0)+(form.other_allowance||0)).toFixed(3)}`} style={{ fontWeight: 700, color: 'var(--primary-light)' }} />
          </div>
        </div>

        {/* Bank */}
        <hr className="divider" />
        <div className="section-label">🏦 {t('bankInfo')}</div>
        <div className="form-grid">
          <div className="form-group"><label className="field-label">{t('bankName')}</label><input value={form.bank_name || ''} onChange={e => f('bank_name', e.target.value)} /></div>
          <div className="form-group full"><label className="field-label">{t('ibanAccount')}</label><input value={form.iban || ''} onChange={e => f('iban', e.target.value)} /></div>
        </div>

        {/* Documents */}
        <hr className="divider" />
        <div className="section-label">🪪 {t('officialDocuments')}</div>
        <div className="form-grid">
          <div className="form-group"><label className="field-label">{t('civilId')}</label><input value={form.civil_id || ''} onChange={e => f('civil_id', e.target.value)} maxLength={12} /></div>
          <div className="form-group"><label className="field-label">{t('civilIdExpiry')}</label><input type="date" value={form.civil_id_expiry || ''} onChange={e => f('civil_id_expiry', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('passportNo')}</label><input value={form.passport_no || ''} onChange={e => f('passport_no', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('passportExpiry')}</label><input type="date" value={form.passport_expiry || ''} onChange={e => f('passport_expiry', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('residencyNo')}</label><input value={form.residency_no || ''} onChange={e => f('residency_no', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('residencyExpiry')}</label><input type="date" value={form.residency_expiry || ''} onChange={e => f('residency_expiry', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('workPermitNo')}</label><input value={form.work_permit_no || ''} onChange={e => f('work_permit_no', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('workPermitExpiry')}</label><input type="date" value={form.work_permit_expiry || ''} onChange={e => f('work_permit_expiry', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('healthCardNo')}</label><input value={form.health_card_no || ''} onChange={e => f('health_card_no', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('healthCardExpiry')}</label><input type="date" value={form.health_card_expiry || ''} onChange={e => f('health_card_expiry', e.target.value)} /></div>
        </div>

        {/* Emergency */}
        <hr className="divider" />
        <div className="section-label">🚨 {t('emergencyContact')}</div>
        <div className="form-grid">
          <div className="form-group"><label className="field-label">{t('emergencyContactName')}</label><input value={form.emergency_contact_name || ''} onChange={e => f('emergency_contact_name', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('emergencyMobile')}</label><input value={form.emergency_contact_mobile || ''} onChange={e => f('emergency_contact_mobile', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('emergencyRelation')}</label><input value={form.emergency_contact_relation || ''} onChange={e => f('emergency_contact_relation', e.target.value)} /></div>
        </div>

        {/* Attachments */}
        <hr className="divider" />
        <div className="section-label">📎 {t('documents')}</div>
        <div className="attach-grid-3">
          <AttachZone icon="🪪" label={t('attachCivilIdCopy')} bucket="employee-docs" path="civil-id" />
          <AttachZone icon="📘" label={t('attachPassportCopy')} bucket="employee-docs" path="passport" />
          <AttachZone icon="📄" label={t('attachEmploymentContract')} bucket="employee-docs" path="contracts" />
          <AttachZone icon="🏥" label={t('attachHealthCard')} bucket="employee-docs" path="health-card" />
          <AttachZone icon="📋" label={t('attachWorkPermit')} bucket="employee-docs" path="work-permit" />
          <CameraZone label={t('attachPhoto')} bucket="employee-docs" path="photos" />
        </div>
      </Modal>

      {/* View Profile Modal */}
      {viewItem && (
        <Modal open={!!viewItem} onClose={() => setViewItem(null)} title={`👤 ${viewItem.full_name}`} size="modal-lg"
          footer={
            <>
              <button className="btn btn-outline" onClick={() => setViewItem(null)}>{t('cancel')}</button>
              <button className="btn btn-primary" onClick={() => { setViewItem(null); openEdit(viewItem); }}>✏️ {t('edit')}</button>
            </>
          }
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { l: t('employeeNo'), v: viewItem.employee_no },
              { l: t('employmentType'), v: t(viewItem.employment_type) },
              { l: t('totalSalary'), v: `KD ${totalSalary(viewItem)}` },
            ].map((x, i) => (
              <div key={i} style={{ background: 'var(--bg)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600 }}>{x.l}</div>
                <div style={{ fontWeight: 700, marginTop: 4, color: 'var(--primary)' }}>{x.v}</div>
              </div>
            ))}
          </div>
          <div className="section-label">🧑 {t('personalInfo')}</div>
          <InfoRow label={t('nationality')} value={viewItem.nationality} />
          <InfoRow label={t('dateOfBirth')} value={viewItem.date_of_birth} />
          <InfoRow label={t('gender')} value={viewItem.gender} />
          <InfoRow label={t('maritalStatus')} value={viewItem.marital_status} />
          <InfoRow label={t('mobileNo')} value={viewItem.mobile} />
          <InfoRow label={t('emailAddress')} value={viewItem.email} />
          <div className="section-label">📋 {t('employmentInfo')}</div>
          <InfoRow label={t('department')} value={viewItem.departments?.name} />
          <InfoRow label={t('designation')} value={viewItem.designation} />
          <InfoRow label={t('joinDate')} value={viewItem.join_date} />
          <InfoRow label={t('contractEndDate')} value={viewItem.contract_end_date} />
          <InfoRow label={t('status')} value={<StatusBadge status={viewItem.status} />} />
          <div className="section-label">💰 {t('salaryAllowances')}</div>
          <InfoRow label={t('basicSalary')} value={`KD ${viewItem.basic_salary}`} />
          <InfoRow label={t('housingAllowance')} value={`KD ${viewItem.housing_allowance}`} />
          <InfoRow label={t('transportAllowance')} value={`KD ${viewItem.transport_allowance}`} />
          {viewItem.other_allowance > 0 && <InfoRow label={t('otherAllowance')} value={`KD ${viewItem.other_allowance}`} />}
          <InfoRow label={t('totalSalary')} value={<strong style={{ color: 'var(--primary-light)', fontSize: 15 }}>KD {totalSalary(viewItem)}</strong>} />
          <div className="section-label">🏦 {t('bankInfo')}</div>
          <InfoRow label={t('bankName')} value={viewItem.bank_name} />
          <InfoRow label={t('ibanAccount')} value={viewItem.iban} mono />
          <div className="section-label">🪪 {t('officialDocuments')}</div>
          {viewItem.civil_id && <InfoRow label={t('civilId')} value={`${viewItem.civil_id} (${t('civilIdExpiry')}: ${viewItem.civil_id_expiry || '—'})`} mono />}
          <InfoRow label={t('passportNo')} value={`${viewItem.passport_no || '—'} (exp: ${viewItem.passport_expiry || '—'})`} />
          {viewItem.residency_no && <InfoRow label={t('residencyNo')} value={`${viewItem.residency_no} (exp: ${viewItem.residency_expiry || '—'})`} />}
          {viewItem.work_permit_no && <InfoRow label={t('workPermitNo')} value={`${viewItem.work_permit_no} (exp: ${viewItem.work_permit_expiry || '—'})`} />}
          {viewItem.health_card_no && <InfoRow label={t('healthCardNo')} value={`${viewItem.health_card_no} (exp: ${viewItem.health_card_expiry || '—'})`} />}
          <div className="section-label">🚨 {t('emergencyContact')}</div>
          <InfoRow label={t('emergencyContactName')} value={viewItem.emergency_contact_name} />
          <InfoRow label={t('emergencyMobile')} value={viewItem.emergency_contact_mobile} />
          <InfoRow label={t('emergencyRelation')} value={viewItem.emergency_contact_relation} />
        </Modal>
      )}
    </div>
  );
}
