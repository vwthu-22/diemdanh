'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import styles from './about.module.css';

const QUICK_SEARCH_CHIPS = [
  { label: 'Tất cả', query: '' },
  { label: 'Thầy Nguyễn Xuân Miên', query: 'Nguyễn Xuân Miên' },
  { label: 'Lớp CQP22', query: 'CQP22' },
  { label: 'TS. Trần Tiến', query: 'Trần Tiến' },
  { label: 'TS. Nguyễn Minh Hải', query: 'Nguyễn Minh Hải' },
  { label: 'Khoa Báo chí & Quay phim', query: 'Báo chí' },
  { label: 'Trung tâm & Phòng ban', query: 'Phòng' },
];

export default function AboutPage() {
  const [searchTerm, setSearchTerm] = useState('');

  const departments = useMemo(() => [
    {
      dept: 'Khoa Báo chí - Truyền thông & Quay phim',
      members: [
        { role: 'Trưởng khoa', name: 'ThS. Phạm Thanh Huyền' },
        { role: 'Phó Trưởng khoa', name: 'ThS. Trần Doanh Trung' },
        { role: 'Phó Trưởng khoa', name: 'ThS. Trương Thị Tuyên' },
      ],
    },
    {
      dept: 'Phòng Đảm bảo chất lượng & Hợp tác phát triển',
      members: [
        { role: 'Trưởng phòng', name: 'Nguyễn Thị Thanh Bình' },
        { role: 'Phó Trưởng phòng', name: 'Trần Tuấn Anh' },
      ],
    },
    {
      dept: 'Phòng Công tác Học sinh Sinh viên',
      members: [
        { role: 'Trưởng phòng', name: 'Dương Tấn Anh' },
        { role: 'Phó Trưởng phòng', name: 'Bùi Minh Tuân, Nguyễn Tiến Thành' },
      ],
    },
    {
      dept: 'Phòng Tổng hợp',
      members: [
        { role: 'Phó Trưởng phòng', name: 'Nguyễn Anh Tú, Phan Thu Phương' },
      ],
    },
    {
      dept: 'Trung tâm Thực hành & Ứng dụng Công nghệ',
      members: [
        { role: 'Giám đốc', name: 'Vũ Mạnh Thắng' },
        { role: 'Phó Giám đốc', name: 'Nguyễn Tuấn Khanh' },
      ],
    },
    {
      dept: 'Trung tâm Bồi dưỡng & Đào tạo Nâng cao',
      members: [
        { role: 'Phó Giám đốc', name: 'Nguyễn Huy Hoàng, Phan Thùy Linh, Nguyễn Thị Mai Hương, Đỗ Hoàng Hiền, Nguyễn Xuân Quang' },
      ],
    },
  ], []);

  // Normalize string for Vietnamese searching without accent sensitivity
  const normalize = (str: string) => {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .trim();
  };

  const q = normalize(searchTerm);

  // Filter sections based on search query
  const matchHero = !q || normalize('Truong Cao dang Truyen hinh VTV College 70 nam Dai Truyen hinh Viet Nam Hoc that Lam that Viec that toan soan truong quay').includes(q);
  const matchClass = !q || normalize('Lop CQP22 Khoa 22 Chuyen nganh Quay phim tan sinh vien nghe thuat thi giac dung phim AI Video Creation MV cua toi 2026').includes(q);
  const matchTeacher = !q || normalize('Thay Nguyen Xuan Mien giang vien chu nhiem lop CQP22 Khoa Bao chi Truyen thong Quay phim Nghe thuat Quay phim 1 2 Ngay hoi viec lam MV cua toi 2026 Thanh xuan VTVCollege').includes(q);
  const matchLeaders = !q || normalize('Ban Giam Hieu Hieu truong TS Tran Tien Bi thu Dang uy TS Nguyen Minh Hai Chu tich Hoi dong truong Pho Hieu truong').includes(q);

  const filteredDepts = useMemo(() => {
    if (!q) return departments;
    return departments
      .map((d) => {
        const deptMatches = normalize(d.dept).includes(q);
        const matchedMembers = d.members.filter((m) =>
          normalize(m.name).includes(q) || normalize(m.role).includes(q)
        );
        if (deptMatches) return d;
        if (matchedMembers.length > 0) return { ...d, members: matchedMembers };
        return null;
      })
      .filter(Boolean) as typeof departments;
  }, [departments, q]);

  const totalResults = (matchHero ? 1 : 0) + (matchClass ? 1 : 0) + (matchTeacher ? 1 : 0) + (matchLeaders ? 1 : 0) + filteredDepts.length;

  return (
    <div className={styles.container}>
      <main className={styles.contentWrapper}>
        {/* ─── Search Bar Sticky ─── */}
        <div className={styles.searchSection}>
          <div className={styles.searchBarWrapper}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Tìm kiếm: Thầy Miên, Lớp CQP22, TS. Trần Tiến, Quay phim, Khoa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              id="about-search-input"
            />
            {searchTerm && (
              <button
                type="button"
                className={styles.clearSearchBtn}
                onClick={() => setSearchTerm('')}
                title="Xóa tìm kiếm"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Search Tags */}
          <div className={styles.quickTagsScroll}>
            {QUICK_SEARCH_CHIPS.map((chip) => {
              const isActive = searchTerm.toLowerCase() === chip.query.toLowerCase() || (!searchTerm && !chip.query);
              return (
                <button
                  key={chip.label}
                  type="button"
                  className={`${styles.quickTag} ${isActive ? styles.quickTagActive : ''}`}
                  onClick={() => setSearchTerm(chip.query)}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>

          {searchTerm && (
            <div className={styles.searchMeta}>
              <span>Kết quả cho &ldquo;{searchTerm}&rdquo;:</span>
              <span className={styles.searchMetaCount}>{totalResults} mục phù hợp</span>
            </div>
          )}
        </div>

        {totalResults === 0 && (
          <div className={styles.emptySearch}>
            <div className={styles.emptySearchTitle}>Không tìm thấy kết quả phù hợp</div>
            <p>Không có nội dung nào khớp với từ khóa &ldquo;{searchTerm}&rdquo;.</p>
            <button
              type="button"
              className={styles.resetBtn}
              onClick={() => setSearchTerm('')}
            >
              Xem tất cả thông tin
            </button>
          </div>
        )}

        {/* ─── Hero Header ─── */}
        {matchHero && (
          <section className={styles.heroCard}>
            <div className={styles.badgeVTV}>ĐÀI TRUYỀN HÌNH VIỆT NAM • VTV</div>
            <h1 className={styles.schoolTitle}>TRƯỜNG CAO ĐẲNG TRUYỀN HÌNH</h1>
            <div className={styles.schoolSub}>VTV College — Nơi Khởi Đầu Của Những Nhà Truyền Thông Thực Chiến</div>
            <div className={styles.anniversaryBadge}>
              Kỷ niệm 70 năm thành lập (10/03/1956 – 10/03/2026)
            </div>

            <div className={styles.mottoBox}>
              <div>
                <span className={styles.mottoHighlight}>Triết lý đào tạo:</span> &ldquo;Học thật – Làm thật – Việc thật&rdquo;. Biến không gian giảng đường thành tòa soạn và trường quay chuyên nghiệp chuẩn quốc gia.
              </div>
            </div>
          </section>
        )}

        {/* ─── Lớp CQP22 Spotlight ─── */}
        {matchClass && (
          <section className={styles.classCard}>
            <div className={styles.classBadge}>LỚP CQP22 • KHÓA 22</div>
            <h2 className={styles.sectionTitle} style={{ marginBottom: 8, fontSize: '1.25rem' }}>
              Chuyên ngành Quay phim – Lớp CQP22
            </h2>
            <p className={styles.classDesc}>
              Lớp <strong>CQP22</strong> quy tụ những tân sinh viên năng động, đam mê nghệ thuật thị giác và công nghệ ghi hình hiện đại. Được đào tạo theo chuẩn thực chiến của Đài Truyền hình Việt Nam, sinh viên lớp CQP22 luôn tiên phong trong các dự án sản xuất video, phóng sự, MV ca nhạc và ứng dụng trí tuệ nhân tạo (AI) trong sáng tạo nghệ thuật.
            </p>
            <div className={styles.tagGrid}>
              <span className={styles.tagItem}>🎥 Nghệ thuật Quay phim</span>
              <span className={styles.tagItem}>🎬 Kỹ xảo & Dựng phim</span>
              <span className={styles.tagItem}>🤖 AI Video Creation</span>
              <span className={styles.tagItem}>🏆 MV của tôi 2026</span>
            </div>
          </section>
        )}

        {/* ─── Thầy Chủ Nhiệm Nguyễn Xuân Miên ─── */}
        {matchTeacher && (
          <section className={styles.teacherSpotlight}>
            <div className={styles.teacherBadge}>GIẢNG VIÊN & THẦY CHỦ NHIỆM LỚP CQP22</div>
            <h2 className={styles.teacherName}>Thầy Nguyễn Xuân Miên</h2>
            <div className={styles.teacherTitle}>
              Giảng viên cơ hữu chủ chốt • Khoa Báo chí - Truyền thông & Quay phim
            </div>

            <div className={styles.featureList}>
              <div className={styles.featureItem}>
                <div className={styles.featureIcon}>📚</div>
                <div className={styles.featureText}>
                  <strong>Học phần chuyên môn cốt lõi:</strong> Trực tiếp phụ trách giảng dạy môn <em>&ldquo;Nghệ thuật Quay phim 1&rdquo;</em> và <em>&ldquo;Nghệ thuật Quay phim 2&rdquo;</em>. Phong cách giảng dạy đề cao tính thực chiến tại phim trường ngoại cảnh và trường quay chuyên nghiệp.
                </div>
              </div>

              <div className={styles.featureItem}>
                <div className={styles.featureIcon}>💼</div>
                <div className={styles.featureText}>
                  <strong>Định hướng nghề nghiệp:</strong> Người trực tiếp điều phối sự kiện <em>&ldquo;Ngày hội việc làm VTV College&rdquo;</em> quy mô lớn, kết nối sinh viên với các đài truyền hình, cơ quan báo chí và doanh nghiệp truyền thông hàng đầu.
                </div>
              </div>

              <div className={styles.featureItem}>
                <div className={styles.featureIcon}>🌟</div>
                <div className={styles.featureText}>
                  <strong>Truyền lửa sáng tạo & Công nghệ AI:</strong> Khởi xướng cuộc thi chuyên nghiệp <em>&ldquo;MV của tôi 2026&rdquo;</em> với chủ đề <em>&ldquo;Thanh xuân VTVCollege&rdquo;</em>, tạo bệ phóng để sinh viên Quay phim ứng dụng công cụ AI vào phát triển kịch bản và hoàn thiện kỹ xảo hình ảnh.
                </div>
              </div>

              <div className={styles.featureItem}>
                <div className={styles.featureIcon}>✍️</div>
                <div className={styles.featureText}>
                  <strong>Tâm huyết sư phạm:</strong> Tác giả nhiều bài viết, báo cáo chuyên môn phản ánh sâu sắc không khí học tập, hoạt động trải nghiệm thực tế và văn hóa nhà trường trên các cổng thông tin truyền thông chính thống.
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ─── Ban Giám Hiệu ─── */}
        {matchLeaders && (
          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}>🏛️</div>
              <div>
                <h2 className={styles.sectionTitle}>Ban Giám Hiệu & Lãnh Đạo Nhà Trường</h2>
                <div className={styles.sectionSubtitle}>Dẫn dắt chiến lược phát triển VTV College</div>
              </div>
            </div>

            <div className={styles.leaderGrid}>
              <div className={styles.leaderCard}>
                <div className={styles.leaderTop}>
                  <div className={styles.leaderName}>TS. Trần Tiến</div>
                  <div className={styles.leaderRole}>Bí thư Đảng ủy • Hiệu trưởng</div>
                </div>
                <p className={styles.leaderDesc}>
                  Sinh năm 1973 tại Nam Định, nguyên là học sinh xuất sắc của trường và không ngừng phấn đấu cống hiến. Được Tổng Giám đốc Đài Truyền hình Việt Nam bổ nhiệm ngày 04/09/2024. Triết lý quản trị: Đổi mới, thấu hiểu, sẻ chia, lấy năng lực <em>&ldquo;thực làm – thực việc&rdquo;</em> làm trọng tâm phát triển nguồn nhân lực.
                </p>
              </div>

              <div className={styles.leaderCard}>
                <div className={styles.leaderTop}>
                  <div className={styles.leaderName}>TS. Nguyễn Minh Hải</div>
                  <div className={styles.leaderRole}>Phó Bí thư Đảng ủy • Chủ tịch Hội đồng trường • Phó Hiệu trưởng</div>
                </div>
                <p className={styles.leaderDesc}>
                  Trực tiếp chỉ đạo công tác đảm bảo chất lượng đào tạo, phong trào công đoàn, hoạt động nghệ thuật và kiến tạo khuôn khổ pháp lý, chiến lược phát triển bền vững của nhà trường.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* ─── Cơ Cấu Tổ Chức & Khoa Phòng ─── */}
        {filteredDepts.length > 0 && (
          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}>📋</div>
              <div>
                <h2 className={styles.sectionTitle}>Cơ Cấu Tổ Chức & Đơn Vị Chuyên Môn</h2>
                <div className={styles.sectionSubtitle}>Hệ thống khoa, phòng ban và trung tâm trực thuộc</div>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className={styles.orgTable}>
                <thead>
                  <tr>
                    <th style={{ width: '45%' }}>Đơn vị chuyên môn / Hành chính</th>
                    <th style={{ width: '55%' }}>Cán bộ đảm nhiệm</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDepts.map((d, i) => (
                    <tr key={i}>
                      <td className={styles.deptName}>{d.dept}</td>
                      <td>
                        {d.members.map((m, j) => (
                          <div key={j} style={{ marginBottom: j < d.members.length - 1 ? 4 : 0 }}>
                            <span className={styles.roleTag}>{m.role}</span>
                            <span className={styles.staffName}>{m.name}</span>
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      {/* ─── Bottom Navigation Bar ─── */}
      <footer className={styles.bottomBar}>
        <div className={styles.bottomBarInner}>
          <Link href="/" className={styles.bottomNavBtn} id="btn-footer-checkin">
            <span>Điểm danh</span>
          </Link>
          <Link href="/schedule" className={styles.bottomNavBtn} id="btn-footer-schedule">
            <span>Thời khóa biểu</span>
          </Link>
          <Link href="/about" className={`${styles.bottomNavBtn} ${styles.bottomNavBtnActive}`} id="btn-footer-about">
            <span>Về chúng tôi</span>
          </Link>
        </div>
      </footer>
    </div>
  );
}
