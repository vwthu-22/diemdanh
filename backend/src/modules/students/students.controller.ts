import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  Header,
} from '@nestjs/common';
import { StudentsService } from './students.service';

@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  @Header('Pragma', 'no-cache')
  findAll() {
    return this.studentsService.findAll();
  }

  @Get('faces')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  getAllWithFaceDescriptor() {
    return this.studentsService.getAllWithFaceDescriptor();
  }

  @Post()
  create(@Body() body: { name: string; dob?: string; orderNum?: number }) {
    return this.studentsService.create(body);
  }

  @Post('reorder')
  reorder() {
    return this.studentsService.reorderAll();
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Partial<{ name: string; dob: string; orderNum: number }>,
  ) {
    return this.studentsService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.studentsService.remove(id);
  }

  /** Đăng ký / cập nhật khuôn mặt cho sinh viên */
  @Put(':id/face-descriptor')
  saveFaceDescriptor(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { descriptor: number[] },
  ) {
    return this.studentsService.saveFaceDescriptor(id, body.descriptor);
  }

  /** Hủy đăng ký khuôn mặt của sinh viên */
  @Delete(':id/face-descriptor')
  removeFaceDescriptor(@Param('id', ParseIntPipe) id: number) {
    return this.studentsService.removeFaceDescriptor(id);
  }
}
