'use client';
import { useState, useEffect, useCallback } from 'react';
import styles from './students.module.css';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://diemdanh-m37h.onrender.com/api';

interface Student {
  id: number;
  orderNum: number;
  name: string;
  dob: string;
}

interface EditForm {
  name: string;
  dob: string;
  orderNum: string;
}

const emptyForm: EditForm = { name: '', dob: '', orderNum: '' };

export default function StudentsAdminPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(emptyForm);
  const [addForm, setAddForm] = useState<EditForm>(emptyForm);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getToken = () => localStorage.getItem('admin_token') || '';

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/students`, { cache: 'no-store' });
      const data = await res.json();
      setStudents(data);
    } catch {
      showToast('Lỗi tải danh sách sinh viên', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    String(s.orderNum).includes(search)
  );

  const startEdit = (s: Student) => {
    setEditingId(s.id);
    setEditForm({ name: s.name, dob: s.dob || '', orderNum: String(s.orderNum) });
    setShowAddForm(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(emptyForm);
  };

  const saveEdit = async (id: number) => {
    if (!editForm.name.trim()) { showToast('Họ tên không được để trống', 'error'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/students/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          name: editForm.name.trim(),
          dob: editForm.dob.trim(),
          orderNum: Number(editForm.orderNum),
        }),
      });
      if (!res.ok) throw new Error();
      showToast('Cập nhật thành công');
      setEditingId(null);
      await fetchStudents();
    } catch {
      showToast('Lỗi cập nhật', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Xóa sinh viên "${name}"?\nTất cả dữ liệu điểm danh của sinh viên này cũng sẽ bị xóa.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${API}/students/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error();
      showToast(`Đã xóa sinh viên "${name}"`);
      await fetchStudents();
    } catch {
      showToast('Lỗi xóa sinh viên', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleAdd = async () => {
    if (!addForm.name.trim()) { showToast('Họ tên không được để trống', 'error'); return; }
    if (!addForm.orderNum || isNaN(Number(addForm.orderNum))) { showToast('STT phải là số', 'error'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/students`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          name: addForm.name.trim(),
          dob: addForm.dob.trim(),
          orderNum: Number(addForm.orderNum),
        }),
      });
      if (!res.ok) throw new Error();
      showToast('Thêm sinh viên thành công');
      setAddForm(emptyForm);
      setShowAddForm(false);
      await fetchStudents();
    } catch {
      showToast('Lỗi thêm sinh viên', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      {/* Toast */}
      {toast && (
        <div className={`${styles.toast} ${toast.type === 'error' ? styles.toastError : styles.toastSuccess}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Danh sách thành viên</h1>
          <p className={styles.subtitle}>Quản lý, chỉnh sửa thông tin sinh viên CQP 22</p>
        </div>
        <button
          className={styles.addBtn}
          id="btn-add-student"
          onClick={() => { setShowAddForm(v => !v); setEditingId(null); }}
        >
          {showAddForm ? 'Hủy thêm' : 'Thêm sinh viên'}
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className={styles.addCard}>
          <h3 className={styles.addCardTitle}>Thêm sinh viên mới</h3>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.label}>STT</label>
              <input
                id="add-orderNum"
                className={styles.input}
                type="number"
                placeholder="VD: 33"
                value={addForm.orderNum}
                onChange={e => setAddForm(f => ({ ...f, orderNum: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Họ và tên</label>
              <input
                id="add-name"
                className={styles.input}
                placeholder="Nguyễn Văn A"
                value={addForm.name}
                onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Ngày sinh</label>
              <input
                id="add-dob"
                className={styles.input}
                placeholder="DD/MM/YYYY"
                value={addForm.dob}
                onChange={e => setAddForm(f => ({ ...f, dob: e.target.value }))}
              />
            </div>
          </div>
          <div className={styles.addActions}>
            <button className={styles.saveBtn} id="btn-confirm-add" onClick={handleAdd} disabled={saving}>
              {saving ? 'Đang lưu...' : 'Xác nhận thêm'}
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className={styles.searchBar}>
        <input
          id="search-student"
          className={styles.searchInput}
          placeholder="Tìm kiếm tên, STT..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span className={styles.searchCount}>{filtered.length} sinh viên</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className={styles.loadingBox}>Đang tải...</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th} style={{ width: 52 }}>STT</th>
                <th className={styles.th}>Họ và tên</th>
                <th className={styles.th}>Ngày sinh</th>
                <th className={styles.th} style={{ width: 160 }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} className={`${styles.tr} ${editingId === s.id ? styles.trEditing : ''}`}>
                  {editingId === s.id ? (
                    <>
                      <td className={styles.td}>
                        <input
                          id={`edit-orderNum-${s.id}`}
                          className={styles.inlineInput}
                          type="number"
                          value={editForm.orderNum}
                          onChange={e => setEditForm(f => ({ ...f, orderNum: e.target.value }))}
                        />
                      </td>
                      <td className={styles.td}>
                        <input
                          id={`edit-name-${s.id}`}
                          className={styles.inlineInput}
                          value={editForm.name}
                          onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                        />
                      </td>
                      <td className={styles.td}>
                        <input
                          id={`edit-dob-${s.id}`}
                          className={styles.inlineInput}
                          placeholder="DD/MM/YYYY"
                          value={editForm.dob}
                          onChange={e => setEditForm(f => ({ ...f, dob: e.target.value }))}
                        />
                      </td>
                      <td className={styles.td}>
                        <div className={styles.actions}>
                          <button
                            className={styles.confirmBtn}
                            id={`btn-save-${s.id}`}
                            onClick={() => saveEdit(s.id)}
                            disabled={saving}
                          >
                            {saving ? '...' : 'Lưu'}
                          </button>
                          <button className={styles.cancelBtn} id={`btn-cancel-${s.id}`} onClick={cancelEdit}>
                            Hủy
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className={styles.td}><span className={styles.orderNum}>{s.orderNum}</span></td>
                      <td className={styles.td}><span className={styles.studentName}>{s.name}</span></td>
                      <td className={styles.td}><span className={styles.dob}>{s.dob || '—'}</span></td>
                      <td className={styles.td}>
                        <div className={styles.actions}>
                          <button
                            className={styles.editBtn}
                            id={`btn-edit-${s.id}`}
                            onClick={() => startEdit(s)}
                          >
                            Sửa
                          </button>
                          <button
                            className={styles.deleteBtn}
                            id={`btn-delete-${s.id}`}
                            onClick={() => handleDelete(s.id, s.name)}
                            disabled={deletingId === s.id}
                          >
                            {deletingId === s.id ? '...' : 'Xóa'}
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className={styles.empty}>Không tìm thấy sinh viên nào</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
