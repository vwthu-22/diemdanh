import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from '../../entities/student.entity';

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

  async create(data: { name: string; dob?: string; orderNum: number }): Promise<Student> {
    const student = this.studentRepo.create(data);
    return this.studentRepo.save(student);
  }

  async update(id: number, data: Partial<{ name: string; dob: string; orderNum: number }>): Promise<Student> {
    const student = await this.studentRepo.findOneBy({ id });
    if (!student) throw new NotFoundException('Không tìm thấy sinh viên');
    Object.assign(student, data);
    return this.studentRepo.save(student);
  }

  async remove(id: number): Promise<void> {
    const student = await this.studentRepo.findOneBy({ id });
    if (!student) throw new NotFoundException('Không tìm thấy sinh viên');
    await this.studentRepo.delete(id);
  }
}
