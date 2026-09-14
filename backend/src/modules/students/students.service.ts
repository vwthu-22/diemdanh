import { Injectable } from '@nestjs/common';
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
}
