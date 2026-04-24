import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import { useLang } from '../../../contexts/LangContext';
import { DownloadButtons, EmptyState, Spinner, StatusBadge } from '../../layout/SharedComponents';

export default function Kitchen() {
  const { t } = useLang();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('kitchen_tickets')
      .select('*, orders(order_no), guests(full_name), restaurant_tables(table_no, table_name)')
      .order('created_at', { ascending: false })
      .limit(200);

    if (statusFilter) q = q.eq('status', statusFilter);

    const { data } = await q;
    setTickets(data || []);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function setStatus(ticket, status) {
    await supabase.from('kitchen_tickets').update({ status }).eq('id', ticket.id);
    if (status === 'ready') {
      await supabase.from('orders').update({ status: 'ready' }).eq('id', ticket.order_id);
    }
    if (status === 'served') {
      await supabase.from('orders').update({ status: 'served' }).eq('id', ticket.order_id);
    }
    load();
  }

  const getRows = () => tickets.map((k) => [
    k.ticket_no,
    k.orders?.order_no || '',
    k.guests?.full_name || '',
    k.restaurant_tables?.table_name || k.restaurant_tables?.table_no || '',
    k.priority,
    k.status
  ]);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{t('kitchen')}</div>
          <div className="page-subtitle">{tickets.length} tickets</div>
        </div>
        <DownloadButtons
          title="Kitchen_Tickets"
          columns={[t('ticketNo'), t('orderNo'), t('guest'), t('table'), t('priority'), t('status')]}
          getRows={getRows}
        />
      </div>

      <div className="search-bar">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 220 }}>
          <option value="">{t('allStatus')}</option>
          <option value="queued">{t('queued')}</option>
          <option value="preparing">{t('preparing')}</option>
          <option value="ready">{t('ready')}</option>
          <option value="served">{t('served')}</option>
        </select>
      </div>

      <div className="card">
        {loading ? (
          <Spinner />
        ) : tickets.length === 0 ? (
          <EmptyState icon="🍳" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('ticketNo')}</th>
                  <th>{t('orderNo')}</th>
                  <th>{t('guest')}</th>
                  <th>{t('table')}</th>
                  <th>{t('priority')}</th>
                  <th>{t('status')}</th>
                  <th>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td><span className="tag">{ticket.ticket_no}</span></td>
                    <td>{ticket.orders?.order_no || '—'}</td>
                    <td>{ticket.guests?.full_name || 'Walk-in'}</td>
                    <td>{ticket.restaurant_tables?.table_name || ticket.restaurant_tables?.table_no || 'Takeaway'}</td>
                    <td><span className="pill">{ticket.priority}</span></td>
                    <td><StatusBadge status={ticket.status} /></td>
                    <td>
                      <div className="action-btns">
                        {ticket.status === 'queued' && (
                          <button className="btn btn-outline btn-sm" onClick={() => setStatus(ticket, 'preparing')}>
                            {t('startPrep')}
                          </button>
                        )}
                        {(ticket.status === 'queued' || ticket.status === 'preparing') && (
                          <button className="btn btn-success btn-sm" onClick={() => setStatus(ticket, 'ready')}>
                            {t('markReady')}
                          </button>
                        )}
                        {ticket.status === 'ready' && (
                          <button className="btn btn-primary btn-sm" onClick={() => setStatus(ticket, 'served')}>
                            {t('markServed')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
