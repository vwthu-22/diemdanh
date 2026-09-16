'use client';
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import styles from './export.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused';

interface AttendanceRecord {
  id: number;
  session: 'morning' | 'afternoon';
  status: AttendanceStatus;
  checkInTime?: string;
  note?: string;
}

interface DailyRow {
  student: { id: number; orderNum: number; name: string; dob?: string };
  morning: AttendanceRecord | null;
  afternoon: AttendanceRecord | null;
}

interface WeeklyData {
  students: { id: number; orderNum: number; name: string; dob?: string }[];
  dates: string[];
  attendances: (AttendanceRecord & { studentId: number; date: string })[];
  schedule?: Record<string, string[]>;
  today?: string;
  currentTime?: string;
  settings?: {
    morningLateEnd?: string;
    afternoonLateEnd?: string;
    startDate?: string;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: '✓',
  late: 'M',
  absent: '✗',
  excused: 'P',
};

const STATUS_COLOR: Record<AttendanceStatus, string> = {
  present: 'var(--color-present)',
  late: 'var(--color-late)',
  absent: 'var(--color-absent)',
  excused: 'var(--color-excused)',
};

function StatusCell({ record }: { record: AttendanceRecord | null }) {
  if (!record) return <td style={{ color: 'var(--color-text-muted)' }}>–</td>;
  return (
    <td>
      <span style={{ color: STATUS_COLOR[record.status], fontWeight: 700 }}>
        {STATUS_LABEL[record.status]}
      </span>
    </td>
  );
}

const DEFAULT_SCHEDULE: Record<string, string[]> = {
  '1': ['morning'],
  '2': ['morning', 'afternoon'],
  '3': ['morning', 'afternoon'],
  '4': ['morning'],
  '5': ['morning', 'afternoon'],
  '6': [],
  '0': [],
};

function TimeCell({ record }: { record: AttendanceRecord | null }) {
  if (!record?.checkInTime) return <td style={{ color: 'var(--color-text-muted)' }}>–</td>;
  return <td>{record.checkInTime.slice(0, 5)}</td>;
}

// ─── Daily Preview ────────────────────────────────────────────────────────────

function DailyPreview({ date }: { date: string }) {
  const [data, setData] = useState<DailyRow[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!date) return;
    setLoading(true);
    Promise.all([
      api.get<DailyRow[]>(`/admin/attendance?date=${date}`),
      api.get('/settings').catch(() => ({ data: null })),
    ])
      .then(([rData, rSettings]) => {
        setData(rData.data);
        setSettings(rSettings.data);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [date]);

  const label = date.split('-').reverse().join('/');

  const today = new Date().toLocaleDateString('en-CA');
  const startDate = settings?.startDate || '2026-09-14';
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const dow = String(new Date(date).getDay());
  const schedule = settings?.schedule || DEFAULT_SCHEDULE;

  const morningScheduled = schedule[dow]?.includes('morning') ?? true;
  const afternoonScheduled = schedule[dow]?.includes('afternoon') ?? true;
  const morningLateEnd = settings?.morningLateEnd || '08:15';
  const afternoonLateEnd = settings?.afternoonLateEnd || '13:45';

  const [ch, cm] = currentTime.split(':').map(Number);
  const [mh, mm] = morningLateEnd.split(':').map(Number);
  const [ah, am] = afternoonLateEnd.split(':').map(Number);

  const isPastStart = date >= startDate;
  const isMorningPassed = isPastStart && (date < today || (date === today && (ch * 60 + cm) > (mh * 60 + mm)));
  const isAfternoonPassed = isPastStart && (date < today || (date === today && (ch * 60 + cm) > (ah * 60 + am)));

  function getDailySessionDisplay(rec: AttendanceRecord | null, scheduled: boolean, passed: boolean) {
    if (rec) {
      return {
        label: STATUS_LABEL[rec.status],
        color: STATUS_COLOR[rec.status],
        status: rec.status as AttendanceStatus | null,
      };
    }
    if (scheduled && passed) {
      return {
        label: '✗',
        color: STATUS_COLOR['absent'],
        status: 'absent' as AttendanceStatus | null,
      };
    }
    return {
      label: '–',
      color: 'var(--color-text-muted)',
      status: null,
    };
  }

  function getRowSummary(row: DailyRow) {
    const mDisp = getDailySessionDisplay(row.morning, morningScheduled, isMorningPassed);
    const aDisp = getDailySessionDisplay(row.afternoon, afternoonScheduled, isAfternoonPassed);

    const statuses = [mDisp.status, aDisp.status].filter(Boolean) as AttendanceStatus[];
    if (statuses.length === 0) {
      return { label: '–', color: 'var(--color-text-muted)' };
    }
    if (statuses.some((s) => s === 'late')) return { label: 'Muộn', color: 'var(--color-late)' };
    if (statuses.some((s) => s === 'present')) return { label: 'Có mặt', color: 'var(--color-present)' };
    if (statuses.some((s) => s === 'excused')) return { label: 'Có phép', color: 'var(--color-excused)' };
    return { label: 'Vắng', color: 'var(--color-absent)' };
  }

  return (
    <div className={styles.previewTable}>
      <div className={styles.previewHeader}>XEM TRƯỚC – NGÀY {label}</div>
      {loading ? (
        <div className={styles.previewEmpty}>Đang tải...</div>
      ) : data.length === 0 ? (
        <div className={styles.previewEmpty}>Chưa có dữ liệu điểm danh ngày này</div>
      ) : (
        <div className={styles.tableScrollWrapper}>
          <table>
            <thead>
              <tr>
                <th className={styles.colSTT}>STT</th>
                <th className={styles.colName}>Họ và Tên</th>
                <th className={`${styles.colDob} ${styles.sectionDividerRight}`}>Ngày sinh</th>
                <th style={{ minWidth: 100 }}>Giờ vào Sáng</th>
                <th style={{ minWidth: 80 }} className={styles.dayDivider}>TT Sáng</th>
                <th style={{ minWidth: 100 }}>Giờ vào Chiều</th>
                <th style={{ minWidth: 80 }} className={styles.dayDivider}>TT Chiều</th>
                <th className={`${styles.colSummary} ${styles.sectionDividerLeft}`}>Tổng kết</th>
                <th style={{ minWidth: 140, textAlign: 'left', paddingLeft: 12 }}>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => {
                const sum = getRowSummary(row);
                const mDisp = getDailySessionDisplay(row.morning, morningScheduled, isMorningPassed);
                const aDisp = getDailySessionDisplay(row.afternoon, afternoonScheduled, isAfternoonPassed);
                const note = row.morning?.note || row.afternoon?.note || '';
                return (
                  <tr key={row.student.id}>
                    <td className={styles.colSTT} style={{ color: 'var(--color-text-muted)' }}>{i + 1}</td>
                    <td className={styles.colName} style={{ fontWeight: 600 }}>{row.student.name}</td>
                    <td className={`${styles.colDob} ${styles.sectionDividerRight}`} style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>{row.student.dob || '—'}</td>
                    <TimeCell record={row.morning} />
                    <td className={styles.dayDivider}>
                      <span style={{ color: mDisp.color, fontWeight: mDisp.label !== '–' ? 700 : 400 }}>
                        {mDisp.label}
                      </span>
                    </td>
                    <TimeCell record={row.afternoon} />
                    <td className={styles.dayDivider}>
                      <span style={{ color: aDisp.color, fontWeight: aDisp.label !== '–' ? 700 : 400 }}>
                        {aDisp.label}
                      </span>
                    </td>
                    <td className={`${styles.colSummary} ${styles.sectionDividerLeft}`}><span style={{ color: sum.color, fontWeight: 700 }}>{sum.label}</span></td>
                    <td style={{ textAlign: 'left', fontSize: '0.78rem', color: 'var(--color-text-muted)', paddingLeft: 12 }}>{note}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Weekly Preview ───────────────────────────────────────────────────────────

const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const PREVIEW_DAYS = 7;

function WeeklyPreview({ from, to }: { from: string; to: string }) {
  const [data, setData] = useState<WeeklyData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!from || !to) return;
    setLoading(true);
    api
      .get<WeeklyData>(`/admin/attendance/range?from=${from}&to=${to}`)
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [from, to]);

  const header = `${from.split('-').reverse().join('/')} → ${to.split('-').reverse().join('/')}`;

  if (loading) {
    return (
      <div className={styles.previewTable}>
        <div className={styles.previewHeader}>XEM TRƯỚC – TUẦN</div>
        <div className={styles.previewEmpty}>Đang tải...</div>
      </div>
    );
  }

  if (!data || data.students.length === 0) {
    return (
      <div className={styles.previewTable}>
        <div className={styles.previewHeader}>XEM TRƯỚC – TUẦN</div>
        <div className={styles.previewEmpty}>Chưa có dữ liệu điểm danh tuần này</div>
      </div>
    );
  }

  const { students, dates, attendances } = data;
  const shownDates = dates.slice(0, PREVIEW_DAYS);
  const hasMore = dates.length > PREVIEW_DAYS;

  function getSessionState(studentId: number, date: string, session: 'morning' | 'afternoon') {
    const rec = attendances.find((a) => a.studentId === studentId && a.date === date && a.session === session);
    if (rec) {
      return {
        status: rec.status,
        label: STATUS_LABEL[rec.status],
        color: STATUS_COLOR[rec.status],
        isAbsent: rec.status === 'absent',
      };
    }

    const dow = String(new Date(date).getDay());
    const schedule = data?.schedule;
    const isScheduled = schedule ? (schedule[dow]?.includes(session) ?? true) : true;

    const today = data?.today || new Date().toLocaleDateString('en-CA');
    const startDate = data?.settings?.startDate || today;
    const now = new Date();
    const currentTime = data?.currentTime || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const lateEnd = session === 'morning' ? (data?.settings?.morningLateEnd || '08:15') : (data?.settings?.afternoonLateEnd || '13:45');

    const [ch, cm] = currentTime.split(':').map(Number);
    const [lh, lm] = lateEnd.split(':').map(Number);
    const isPastStart = date >= startDate;
    const isPassed = isPastStart && (date < today || (date === today && (ch * 60 + cm) > (lh * 60 + lm)));

    if (isScheduled && isPassed) {
      // Session has passed and student was not checked in -> VẮNG!
      return {
        status: 'absent' as AttendanceStatus,
        label: '✗',
        color: STATUS_COLOR['absent'],
        isAbsent: true,
      };
    }

    // Off-session or future
    return {
      status: null,
      label: '–',
      color: 'var(--color-text-muted)',
      isAbsent: false,
    };
  }

  function countSummary(studentId: number) {
    let present = 0, late = 0, absent = 0, excused = 0;
    dates.forEach((d) => {
      (['morning', 'afternoon'] as const).forEach((sess) => {
        const state = getSessionState(studentId, d, sess);
        if (state.status === 'present') present++;
        else if (state.status === 'late') late++;
        else if (state.status === 'excused') excused++;
        else if (state.isAbsent) absent++;
      });
    });
    return { present, late, absent, excused };
  }

  return (
    <div className={styles.previewTable}>
      <div className={styles.previewHeader}>XEM TRƯỚC – {header} ({dates.length} ngày)</div>
      <div className={styles.tableScrollWrapper}>
        <table>
          <thead>
            <tr>
              <th rowSpan={2} className={styles.colSTT}>STT</th>
              <th rowSpan={2} className={styles.colName}>Họ và Tên</th>
              <th rowSpan={2} className={`${styles.colDob} ${styles.sectionDividerRight}`}>Ngày sinh</th>
              {shownDates.map((d) => {
                const dow = new Date(d).getDay();
                const [, m, dd] = d.split('-');
                return (
                  <th key={d} colSpan={2} className={styles.dayDivider}>
                    {DAY_LABELS[dow]} {dd}/{m}
                  </th>
                );
              })}
              {hasMore && <th colSpan={2} className={styles.dayDivider} style={{ color: 'var(--color-text-muted)' }}>...</th>}
              <th rowSpan={2} className={`${styles.colSummary} ${styles.sectionDividerLeft}`} style={{ background: 'var(--color-present-bg)', color: 'var(--color-present)' }}>Có mặt</th>
              <th rowSpan={2} className={styles.colSummary} style={{ background: 'var(--color-late-bg)', color: 'var(--color-late)' }}>Muộn</th>
              <th rowSpan={2} className={styles.colSummary} style={{ background: 'var(--color-absent-bg)', color: 'var(--color-absent)' }}>Vắng</th>
              <th rowSpan={2} className={styles.colSummary} style={{ background: 'var(--color-excused-bg)', color: 'var(--color-excused)' }}>Phép</th>
            </tr>
            <tr>
              {shownDates.map((d) => [
                <th key={`${d}-s`} className={styles.colSession}>S</th>,
                <th key={`${d}-c`} className={`${styles.colSession} ${styles.dayDivider}`}>C</th>,
              ])}
              {hasMore && [
                <th key="more-s" className={styles.colSession}>S</th>,
                <th key="more-c" className={`${styles.colSession} ${styles.dayDivider}`}>C</th>,
              ]}
            </tr>
          </thead>
          <tbody>
            {students.map((student, i) => {
              const sum = countSummary(student.id);
              return (
                <tr key={student.id}>
                  <td className={styles.colSTT} style={{ color: 'var(--color-text-muted)' }}>{i + 1}</td>
                  <td className={styles.colName} style={{ fontWeight: 600 }}>{student.name}</td>
                  <td className={`${styles.colDob} ${styles.sectionDividerRight}`} style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>{student.dob || '—'}</td>
                  {shownDates.map((d) => {
                    const mState = getSessionState(student.id, d, 'morning');
                    const afState = getSessionState(student.id, d, 'afternoon');
                    return [
                      <td key={`${d}-m`} className={styles.colSession}>
                        <span style={{ color: mState.color, fontWeight: mState.label !== '–' ? 700 : 400 }}>
                          {mState.label}
                        </span>
                      </td>,
                      <td key={`${d}-a`} className={`${styles.colSession} ${styles.dayDivider}`}>
                        <span style={{ color: afState.color, fontWeight: afState.label !== '–' ? 700 : 400 }}>
                          {afState.label}
                        </span>
                      </td>,
                    ];
                  })}
                  {hasMore && [
                    <td key="more-m" className={styles.colSession} style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>...</td>,
                    <td key="more-a" className={`${styles.colSession} ${styles.dayDivider}`} style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>...</td>,
                  ]}
                  <td className={`${styles.colSummary} ${styles.sectionDividerLeft}`} style={{ color: 'var(--color-present)', fontWeight: 700 }}>{sum.present}</td>
                  <td className={styles.colSummary} style={{ color: 'var(--color-late)', fontWeight: 700 }}>{sum.late}</td>
                  <td className={styles.colSummary} style={{ color: 'var(--color-absent)', fontWeight: 700 }}>{sum.absent}</td>
                  <td className={styles.colSummary} style={{ color: 'var(--color-excused)', fontWeight: 700 }}>{sum.excused}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Monthly Preview ──────────────────────────────────────────────────────────

function MonthlyPreview({ month }: { month: string }) {
  const [data, setData] = useState<WeeklyData | null>(null);
  const [loading, setLoading] = useState(false);

  const [yStr, mStr] = month.split('-');
  const daysInMonth = new Date(parseInt(yStr), parseInt(mStr), 0).getDate();
  const from = `${month}-01`;
  const to = `${month}-${String(daysInMonth).padStart(2, '0')}`;

  useEffect(() => {
    if (!month) return;
    setLoading(true);
    api
      .get<WeeklyData>(`/admin/attendance/range?from=${from}&to=${to}`)
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [month, from, to]);

  if (loading) {
    return (
      <div className={styles.previewTable}>
        <div className={styles.previewHeader}>XEM TRƯỚC – THÁNG {mStr}/{yStr}</div>
        <div className={styles.previewEmpty}>Đang tải dữ liệu tháng...</div>
      </div>
    );
  }

  if (!data || data.students.length === 0) {
    return (
      <div className={styles.previewTable}>
        <div className={styles.previewHeader}>XEM TRƯỚC – THÁNG {mStr}/{yStr}</div>
        <div className={styles.previewEmpty}>Chưa có dữ liệu điểm danh tháng này</div>
      </div>
    );
  }

  const { students, dates, attendances } = data;

  function getSessionState(studentId: number, date: string, session: 'morning' | 'afternoon') {
    const rec = attendances.find((a) => a.studentId === studentId && a.date === date && a.session === session);
    if (rec) {
      return {
        status: rec.status,
        label: STATUS_LABEL[rec.status],
        color: STATUS_COLOR[rec.status],
        isAbsent: rec.status === 'absent',
      };
    }

    const dow = String(new Date(date).getDay());
    const schedule = data?.schedule;
    const isScheduled = schedule ? (schedule[dow]?.includes(session) ?? true) : true;

    const today = data?.today || new Date().toLocaleDateString('en-CA');
    const startDate = data?.settings?.startDate || today;
    const now = new Date();
    const currentTime = data?.currentTime || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const lateEnd = session === 'morning' ? (data?.settings?.morningLateEnd || '08:15') : (data?.settings?.afternoonLateEnd || '13:45');

    const [ch, cm] = currentTime.split(':').map(Number);
    const [lh, lm] = lateEnd.split(':').map(Number);
    const isPastStart = date >= startDate;
    const isPassed = isPastStart && (date < today || (date === today && (ch * 60 + cm) > (lh * 60 + lm)));

    if (isScheduled && isPassed) {
      return {
        status: 'absent' as AttendanceStatus,
        label: '✗',
        color: STATUS_COLOR['absent'],
        isAbsent: true,
      };
    }

    return {
      status: null,
      label: '–',
      color: 'var(--color-text-muted)',
      isAbsent: false,
    };
  }

  function countSummary(studentId: number) {
    let present = 0, late = 0, absent = 0, excused = 0;
    let scheduled = 0;
    const today = data?.today || new Date().toLocaleDateString('en-CA');
    const startDate = data?.settings?.startDate || today;
    dates.forEach((d) => {
      const dow = String(new Date(d).getDay());
      const schedule = data?.schedule;
      const isPastStart = d >= startDate;
      (['morning', 'afternoon'] as const).forEach((sess) => {
        const isSched = schedule ? (schedule[dow]?.includes(sess) ?? true) : true;
        if (isPastStart && isSched) scheduled++;
        const state = getSessionState(studentId, d, sess);
        if (state.status === 'present') present++;
        else if (state.status === 'late') late++;
        else if (state.status === 'excused') excused++;
        else if (state.isAbsent) absent++;
      });
    });
    const rate = scheduled > 0 ? Math.round(((present + late * 0.8) / scheduled) * 100) : 100;
    return { present, late, absent, excused, rate };
  }

  return (
    <div className={styles.previewTable}>
      <div className={styles.previewHeader}>
        XEM TRƯỚC – THÁNG {mStr}/{yStr} ({dates.length} ngày)
      </div>
      <div className={styles.tableScrollWrapper}>
        <table>
          <thead>
            <tr>
              <th rowSpan={2} className={styles.colSTT}>STT</th>
              <th rowSpan={2} className={styles.colName}>Họ và Tên</th>
              <th rowSpan={2} className={`${styles.colDob} ${styles.sectionDividerRight}`}>Ngày sinh</th>
              {dates.map((d) => {
                const dow = new Date(d).getDay();
                const [, , dd] = d.split('-');
                return (
                  <th key={d} colSpan={2} className={styles.dayDivider} style={{ minWidth: 60, padding: '6px 2px' }}>
                    {DAY_LABELS[dow]}
                    <br />
                    <span style={{ fontSize: '0.72rem', opacity: 0.8 }}>{dd}</span>
                  </th>
                );
              })}
              <th rowSpan={2} className={`${styles.colSummary} ${styles.sectionDividerLeft}`} style={{ background: 'var(--color-present-bg)', color: 'var(--color-present)' }}>Có mặt</th>
              <th rowSpan={2} className={styles.colSummary} style={{ background: 'var(--color-late-bg)', color: 'var(--color-late)' }}>Muộn</th>
              <th rowSpan={2} className={styles.colSummary} style={{ background: 'var(--color-absent-bg)', color: 'var(--color-absent)' }}>Vắng</th>
              <th rowSpan={2} className={styles.colSummary} style={{ background: 'var(--color-excused-bg)', color: 'var(--color-excused)' }}>Phép</th>
              <th rowSpan={2} className={styles.colSummary} style={{ background: 'rgba(59, 130, 246, 0.15)', color: 'var(--color-primary-light)' }}>Tỉ lệ</th>
            </tr>
            <tr>
              {dates.map((d) => [
                <th key={`${d}-s`} className={styles.colSession}>S</th>,
                <th key={`${d}-c`} className={`${styles.colSession} ${styles.dayDivider}`}>C</th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {students.map((student, i) => {
              const sum = countSummary(student.id);
              const rateColor = sum.rate >= 90 ? 'var(--color-present)' : sum.rate >= 70 ? 'var(--color-late)' : 'var(--color-absent)';
              return (
                <tr key={student.id}>
                  <td className={styles.colSTT} style={{ color: 'var(--color-text-muted)' }}>{i + 1}</td>
                  <td className={styles.colName} style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{student.name}</td>
                  <td className={`${styles.colDob} ${styles.sectionDividerRight}`} style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>{student.dob || '—'}</td>
                  {dates.map((d) => {
                    const mState = getSessionState(student.id, d, 'morning');
                    const afState = getSessionState(student.id, d, 'afternoon');
                    return [
                      <td key={`${d}-m`} className={styles.colSession}>
                        <span style={{ color: mState.color, fontWeight: mState.label !== '–' ? 700 : 400, fontSize: '0.82rem' }}>
                          {mState.label}
                        </span>
                      </td>,
                      <td key={`${d}-a`} className={`${styles.colSession} ${styles.dayDivider}`}>
                        <span style={{ color: afState.color, fontWeight: afState.label !== '–' ? 700 : 400, fontSize: '0.82rem' }}>
                          {afState.label}
                        </span>
                      </td>,
                    ];
                  })}
                  <td className={`${styles.colSummary} ${styles.sectionDividerLeft}`} style={{ color: 'var(--color-present)', fontWeight: 700 }}>{sum.present}</td>
                  <td className={styles.colSummary} style={{ color: 'var(--color-late)', fontWeight: 700 }}>{sum.late}</td>
                  <td className={styles.colSummary} style={{ color: 'var(--color-absent)', fontWeight: 700 }}>{sum.absent}</td>
                  <td className={styles.colSummary} style={{ color: 'var(--color-excused)', fontWeight: 700 }}>{sum.excused}</td>
                  <td className={styles.colSummary} style={{ color: rateColor, fontWeight: 800 }}>{sum.rate}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ExportPage() {
  const [mode, setMode] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [weekFrom, setWeekFrom] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setDate(diff);
    return monday.toLocaleDateString('en-CA');
  });
  const [weekTo, setWeekTo] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1) + 5;
    const saturday = new Date(d);
    saturday.setDate(diff);
    return saturday.toLocaleDateString('en-CA');
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const downloadFile = async (url: string, filename: string) => {
    setLoading(true);
    setError('');
    try {
      const r = await api.get(url, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([r.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      setError('Lỗi xuất file. Vui lòng kiểm tra đăng nhập!');
    } finally {
      setLoading(false);
    }
  };

  const exportDaily = () => {
    const [y, m, d] = date.split('-');
    downloadFile(`/export/daily?date=${date}`, `diemdanh_ngay_${d}-${m}-${y}.xlsx`);
  };

  const exportWeekly = () => {
    const [fy, fm, fd] = weekFrom.split('-');
    const [ty, tm, td] = weekTo.split('-');
    downloadFile(
      `/export/weekly?from=${weekFrom}&to=${weekTo}`,
      `diemdanh_tuan_${fd}-${fm}-${fy}_den_${td}-${tm}-${ty}.xlsx`,
    );
  };

  const exportMonthly = () => {
    const [y, m] = month.split('-');
    downloadFile(`/export/monthly?month=${month}`, `diemdanh_thang_${m}-${y}.xlsx`);
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Xuất báo cáo Excel</h1>
        <p className={styles.pageSubtitle}>Tải file Excel điểm danh theo ngày, tuần hoặc cả tháng</p>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${mode === 'daily' ? styles.tabActive : ''}`}
          onClick={() => setMode('daily')}
          id="export-tab-daily"
        >
          Theo ngày
        </button>
        <button
          className={`${styles.tab} ${mode === 'weekly' ? styles.tabActive : ''}`}
          onClick={() => setMode('weekly')}
          id="export-tab-weekly"
        >
          Theo tuần
        </button>
        <button
          className={`${styles.tab} ${mode === 'monthly' ? styles.tabActive : ''}`}
          onClick={() => setMode('monthly')}
          id="export-tab-monthly"
        >
          Theo tháng
        </button>
      </div>

      {mode === 'daily' && (
        <div className={`card ${styles.exportCard} fade-in`}>
          <h2 className={styles.cardTitle}>Xuất điểm danh theo ngày</h2>
          <div className={styles.actionRow}>
            <div className={styles.dateField}>
              <label className={styles.fieldLabel}>Chọn ngày</label>
              <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} id="export-daily-date" />
            </div>
            <button className={`btn btn-success btn-lg ${styles.exportBtn}`} onClick={exportDaily} disabled={loading} id="export-daily-btn">
              {loading ? <><div className="spinner" /> Đang tạo...</> : 'Xuất Excel (.xlsx)'}
            </button>
          </div>
          <DailyPreview date={date} />
        </div>
      )}

      {mode === 'weekly' && (
        <div className={`card ${styles.exportCard} fade-in`}>
          <h2 className={styles.cardTitle}>Xuất điểm danh theo tuần</h2>
          <div className={styles.actionRow}>
            <div className={styles.dateField}>
              <label className={styles.fieldLabel}>Từ ngày</label>
              <input type="date" className="input" value={weekFrom} onChange={(e) => setWeekFrom(e.target.value)} id="export-weekly-from" />
            </div>
            <div className={styles.dateField}>
              <label className={styles.fieldLabel}>Đến ngày</label>
              <input type="date" className="input" value={weekTo} onChange={(e) => setWeekTo(e.target.value)} id="export-weekly-to" />
            </div>
            <button className={`btn btn-success btn-lg ${styles.exportBtn}`} onClick={exportWeekly} disabled={loading} id="export-weekly-btn">
              {loading ? <><div className="spinner" /> Đang tạo...</> : 'Xuất Excel (.xlsx)'}
            </button>
          </div>
          <WeeklyPreview from={weekFrom} to={weekTo} />
        </div>
      )}

      {mode === 'monthly' && (
        <div className={`card ${styles.exportCard} fade-in`}>
          <h2 className={styles.cardTitle}>Xuất điểm danh theo tháng</h2>
          <div className={styles.actionRow}>
            <div className={styles.dateField}>
              <label className={styles.fieldLabel}>Chọn tháng</label>
              <input
                type="month"
                className="input"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                id="export-monthly-picker"
              />
            </div>
            <button
              className={`btn btn-success btn-lg ${styles.exportBtn}`}
              onClick={exportMonthly}
              disabled={loading}
              id="export-monthly-btn"
            >
              {loading ? <><div className="spinner" /> Đang tạo...</> : 'Xuất Excel (.xlsx)'}
            </button>
          </div>
          <MonthlyPreview month={month} />
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}

      <div className={`card ${styles.infoCard}`}>
        <h3>Ký hiệu trong file Excel (Báo cáo tuần)</h3>
        <div className={styles.legendGrid}>
          <div className={styles.legendItem}>
            <span style={{ color: 'var(--color-present)', fontWeight: 700 }}>✓</span>
            <span>Có mặt (đúng giờ)</span>
          </div>
          <div className={styles.legendItem}>
            <span style={{ color: 'var(--color-late)', fontWeight: 700 }}>M</span>
            <span>Muộn</span>
          </div>
          <div className={styles.legendItem}>
            <span style={{ color: 'var(--color-absent)', fontWeight: 700 }}>✗</span>
            <span>Vắng (không phép)</span>
          </div>
          <div className={styles.legendItem}>
            <span style={{ color: 'var(--color-excused)', fontWeight: 700 }}>P</span>
            <span>Có phép</span>
          </div>
        </div>
      </div>
    </div>
  );
}

