import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { AsignacionRuta, Usuario } from './';
import { EstadoEjecucionRutaEnum } from '../enums';

@Entity('ejecucion_rutas')
@Unique('UQ_ejecucion_rutas_asignacion_ruta_id', ['asignacionRuta'])
@Index('idx_ejecucion_rutas_estado', ['estado'])
export class EjecucionRuta {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => AsignacionRuta, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'asignacion_ruta_id' })
  asignacionRuta: AsignacionRuta;

  @Column({
    name: 'tiempo_inicio',
    type: 'timestamp without time zone',
    nullable: true,
  })
  tiempoInicio?: Date;

  @Column({
    name: 'tiempo_fin',
    type: 'timestamp without time zone',
    nullable: true,
  })
  tiempoFin?: Date;

  @Column({
    type: 'enum',
    enum: EstadoEjecucionRutaEnum,
    default: EstadoEjecucionRutaEnum.NO_INICIADO,
  })
  estado: EstadoEjecucionRutaEnum;

  @ManyToOne(() => Usuario, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'iniciado_por_usuario_id' })
  iniciadoPorUsuario?: Usuario;

  @ManyToOne(() => Usuario, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'cerrado_por_usuario_id' })
  cerradoPorUsuario?: Usuario;

  @Column({
    name: 'latitud_inicio',
    type: 'numeric',
    precision: 10,
    scale: 7,
    nullable: true,
  })
  latitudInicio?: number;

  @Column({
    name: 'longitud_inicio',
    type: 'numeric',
    precision: 10,
    scale: 7,
    nullable: true,
  })
  longitudInicio?: number;

  @Column({
    name: 'latitud_fin',
    type: 'numeric',
    precision: 10,
    scale: 7,
    nullable: true,
  })
  latitudFin?: number;

  @Column({
    name: 'longitud_fin',
    type: 'numeric',
    precision: 10,
    scale: 7,
    nullable: true,
  })
  longitudFin?: number;

  @Column({
    name: 'odometro_inicio',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  odometroInicio?: number;

  @Column({
    name: 'odometro_fin',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  odometroFin?: number;

  @Column({
    name: 'notas_ejecucion',
    type: 'text',
    nullable: true,
  })
  notasEjecucion?: string;

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