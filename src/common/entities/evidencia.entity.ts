import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Check,
  Index,
} from 'typeorm';
import { EjecucionRuta, Incidencia, PuntoRutaEjecucion, Usuario } from './index';


@Entity('evidencia')
@Check(
  'chk_evidences_at_least_one_context',
  `"ejecucion_ruta_id" IS NOT NULL OR "punto_ejecucion_ruta_id" IS NOT NULL OR "incidencia_id" IS NOT NULL`,
)
@Index('idx_evidencia_ejecucion_ruta', ['ejecucionRuta'])
@Index('idx_evidencia_punto_ejecucion_ruta', ['puntoEjecucionRuta'])
@Index('idx_evidencia_incidencia', ['incidencia'])
@Index('idx_evidencia_subido_por', ['subidoPorUsuario'])
export class Evidencia {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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

  @ManyToOne(() => Incidencia, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'incidencia_id' })
  incidencia?: Incidencia;

  @ManyToOne(() => Usuario, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'subido_por_usuario_id' })
  subidoPorUsuario: Usuario;

  @Column({
    name: 'file_url',
    type: 'text',
  })
  fileUrl: string;

  @Column({
    name: 'file_name',
    type: 'varchar',
    length: 255,
  })
  fileName: string;

  @Column({
    name: 'mime_type',
    type: 'varchar',
    length: 100,
  })
  mimeType: string;

  @Column({
    name: 'file_size_bytes',
    type: 'bigint',
    nullable: true,
  })
  fileSizeBytes?: string;

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

  @Column({
    name: 'taken_at',
    type: 'timestamp without time zone',
    nullable: true,
  })
  takenAt?: Date;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp without time zone',
  })
  createdAt: Date;
}