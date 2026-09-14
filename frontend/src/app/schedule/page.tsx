'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { SCHEDULE_DATA, WEEKS_LIST, ScheduleLesson, getLessonsByDate } from '@/data/schedule';
import styles from './schedule.module.css';

export default function SchedulePage() {
  const [selectedWeek, setSelectedWeek] = useState<number | 'all'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [searchQuery, setSearchQuery] = useState('');

  const todayStr = useMemo(() => new Date().toLocaleDateString('en-CA'), []);
  const todayLessons = useMemo(() => getLessonsByDate(todayStr), [todayStr]);

  const filteredLessons = useMemo(() => {
    return SCHEDULE_DATA.filter((lesson) => {
      const matchWeek = selectedWeek === 'all' || lesson.week === selectedWeek;
      const matchSearch =
        !searchQuery ||
        lesson.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lesson.teacher.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lesson.room.toLowerCase().includes(searchQuery.toLowerCase());
      return matchWeek && matchSearch;
    });
  }, [selectedWeek, searchQuery]);

  const displayWeeks = useMemo(() => {
    if (selectedWeek === 'all') return WEEKS_LIST.map((w) => w.week);
    return [selectedWeek];
  }, [selectedWeek]);

  // Determine which days to display for a given week (includes Saturday if scheduled)
  const getDaysForWeek = (weekNum: number) => {
    const hasSat = SCHEDULE_DATA.some((l) => l.week === weekNum && l.dayOfWeek === 7);
    const base = [
      { num: 2, label: 'Thứ Hai' },
      { num: 3, label: 'Thứ Ba' },
      { num: 4, label: 'Thứ Tư' },
      { num: 5, label: 'Thứ Năm' },
      { num: 6, label: 'Thứ Sáu' },
    ];
    if (hasSat) {
      base.push({ num: 7, label: 'Thứ Bảy' });
    }
    return base;
  };

  // Group lessons for a specific week by dayOfWeek (2..7)
  const getWeekDayLessons = (weekNum: number, dayOfWeek: number) => {
    return SCHEDULE_DATA.filter(
      (l) =>
        l.week === weekNum &&
        l.dayOfWeek === dayOfWeek &&
        (!searchQuery ||
          l.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
          l.teacher.toLowerCase().includes(searchQuery.toLowerCase()) ||
          l.room.toLowerCase().includes(searchQuery.toLowerCase())),
    ).sort((a, b) => (a.session === 'morning' ? -1 : 1));
  };

  const getWeekDayDate = (weekNum: number, dayOfWeek: number) => {
    const lesson = SCHEDULE_DATA.find((l) => l.week === weekNum && l.dayOfWeek === dayOfWeek);
    if (lesson) return { dateStr: lesson.date, display: lesson.dateDisplay };

    // Fallback date calculation based on week start
    const weekInfo = WEEKS_LIST.find((w) => w.week === weekNum);
    if (!weekInfo) return { dateStr: '', display: '' };
    const [y, m, d] = weekInfo.from.split('-').map(Number);
    const startDate = new Date(y, m - 1, d);
    const targetDate = new Date(startDate);
    targetDate.setDate(startDate.getDate() + (dayOfWeek - 2));
    const dayStr = String(targetDate.getDate()).padStart(2, '0');
    const monthStr = String(targetDate.getMonth() + 1).padStart(2, '0');
    const yearStr = targetDate.getFullYear();
    return {
      dateStr: `${yearStr}-${monthStr}-${dayStr}`,
      display: `${dayStr}/${monthStr}/${yearStr}`,
    };
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>📅</div>
          <div>
            <h1 className={styles.title}>
              Thời Khóa Biểu Lớp CQP 22
            </h1>
            <p className={styles.subtitle}>
              Trường Cao đẳng Truyền hình • Kế hoạch giảng dạy Kỳ 1 Năm học 2026 (Tuần 5 – Tuần 20)
            </p>
          </div>
        </div>

        <div className={styles.headerRight}>
          <Link href="/" className="btn btn-primary" id="btn-goto-checkin">
            ✅ Vào điểm danh
          </Link>
          <Link href="/admin" className="btn btn-secondary" id="btn-goto-admin">
            ⚙️ Quản trị
          </Link>
        </div>
      </header>

      {/* Today Banner */}
      <div className={styles.todayBanner}>
        <div>
          <div className={styles.todayBannerTitle}>
            <span>⚡ Lịch học hôm nay</span>
            {todayLessons.length > 0 && (
              <span style={{ background: '#22c55e', color: '#fff', fontSize: '0.68rem', padding: '1px 6px', borderRadius: 4 }}>
                Có {todayLessons.length} ca học
              </span>
            )}
          </div>
          <div className={styles.todayBannerDate}>
            {new Date().toLocaleDateString('vi-VN', {
              weekday: 'long',
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })}
          </div>
        </div>

        <div>
          {todayLessons.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: '0.9rem', fontStyle: 'italic' }}>
              🎉 Hôm nay lớp CQP 22 không có lịch học!
            </div>
          ) : (
            <div className={styles.todayLessonsList}>
              {todayLessons.map((lesson) => (
                <div key={lesson.id} className={styles.todayLessonChip}>
                  <span
                    className={`${styles.todayChipSession} ${
                      lesson.session === 'morning' ? styles.sessionMorning : styles.sessionAfternoon
                    }`}
                  >
                    {lesson.sessionLabel} • Tiết {lesson.periods}
                  </span>
                  <div>
                    <div className={styles.todayChipSubject}>
                      {lesson.icon} {lesson.subject}
                    </div>
                    <div className={styles.todayChipMeta}>
                      📍 P.{lesson.room} • 👨‍🏫 GV: {lesson.teacher}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Toolbar / Filters */}
      <div className={styles.toolbar}>
        <div className={styles.weekSelectorGroup}>
          <select
            className={styles.weekSelect}
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            id="select-week"
            title="Chọn nhanh tuần học"
          >
            <option value="all">🗓️ Toàn bộ kỳ học (Tuần 5 – Tuần 20)</option>
            {WEEKS_LIST.map((w) => (
              <option key={w.week} value={w.week}>
                Tuần {w.week}: {w.label}
              </option>
            ))}
          </select>

          <div className={styles.weekTabs}>
            <button
              className={`${styles.weekTab} ${selectedWeek === 'all' ? styles.weekTabActive : ''}`}
              onClick={() => setSelectedWeek('all')}
              id="tab-week-all"
            >
              Tất cả (16 tuần)
            </button>
            {WEEKS_LIST.map((w) => (
              <button
                key={w.week}
                className={`${styles.weekTab} ${selectedWeek === w.week ? styles.weekTabActive : ''}`}
                onClick={() => setSelectedWeek(w.week)}
                id={`tab-week-${w.week}`}
                title={w.label}
              >
                Tuần {w.week}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.toolbarRight}>
          <input
            type="text"
            className={`input ${styles.searchInput}`}
            placeholder="🔍 Tìm môn, phòng, GV..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div className={styles.viewSwitch}>
            <button
              className={`${styles.viewBtn} ${viewMode === 'grid' ? styles.viewBtnActive : ''}`}
              onClick={() => setViewMode('grid')}
              id="btn-view-grid"
              title="Xem dạng lưới thời khóa biểu"
            >
              📅 Lưới
            </button>
            <button
              className={`${styles.viewBtn} ${viewMode === 'table' ? styles.viewBtnActive : ''}`}
              onClick={() => setViewMode('table')}
              id="btn-view-table"
              title="Xem dạng bảng Excel chi tiết"
            >
              📋 Danh sách
            </button>
          </div>
        </div>
      </div>

      {/* ─── GRID VIEW ──────────────────────────────────────────────────────── */}
      {viewMode === 'grid' && (
        <div className={styles.gridContainer}>
          {displayWeeks.map((weekNum) => {
            const weekInfo = WEEKS_LIST.find((w) => w.week === weekNum);
            const weekDays = getDaysForWeek(weekNum);
            return (
              <div key={weekNum} className={styles.weekSection}>
                <div className={styles.weekHeader}>
                  <div className={styles.weekTitle}>
                    <span>📖 TUẦN {weekNum}</span>
                    <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 500 }}>
                      ({weekInfo?.label})
                    </span>
                  </div>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    Lớp hành chính: <strong>CQP22</strong>
                  </span>
                </div>

                <div
                  className={styles.daysGrid}
                  style={{ '--day-count': weekDays.length } as React.CSSProperties}
                >
                  {weekDays.map((day) => {
                    const lessons = getWeekDayLessons(weekNum, day.num);
                    const dayDate = getWeekDayDate(weekNum, day.num);
                    const isToday = dayDate.dateStr === todayStr;

                    return (
                      <div
                        key={day.num}
                        className={`${styles.dayColumn} ${isToday ? styles.dayColumnToday : ''}`}
                      >
                        <div className={styles.dayColHeader}>
                          <div>
                            <span className={styles.dayColName}>{day.label}</span>
                            {isToday && <span className={styles.dayColTodayBadge}>HÔM NAY</span>}
                          </div>
                          <span className={styles.dayColDate}>{dayDate.display}</span>
                        </div>

                        <div className={styles.dayColBody}>
                          {lessons.length === 0 ? (
                            <div className={styles.emptyDay}>
                              <span style={{ fontSize: '1.2rem', opacity: 0.5 }}>☕</span>
                              <span>Nghỉ cả ngày</span>
                            </div>
                          ) : (
                            lessons.map((l) => (
                              <div
                                key={l.id}
                                className={styles.lessonCard}
                                style={{ '--card-accent': l.badgeColor } as any}
                              >
                                <div className={styles.lessonTopRow}>
                                  <span
                                    className={`${styles.sessionBadge} ${
                                      l.session === 'morning' ? styles.sessionMorning : styles.sessionAfternoon
                                    }`}
                                  >
                                    {l.sessionLabel} • Tiết {l.periods}
                                  </span>
                                  <span className={styles.roomBadge}>
                                    P.{l.room}
                                  </span>
                                </div>

                                <div className={styles.lessonSubject}>
                                  <span>{l.icon}</span>
                                  <span>{l.subject}</span>
                                </div>

                                <div className={styles.lessonMetaGrid}>
                                  <div className={styles.lessonMetaItem}>
                                    <span>👨‍🏫</span>
                                    <span className={styles.teacherName}>{l.teacher}</span>
                                  </div>
                                  <div className={styles.lessonMetaItem}>
                                    <span>⏱️</span>
                                    <span>{l.periodCount} tiết • {l.format}</span>
                                  </div>
                                </div>

                                <div className={styles.lessonFooter}>
                                  <span>{l.credits} Tín chỉ</span>
                                  <span>Tổng: {l.totalPeriods} tiết</span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── TABLE VIEW (EXCEL FORMAT) ──────────────────────────────────────── */}
      {viewMode === 'table' && (
        <div className={styles.tableCard}>
          <div className={styles.tableScrollWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: 60, textAlign: 'center' }}>Tuần</th>
                  <th style={{ width: 70, textAlign: 'center' }}>Thứ</th>
                  <th style={{ width: 100 }}>Ngày</th>
                  <th>Lớp</th>
                  <th>Tên lớp tín chỉ / Môn học</th>
                  <th style={{ width: 60, textAlign: 'center' }}>Số TC</th>
                  <th style={{ width: 80, textAlign: 'center' }}>Tổng tiết</th>
                  <th style={{ width: 80 }}>Hình thức</th>
                  <th style={{ width: 90 }}>Phòng học</th>
                  <th style={{ width: 80 }}>Cặp tiết</th>
                  <th style={{ width: 80 }}>Buổi</th>
                  <th style={{ width: 65, textAlign: 'center' }}>Số tiết</th>
                  <th style={{ minWidth: 150 }}>Giảng viên</th>
                </tr>
              </thead>
              <tbody>
                {filteredLessons.map((l) => {
                  const isToday = l.date === todayStr;
                  return (
                    <tr key={l.id} className={isToday ? styles.tableTrToday : ''}>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#38bdf8' }}>
                        {l.week}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>
                        {l.dayLabel}
                      </td>
                      <td style={{ whiteSpace: 'nowrap', fontWeight: isToday ? 800 : 400 }}>
                        {l.dateDisplay} {isToday && '⭐'}
                      </td>
                      <td style={{ fontWeight: 600, color: '#94a3b8' }}>{l.classGroup}</td>
                      <td style={{ fontWeight: 700, color: '#fff' }}>
                        <span style={{ marginRight: 6 }}>{l.icon}</span>
                        {l.subject}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{l.credits}</td>
                      <td style={{ textAlign: 'center', color: '#94a3b8' }}>{l.totalPeriods}</td>
                      <td>
                        <span style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: 4, fontSize: '0.75rem' }}>
                          {l.format}
                        </span>
                      </td>
                      <td className={styles.roomCell}>P.{l.room}</td>
                      <td style={{ fontWeight: 600 }}>{l.periods}</td>
                      <td>
                        <span
                          className={`${styles.tablePill} ${
                            l.session === 'morning' ? styles.pillMorning : styles.pillAfternoon
                          }`}
                        >
                          {l.sessionLabel}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{l.periodCount}</td>
                      <td className={styles.teacherCell}>
                        👨‍🏫 {l.teacher}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
