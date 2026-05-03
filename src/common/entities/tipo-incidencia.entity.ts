import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('tipos_incidencia')
@Index('idx_tipos_incidencia_active', ['isActive'])
export class TipoIncidencia {
  /** Mayúsculas y espacios (incl. consecutivos) sustituidos por un guion bajo. */
  static normalizeNombre(value: string): string {
    return value.trim().toUpperCase().replace(/\s+/g, '_');
  }

  @BeforeInsert()
  applyNombreNormalizationInsert() {
    this.nombre = TipoIncidencia.normalizeNombre(this.nombre);
  }

  @BeforeUpdate()
  applyNombreNormalizationUpdate() {
    this.nombre = TipoIncidencia.normalizeNombre(this.nombre);
  }

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 100,
    unique: true,
  })
  nombre: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  descripcion?: string;

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