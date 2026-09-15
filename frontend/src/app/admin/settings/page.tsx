'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Settings } from '@/types';
import styles from './settings.module.css';

const DAYS = [
  { key: '1', label: 'Thứ 2' },
  { key: '2', label: 'Thứ 3' },
  { key: '3', label: 'Thứ 4' },
  { key: '4', label: 'Thứ 5' },
  { key: '5', label: 'Thứ 6' },
  { key: '6', label: 'Thứ 7' },
  { key: '0', label: 'Chủ Nhật' },
];

const DEFAULT_SCHEDULE: Record<string, string[]> = {
  '1': ['morning'],
  '2': ['morning', 'afternoon'],
  '3': ['morning', 'afternoon'],
  '4': ['morning'],
  '5': ['morning', 'afternoon'],
  '6': [],
  '0': [],
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [form, setForm] = useState<Partial<Settings>>({});
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    api.get<Settings>('/settings').then((r) => {
      setSettings(r.data);
      setForm(r.data);
    });
  }, []);

  const clearAllAttendance = async () => {
    if (!window.confirm('⚠️ Bạn có chắc chắn muốn xóa TOÀN BỘ dữ liệu điểm danh đã test không?\n\nDanh sách 29 sinh viên và cài đặt trường/thời khóa biểu vẫn được giữ nguyên 100%.')) {
      return;
    }
    setClearing(true);
    setMessage(null);
    try {
      const res = await api.delete('/admin/attendance/clear-all');
      setMessage({ text: res.data?.message || 'Đã xóa sạch dữ liệu điểm danh test thành công!', type: 'success' });
    } catch {
      setMessage({ text: 'Lỗi khi xóa dữ liệu. Vui lòng thử lại!', type: 'error' });
    } finally {
      setClearing(false);
    }
  };

  const clearMyDevice = () => {
    localStorage.removeItem('cqp22_device_id');
    localStorage.removeItem('cqp22_student');
    alert('✅ Đã xóa bộ nhớ thiết bị của bạn trên trình duyệt! Bây giờ máy bạn giống như một sinh viên mới mở app lần đầu.');
  };

  const getMyLocation = () => {
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          schoolLat: parseFloat(pos.coords.latitude.toFixed(6)),
          schoolLng: parseFloat(pos.coords.longitude.toFixed(6)),
        }));
        setGpsLoading(false);
        setMessage({ text: 'Đã cập nhật tọa độ GPS vị trí hiện tại của bạn!', type: 'success' });
      },
      () => {
        alert('Không lấy được GPS. Hãy bật định vị trình duyệt hoặc nhập thủ công!');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true },
    );
  };

  const save = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await api.patch<Settings>('/settings', form);
      if (res.data) {
        setSettings(res.data);
        setForm(res.data);
      }
      setMessage({ text: 'Đã lưu cấu hình hệ thống thành công!', type: 'success' });
      // Clear toast after 4s
      setTimeout(() => setMessage(null), 4000);
    } catch {
      setMessage({ text: 'Lỗi khi lưu cài đặt. Vui lòng kiểm tra lại quyền admin!', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const update = (field: keyof Settings, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const schedule = form.schedule || settings?.schedule || DEFAULT_SCHEDULE;

  const toggleSchedule = (dayKey: string, session: 'morning' | 'afternoon') => {
    const currentSessions = schedule[dayKey] || [];
    const hasSession = currentSessions.includes(session);
    const updatedSessions = hasSession
      ? currentSessions.filter((s) => s !== session)
      : [...currentSessions, session];

    setForm((prev) => ({
      ...prev,
      schedule: {
        ...schedule,
        [dayKey]: updatedSessions,
      },
    }));
  };

  const setPresetSchedule = (type: 'cqp22' | 'all' | 'none') => {
    let newSched: Record<string, string[]> = {};
    if (type === 'cqp22') {
      newSched = {
        '1': ['morning'],
        '2': ['morning', 'afternoon'],
        '3': ['morning', 'afternoon'],
        '4': ['morning'],
        '5': ['morning', 'afternoon'],
        '6': [],
        '0': [],
      };
    } else if (type === 'all') {
      newSched = {
        '1': ['morning', 'afternoon'],
        '2': ['morning', 'afternoon'],
        '3': ['morning', 'afternoon'],
        '4': ['morning', 'afternoon'],
        '5': ['morning', 'afternoon'],
        '6': ['morning', 'afternoon'],
        '0': ['morning', 'afternoon'],
      };
    } else {
      newSched = { '1': [], '2': [], '3': [], '4': [], '5': [], '6': [], '0': [] };
    }
    setForm((prev) => ({ ...prev, schedule: newSched }));
  };

  const copyCredentials = () => {
    navigator.clipboard.writeText('ADMIN_USERNAME=giaovien\nADMIN_PASSWORD=cqp22admin');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Helper calculating duration string
  const getWindowSummary = (start?: string, ontime?: string, late?: string) => {
    if (!start || !ontime || !late) return '';
    return `Đúng giờ: ${start} → ${ontime} • Muộn: ${ontime} → ${late}`;
  };

  const radiusFormatted = useMemo(() => {
    const r = form.radiusMeters || 150;
    if (r >= 1000) return `${(r / 1000).toFixed(1)} km`;
    return `${r} m`;
  }, [form.radiusMeters]);

  if (!settings) {
    return (
      <div className={styles.page}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 40 }}>
          <div className="spinner" /> Đang tải dữ liệu cấu hình hệ thống...
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.titleArea}>
          <h1 className={styles.pageTitle}>
            <span>⚙️</span> Cài đặt hệ thống
          </h1>
          <p className={styles.pageSubtitle}>
            Cấu hình định vị GPS, bán kính điểm danh, khung giờ ca học và thời khóa biểu
          </p>
        </div>
      </div>

      {/* Top 2-Column Grid */}
      <div className={styles.topGrid}>
        {/* Card 1: GPS Location & Geofence */}
        <div className={styles.sectionCard}>
          <div className={styles.cardHeader}>
            <h2 className={styles.sectionTitle}>
              <span>📍</span> Vị trí & Bán kính GPS
            </h2>
            <span className={styles.badgePill}>Geofence</span>
          </div>

          <p className={styles.sectionDesc}>
            Sinh viên mở điện thoại phải nằm trong bán kính này tính từ tâm trường mới có thể điểm danh.
          </p>

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label}>Vĩ độ (Latitude)</label>
              <input
                className="input"
                type="number"
                step="0.000001"
                value={form.schoolLat || ''}
                onChange={(e) => update('schoolLat', parseFloat(e.target.value))}
                id="settings-school-lat"
                placeholder="20.868382"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Kinh độ (Longitude)</label>
              <input
                className="input"
                type="number"
                step="0.000001"
                value={form.schoolLng || ''}
                onChange={(e) => update('schoolLng', parseFloat(e.target.value))}
                id="settings-school-lng"
                placeholder="105.857279"
              />
            </div>
          </div>

          <div className={styles.gpsActions}>
            <button
              type="button"
              className={styles.gpsBtn}
              onClick={getMyLocation}
              disabled={gpsLoading}
              id="settings-get-location"
            >
              {gpsLoading ? (
                <>
                  <div className="spinner" /> Đang dò sóng GPS...
                </>
              ) : (
                '📡 Lấy vị trí hiện tại của tôi'
              )}
            </button>

            {form.schoolLat && form.schoolLng && (
              <a
                href={`https://www.google.com/maps?q=${form.schoolLat},${form.schoolLng}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.mapLink}
              >
                🗺️ Xem trên Google Maps →
              </a>
            )}
          </div>

          {/* Radius Slider & Box */}
          <div className={styles.radiusBox}>
            <div className={styles.radiusHeader}>
              <span className={styles.label}>Bán kính cho phép điểm danh</span>
              <span className={styles.radiusBadge}>{radiusFormatted}</span>
            </div>

            <input
              type="range"
              min={50}
              max={5000}
              step={50}
              value={form.radiusMeters || 150}
              onChange={(e) => update('radiusMeters', parseInt(e.target.value) || 50)}
              className={styles.rangeSlider}
            />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              <span>50 m (Trong lớp)</span>
              <span>500 m (Khuôn viên)</span>
              <span>5 km (Khu vực lân cận)</span>
            </div>
          </div>
        </div>

        {/* Card 2: Check-in Time Windows */}
        <div className={styles.sectionCard}>
          <div className={styles.cardHeader}>
            <h2 className={styles.sectionTitle}>
              <span>⏰</span> Khung giờ điểm danh
            </h2>
            <span className={styles.badgePill}>2 Buổi / ngày</span>
          </div>

          <p className={styles.sectionDesc}>
            Xác định thời điểm mở cổng, mốc đúng giờ và mốc đóng cổng (hết hạn muộn) cho từng buổi.
          </p>

          {/* Morning Window */}
          <div className={styles.timeSessionBox}>
            <div className={styles.timeSessionHeader}>
              <span>🌅 Ca Sáng</span>
              <span className={styles.timePillBadge}>
                {getWindowSummary(form.morningStart, form.morningOnTimeEnd, form.morningLateEnd)}
              </span>
            </div>

            <div className={styles.timeFieldGrid}>
              <div className={styles.timeInputWrap}>
                <label className={styles.timeInputLabel}>Bắt đầu</label>
                <input
                  className="input"
                  type="time"
                  value={form.morningStart || '07:30'}
                  onChange={(e) => update('morningStart', e.target.value)}
                  id="settings-morning-start"
                />
              </div>
              <div className={styles.timeInputWrap}>
                <label className={styles.timeInputLabel}>Đúng giờ đến</label>
                <input
                  className="input"
                  type="time"
                  value={form.morningOnTimeEnd || '07:45'}
                  onChange={(e) => update('morningOnTimeEnd', e.target.value)}
                  id="settings-morning-ontime"
                />
              </div>
              <div className={styles.timeInputWrap}>
                <label className={styles.timeInputLabel}>Đóng cổng</label>
                <input
                  className="input"
                  type="time"
                  value={form.morningLateEnd || '08:15'}
                  onChange={(e) => update('morningLateEnd', e.target.value)}
                  id="settings-morning-late"
                />
              </div>
            </div>
          </div>

          {/* Afternoon Window */}
          <div className={styles.timeSessionBox}>
            <div className={styles.timeSessionHeader}>
              <span>☀️ Ca Chiều</span>
              <span className={styles.timePillBadge}>
                {getWindowSummary(form.afternoonStart, form.afternoonOnTimeEnd, form.afternoonLateEnd)}
              </span>
            </div>

            <div className={styles.timeFieldGrid}>
              <div className={styles.timeInputWrap}>
                <label className={styles.timeInputLabel}>Bắt đầu</label>
                <input
                  className="input"
                  type="time"
                  value={form.afternoonStart || '13:00'}
                  onChange={(e) => update('afternoonStart', e.target.value)}
                  id="settings-afternoon-start"
                />
              </div>
              <div className={styles.timeInputWrap}>
                <label className={styles.timeInputLabel}>Đúng giờ đến</label>
                <input
                  className="input"
                  type="time"
                  value={form.afternoonOnTimeEnd || '13:15'}
                  onChange={(e) => update('afternoonOnTimeEnd', e.target.value)}
                  id="settings-afternoon-ontime"
                />
              </div>
              <div className={styles.timeInputWrap}>
                <label className={styles.timeInputLabel}>Đóng cổng</label>
                <input
                  className="input"
                  type="time"
                  value={form.afternoonLateEnd || '13:45'}
                  onChange={(e) => update('afternoonLateEnd', e.target.value)}
                  id="settings-afternoon-late"
                />
              </div>
            </div>
          </div>

          {/* Start Date Setting */}
          <div style={{ marginTop: 16, padding: '14px 16px', background: 'rgba(59, 130, 246, 0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(59, 130, 246, 0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-primary-light)' }}>
                🗓️ Ngày bắt đầu áp dụng tính điểm danh
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                Các ngày trước mốc này hiển thị &quot;–&quot; và không bị tính vắng
              </span>
            </div>
            <input
              className="input"
              type="date"
              value={form.startDate || '2026-09-14'}
              onChange={(e) => update('startDate', e.target.value)}
              id="settings-start-date"
              style={{ maxWidth: 220 }}
            />
          </div>
        </div>
      </div>

      {/* Card 3: Weekly Timetable Schedule & Attendance Control */}
      <div className={styles.scheduleCard}>
        <div className={styles.scheduleHeaderRow}>
          <div>
            <h2 className={styles.sectionTitle}>
              <span>📅</span> Thời khóa biểu tuần (Lịch học & Điều khiển ca điểm danh)
            </h2>
            <p className={styles.sectionDesc} style={{ marginBottom: 0 }}>
              Bấm vào từng ô để chuyển đổi giữa <strong>Học</strong> và <strong>Nghỉ</strong>. Ca nghỉ học sẽ <strong>không mở cổng điểm danh</strong> và <strong>không bị tính vắng học sinh</strong>. Thầy cô có thể chủ động cấu hình khi lớp nghỉ đột xuất hoặc có lịch học bù/thi vào Thứ 7, Chủ Nhật.
            </p>
          </div>

          <div className={styles.presetBar}>
            <button
              type="button"
              className={styles.presetBtn}
              onClick={() => setPresetSchedule('cqp22')}
              title="Khôi phục lịch học chuẩn của lớp CQP22"
            >
              📋 Chuẩn lịch CQP22
            </button>
            <button
              type="button"
              className={styles.presetBtn}
              onClick={() => setPresetSchedule('all')}
              title="Bật tất cả các ca trong tuần (T2 đến Chủ Nhật)"
            >
              ⚡ Bật cả tuần (T2-CN)
            </button>
            <button
              type="button"
              className={styles.presetBtn}
              onClick={() => setPresetSchedule('none')}
              title="Tắt tất cả các ca"
            >
              ❌ Nghỉ tất cả
            </button>
            <Link
              href="/schedule"
              className="btn btn-secondary"
              style={{ padding: '6px 14px', fontSize: '0.8rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              id="btn-goto-schedule-from-settings"
            >
              📖 Xem TKB chi tiết cả kỳ →
            </Link>
          </div>
        </div>

        <div className={styles.tableResponsive}>
          <table className={styles.scheduleTable}>
            <thead>
              <tr>
                <th style={{ width: 130, textAlign: 'left' }}>Ca học</th>
                {DAYS.map((d) => (
                  <th key={d.key}>{d.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Morning Row */}
              <tr>
                <td style={{ fontWeight: 700, textAlign: 'left', color: 'var(--color-text-primary)' }}>
                  🌅 Buổi Sáng
                </td>
                {DAYS.map((d) => {
                  const active = schedule[d.key]?.includes('morning') ?? false;
                  return (
                    <td
                      key={`morning-${d.key}`}
                      className={styles.scheduleCell}
                      onClick={() => toggleSchedule(d.key, 'morning')}
                    >
                      <div className={`${styles.scheduleToggleCard} ${active ? styles.toggleActive : styles.toggleInactive}`}>
                        <div className={styles.toggleTitle}>{active ? '✓ Học' : '✕ Nghỉ'}</div>
                        <div className={styles.toggleSub}>{active ? 'Có điểm danh' : 'Bỏ qua (không vắng)'}</div>
                      </div>
                    </td>
                  );
                })}
              </tr>

              {/* Afternoon Row */}
              <tr>
                <td style={{ fontWeight: 700, textAlign: 'left', color: 'var(--color-text-primary)' }}>
                  ☀️ Buổi Chiều
                </td>
                {DAYS.map((d) => {
                  const active = schedule[d.key]?.includes('afternoon') ?? false;
                  return (
                    <td
                      key={`afternoon-${d.key}`}
                      className={styles.scheduleCell}
                      onClick={() => toggleSchedule(d.key, 'afternoon')}
                    >
                      <div className={`${styles.scheduleToggleCard} ${active ? styles.toggleActive : styles.toggleInactive}`}>
                        <div className={styles.toggleTitle}>{active ? '✓ Học' : '✕ Nghỉ'}</div>
                        <div className={styles.toggleSub}>{active ? 'Có điểm danh' : 'Bỏ qua (không vắng)'}</div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Grid: Info & Danger Zone */}
      <div className={styles.bottomGrid}>
        {/* Info Card */}
        <div className={styles.infoCard}>
          <div className={styles.cardHeader}>
            <h2 className={styles.sectionTitle}>
              <span>📌</span> Quản trị & Bảo mật
            </h2>
            <span className={styles.badgePill}>Hệ thống</span>
          </div>
          <p className={styles.sectionDesc}>
            Để thay đổi tài khoản hoặc mật khẩu quản trị viên, vui lòng chỉnh sửa file <code>.env</code> trong thư mục <code>backend/</code>:
          </p>
          <div className={styles.codeBox}>
            <div>ADMIN_USERNAME=giaovien</div>
            <div>ADMIN_PASSWORD=cqp22admin</div>
          </div>
          <button
            type="button"
            className={styles.resetDevBtn}
            onClick={copyCredentials}
            style={{ marginTop: 12 }}
          >
            {copied ? '✓ Đã sao chép!' : '📋 Sao chép thông tin'}
          </button>
        </div>

        {/* Danger Zone */}
        <div className={styles.dangerCard}>
          <div className={styles.cardHeader}>
            <h2 className={styles.sectionTitle} style={{ color: 'var(--color-absent)' }}>
              <span>🛡️</span> Khu vực thử nghiệm & Reset
            </h2>
            <span
              className={styles.badgePill}
              style={{ background: 'var(--color-absent-bg)', color: 'var(--color-absent)', borderColor: 'var(--color-absent-border)' }}
            >
              Danger Zone
            </span>
          </div>
          <p className={styles.sectionDesc}>
            Các thao tác dọn dẹp bộ nhớ và dữ liệu thử nghiệm trước khi triển khai chính thức cho lớp học:
          </p>

          <div className={styles.dangerActions}>
            <button
              type="button"
              className={styles.dangerBtn}
              onClick={clearAllAttendance}
              disabled={clearing}
            >
              {clearing ? 'Đang xóa...' : '🗑️ Xóa toàn bộ lượt điểm danh test'}
            </button>

            <button
              type="button"
              className={styles.resetDevBtn}
              onClick={clearMyDevice}
            >
              🧹 Reset máy này (thử lại vai trò học sinh)
            </button>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Save Bar */}
      <div className={styles.stickySaveBar}>
        <div className={styles.saveBarLeft}>
          {message && (
            <div className={`${styles.toastMsg} ${message.type === 'success' ? styles.toastSuccess : styles.toastError}`}>
              {message.type === 'success' ? '✓ ' : '✕ '} {message.text}
            </div>
          )}
        </div>

        <button
          type="button"
          className={styles.saveBtn}
          onClick={save}
          disabled={loading}
          id="settings-save"
        >
          {loading ? (
            <>
              <div className="spinner" /> Đang lưu cấu hình...
            </>
          ) : (
            '💾 Lưu tất cả cài đặt'
          )}
        </button>
      </div>
    </div>
  );
}
