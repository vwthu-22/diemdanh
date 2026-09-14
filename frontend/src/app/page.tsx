'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { getLessonsByDate } from '@/data/schedule';
import { Student, SessionStatusResponse, SessionInfo, AttendanceRecord, AttendanceSession } from '@/types';
import styles from './page.module.css';

const SESSION_LABELS: Record<AttendanceSession, string> = {
  morning: 'Buổi Sáng',
  afternoon: 'Buổi Chiều',
};

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  present: { label: '✓ Có mặt', className: styles.statusPresent },
  late:    { label: '⚡ Muộn',   className: styles.statusLate },
  absent:  { label: '✗ Vắng',   className: styles.statusAbsent },
  excused: { label: '📋 Có phép', className: styles.statusExcused },
};

function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem('cqp22_device_id');
  if (!id) {
    id = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('cqp22_device_id', id);
  }
  return id;
}

function getStoredStudent(): { id: number; name: string } | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('cqp22_student');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export default function StudentPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<{ id: number; name: string } | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<SessionStatusResponse | null>(null);
  const [myRecords, setMyRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [currentTime, setCurrentTime] = useState('');

  // Update clock every second
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      setCurrentTime(`${h}:${m}:${s}`);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  const [isDeviceBound, setIsDeviceBound] = useState(false);

  // Check if this device is already bound to a student
  const checkDeviceBinding = useCallback(async () => {
    const deviceId = getOrCreateDeviceId();
    try {
      const r = await api.get<{ bound: boolean; student: Student | null }>(
        `/attendance/device-binding?deviceId=${deviceId}`,
      );
      if (r.data.bound && r.data.student) {
        setIsDeviceBound(true);
        const boundSt = { id: r.data.student.id, name: r.data.student.name };
        setSelectedStudent(boundSt);
        localStorage.setItem('cqp22_student', JSON.stringify(boundSt));
      } else {
        setIsDeviceBound(false);
      }
    } catch {}
  }, []);

  // Load students
  useEffect(() => {
    api.get<Student[]>('/students').then((r) => setStudents(r.data));
    const stored = getStoredStudent();
    if (stored) setSelectedStudent(stored);
    checkDeviceBinding();
  }, [checkDeviceBinding]);

  const fetchStatus = useCallback(async () => {
    try {
      const r = await api.get<SessionStatusResponse>('/attendance/session-status');
      setSessionStatus(r.data);
    } catch {}
  }, []);

  const fetchMyRecords = useCallback(async () => {
    const deviceId = getOrCreateDeviceId();
    const today = new Date().toLocaleDateString('en-CA');
    try {
      const r = await api.get<AttendanceRecord[]>(`/attendance/my-status?deviceId=${deviceId}&date=${today}`);
      setMyRecords(r.data);
    } catch {}
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchMyRecords();
    checkDeviceBinding();
    const interval = setInterval(() => {
      fetchStatus();
      fetchMyRecords();
      checkDeviceBinding();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus, fetchMyRecords, checkDeviceBinding]);

  const selectStudent = (student: Student) => {
    const stored = { id: student.id, name: student.name };
    setSelectedStudent(stored);
    localStorage.setItem('cqp22_student', JSON.stringify(stored));
    setShowPicker(false);
  };

  const checkIn = async (session: AttendanceSession) => {
    if (!selectedStudent) {
      setMessage({ text: 'Vui lòng chọn tên của bạn trước!', type: 'error' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      // Get GPS position
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Trình duyệt không hỗ trợ GPS. Vui lòng dùng Chrome/Safari trên điện thoại!'));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
      });

      const deviceId = getOrCreateDeviceId();
      const r = await api.post('/attendance/checkin', {
        studentId: selectedStudent.id,
        deviceId,
        session,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });

      setMessage({ text: r.data.message, type: r.data.status === 'late' ? 'info' : 'success' });
      fetchMyRecords();
      fetchStatus();
      checkDeviceBinding();
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.message ||
        err?.message ||
        'Có lỗi xảy ra. Vui lòng thử lại!';
      setMessage({ text: errMsg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const todayStr = sessionStatus?.today || new Date().toLocaleDateString('en-CA');
  const [ty, tm, td] = todayStr.split('-');
  const dayNames = ['Chủ nhật','Thứ hai','Thứ ba','Thứ tư','Thứ năm','Thứ sáu','Thứ bảy'];
  const dayName = dayNames[new Date(todayStr).getDay()];

  const todayLessons = useMemo(() => getLessonsByDate(todayStr), [todayStr]);

  const getRecordForSession = (session: AttendanceSession) =>
    myRecords.find((r) => r.session === session) || null;

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.logo}>
            <div className={styles.logoIcon}>📹</div>
            <div>
              <div className={styles.logoTitle}>CQP 22</div>
              <div className={styles.logoSub}>Trường Cao đẳng Truyền hình</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link href="/schedule" className={`btn btn-secondary ${styles.adminLink}`} id="link-header-schedule">
              📅 Thời khóa biểu
            </Link>
            <Link href="/admin" className={`btn btn-secondary ${styles.adminLink}`}>
              ⚙️ Quản lý
            </Link>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        {/* Date & Time Card */}
        <div className={`card ${styles.timeCard} fade-in`}>
          <div className={styles.dayLabel}>{dayName}</div>
          <div className={styles.dateDisplay}>{td}/{tm}/{ty}</div>
          <div className={styles.clockDisplay}>{currentTime}</div>
        </div>

        {/* Today's Schedule Banner */}
        {todayLessons.length > 0 ? (
          <div
            className="card fade-in"
            style={{
              padding: '14px 18px',
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(139, 92, 246, 0.1))',
              border: '1px solid rgba(99, 102, 241, 0.3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
                📖 Môn học hôm nay ({todayLessons.length} ca)
              </span>
              <Link
                href="/schedule"
                style={{ fontSize: '0.78rem', color: '#38bdf8', textDecoration: 'none', fontWeight: 600 }}
              >
                Xem TKB đầy đủ ➔
              </Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {todayLessons.map((l) => (
                <div
                  key={l.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 8,
                    padding: '8px 12px',
                    borderRadius: 10,
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '1.2rem' }}>{l.icon}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f8fafc' }}>{l.subject}</div>
                      <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                        📍 P.{l.room} • 👨‍🏫 GV: {l.teacher}
                      </div>
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: 6,
                      background: l.session === 'morning' ? 'rgba(245, 158, 11, 0.18)' : 'rgba(59, 130, 246, 0.18)',
                      color: l.session === 'morning' ? '#fbbf24' : '#60a5fa',
                      border: l.session === 'morning' ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(59, 130, 246, 0.3)',
                    }}
                  >
                    {l.sessionLabel} • Tiết {l.periods}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div
            className="card fade-in"
            style={{
              padding: '12px 18px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '0.84rem', color: '#94a3b8' }}>
              ☕ Hôm nay lớp CQP 22 không có lịch học
            </span>
            <Link href="/schedule" style={{ fontSize: '0.78rem', color: '#38bdf8', textDecoration: 'none', fontWeight: 600 }}>
              Xem thời khóa biểu ➔
            </Link>
          </div>
        )}

        {/* Student Selector */}
        <div className={`card ${styles.studentCard} fade-in`}>
          <div className={styles.studentCardTitle} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>👤 Bạn là ai?</span>
            {isDeviceBound && (
              <span style={{ fontSize: '0.72rem', color: 'var(--color-present)', fontWeight: 600 }}>
                🔒 Máy đã liên kết
              </span>
            )}
          </div>
          {selectedStudent ? (
            <div className={styles.selectedStudentInfo}>
              <div className={styles.selectedName}>{selectedStudent.name}</div>
              {!isDeviceBound ? (
                <button
                  className={`btn btn-secondary btn-sm`}
                  onClick={() => setShowPicker(true)}
                  id="student-change-btn"
                >
                  Đổi
                </button>
              ) : (
                <span
                  style={{
                    fontSize: '0.72rem',
                    color: 'var(--color-text-muted)',
                    background: 'rgba(255,255,255,0.06)',
                    padding: '3px 8px',
                    borderRadius: 6,
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                  title="Thiết bị này đã được cố định vào bạn. Nếu đổi điện thoại, vui lòng báo giáo viên reset!"
                >
                  🔒 Cố định máy
                </span>
              )}
            </div>
          ) : (
            <button
              className={`btn btn-primary w-full`}
              onClick={() => setShowPicker(true)}
            >
              Chọn tên của bạn
            </button>
          )}
        </div>

        {/* Student Picker Modal */}
        {showPicker && (
          <div className={styles.modalOverlay} onClick={() => setShowPicker(false)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3>Chọn tên của bạn</h3>
                <button onClick={() => setShowPicker(false)} className={styles.modalClose}>✕</button>
              </div>
              <div className={styles.studentList}>
                {students.map((s) => (
                  <button
                    key={s.id}
                    className={`${styles.studentItem} ${selectedStudent?.id === s.id ? styles.studentItemActive : ''}`}
                    onClick={() => selectStudent(s)}
                  >
                    <span className={styles.studentNum}>{s.orderNum}</span>
                    <span className={styles.studentName}>{s.name}</span>
                    {selectedStudent?.id === s.id && <span className={styles.checkmark}>✓</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Check-in Buttons */}
        {sessionStatus && (
          <div className={`${styles.sessionsGrid} fade-in`}>
            {sessionStatus.sessions.map((session) => {
              const record = getRecordForSession(session.session);
              const statusInfo = record ? STATUS_MAP[record.status] : null;

              return (
                <div key={session.session} className={`card ${styles.sessionCard}`}>
                  <div className={styles.sessionHeader}>
                    <div className={styles.sessionLabel}>
                      {session.session === 'morning' ? '🌅' : '☀️'} {session.label}
                    </div>
                    <div className={`${styles.sessionTimeBadge} ${
                      session.isScheduled === false
                        ? styles.sessionClosed
                        : session.isOpen
                        ? (session.isOnTime ? styles.sessionOpen : styles.sessionLate)
                        : styles.sessionClosed
                    }`}>
                      {session.isScheduled === false
                        ? '⚪ Không có tiết'
                        : session.isOpen
                        ? (session.isOnTime ? '🟢 Đang mở' : '🟡 Muộn')
                        : '🔴 Đã đóng'}
                    </div>
                  </div>

                  <div className={styles.sessionTime}>
                    ⏰ {session.start} → {session.lateEnd}
                    <span className={styles.onTimeHint}>(Đúng giờ trước {session.onTimeEnd})</span>
                  </div>

                  {record ? (
                    <div className={styles.checkedInState}>
                      <div className={`${styles.statusBig} ${statusInfo?.className}`}>
                        {statusInfo?.label}
                      </div>
                      <div className={styles.checkInTime}>
                        Điểm danh lúc {record.checkInTime?.substring(0, 5)}
                      </div>
                    </div>
                  ) : session.isScheduled === false ? (
                    <div className={styles.closedState}>
                      😴 Buổi này lớp không có lịch học
                    </div>
                  ) : session.isOpen ? (
                    <button
                      className={`btn btn-primary btn-lg w-full ${styles.checkinBtn}`}
                      onClick={() => checkIn(session.session)}
                      disabled={loading || !selectedStudent}
                    >
                      {loading ? <><div className="spinner" /> Đang xử lý...</> : '📍 Điểm danh ngay'}
                    </button>
                  ) : (
                    <div className={styles.closedState}>
                      Cổng điểm danh đã đóng
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Feedback Message */}
        {message && (
          <div className={`${styles.message} ${styles[`message-${message.type}`]} fade-in`}>
            {message.text}
          </div>
        )}

        {/* Footer note */}
        <p className={`${styles.footerNote} text-muted text-center`}>
          🔒 Điểm danh yêu cầu có mặt tại trường và GPS bật
        </p>
      </main>
    </div>
  );
}
