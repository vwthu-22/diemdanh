import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';

@Entity('students')
export class Student {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_num' })
  orderNum: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  dob: string;

  @Column({ name: 'device_id', nullable: true })
  deviceId?: string;

  @Column({ name: 'face_descriptor', type: 'text', nullable: true })
  faceDescriptor?: string | null; // JSON array of 128 floats from face-api.js

  // Ngày học sinh bắt đầu vào lớp / được thêm vào hệ thống (YYYY-MM-DD).
  // Các ngày trước mốc này sẽ KHÔNG bị tính vắng, hiển thị dấu "–" (Chưa vào lớp).
  @Column({ name: 'created_at', type: 'varchar', nullable: true })
  createdAt?: string;
}
