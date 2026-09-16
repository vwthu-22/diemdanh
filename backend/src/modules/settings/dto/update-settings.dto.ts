import { IsOptional, IsNumber, IsString, Min, Max, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateSettingsDto {
  @IsOptional()
  id?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  schoolLat?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  schoolLng?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(200)
  @Type(() => Number)
  radiusMeters?: number;

  @IsOptional()
  @IsString()
  morningStart?: string;

  @IsOptional()
  @IsString()
  morningOnTimeEnd?: string;

  @IsOptional()
  @IsString()
  morningLateEnd?: string;

  @IsOptional()
  @IsString()
  afternoonStart?: string;

  @IsOptional()
  @IsString()
  afternoonOnTimeEnd?: string;

  @IsOptional()
  @IsString()
  afternoonLateEnd?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsObject()
  schedule?: Record<string, string[]>;
}
