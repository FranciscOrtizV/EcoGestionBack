import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('rutas')
@Index('idx_rutas_active', ['isActive'])
export class Ruta {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 150,
  })
  nombre: string;

  @Column({
    type: 'varchar',
    length: 50,
    unique: true,
    nullable: true,
  })
  codigo?: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  descripcion?: string;

  @Column({
    name: 'tipo_ruta',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  tipoRuta?: string;

  @Column({
    name: 'estimacion_duracion_minutos',
    type: 'integer',
    nullable: true,
  })
  estimacionDuracionMinutos?: number;

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
