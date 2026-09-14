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

const STATUS_ICONS: Record<string, string> = {
  present: '✓',
  late: '⏰',
  absent: '✕',
  excused: '📋',
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
    const sessions: AttendanceSession[] = bulkSession === 'both' ? ['morning', 'afternoon'] : [bulkSession];
    const missing: { studentId: number; session: AttendanceSession }[] = [];

    for (const row of rows) {
      for (const sess of sessions) {
        const existing = sess === 'morning' ? row.morning : row.afternoon;
        if (!existing) {
          missing.push({ studentId: row.student.id, session: sess });
        }
      }
    }

    if (missing.length === 0) {
      alert('Tất cả sinh viên đã có điểm danh rồi!');
      return;
    }

    const sessionLabel = bulkSession === 'both' ? 'cả 2 buổi' : (bulkSession === 'morning' ? 'buổi sáng' : 'buổi chiều');
    const confirmed = window.confirm(
      `Điểm danh "Có mặt" cho ${missing.length} lượt còn thiếu (${sessionLabel})?\n\nHành động này sẽ thêm ${missing.length} bản ghi điểm danh.`
    );
    if (!confirmed) return;

    setBulkLoading(true);
    try {
      await Promise.all(
        missing.map(({ studentId, session }) =>
          api.post('/admin/excuse', { studentId, date, session, note: '', status: 'present' })
        )
      );
      fetchData(true);
    } catch {
      alert('Có lỗi xảy ra khi điểm danh hàng loạt!');
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

  // Compute Daily summary for a row (consistent with export and status logic)
  const getRowSummary = (row: DailyAttendanceRow): AttendanceStatus => {
    const records = [row.morning, row.afternoon].filter(Boolean) as AttendanceRecord[];
    if (records.length === 0) return 'absent';
    if (records.some((r) => r.status === 'late')) return 'late';
    if (records.every((r) => r.status === 'present')) return 'present';
    if (records.some((r) => r.status === 'excused')) return 'excused';
    return 'absent';
  };

  // Stats computation (derived 100% consistently from getRowSummary)
  const totalStudents = rows.length;
  const presentCount = rows.filter((r) => getRowSummary(r) === 'present').length;
  const lateCount = rows.filter((r) => getRowSummary(r) === 'late').length;
  const absentCount = rows.filter((r) => getRowSummary(r) === 'absent').length;
  const excusedCount = rows.filter((r) => getRowSummary(r) === 'excused').length;

  const presentPct = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;
  const latePct = totalStudents > 0 ? Math.round((lateCount / totalStudents) * 100) : 0;
  const absentPct = totalStudents > 0 ? Math.round((absentCount / totalStudents) * 100) : 0;
  const excusedPct = totalStudents > 0 ? Math.round((excusedCount / totalStudents) * 100) : 0;

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
  }, [rows, searchQuery, activeFilter]);

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
          <h1 className={styles.pageTitle}>
            <span>📊</span> Dashboard Điểm danh
          </h1>
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
            ◀
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
            ▶
          </button>
          <button
            type="button"
            className={styles.todayBtn}
            onClick={setToday}
          >
            Hôm nay
          </button>
          <button
            type="button"
            className={`${styles.refreshBtn} ${refreshing ? styles.refreshRotating : ''}`}
            onClick={() => fetchData(true)}
            title="Làm mới dữ liệu"
          >
            🔄
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className={styles.statsGrid}>
        {/* Total */}
        <div
          className={`${styles.statCard} ${styles.statTotal} ${activeFilter === 'all' ? styles.statCardActive : ''}`}
          onClick={() => setActiveFilter('all')}
          title="Bấm để xem tất cả sinh viên"
        >
          <div className={styles.statHeader}>
            <div className={styles.statIcon}>👥</div>
            <div className={styles.statPercent}>100%</div>
          </div>
          <div className={styles.statNum}>{totalStudents}</div>
          <div className={styles.statLabel}>Tổng sĩ số lớp</div>
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
            <div className={styles.statIcon}>✅</div>
            <div className={styles.statPercent}>{presentPct}%</div>
          </div>
          <div className={styles.statNum}>{presentCount}</div>
          <div className={styles.statLabel}>Có mặt</div>
          <div className={styles.statProgressTrack}>
            <div className={styles.statProgressBar} style={{ width: `${presentPct}%` }} />
          </div>
        </div>

        {/* Late */}
        <div
          className={`${styles.statCard} ${styles.statLate} ${activeFilter === 'late' ? styles.statCardActive : ''}`}
          onClick={() => setActiveFilter(activeFilter === 'late' ? 'all' : 'late')}
          title="Bấm để lọc sinh viên đi muộn"
        >
          <div className={styles.statHeader}>
            <div className={styles.statIcon}>⚠️</div>
            <div className={styles.statPercent}>{latePct}%</div>
          </div>
          <div className={styles.statNum}>{lateCount}</div>
          <div className={styles.statLabel}>Đi muộn / 1 ca</div>
          <div className={styles.statProgressTrack}>
            <div className={styles.statProgressBar} style={{ width: `${latePct}%` }} />
          </div>
        </div>

        {/* Excused */}
        <div
          className={`${styles.statCard} ${styles.statExcused} ${activeFilter === 'excused' ? styles.statCardActive : ''}`}
          onClick={() => setActiveFilter(activeFilter === 'excused' ? 'all' : 'excused')}
          title="Bấm để lọc sinh viên vắng có phép"
        >
          <div className={styles.statHeader}>
            <div className={styles.statIcon}>📋</div>
            <div className={styles.statPercent}>{excusedPct}%</div>
          </div>
          <div className={styles.statNum}>{excusedCount}</div>
          <div className={styles.statLabel}>Vắng có phép</div>
          <div className={styles.statProgressTrack}>
            <div className={styles.statProgressBar} style={{ width: `${excusedPct}%` }} />
          </div>
        </div>

        {/* Absent */}
        <div
          className={`${styles.statCard} ${styles.statAbsent} ${activeFilter === 'absent' ? styles.statCardActive : ''}`}
          onClick={() => setActiveFilter(activeFilter === 'absent' ? 'all' : 'absent')}
          title="Bấm để lọc sinh viên vắng không phép"
        >
          <div className={styles.statHeader}>
            <div className={styles.statIcon}>❌</div>
            <div className={styles.statPercent}>{absentPct}%</div>
          </div>
          <div className={styles.statNum}>{absentCount}</div>
          <div className={styles.statLabel}>Vắng không phép</div>
          <div className={styles.statProgressTrack}>
            <div className={styles.statProgressBar} style={{ width: `${absentPct}%` }} />
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
              Có mặt ({presentCount})
            </button>
            <button
              type="button"
              className={`${styles.filterChip} ${activeFilter === 'late' ? styles.filterChipActive : ''}`}
              onClick={() => setActiveFilter('late')}
            >
              Đi muộn ({lateCount})
            </button>
            <button
              type="button"
              className={`${styles.filterChip} ${activeFilter === 'excused' ? styles.filterChipActive : ''}`}
              onClick={() => setActiveFilter('excused')}
            >
              Vắng có phép ({excusedCount})
            </button>
            <button
              type="button"
              className={`${styles.filterChip} ${activeFilter === 'absent' ? styles.filterChipActive : ''}`}
              onClick={() => setActiveFilter('absent')}
            >
              Vắng không phép ({absentCount})
            </button>
          </div>

          <div className={styles.searchWrap}>
            <span className={styles.searchIcon}>🔍</span>
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
              <option value="morning">🌅 Sáng</option>
              <option value="afternoon">☀️ Chiều</option>
              <option value="both">📋 Cả 2 buổi</option>
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
                <>✅ Điểm danh tất cả</>
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
                    🌅 Sáng
                    <div style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {settings ? `${settings.morningStart} - ${settings.morningLateEnd}` : '07:30 - 08:15'}
                    </div>
                  </th>
                  <th className={`${styles.colSession} ${styles.sectionDividerRight}`}>
                    ☀️ Chiều
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
                                <span style={{ fontSize: '0.72rem', color: 'var(--color-present)', fontWeight: 600 }} title={`Mã thiết bị: ${student.deviceId}`}>
                                  📱 Đã khóa máy
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
                                  🔄 Reset máy
                                </button>
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                                ⚪ Chưa liên kết máy
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
                              {STATUS_ICONS[morning.status]} {STATUS_LABELS[morning.status]}
                            </span>
                            {morning.checkInTime && (
                              <span className={styles.timePill}>
                                ⏱️ {morning.checkInTime.substring(0, 5)}
                              </span>
                            )}
                            {morning.note ? (
                              <span
                                className={styles.notePill}
                                title={`Lý do: ${morning.note} (Bấm để sửa)`}
                                onClick={() => {
                                  setExcuseModal({ studentId: student.id, name: student.name, dob: student.dob });
                                  setExcuseSession('morning');
                                  setExcuseStatus(morning.status);
                                  setExcuseNote(morning.note || '');
                                }}
                              >
                                💬 {morning.note}
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
                                + Thêm lý do phép
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
                                <option value="delete" style={{ color: 'var(--color-absent)' }}>🗑️ Xóa</option>
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
                                ✏️
                              </button>
                              <button
                                type="button"
                                className={styles.miniDeleteBtn}
                                title="Xóa lượt này"
                                onClick={() => deleteRecord(morning.id)}
                              >
                                ✕
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
                            + Điểm danh / Phép
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
                              {STATUS_ICONS[afternoon.status]} {STATUS_LABELS[afternoon.status]}
                            </span>
                            {afternoon.checkInTime && (
                              <span className={styles.timePill}>
                                ⏱️ {afternoon.checkInTime.substring(0, 5)}
                              </span>
                            )}
                            {afternoon.note ? (
                              <span
                                className={styles.notePill}
                                title={`Lý do: ${afternoon.note} (Bấm để sửa)`}
                                onClick={() => {
                                  setExcuseModal({ studentId: student.id, name: student.name, dob: student.dob });
                                  setExcuseSession('afternoon');
                                  setExcuseStatus(afternoon.status);
                                  setExcuseNote(afternoon.note || '');
                                }}
                              >
                                💬 {afternoon.note}
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
                                + Thêm lý do phép
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
                                <option value="delete" style={{ color: 'var(--color-absent)' }}>🗑️ Xóa</option>
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
                                ✏️
                              </button>
                              <button
                                type="button"
                                className={styles.miniDeleteBtn}
                                title="Xóa lượt này"
                                onClick={() => deleteRecord(afternoon.id)}
                              >
                                ✕
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
                            + Điểm danh / Phép
                          </button>
                        )}
                      </td>

                      {/* Tổng kết ngày */}
                      <td className={`${styles.colSummary} ${styles.sectionDividerLeft}`}>
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
                          📋 Phép
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
                <h3 className={styles.modalTitle}>📋 Cập nhật điểm danh</h3>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setExcuseModal(null)}
              >
                ✕
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
                🌅 Buổi Sáng
              </button>
              <button
                type="button"
                className={`${styles.sessionSegmentBtn} ${excuseSession === 'afternoon' ? styles.sessionSegmentBtnActive : ''}`}
                onClick={() => setExcuseSession('afternoon')}
              >
                ☀️ Buổi Chiều
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
                <span style={{ color: 'var(--color-present)' }}>✓</span> Có mặt
              </div>
              <div
                className={`${styles.statusOption} ${excuseStatus === 'late' ? styles.statusOptionActive : ''}`}
                onClick={() => setExcuseStatus('late')}
              >
                <span style={{ color: 'var(--color-late)' }}>⏰</span> Đi muộn
              </div>
              <div
                className={`${styles.statusOption} ${excuseStatus === 'absent' ? styles.statusOptionActive : ''}`}
                onClick={() => setExcuseStatus('absent')}
              >
                <span style={{ color: 'var(--color-absent)' }}>✕</span> Vắng mặt
              </div>
              <div
                className={`${styles.statusOption} ${excuseStatus === 'excused' ? styles.statusOptionActive : ''}`}
                onClick={() => setExcuseStatus('excused')}
              >
                <span style={{ color: 'var(--color-excused)' }}>📋</span> Có phép
              </div>
              <div
                className={`${styles.statusOption} ${styles.statusOptionDelete} ${excuseStatus === 'delete' ? styles.statusOptionDeleteActive : ''}`}
                onClick={() => setExcuseStatus('delete')}
              >
                <span>🗑️</span> Xóa bản ghi (Không có lượt điểm danh)
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
                ✓ Lưu xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
