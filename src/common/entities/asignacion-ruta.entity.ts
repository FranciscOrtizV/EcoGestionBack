import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Unique, Index } from 'typeorm';
import { Ruta, Usuario, Vehiculo } from './index';
import { EstadoAsignacionRutaEnum, TurnoEnum } from '../enums';

@Entity('asignacion_rutas')
@Unique('uq_route_assignments_vehicle_date_shift', [
  'vehiculo',
  'fechaAsignacion',
  'turno',
])
@Unique('uq_route_assignments_driver_date_shift', [
  'conductor',
  'fechaAsignacion',
  'turno',
])
@Index('idx_asignacion_rutas_fecha', ['fechaAsignacion'])
@Index('idx_asignacion_rutas_estado', ['estado'])
@Index('idx_asignacion_rutas_turno', ['turno'])
export class AsignacionRuta {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Ruta, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'ruta_id' })
  ruta: Ruta;

  @ManyToOne(() => Vehiculo, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'vehiculo_id' })
  vehiculo: Vehiculo;

  @ManyToOne(() => Usuario, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'conductor_id' })
  conductor: Usuario;

  @ManyToOne(() => Usuario, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'planificador_id' })
  planificador: Usuario;

  @ManyToOne(() => Usuario, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'supervisor_id' })
  supervisor?: Usuario;

  @Column({
    name: 'fecha_asignacion',
    type: 'date',
  })
  fechaAsignacion: string;

  @Column({
    type: 'enum',
    enum: TurnoEnum,
  })
  turno: TurnoEnum;

  @Column({
    name: 'planificacion_tiempo_inicio',
    type: 'timestamp without time zone',
    nullable: true,
  })
  planificacionTiempoInicio?: Date;

  @Column({
    name: 'planificacion_tiempo_fin',
    type: 'timestamp without time zone',
    nullable: true,
  })
  planificacionTiempoFin?: Date;

  @Column({
    type: 'enum',
    enum: EstadoAsignacionRutaEnum,
    default: EstadoAsignacionRutaEnum.BORRADOR,
  })
  estado: EstadoAsignacionRutaEnum;

  @Column({
    type: 'text',
    nullable: true,
  })
  notas?: string;

  @Column({
    name: 'published_at',
    type: 'timestamp without time zone',
    nullable: true,
  })
  publishedAt?: Date;

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