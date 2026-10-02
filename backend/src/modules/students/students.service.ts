import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from '../../entities/student.entity';

/**
 * So sánh 2 họ tên tiếng Việt theo quy chuẩn:
 * - So sánh theo Tên (từ cuối cùng) trước
 * - Nếu Tên giống nhau, so sánh theo Họ và Tên đệm (các từ trước)
 * - Sử dụng locale 'vi' với collation chuẩn tiếng Việt (hỗ trợ đầy đủ dấu Ă, Â, Đ, Ê, Ô, Ơ, Ư...)
 */
export function compareVietnameseNames(nameA: string, nameB: string): number {
  const cleanA = (nameA || '').trim();
  const cleanB = (nameB || '').trim();

  const partsA = cleanA.split(/\s+/).filter(Boolean);
  const partsB = cleanB.split(/\s+/).filter(Boolean);

  const firstNameA = partsA.length > 0 ? partsA[partsA.length - 1] : '';
  const firstNameB = partsB.length > 0 ? partsB[partsB.length - 1] : '';

  // 1. So sánh Tên chính theo bảng chữ cái tiếng Việt
  const cmpFirstName = firstNameA.localeCompare(firstNameB, 'vi', { sensitivity: 'base' });
  if (cmpFirstName !== 0) {
    return cmpFirstName;
  }

  // 2. Nếu tên chính đồng âm khác dấu (ví dụ: An vs Ân), so sánh dấu chính xác
  const cmpFirstNameExact = firstNameA.localeCompare(firstNameB, 'vi', { sensitivity: 'accent' });
  if (cmpFirstNameExact !== 0) {
    return cmpFirstNameExact;
  }

  // 3. Nếu tên chính hoàn toàn giống nhau, so sánh họ và tên đệm đầy đủ
  return cleanA.localeCompare(cleanB, 'vi', { sensitivity: 'base' });
}

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(Student)
    private studentRepo: Repository<Student>,
  ) {}

  findAll(): Promise<Student[]> {
    return this.studentRepo.find({ order: { orderNum: 'ASC' } });
  }

  findOne(id: number): Promise<Student | null> {
    return this.studentRepo.findOneBy({ id });
  }

  /**
   * Sắp xếp lại toàn bộ danh sách sinh viên theo thứ tự bảng chữ cái tiếng Việt (theo vần)
   * và cập nhật lại STT (orderNum: 1, 2, 3...)
   */
  async reorderAll(): Promise<Student[]> {
    const all = await this.studentRepo.find();
    all.sort((a, b) => compareVietnameseNames(a.name, b.name));

    for (let i = 0; i < all.length; i++) {
      all[i].orderNum = i + 1;
    }

    await this.studentRepo.save(all);
    return this.studentRepo.find({ order: { orderNum: 'ASC' } });
  }

  async create(data: { name: string; dob?: string; orderNum?: number }): Promise<Student> {
    const student = this.studentRepo.create({
      name: data.name.trim(),
      dob: data.dob ? data.dob.trim() : undefined,
      orderNum: data.orderNum ? Number(data.orderNum) : 999,
    });

    const saved = await this.studentRepo.save(student);
    // Tự động sắp xếp lại danh sách theo vần sau khi thêm
    await this.reorderAll();

    const result = await this.studentRepo.findOneBy({ id: saved.id });
    return result || saved;
  }

  async update(id: number, data: Partial<{ name: string; dob: string; orderNum: number }>): Promise<Student> {
    const student = await this.studentRepo.findOneBy({ id });
    if (!student) throw new NotFoundException('Không tìm thấy sinh viên');

    const nameChanged = data.name !== undefined && data.name.trim() !== student.name;

    Object.assign(student, {
      ...data,
      name: data.name !== undefined ? data.name.trim() : student.name,
      dob: data.dob !== undefined ? data.dob.trim() : student.dob,
      orderNum: data.orderNum !== undefined ? Number(data.orderNum) : student.orderNum,
    });

    await this.studentRepo.save(student);

    // Nếu tên thay đổi, tự động sắp xếp lại theo vần
    if (nameChanged) {
      await this.reorderAll();
    }

    const updated = await this.studentRepo.findOneBy({ id });
    return updated || student;
  }

  async remove(id: number): Promise<void> {
    const student = await this.studentRepo.findOneBy({ id });
    if (!student) throw new NotFoundException('Không tìm thấy sinh viên');

    await this.studentRepo.delete(id);
    // Tự động cập nhật lại STT liên tục sau khi xóa
    await this.reorderAll();
  }
}
