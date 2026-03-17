import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Usuario } from './usuarios.entity';
import { AccionAuditoriaEnum } from '../enums';


@Entity('auditoria_logs')
export class AuditoriaLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Usuario, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'usuario_id' })
  usuario?: Usuario;

  @Column({
    name: 'nombre_entidad',
    type: 'varchar',
    length: 100,
  })
  nombreEntidad: string;

  @Column({
    type: 'enum',
    enum: [
      AccionAuditoriaEnum.CREATE,
      AccionAuditoriaEnum.UPDATE,
      AccionAuditoriaEnum.DELETE,
      AccionAuditoriaEnum.LOGIN,
      AccionAuditoriaEnum.LOGOUT,
      AccionAuditoriaEnum.START_ROUTE,
      AccionAuditoriaEnum.CLOSE_ROUTE,
      AccionAuditoriaEnum.CHECK_IN,
      AccionAuditoriaEnum.REPORT_INCIDENT,
    ], // ajusta según tu enum real
  })
  accion: string;

  @Column({
    name: 'valor_antiguo',
    type: 'jsonb',
    nullable: true,
  })
  valorAntiguo?: Record<string, any>;

  @Column({
    name: 'valor_nuevo',
    type: 'jsonb',
    nullable: true,
  })
  valorNuevo?: Record<string, any>;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp without time zone',
  })
  createdAt: Date;
}