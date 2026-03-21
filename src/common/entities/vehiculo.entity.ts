import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { EstadoVehiculoEnum } from '../enums';

@Entity('vehiculos')
@Index('idx_vehiculos_estado', ['estado'])
@Index('idx_vehiculos_active', ['isActive'])
@Index('idx_vehiculos_estado_active', ['estado', 'isActive'])
export class Vehiculo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 20,
    unique: true,
  })
  patente: string;

  @Column({
    name: 'codigo_interno',
    type: 'varchar',
    length: 50,
    unique: true,
    nullable: true,
  })
  codigoInterno?: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  marca?: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  modelo?: string;

  @Column({
    name: 'año_vehiculo',
    type: 'integer',
    nullable: true,
  })
  anioVehiculo?: number;

  @Column({
    name: 'capacidad_kg',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  capacidadKg?: number;

  @Column({
    name: 'capacidad_m3',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  capacidadM3?: number;

  @Column({
    type: 'enum',
    enum: EstadoVehiculoEnum,
    default: EstadoVehiculoEnum.DISPONIBLE,
  })
  estado: EstadoVehiculoEnum;

  @Column({
    name: 'is_active',
    type: 'boolean',
    default: true,
  })
  isActive: boolean;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp without time zone',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp without time zone',
  })
  updatedAt: Date;
}