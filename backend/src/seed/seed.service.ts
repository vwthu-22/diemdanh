import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from '../entities/student.entity';
import { Settings } from '../entities/settings.entity';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';

const STUDENTS = [
  { orderNum: 1, name: 'Đoàn Ngọc Khánh An', dob: '07/12/2007' },
  { orderNum: 2, name: 'Đào Ngọc Chung', dob: '03/06/2007' },
  { orderNum: 3, name: 'Nguyễn Tiến Đạt', dob: '22/04/2008' },
  { orderNum: 4, name: 'Nguyễn Quốc Đạt', dob: '06/11/2008' },
  { orderNum: 5, name: 'Trần Việt Dũng', dob: '14/03/2008' },
  { orderNum: 6, name: 'Lê Văn Tuấn Dũng', dob: '01/07/2006' },
  { orderNum: 7, name: 'Bùi Tùng Dương', dob: '01/03/2008' },
  { orderNum: 8, name: 'Phan Lê Hà Duy', dob: '27/09/2008' },
  { orderNum: 9, name: 'Nguyễn Đức Hoàng Hiệp', dob: '10/01/2008' },
  { orderNum: 10, name: 'Nguyễn Công Hòa', dob: '02/12/2008' },
  { orderNum: 11, name: 'Phạm Nhật Hoàng', dob: '18/04/2003' },
  { orderNum: 12, name: 'Lê Đặng Trung Kiên', dob: '30/11/2008' },
  { orderNum: 13, name: 'Nguyễn Nhật Anh Kiệt', dob: '27/06/2006' },
  { orderNum: 14, name: 'Cung Tuấn Kiệt', dob: '16/09/2008' },
  { orderNum: 15, name: 'Ngô Minh Long', dob: '04/10/2004' },
  { orderNum: 16, name: 'Nguyễn Đức Minh', dob: '26/05/2008' },
  { orderNum: 17, name: 'Nguyễn Xuân Minh', dob: '25/11/2007' },
  { orderNum: 18, name: 'Nguyễn Công Minh', dob: '19/07/2008' },
  { orderNum: 19, name: 'Trần Bảo Nam', dob: '12/11/2008' },
  { orderNum: 20, name: 'Trần Đức Phát', dob: '07/02/2008' },
  { orderNum: 21, name: 'Thân Văn Phong', dob: '11/04/1999' },
  { orderNum: 22, name: 'Nguyễn Hữu Quang', dob: '22/11/2004' },
  { orderNum: 23, name: 'Lê Văn Thắng', dob: '04/02/2008' },
  { orderNum: 24, name: 'Nguyễn Văn Thu', dob: '16/09/2004' },
  { orderNum: 25, name: 'Trần Quốc Triệu', dob: '15/11/2006' },
  { orderNum: 26, name: 'Nguyễn Đức Trung', dob: '25/07/2007' },
  { orderNum: 27, name: 'Nguyễn Đình Tuấn', dob: '19/03/2008' },
  { orderNum: 28, name: 'Phạm Xuân Tùng', dob: '05/04/2008' },
  { orderNum: 29, name: 'Hà Xuân Tùng', dob: '13/01/2001' },
  { orderNum: 30, name: 'Đàm Quốc Triệu', dob: '29/01/2004' },
  { orderNum: 31, name: 'Nguyễn Hữu Ngọc', dob: '20/02/2006' },
  { orderNum: 32, name: 'Hà Hải Nam', dob: '11/11/1111' },
  { orderNum: 33, name: 'Ngô Quang Đức', dob: '12/11/2006' },
];

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(Student)
    private studentRepo: Repository<Student>,
    @InjectRepository(Settings)
    private settingsRepo: Repository<Settings>,
  ) {}

  async onApplicationBootstrap() {
    await this.seedStudents();
    await this.seedSettings();
  }

  private async seedStudents() {
    for (const s of STUDENTS) {
      const exists = await this.studentRepo.findOne({
        where: { orderNum: s.orderNum },
      });
      if (!exists) {
        const student = this.studentRepo.create(s);
        await this.studentRepo.save(student);
        console.log(`✅ Seeded student #${s.orderNum}: ${s.name}`);
      } else {
        // Tự động đồng bộ và cập nhật lại Họ tên / Ngày sinh mới nhất
        if (exists.name !== s.name || exists.dob !== s.dob) {
          exists.name = s.name;
          exists.dob = s.dob;
          await this.studentRepo.save(exists);
          console.log(`🔄 Updated student #${s.orderNum}: ${s.name} (${s.dob})`);
        }
      }
    }
  }

  private async seedSettings() {
    const count = await this.settingsRepo.count();
    if (count > 0) return;

    const settings = this.settingsRepo.create({});
    await this.settingsRepo.save(settings);
    console.log('✅ Seeded default settings');
  }
}
