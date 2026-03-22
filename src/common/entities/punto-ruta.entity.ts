import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Unique, Index } from 'typeorm';
import { PuntoRecoleccion, Ruta } from './index';

@Entity('puntos_rutas')
@Unique('uq_route_points_route_sequence', ['ruta', 'ordenSecuencia'])
@Unique('uq_route_points_route_collection_point', ['ruta', 'puntoRecoleccion'])
@Index('idx_puntos_rutas_ruta', ['ruta'])
export class PuntoRuta {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Ruta, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'ruta_id' })
  ruta: Ruta;

  // 🔗 RELACIÓN CON PUNTO DE RECOLECCIÓN
  @ManyToOne(() => PuntoRecoleccion, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'punto_recoleccion_id' })
  puntoRecoleccion: PuntoRecoleccion;

  @Column({
    name: 'orden_secuencia',
    type: 'integer',
  })
  ordenSecuencia: number;

  @Column({
    name: 'estimacion_parada_minutos',
    type: 'integer',
    nullable: true,
  })
  estimacionParadaMinutos?: number;

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