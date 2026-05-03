import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Check, Index } from 'typeorm';
import { EjecucionRuta, PuntoRutaEjecucion, TipoIncidencia, Usuario } from './index';
import { EstadoIncidenciaEnum, PrioridadIncidenciaEnum } from '../enums';

@Entity('incidencias')
@Check(
  'chk_incidents_at_least_one_context',
  `"ejecucion_ruta_id" IS NOT NULL OR "punto_ejecucion_ruta_id" IS NOT NULL`,
)
@Index('idx_incidencias_estado', ['estado'])
@Index('idx_incidencias_prioridad', ['prioridad'])
@Index('idx_incidencias_reported_at', ['reportedAt'])
export class Incidencia {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => TipoIncidencia, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'tipo_incidencia_id' })
  tipoIncidencia: TipoIncidencia;

  @ManyToOne(() => EjecucionRuta, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'ejecucion_ruta_id' })
  ejecucionRuta?: EjecucionRuta;

  @ManyToOne(() => PuntoRutaEjecucion, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'punto_ejecucion_ruta_id' })
  puntoEjecucionRuta?: PuntoRutaEjecucion;

  @ManyToOne(() => Usuario, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'reportado_por_usuario_id' })
  reportadoPorUsuario: Usuario;

  @ManyToOne(() => Usuario, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'asignado_a_usuario_id' })
  asignadoAUsuario?: Usuario;

  @Column({
    type: 'varchar',
    length: 200,
  })
  titulo: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  descripcion?: string;

  @Column({
    type: 'enum',
    enum: EstadoIncidenciaEnum,
    default: EstadoIncidenciaEnum.ABIERTA,
  })
  estado: EstadoIncidenciaEnum;

  @Column({
    type: 'enum',
    enum: PrioridadIncidenciaEnum,
    default: PrioridadIncidenciaEnum.MEDIA,
  })
  prioridad: PrioridadIncidenciaEnum;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 7,
    nullable: true,
  })
  latitud?: number;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 7,
    nullable: true,
  })
  longitud?: number;

  @CreateDateColumn({
    name: 'reported_at',
    type: 'timestamp without time zone',
  })
  reportedAt: Date;

  @Column({
    name: 'resolved_at',
    type: 'timestamp without time zone',
    nullable: true,
  })
  resolvedAt?: Date;

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