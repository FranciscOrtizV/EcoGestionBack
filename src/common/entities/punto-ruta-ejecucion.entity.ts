import { Entity, PrimaryGeneratedColumn, Column ,CreateDateColumn ,UpdateDateColumn, ManyToOne, JoinColumn, Unique, Index } from 'typeorm';
import { EjecucionRuta, PuntoRecoleccion, PuntoRuta } from './index';
import { EstadoEjecucionPuntoRutaEnum } from '../enums';


@Entity('punto_ruta_ejecucion')
@Unique('uq_route_point_executions_execution_route_point', [
  'ejecucionRuta',
  'puntoRuta',
])
@Index('idx_punto_ruta_ejecucion_ejecucion', ['ejecucionRuta'])
@Index('idx_punto_ruta_ejecucion_estado', ['estado'])
@Index('idx_punto_ruta_ejecucion_punto_recoleccion', ['puntoRecoleccion'])
export class PuntoRutaEjecucion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => EjecucionRuta, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'ejecucion_ruta_id' })
  ejecucionRuta: EjecucionRuta;

  @ManyToOne(() => PuntoRuta, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'punto_ruta_id' })
  puntoRuta: PuntoRuta;

  @ManyToOne(() => PuntoRecoleccion, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'punto_recoleccion_id' })
  puntoRecoleccion: PuntoRecoleccion;

  @Column({
    type: 'enum',
    enum: EstadoEjecucionPuntoRutaEnum,
    default: EstadoEjecucionPuntoRutaEnum.PENDIENTE,
  })
  estado: EstadoEjecucionPuntoRutaEnum;

  @Column({
    name: 'tiempo_chequeo',
    type: 'timestamp without time zone',
    nullable: true,
  })
  tiempoChequeo?: Date;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 7,
    nullable: true,
  })
  longitud?: number;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 7,
    nullable: true,
  })
  latitud?: number;

  @Column({
    type: 'text',
    nullable: true,
  })
  comentarios?: string;

  @Column({
    name: 'orden_secuencia',
    type: 'integer',
  })
  ordenSecuencia: number;

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