'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import api from '@/lib/api';
import { DailyAttendanceRow, AttendanceStatus, AttendanceSession, Settings, AttendanceRecord } from '@/types';
import styles from './dashboard.module.css';

const STATUS_LABELS: Record<string, string> = {
  present: 'Có mặt',
  late: 'Muộn',
  absent: 'Vắng không phép',
  excused: 'Vắng có phép',
};

const ALL_STATUSES: AttendanceStatus[] = ['present', 'late', 'absent', 'excused'];

const QUICK_REASONS = [
  'Ốm có đơn',
  'Gia đình có việc',
  'Đi thi / Học bù',
  'Hỏng xe / Sự cố',
  'Công tác trường',
];

export default function DashboardPage() {
  const [date, setDate] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [rows, setRows] = useState<DailyAttendanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | AttendanceStatus>('all');
  const [settings, setSettings] = useState<Settings | null>(null);

  // Bulk attend state
  const [bulkSession, setBulkSession] = useState<AttendanceSession | 'both'>('morning');
  const [bulkLoading, setBulkLoading] = useState(false);

  // Modal State
  const [excuseModal, setExcuseModal] = useState<{ studentId: number; name: string; dob?: string } | null>(null);
  const [excuseNote, setExcuseNote] = useState('');
  const [excuseSession, setExcuseSession] = useState<AttendanceSession>('morning');
  const [excuseStatus, setExcuseStatus] = useState<AttendanceStatus | 'delete'>('excused');

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const r = await api.get<DailyAttendanceRow[]>(`/admin/attendance?date=${date}`);
      setRows(r.data);
    } catch {
      // ignore or redirect
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [date]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    api.get<Settings>('/settings').then((r) => setSettings(r.data)).catch(() => {});
  }, []);

  const changeDay = (delta: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    setDate(d.toLocaleDateString('en-CA'));
  };

  const setToday = () => {
    setDate(new Date().toLocaleDateString('en-CA'));
  };

  const updateStatus = async (id: number, status: AttendanceStatus) => {
    try {
      await api.patch(`/admin/attendance/${id}`, { status });
      fetchData(true);
    } catch {}
  };

  const createOrUpdateStatus = async (
    record: AttendanceRecord | null,
    studentId: number,
    session: AttendanceSession,
    status: AttendanceStatus
  ) => {
    if (record) {
      await updateStatus(record.id, status);
    } else {
      try {
        await api.post('/admin/excuse', {
          studentId,
          date,
          session,
          note: '',
          status,
        });
        fetchData(true);
      } catch {}
    }
  };

  const deleteRecord = async (id: number) => {
    try {
      await api.delete(`/admin/attendance/${id}`);
      fetchData(true);
    } catch {}
  };

  const handleResetDevice = async (studentId: number, studentName: string) => {
    if (
      !window.confirm(
        `Bạn có chắc muốn mở khóa thiết bị cho sinh viên "${studentName}"?\nSau khi mở khóa, sinh viên có thể dùng điện thoại mới để điểm danh lại.`,
      )
    ) {
      return;
    }
    try {
      await api.post(`/admin/students/${studentId}/reset-device`);
      fetchData(true);
      alert(`Đã mở khóa thiết bị thành công cho ${studentName}!`);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Có lỗi xảy ra khi reset thiết bị');
    }
  };

  const markAllPresent = async () => {
    const sessionLabel =
      bulkSession === 'both'
        ? 'cả 2 buổi'
        : bulkSession === 'morning'
        ? 'buổi sáng'
        : 'buổi chiều';

    const confirmed = window.confirm(
      `Điểm danh "Có mặt" cho toàn bộ sinh viên (${sessionLabel})?\n\nThao tác này sẽ cập nhật tất cả sinh viên chưa có mặt thành "Có mặt".`,
    );
    if (!confirmed) return;

    setBulkLoading(true);
    try {
      const res = await api.post('/admin/attendance/bulk', {
        date,
        session: bulkSession,
        status: 'present',
      });
      fetchData(true);
      alert(res.data?.message || 'Đã điểm danh có mặt cho toàn bộ sinh viên thành công!');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Có lỗi xảy ra khi điểm danh hàng loạt!');
    } finally {
      setBulkLoading(false);
    }
  };

  const submitExcuse = async () => {
    if (!excuseModal) return;
    try {
      if (excuseStatus === 'delete') {
        const row = rows.find((r) => r.student.id === excuseModal.studentId);
        const target = excuseSession === 'morning' ? row?.morning : row?.afternoon;
        if (target) {
          await api.delete(`/admin/attendance/${target.id}`);
        }
      } else {
        await api.post('/admin/excuse', {
          studentId: excuseModal.studentId,
          date,
          session: excuseSession,
          note: excuseNote,
          status: excuseStatus,
        });
      }
      setExcuseModal(null);
      setExcuseNote('');
      setExcuseStatus('excused');
      fetchData(true);
    } catch {}
  };

  const [viewSession, setViewSession] = useState<'all' | 'morning' | 'afternoon'>('all');

  const isSessionClosed = useCallback((session: 'morning' | 'afternoon') => {
    const now = new Date();
    const currentToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(now);
    if (date < currentToday) return true; // Quá khứ đã đóng cổng
    if (date > currentToday) return false; // Tương lai chưa tới giờ

    const currentTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);
    const lateEnd = session === 'morning' ? (settings?.morningLateEnd || '08:15') : (settings?.afternoonLateEnd || '13:45');
    return currentTime > lateEnd;
  }, [date, settings]);

  const getDayOfWeekKey = useCallback((dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00+07:00');
    return d.getDay().toString();
  }, []);

  const isSessionScheduled = useCallback((session: 'morning' | 'afternoon') => {
    const dow = getDayOfWeekKey(date);
    const schedule = settings?.schedule;
    if (!schedule) return true;
    return schedule[dow]?.includes(session) ?? true;
  }, [date, getDayOfWeekKey, settings]);

  const getEffectiveSessionStatus = useCallback((
    record: AttendanceRecord | null,
    session: 'morning' | 'afternoon'
  ): AttendanceStatus | null => {
    if (record) return record.status;
    if (!isSessionScheduled(session)) return null; // Ca nghỉ theo TKB
    if (isSessionClosed(session)) return 'absent'; // Tự động tính là vắng khi đã đóng cổng
    return null; // Đang mở cổng hoặc chưa tới giờ
  }, [isSessionScheduled, isSessionClosed]);

  // Compute Daily summary for a row
  const getRowSummary = useCallback((row: DailyAttendanceRow): AttendanceStatus => {
    const morningStatus = getEffectiveSessionStatus(row.morning, 'morning');
    const afternoonStatus = getEffectiveSessionStatus(row.afternoon, 'afternoon');

    const statuses = [morningStatus, afternoonStatus].filter(Boolean) as AttendanceStatus[];
    if (statuses.length === 0) return 'absent';

    // If viewing specific session
    if (viewSession === 'morning') return morningStatus || 'absent';
    if (viewSession === 'afternoon') return afternoonStatus || 'absent';

    // When viewing whole day: chỉ cần có mặt ít nhất 1 buổi trong ngày là tính Có mặt / Muộn
    if (statuses.some((s) => s === 'late')) return 'late';
    if (statuses.some((s) => s === 'present')) return 'present';
    if (statuses.some((s) => s === 'excused')) return 'excused';
    return 'absent';
  }, [getEffectiveSessionStatus, viewSession]);

  // Stats computation
  const stats = useMemo(() => {
    if (viewSession === 'morning' || viewSession === 'afternoon') {
      const scheduled = isSessionScheduled(viewSession);
      const total = scheduled ? rows.length : 0;
      let present = 0, late = 0, absent = 0, excused = 0;

      if (scheduled) {
        rows.forEach((r) => {
          const st = getEffectiveSessionStatus(viewSession === 'morning' ? r.morning : r.afternoon, viewSession);
          if (st === 'present') present++;
          else if (st === 'late') late++;
          else if (st === 'absent') absent++;
          else if (st === 'excused') excused++;
        });
      }
      return {
        total,
        present,
        late,
        absent,
        excused,
        presentPct: total > 0 ? Math.round((present / total) * 100) : 0,
        latePct: total > 0 ? Math.round((late / total) * 100) : 0,
        absentPct: total > 0 ? Math.round((absent / total) * 100) : 0,
        excusedPct: total > 0 ? Math.round((excused / total) * 100) : 0,
      };
    }

    // Whole Day: Calculate across all scheduled sessions of the day
    let totalSlots = 0;
    let presentSlots = 0;
    let lateSlots = 0;
    let absentSlots = 0;
    let excusedSlots = 0;

    const morningScheduled = isSessionScheduled('morning');
    const afternoonScheduled = isSessionScheduled('afternoon');

    rows.forEach((r) => {
      if (morningScheduled) {
        totalSlots++;
        const st = getEffectiveSessionStatus(r.morning, 'morning');
        if (st === 'present') presentSlots++;
        else if (st === 'late') lateSlots++;
        else if (st === 'absent') absentSlots++;
        else if (st === 'excused') excusedSlots++;
      }
      if (afternoonScheduled) {
        totalSlots++;
        const st = getEffectiveSessionStatus(r.afternoon, 'afternoon');
        if (st === 'present') presentSlots++;
        else if (st === 'late') lateSlots++;
        else if (st === 'absent') absentSlots++;
        else if (st === 'excused') excusedSlots++;
      }
    });

    return {
      total: totalSlots,
      present: presentSlots,
      late: lateSlots,
      absent: absentSlots,
      excused: excusedSlots,
      presentPct: totalSlots > 0 ? Math.round((presentSlots / totalSlots) * 100) : 0,
      latePct: totalSlots > 0 ? Math.round((lateSlots / totalSlots) * 100) : 0,
      absentPct: totalSlots > 0 ? Math.round((absentSlots / totalSlots) * 100) : 0,
      excusedPct: totalSlots > 0 ? Math.round((excusedSlots / totalSlots) * 100) : 0,
    };
  }, [rows, viewSession, isSessionScheduled, getEffectiveSessionStatus]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = row.student.name.toLowerCase().includes(q);
        const matchDob = row.student.dob?.includes(q);
        const matchOrder = String(row.student.orderNum).includes(q);
        if (!matchName && !matchDob && !matchOrder) return false;
      }

      // Status chip filter
      if (activeFilter !== 'all') {
        const summary = getRowSummary(row);
        if (summary !== activeFilter) return false;
      }

      return true;
    });
  }, [rows, searchQuery, activeFilter, getRowSummary]);

  const [ty, tm, td] = date.split('-');
  const formattedDate = `${td}/${tm}/${ty}`;

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.titleArea}>
          <h1 className={styles.pageTitle}>Dashboard Điểm danh</h1>
          <p className={styles.pageSubtitle}>
            Lớp CQP 22 — Trường Cao đẳng Truyền hình • Ngày {formattedDate}
          </p>
        </div>

        {/* Date Navigator */}
        <div className={styles.dateNav}>
          <button
            type="button"
            className={styles.navArrowBtn}
            onClick={() => changeDay(-1)}
            title="Lùi 1 ngày"
          >
            Trước
          </button>
          <input
            type="date"
            className={styles.dateInput}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            id="dashboard-date"
          />
          <button
            type="button"
            className={styles.navArrowBtn}
            onClick={() => changeDay(1)}
            title="Tiến 1 ngày"
          >
            Sau
          </button>
          <button
            type="button"
            className={styles.todayBtn}
            onClick={setToday}
          >
            Hôm nay
          </button>
        </div>
      </div>

      {/* Session Filter Bar for Stats */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255, 255, 255, 0.05)', padding: 4, borderRadius: 10, border: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', padding: '0 8px', fontWeight: 600 }}>Thống kê:</span>
          <button
            type="button"
            style={{
              padding: '5px 12px',
              fontSize: '0.78rem',
              fontWeight: 600,
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              background: viewSession === 'all' ? 'var(--color-primary)' : 'transparent',
              color: viewSession === 'all' ? '#fff' : 'var(--color-text-secondary)',
            }}
            onClick={() => setViewSession('all')}
          >
            Cả ngày (tổng ca)
          </button>
          <button
            type="button"
            style={{
              padding: '5px 12px',
              fontSize: '0.78rem',
              fontWeight: 600,
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              background: viewSession === 'morning' ? 'var(--color-primary)' : 'transparent',
              color: viewSession === 'morning' ? '#fff' : 'var(--color-text-secondary)',
            }}
            onClick={() => setViewSession('morning')}
          >
            Ca Sáng
          </button>
          <button
            type="button"
            style={{
              padding: '5px 12px',
              fontSize: '0.78rem',
              fontWeight: 600,
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              background: viewSession === 'afternoon' ? 'var(--color-primary)' : 'transparent',
              color: viewSession === 'afternoon' ? '#fff' : 'var(--color-text-secondary)',
            }}
            onClick={() => setViewSession('afternoon')}
          >
            Ca Chiều
          </button>
        </div>
        <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
          {viewSession === 'all' ? `Tổng cộng ${stats.total} lượt ca học trong ngày` : viewSession === 'morning' ? 'Thống kê riêng ca Sáng' : 'Thống kê riêng ca Chiều'}
        </span>
      </div>

      {/* KPI Stats Cards */}
      <div className={styles.statsGrid}>
        {/* Total */}
        <div
          className={`${styles.statCard} ${styles.statTotal} ${activeFilter === 'all' ? styles.statCardActive : ''}`}
          onClick={() => setActiveFilter('all')}
          title="Bấm để xem tất cả"
        >
          <div className={styles.statHeader}>
            <div className={styles.statPercent}>100%</div>
          </div>
          <div className={styles.statNum}>{stats.total}</div>
          <div className={styles.statLabel}>{viewSession === 'all' ? 'Tổng lượt ca học' : 'Sĩ số ca'}</div>
          <div className={styles.statProgressTrack}>
            <div className={styles.statProgressBar} style={{ width: '100%' }} />
          </div>
        </div>

        {/* Present */}
        <div
          className={`${styles.statCard} ${styles.statPresent} ${activeFilter === 'present' ? styles.statCardActive : ''}`}
          onClick={() => setActiveFilter(activeFilter === 'present' ? 'all' : 'present')}
          title="Bấm để lọc sinh viên có mặt"
        >
          <div className={styles.statHeader}>
            <div className={styles.statPercent}>{stats.presentPct}%</div>
          </div>
          <div className={styles.statNum}>{stats.present}</div>
          <div className={styles.statLabel}>Có mặt</div>
          <div className={styles.statProgressTrack}>
            <div className={styles.statProgressBar} style={{ width: `${stats.presentPct}%` }} />
          </div>
        </div>

        {/* Late */}
        <div
          className={`${styles.statCard} ${styles.statLate} ${activeFilter === 'late' ? styles.statCardActive : ''}`}
          onClick={() => setActiveFilter(activeFilter === 'late' ? 'all' : 'late')}
          title="Bấm để lọc sinh viên đi muộn"
        >
          <div className={styles.statHeader}>
            <div className={styles.statPercent}>{stats.latePct}%</div>
          </div>
          <div className={styles.statNum}>{stats.late}</div>
          <div className={styles.statLabel}>Đi muộn</div>
          <div className={styles.statProgressTrack}>
            <div className={styles.statProgressBar} style={{ width: `${stats.latePct}%` }} />
          </div>
        </div>

        {/* Excused */}
        <div
          className={`${styles.statCard} ${styles.statExcused} ${activeFilter === 'excused' ? styles.statCardActive : ''}`}
          onClick={() => setActiveFilter(activeFilter === 'excused' ? 'all' : 'excused')}
          title="Bấm để lọc sinh viên vắng có phép"
        >
          <div className={styles.statHeader}>
            <div className={styles.statPercent}>{stats.excusedPct}%</div>
          </div>
          <div className={styles.statNum}>{stats.excused}</div>
          <div className={styles.statLabel}>Vắng có phép</div>
          <div className={styles.statProgressTrack}>
            <div className={styles.statProgressBar} style={{ width: `${stats.excusedPct}%` }} />
          </div>
        </div>

        {/* Absent */}
        <div
          className={`${styles.statCard} ${styles.statAbsent} ${activeFilter === 'absent' ? styles.statCardActive : ''}`}
          onClick={() => setActiveFilter(activeFilter === 'absent' ? 'all' : 'absent')}
          title="Bấm để lọc sinh viên vắng không phép"
        >
          <div className={styles.statHeader}>
            <div className={styles.statPercent}>{stats.absentPct}%</div>
          </div>
          <div className={styles.statNum}>{stats.absent}</div>
          <div className={styles.statLabel}>Vắng không phép</div>
          <div className={styles.statProgressTrack}>
            <div className={styles.statProgressBar} style={{ width: `${stats.absentPct}%` }} />
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className={styles.tableCard}>
        {/* Table Toolbar */}
        <div className={styles.tableToolbar}>
          <div className={styles.filterChips}>
            <button
              type="button"
              className={`${styles.filterChip} ${activeFilter === 'all' ? styles.filterChipActive : ''}`}
              onClick={() => setActiveFilter('all')}
            >
              Tất cả ({rows.length})
            </button>
            <button
              type="button"
              className={`${styles.filterChip} ${activeFilter === 'present' ? styles.filterChipActive : ''}`}
              onClick={() => setActiveFilter('present')}
            >
              Có mặt ({stats.present})
            </button>
            <button
              type="button"
              className={`${styles.filterChip} ${activeFilter === 'late' ? styles.filterChipActive : ''}`}
              onClick={() => setActiveFilter('late')}
            >
              Đi muộn ({stats.late})
            </button>
            <button
              type="button"
              className={`${styles.filterChip} ${activeFilter === 'excused' ? styles.filterChipActive : ''}`}
              onClick={() => setActiveFilter('excused')}
            >
              Vắng có phép ({stats.excused})
            </button>
            <button
              type="button"
              className={`${styles.filterChip} ${activeFilter === 'absent' ? styles.filterChipActive : ''}`}
              onClick={() => setActiveFilter('absent')}
            >
              Vắng không phép ({stats.absent})
            </button>
          </div>

          <div className={styles.searchWrap}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Tìm kiếm theo tên, ngày sinh..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Bulk Attend */}
          <div className={styles.bulkAttendWrap}>
            <select
              className={styles.bulkSessionSelect}
              value={bulkSession}
              onChange={(e) => setBulkSession(e.target.value as AttendanceSession | 'both')}
              title="Chọn buổi muốn điểm danh hàng loạt"
            >
              <option value="morning">Sáng</option>
              <option value="afternoon">Chiều</option>
              <option value="both">Cả 2 buổi</option>
            </select>
            <button
              type="button"
              className={styles.bulkAttendBtn}
              onClick={markAllPresent}
              disabled={bulkLoading}
              title="Điểm danh có mặt cho toàn bộ sinh viên chưa có lượt trong buổi đã chọn"
              id="btn-mark-all-present"
            >
              {bulkLoading ? (
                <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Đang xử lý...</>
              ) : (
                'Điểm danh tất cả'
              )}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className={styles.tableResponsive}>
          {loading ? (
            <div className={styles.emptyState}>
              <div className="spinner" style={{ margin: '0 auto 12px' }} />
              Đang tải danh sách điểm danh...
            </div>
          ) : filteredRows.length === 0 ? (
            <div className={styles.emptyState}>
              Không tìm thấy sinh viên nào khớp với điều kiện lọc.
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.colSTT}>STT</th>
                  <th className={styles.colName}>Họ và Tên</th>
                  <th className={`${styles.colDob} ${styles.sectionDividerRight}`}>Ngày sinh</th>
                  <th className={`${styles.colSession} ${styles.dayDivider}`}>
                    Sáng
                    <div style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {settings ? `${settings.morningStart} - ${settings.morningLateEnd}` : '07:30 - 08:15'}
                    </div>
                  </th>
                  <th className={`${styles.colSession} ${styles.sectionDividerRight}`}>
                    Chiều
                    <div style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {settings ? `${settings.afternoonStart} - ${settings.afternoonLateEnd}` : '13:00 - 13:45'}
                    </div>
                  </th>
                  <th className={`${styles.colSummary} ${styles.sectionDividerLeft}`}>Tổng kết</th>
                  <th className={styles.colAction}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const { student, morning, afternoon } = row;
                  const daySummary = getRowSummary(row);

                  return (
                    <tr key={student.id}>
                      {/* STT */}
                      <td className={styles.colSTT}>
                        <span className={styles.sttBadge}>{student.orderNum}</span>
                      </td>

                      {/* Name with initials Avatar */}
                      <td className={styles.colName}>
                        <div className={styles.studentCell}>
                          <div className={styles.avatar}>
                            {getInitials(student.name)}
                          </div>
                          <div>
                            <div className={styles.studentName}>{student.name}</div>
                            {student.deviceId ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                <span style={{ fontSize: '0.72rem', color: 'var(--color-present)', fontWeight: 600 }}>
                                  Đã khóa máy
                                </span>
                                <button
                                  type="button"
                                  style={{
                                    fontSize: '0.68rem',
                                    padding: '1px 6px',
                                    borderRadius: 4,
                                    border: '1px solid rgba(255,255,255,0.15)',
                                    background: 'rgba(255,255,255,0.08)',
                                    color: 'var(--color-text-secondary)',
                                    cursor: 'pointer',
                                  }}
                                  title="Nhấn để mở khóa nếu sinh viên đổi điện thoại mới"
                                  onClick={() => handleResetDevice(student.id, student.name)}
                                >
                                  Reset máy
                                </button>
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                                Chưa liên kết máy
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Ngày sinh */}
                      <td className={`${styles.colDob} ${styles.sectionDividerRight}`}>
                        <span className={styles.dobText}>{student.dob || '—'}</span>
                      </td>

                      {/* Ca Sáng */}
                      <td className={`${styles.colSession} ${styles.dayDivider}`}>
                        {morning ? (
                          <div className={styles.sessionBox}>
                            <span
                              className={`${styles.sessionStatusPill} badge-${morning.status}`}
                              style={{
                                background: `var(--color-${morning.status}-bg)`,
                                color: `var(--color-${morning.status})`,
                                border: `1px solid var(--color-${morning.status}-border)`,
                              }}
                            >
                              {STATUS_LABELS[morning.status]}
                            </span>
                            {morning.checkInTime && (
                              <span className={styles.timePill}>
                                {morning.checkInTime.substring(0, 5)}
                              </span>
                            )}
                            {morning.note ? (
                              <span
                                className={styles.notePill}
                                title={`Lý do: ${morning.note}`}
                                onClick={() => {
                                  setExcuseModal({ studentId: student.id, name: student.name, dob: student.dob });
                                  setExcuseSession('morning');
                                  setExcuseStatus(morning.status);
                                  setExcuseNote(morning.note || '');
                                }}
                              >
                                {morning.note}
                              </span>
                            ) : morning.status === 'excused' ? (
                              <button
                                type="button"
                                className={styles.addNoteLink}
                                onClick={() => {
                                  setExcuseModal({ studentId: student.id, name: student.name, dob: student.dob });
                                  setExcuseSession('morning');
                                  setExcuseStatus('excused');
                                  setExcuseNote('');
                                }}
                              >
                                Thêm lý do
                              </button>
                            ) : null}
                            <div className={styles.quickActionRow}>
                              <select
                                className={styles.statusMiniSelect}
                                value={morning.status}
                                onChange={(e) => {
                                  if (e.target.value === 'delete') {
                                    deleteRecord(morning.id);
                                  } else {
                                    updateStatus(morning.id, e.target.value as AttendanceStatus);
                                  }
                                }}
                              >
                                {ALL_STATUSES.map((s) => (
                                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                                ))}
                                <option value="delete" style={{ color: 'var(--color-absent)' }}>Xóa</option>
                              </select>
                              <button
                                type="button"
                                className={styles.miniEditBtn}
                                title="Sửa lý do / trạng thái"
                                onClick={() => {
                                  setExcuseModal({ studentId: student.id, name: student.name, dob: student.dob });
                                  setExcuseSession('morning');
                                  setExcuseStatus(morning.status);
                                  setExcuseNote(morning.note || '');
                                }}
                              >
                                Sửa
                              </button>
                              <button
                                type="button"
                                className={styles.miniDeleteBtn}
                                title="Xóa lượt này"
                                onClick={() => deleteRecord(morning.id)}
                              >
                                Xóa
                              </button>
                            </div>
                          </div>
                        ) : !isSessionScheduled('morning') ? (
                          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>
                            — Nghỉ học
                          </div>
                        ) : isSessionClosed('morning') ? (
                          <div className={styles.sessionBox}>
                            <span
                              className={`${styles.sessionStatusPill} badge-absent`}
                              style={{
                                background: 'var(--color-absent-bg)',
                                color: 'var(--color-absent)',
                                border: '1px solid var(--color-absent-border)',
                              }}
                            >
                              Vắng không phép
                            </span>
                            <div className={styles.quickActionRow}>
                              <select
                                className={styles.statusMiniSelect}
                                value="absent"
                                onChange={(e) => {
                                  if (e.target.value !== 'absent' && e.target.value !== 'delete') {
                                    createOrUpdateStatus(null, student.id, 'morning', e.target.value as AttendanceStatus);
                                  }
                                }}
                              >
                                {ALL_STATUSES.map((s) => (
                                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                                ))}
                              </select>
                              <button
                                type="button"
                                className={styles.miniEditBtn}
                                title="Thêm phép / sửa trạng thái"
                                onClick={() => {
                                  setExcuseModal({ studentId: student.id, name: student.name, dob: student.dob });
                                  setExcuseSession('morning');
                                  setExcuseStatus('excused');
                                  setExcuseNote('');
                                }}
                              >
                                Phép
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className={styles.addExcuseBtn}
                            onClick={() => {
                              setExcuseModal({ studentId: student.id, name: student.name, dob: student.dob });
                              setExcuseSession('morning');
                              setExcuseStatus('excused');
                              setExcuseNote('');
                            }}
                          >
                            Điểm danh / Phép
                          </button>
                        )}
                      </td>

                      {/* Ca Chiều */}
                      <td className={`${styles.colSession} ${styles.sectionDividerRight}`}>
                        {afternoon ? (
                          <div className={styles.sessionBox}>
                            <span
                              className={`${styles.sessionStatusPill} badge-${afternoon.status}`}
                              style={{
                                background: `var(--color-${afternoon.status}-bg)`,
                                color: `var(--color-${afternoon.status})`,
                                border: `1px solid var(--color-${afternoon.status}-border)`,
                              }}
                            >
                              {STATUS_LABELS[afternoon.status]}
                            </span>
                            {afternoon.checkInTime && (
                              <span className={styles.timePill}>
                                {afternoon.checkInTime.substring(0, 5)}
                              </span>
                            )}
                            {afternoon.note ? (
                              <span
                                className={styles.notePill}
                                title={`Lý do: ${afternoon.note}`}
                                onClick={() => {
                                  setExcuseModal({ studentId: student.id, name: student.name, dob: student.dob });
                                  setExcuseSession('afternoon');
                                  setExcuseStatus(afternoon.status);
                                  setExcuseNote(afternoon.note || '');
                                }}
                              >
                                {afternoon.note}
                              </span>
                            ) : afternoon.status === 'excused' ? (
                              <button
                                type="button"
                                className={styles.addNoteLink}
                                onClick={() => {
                                  setExcuseModal({ studentId: student.id, name: student.name, dob: student.dob });
                                  setExcuseSession('afternoon');
                                  setExcuseStatus('excused');
                                  setExcuseNote('');
                                }}
                              >
                                Thêm lý do
                              </button>
                            ) : null}
                            <div className={styles.quickActionRow}>
                              <select
                                className={styles.statusMiniSelect}
                                value={afternoon.status}
                                onChange={(e) => {
                                  if (e.target.value === 'delete') {
                                    deleteRecord(afternoon.id);
                                  } else {
                                    updateStatus(afternoon.id, e.target.value as AttendanceStatus);
                                  }
                                }}
                              >
                                {ALL_STATUSES.map((s) => (
                                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                                ))}
                                <option value="delete" style={{ color: 'var(--color-absent)' }}>Xóa</option>
                              </select>
                              <button
                                type="button"
                                className={styles.miniEditBtn}
                                title="Sửa lý do / trạng thái"
                                onClick={() => {
                                  setExcuseModal({ studentId: student.id, name: student.name, dob: student.dob });
                                  setExcuseSession('afternoon');
                                  setExcuseStatus(afternoon.status);
                                  setExcuseNote(afternoon.note || '');
                                }}
                              >
                                Sửa
                              </button>
                              <button
                                type="button"
                                className={styles.miniDeleteBtn}
                                title="Xóa lượt này"
                                onClick={() => deleteRecord(afternoon.id)}
                              >
                                Xóa
                              </button>
                            </div>
                          </div>
                        ) : !isSessionScheduled('afternoon') ? (
                          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>
                            — Nghỉ học
                          </div>
                        ) : isSessionClosed('afternoon') ? (
                          <div className={styles.sessionBox}>
                            <span
                              className={`${styles.sessionStatusPill} badge-absent`}
                              style={{
                                background: 'var(--color-absent-bg)',
                                color: 'var(--color-absent)',
                                border: '1px solid var(--color-absent-border)',
                              }}
                            >
                              Vắng không phép
                            </span>
                            <div className={styles.quickActionRow}>
                              <select
                                className={styles.statusMiniSelect}
                                value="absent"
                                onChange={(e) => {
                                  if (e.target.value !== 'absent' && e.target.value !== 'delete') {
                                    createOrUpdateStatus(null, student.id, 'afternoon', e.target.value as AttendanceStatus);
                                  }
                                }}
                              >
                                {ALL_STATUSES.map((s) => (
                                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                                ))}
                              </select>
                              <button
                                type="button"
                                className={styles.miniEditBtn}
                                title="Thêm phép / sửa trạng thái"
                                onClick={() => {
                                  setExcuseModal({ studentId: student.id, name: student.name, dob: student.dob });
                                  setExcuseSession('afternoon');
                                  setExcuseStatus('excused');
                                  setExcuseNote('');
                                }}
                              >
                                Phép
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className={styles.addExcuseBtn}
                            onClick={() => {
                              setExcuseModal({ studentId: student.id, name: student.name, dob: student.dob });
                              setExcuseSession('afternoon');
                              setExcuseStatus('excused');
                              setExcuseNote('');
                            }}
                          >
                            Điểm danh / Phép
                          </button>
                        )}
                      </td>

                      {/* Tổng kết ngày */}
                      <td className={`${styles.colSummary} ${styles.sectionDividerLeft}`}>
                        {(() => {
                          const m = getEffectiveSessionStatus(row.morning, 'morning');
                          const a = getEffectiveSessionStatus(row.afternoon, 'afternoon');

                          if (viewSession === 'morning') {
                            const s = m || 'absent';
                            return (
                              <span
                                className={styles.daySummaryPill}
                                style={{
                                  background: `var(--color-${s}-bg)`,
                                  color: `var(--color-${s})`,
                                  border: `1px solid var(--color-${s}-border)`,
                                }}
                              >
                                {STATUS_LABELS[s]}
                              </span>
                            );
                          }

                          if (viewSession === 'afternoon') {
                            const s = a || 'absent';
                            return (
                              <span
                                className={styles.daySummaryPill}
                                style={{
                                  background: `var(--color-${s}-bg)`,
                                  color: `var(--color-${s})`,
                                  border: `1px solid var(--color-${s}-border)`,
                                }}
                              >
                                {STATUS_LABELS[s]}
                              </span>
                            );
                          }

                          const mSched = isSessionScheduled('morning');
                          const aSched = isSessionScheduled('afternoon');

                          if (mSched && aSched) {
                            if (m === 'present' && a === 'present') {
                              return (
                                <span
                                  className={styles.daySummaryPill}
                                  style={{
                                    background: 'var(--color-present-bg)',
                                    color: 'var(--color-present)',
                                    border: '1px solid var(--color-present-border)',
                                  }}
                                >
                                  Có mặt đủ
                                </span>
                              );
                            }
                            if (m === 'absent' && a === 'absent') {
                              return (
                                <span
                                  className={styles.daySummaryPill}
                                  style={{
                                    background: 'var(--color-absent-bg)',
                                    color: 'var(--color-absent)',
                                    border: '1px solid var(--color-absent-border)',
                                  }}
                                >
                                  Vắng cả ngày
                                </span>
                              );
                            }
                            if ((m === 'present' && a === 'absent') || (m === 'absent' && a === 'present')) {
                              return (
                                <span
                                  className={styles.daySummaryPill}
                                  style={{
                                    background: 'rgba(239, 68, 68, 0.15)',
                                    color: '#f87171',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                  }}
                                  title="Sinh viên chỉ đi 1 ca và vắng 1 ca"
                                >
                                  Vắng 1 ca
                                </span>
                              );
                            }
                            if (m === 'late' || a === 'late') {
                              return (
                                <span
                                  className={styles.daySummaryPill}
                                  style={{
                                    background: 'var(--color-late-bg)',
                                    color: 'var(--color-late)',
                                    border: '1px solid var(--color-late-border)',
                                  }}
                                >
                                  Đi muộn
                                </span>
                              );
                            }
                            if (m === 'excused' || a === 'excused') {
                              return (
                                <span
                                  className={styles.daySummaryPill}
                                  style={{
                                    background: 'var(--color-excused-bg)',
                                    color: 'var(--color-excused)',
                                    border: '1px solid var(--color-excused-border)',
                                  }}
                                >
                                  Có phép
                                </span>
                              );
                            }
                          }

                          return (
                            <span
                              className={styles.daySummaryPill}
                              style={{
                                background: `var(--color-${daySummary}-bg)`,
                                color: `var(--color-${daySummary})`,
                                border: `1px solid var(--color-${daySummary}-border)`,
                              }}
                            >
                              {STATUS_LABELS[daySummary]}
                            </span>
                          );
                        })()}
                      </td>

                      {/* Thao tác */}
                      <td className={styles.colAction}>
                        <button
                          type="button"
                          className={styles.actionBtn}
                          onClick={() => {
                            setExcuseModal({ studentId: student.id, name: student.name, dob: student.dob });
                          }}
                        >
                          Phép
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modern Excuse Modal */}
      {excuseModal && (
        <div className={styles.modalOverlay} onClick={() => setExcuseModal(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h3 className={styles.modalTitle}>Cập nhật điểm danh</h3>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setExcuseModal(null)}
              >
                Đóng
              </button>
            </div>

            {/* Student card info */}
            <div className={styles.modalStudentInfo}>
              <div className={styles.avatar}>
                {getInitials(excuseModal.name)}
              </div>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  {excuseModal.name}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  Ngày sinh: {excuseModal.dob || '—'}
                </div>
              </div>
            </div>

            {/* Segment: Session */}
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
              Chọn Buổi Học
            </label>
            <div className={styles.sessionSegment}>
              <button
                type="button"
                className={`${styles.sessionSegmentBtn} ${excuseSession === 'morning' ? styles.sessionSegmentBtnActive : ''}`}
                onClick={() => setExcuseSession('morning')}
              >
                Buổi Sáng
              </button>
              <button
                type="button"
                className={`${styles.sessionSegmentBtn} ${excuseSession === 'afternoon' ? styles.sessionSegmentBtnActive : ''}`}
                onClick={() => setExcuseSession('afternoon')}
              >
                Buổi Chiều
              </button>
            </div>

            {/* Status Options Grid */}
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
              Trạng thái thiết lập
            </label>
            <div className={styles.statusRadioGrid}>
              <div
                className={`${styles.statusOption} ${excuseStatus === 'present' ? styles.statusOptionActive : ''}`}
                onClick={() => setExcuseStatus('present')}
              >
                Có mặt
              </div>
              <div
                className={`${styles.statusOption} ${excuseStatus === 'late' ? styles.statusOptionActive : ''}`}
                onClick={() => setExcuseStatus('late')}
              >
                Đi muộn
              </div>
              <div
                className={`${styles.statusOption} ${excuseStatus === 'absent' ? styles.statusOptionActive : ''}`}
                onClick={() => setExcuseStatus('absent')}
              >
                Vắng mặt
              </div>
              <div
                className={`${styles.statusOption} ${excuseStatus === 'excused' ? styles.statusOptionActive : ''}`}
                onClick={() => setExcuseStatus('excused')}
              >
                Có phép
              </div>
              <div
                className={`${styles.statusOption} ${styles.statusOptionDelete} ${excuseStatus === 'delete' ? styles.statusOptionDeleteActive : ''}`}
                onClick={() => setExcuseStatus('delete')}
              >
                Xóa bản ghi (Không có lượt điểm danh)
              </div>
            </div>

            {/* Note & Quick Reasons */}
            {excuseStatus !== 'delete' && (
              <>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>
                  Lý do / Ghi chú
                </label>
                <input
                  className="input"
                  type="text"
                  placeholder="Ví dụ: Ốm có đơn, Gia đình có việc..."
                  value={excuseNote}
                  onChange={(e) => setExcuseNote(e.target.value)}
                  id="excuse-note"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />

                <div className={styles.quickReasonList}>
                  {QUICK_REASONS.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      className={styles.quickReasonChip}
                      onClick={() => setExcuseNote(reason)}
                    >
                      + {reason}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Modal Actions */}
            <div className={styles.modalActions}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setExcuseModal(null)}
              >
                Huỷ
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={submitExcuse}
                id="excuse-confirm"
              >
                Lưu xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
