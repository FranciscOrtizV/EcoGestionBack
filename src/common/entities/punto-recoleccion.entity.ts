import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Zona } from './index';
import { TipoPuntoColeccionEnum } from '../enums';

@Entity('puntos_recoleccion')
export class PuntoRecoleccion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Zona, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'zona_id' })
  zona: Zona;

  @Column({
    type: 'varchar',
    length: 150,
  })
  nombre: string;

  @Column({
    type: 'varchar',
    length: 255,
  })
  direccion: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  referencia?: string;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 7,
  })
  latitud: number;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 7,
  })
  longitud: number;

  @Column({
    name: 'tipo_punto',
    type: 'enum',
    enum: TipoPuntoColeccionEnum,
    default: TipoPuntoColeccionEnum.DOMICILIARIO,
  })
  tipoPunto: TipoPuntoColeccionEnum;

  @Column({
    type: 'smallint',
    nullable: true,
  })
  prioridad?: number;

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