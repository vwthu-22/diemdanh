'use client';
import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { SCHEDULE_DATA, WEEKS_LIST, ScheduleLesson, getLessonsByDate } from '@/data/schedule';
import styles from './schedule.module.css';

export default function SchedulePage() {
  const todayStr = useMemo(() => new Date().toLocaleDateString('en-CA'), []);
  const todayLessons = useMemo(() => getLessonsByDate(todayStr), [todayStr]);

  // Xác định tuần hiện tại dựa trên ngày hôm nay (mặc định Tuần 5)
  const currentWeekNumber = useMemo(() => {
    const found = WEEKS_LIST.find((w) => todayStr >= w.from && todayStr <= w.to);
    return found ? found.week : 5;
  }, [todayStr]);

  const [selectedWeek, setSelectedWeek] = useState<number | 'all'>(5);
  const [selectedDay, setSelectedDay] = useState<number | 'all'>('all'); // Filter theo thứ 2..7 hoặc 'all'
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [searchQuery, setSearchQuery] = useState('');

  // Set default week to current week on mount
  useEffect(() => {
    setSelectedWeek(currentWeekNumber);
  }, [currentWeekNumber]);

  // Danh sách các tuần cần hiển thị
  const displayWeeks = useMemo(() => {
    if (selectedWeek === 'all') return WEEKS_LIST.map((w) => w.week);
    return [selectedWeek];
  }, [selectedWeek]);

  // Lessons đã lọc theo search query & week
  const filteredLessons = useMemo(() => {
    return SCHEDULE_DATA.filter((lesson) => {
      const matchWeek = selectedWeek === 'all' || lesson.week === selectedWeek;
      const matchDay = selectedDay === 'all' || lesson.dayOfWeek === selectedDay;
      const matchSearch =
        !searchQuery ||
        lesson.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lesson.teacher.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lesson.room.toLowerCase().includes(searchQuery.toLowerCase());
      return matchWeek && matchDay && matchSearch;
    });
  }, [selectedWeek, selectedDay, searchQuery]);

  // Navigation chuyển nhanh giữa các tuần
  const handlePrevWeek = () => {
    if (selectedWeek === 'all') {
      setSelectedWeek(20);
    } else if (selectedWeek > 5) {
      setSelectedWeek(selectedWeek - 1);
    }
  };

  const handleNextWeek = () => {
    if (selectedWeek === 'all') {
      setSelectedWeek(5);
    } else if (selectedWeek < 20) {
      setSelectedWeek(selectedWeek + 1);
    }
  };

  // Lấy các ngày trong tuần (Thứ 2 - Thứ 6 hoặc Thứ 7 nếu có lịch)
  const getDaysForWeek = (weekNum: number) => {
    const hasSat = SCHEDULE_DATA.some((l) => l.week === weekNum && l.dayOfWeek === 7);
    const base = [
      { num: 2, label: 'Thứ 2', short: 'T2' },
      { num: 3, label: 'Thứ 3', short: 'T3' },
      { num: 4, label: 'Thứ 4', short: 'T4' },
      { num: 5, label: 'Thứ 5', short: 'T5' },
      { num: 6, label: 'Thứ 6', short: 'T6' },
    ];
    if (hasSat) {
      base.push({ num: 7, label: 'Thứ 7', short: 'T7' });
    }
    if (selectedDay !== 'all') {
      return base.filter((d) => d.num === selectedDay);
    }
    return base;
  };

  // Group lessons theo tuần và thứ
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

  // Lấy ngày tháng thực tế của từng ngày trong tuần
  const getWeekDayDate = (weekNum: number, dayOfWeek: number) => {
    const lesson = SCHEDULE_DATA.find((l) => l.week === weekNum && l.dayOfWeek === dayOfWeek);
    if (lesson) return { dateStr: lesson.date, display: lesson.dateDisplay };

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

  // Thống kê nhanh tuần đang chọn
  const currentWeekInfo = useMemo(() => {
    if (selectedWeek === 'all') return null;
    return WEEKS_LIST.find((w) => w.week === selectedWeek);
  }, [selectedWeek]);

  return (
    <div className={styles.page}>
      {/* Header gọn gàng, tối ưu mobile */}
      <header className={styles.header}>
        <div className={styles.headerInfo}>
          <h1 className={styles.title}>Thời Khóa Biểu CQP22</h1>
          <div className={styles.headerBadge}>Kỳ 1 • Năm học 2026</div>
        </div>
      </header>

      {/* Banner Hôm nay (nếu có tiết hoặc không có tiết) */}
      <div className={styles.todayBanner}>
        <div className={styles.todayBannerLeft}>
          <div className={styles.todayBannerTitle}>
            <span>Lịch học hôm nay</span>
            {todayLessons.length > 0 ? (
              <span className={styles.todayCountBadge}>
                {todayLessons.length} ca học
              </span>
            ) : (
              <span className={styles.todayRestBadge}>Nghỉ</span>
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

        <div className={styles.todayBannerRight}>
          {todayLessons.length === 0 ? (
            <div className={styles.todayNoLesson}>
              Hôm nay lớp CQP 22 không có lịch học!
            </div>
          ) : (
            <div className={styles.todayLessonsList}>
              {todayLessons.map((lesson) => (
                <div key={lesson.id} className={styles.todayLessonChip}>
                  <div className={styles.todayChipTop}>
                    <span
                      className={`${styles.todayChipSession} ${lesson.session === 'morning' ? styles.sessionMorning : styles.sessionAfternoon
                        }`}
                    >
                      {lesson.sessionLabel} • Tiết {lesson.periods}
                    </span>
                    <span className={styles.todayChipRoom}>P.{lesson.room}</span>
                  </div>
                  <div className={styles.todayChipSubject}>{lesson.subject}</div>
                  <div className={styles.todayChipMeta}>GV: {lesson.teacher}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Week Navigator & Controller Bar */}
      <div className={styles.weekNavCard}>
        <div className={styles.weekNavMain}>
          <button
            type="button"
            className={styles.weekNavBtn}
            onClick={handlePrevWeek}
            disabled={selectedWeek === 5}
            title="Xem tuần trước"
          >
            ← 
          </button>

          <div className={styles.weekSelectorCenter}>
            <select
              className={styles.weekSelect}
              value={selectedWeek}
              onChange={(e) => {
                setSelectedWeek(e.target.value === 'all' ? 'all' : Number(e.target.value));
                setSelectedDay('all'); // Reset day filter
              }}
              id="select-week"
            >
              <option value="all">Toàn bộ kỳ (Tuần 5 – 20)</option>
              {WEEKS_LIST.map((w) => (
                <option key={w.week} value={w.week}>
                  {w.label}
                </option>
              ))}
            </select>

            {selectedWeek !== 'all' && currentWeekInfo && (
              <div className={styles.weekDateRange}>
                {currentWeekInfo.from.split('-').reverse().slice(0, 2).join('/')} – {currentWeekInfo.to.split('-').reverse().slice(0, 2).join('/')}
              </div>
            )}
          </div>

          <button
            type="button"
            className={styles.weekNavBtn}
            onClick={handleNextWeek}
            disabled={selectedWeek === 20}
            title="Xem tuần tiếp theo"
          >
             →
          </button>
        </div>

        {/* Horizontal Week Pill Tabs */}
        <div className={styles.weekPillsScroll}>
          <button
            className={`${styles.weekPill} ${selectedWeek === 'all' ? styles.weekPillActive : ''}`}
            onClick={() => {
              setSelectedWeek('all');
              setSelectedDay('all');
            }}
          >
            Tất cả
          </button>
          {WEEKS_LIST.map((w) => (
            <button
              key={w.week}
              className={`${styles.weekPill} ${selectedWeek === w.week ? styles.weekPillActive : ''} ${w.week === currentWeekNumber ? styles.weekPillCurrent : ''
                }`}
              onClick={() => {
                setSelectedWeek(w.week);
                setSelectedDay('all');
              }}
            >
              Tuần {w.week}
              {w.week === currentWeekNumber && <span className={styles.dotCurrent} />}
            </button>
          ))}
        </div>
      </div>

      {/* Secondary Search & View Mode Switcher */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <input
            type="text"
            className={`input ${styles.searchInput}`}
            placeholder="Tìm môn học, giảng viên, phòng..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className={styles.searchClearBtn}
              onClick={() => setSearchQuery('')}
            >
              ×
            </button>
          )}
        </div>

        <div className={styles.viewSwitch}>
          <button
            className={`${styles.viewBtn} ${viewMode === 'grid' ? styles.viewBtnActive : ''}`}
            onClick={() => setViewMode('grid')}
            id="btn-view-grid"
          >
            Lưới
          </button>
          <button
            className={`${styles.viewBtn} ${viewMode === 'table' ? styles.viewBtnActive : ''}`}
            onClick={() => setViewMode('table')}
            id="btn-view-table"
          >
            Danh sách ({filteredLessons.length})
          </button>
        </div>
      </div>

      {/* ─── GRID VIEW ──────────────────────────────────────────────────────── */}
      {viewMode === 'grid' && (
        <div className={styles.gridContainer}>
          {displayWeeks.map((weekNum) => {
            const weekInfo = WEEKS_LIST.find((w) => w.week === weekNum);
            const weekDays = getDaysForWeek(weekNum);
            const totalWeekLessons = SCHEDULE_DATA.filter((l) => l.week === weekNum).length;

            return (
              <div key={weekNum} className={styles.weekSection}>
                <div className={styles.weekHeader}>
                  <div className={styles.weekTitle}>
                    <span className={styles.weekNumberBadge}>TUẦN {weekNum}</span>
                    <span className={styles.weekDateSub}>
                      ({weekInfo?.label})
                    </span>
                  </div>
                  <span className={styles.weekLessonCount}>
                    {totalWeekLessons} ca học
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
                          <div className={styles.dayColHeaderLeft}>
                            <span className={styles.dayColName}>{day.label}</span>
                            {isToday && <span className={styles.dayColTodayBadge}>HÔM NAY</span>}
                          </div>
                          <span className={styles.dayColDate}>{dayDate.display}</span>
                        </div>

                        <div className={styles.dayColBody}>
                          {lessons.length === 0 ? (
                            <div className={styles.emptyDay}>
                              <span>Nghỉ</span>
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
                                    className={`${styles.sessionBadge} ${l.session === 'morning' ? styles.sessionMorning : styles.sessionAfternoon
                                      }`}
                                  >
                                    {l.sessionLabel} • Tiết {l.periods}
                                  </span>
                                  <span className={styles.roomBadge}>
                                    P.{l.room}
                                  </span>
                                </div>

                                <div className={styles.lessonSubject}>
                                  {l.subject}
                                </div>

                                <div className={styles.lessonMetaGrid}>
                                  <div className={styles.lessonMetaItem}>
                                    <span className={styles.metaLabel}>GV:</span>
                                    <span className={styles.teacherName}>{l.teacher}</span>
                                  </div>
                                  <div className={styles.lessonMetaItem}>
                                    <span className={styles.metaLabel}>Thời lượng:</span>
                                    <span>{l.periodCount} tiết ({l.format})</span>
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

      {/* ─── TABLE VIEW ─────────────────────────────────────────────────────── */}
      {viewMode === 'table' && (
        <div className={styles.tableCard}>
          <div className={styles.tableScrollWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: 60, textAlign: 'center' }}>Tuần</th>
                  <th style={{ width: 70, textAlign: 'center' }}>Thứ</th>
                  <th style={{ width: 95 }}>Ngày</th>
                  <th>Tên môn học / Tín chỉ</th>
                  <th style={{ width: 85 }}>Phòng</th>
                  <th style={{ width: 80 }}>Buổi</th>
                  <th style={{ width: 75 }}>Tiết</th>
                  <th style={{ minWidth: 140 }}>Giảng viên</th>
                </tr>
              </thead>
              <tbody>
                {filteredLessons.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: 'var(--color-text-muted)' }}>
                      Không tìm thấy ca học nào phù hợp với bộ lọc!
                    </td>
                  </tr>
                ) : (
                  filteredLessons.map((l) => {
                    const isToday = l.date === todayStr;
                    return (
                      <tr key={l.id} className={isToday ? styles.tableTrToday : ''}>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: '#38bdf8' }}>
                          T{l.week}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>
                          {l.dayLabel}
                        </td>
                        <td style={{ whiteSpace: 'nowrap', fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--color-primary-light)' : 'inherit' }}>
                          {l.dateDisplay}
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.9rem' }}>{l.subject}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                            {l.credits} TC • {l.periodCount} tiết ({l.format})
                          </div>
                        </td>
                        <td className={styles.roomCell}>P.{l.room}</td>
                        <td>
                          <span
                            className={`${styles.tablePill} ${l.session === 'morning' ? styles.pillMorning : styles.pillAfternoon
                              }`}
                          >
                            {l.sessionLabel}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>Tiết {l.periods}</td>
                        <td className={styles.teacherCell}>
                          {l.teacher}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bottom Sticky Navigation Bar */}
      <footer className={styles.bottomBar}>
        <div className={styles.bottomBarInner}>
          <Link
            href="/"
            className={styles.bottomNavBtn}
            id="btn-footer-checkin"
          >
            <span>Điểm danh</span>
          </Link>
          <Link
            href="/schedule"
            className={`${styles.bottomNavBtn} ${styles.bottomNavBtnActive}`}
            id="btn-footer-schedule"
          >
            <span>Thời khóa biểu</span>
          </Link>
        </div>
      </footer>
    </div>
  );
}
