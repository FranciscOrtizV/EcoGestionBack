import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { UsuarioRol } from './index';

@Entity('roles')
export class Rol {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 50,
    unique: true,
  })
  nombre: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  descripcion?: string;

  @CreateDateColumn({
    type: 'timestamp without time zone',
    name: 'created_at',
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamp without time zone',
    name: 'updated_at',
  })
  updatedAt: Date;

  @OneToMany(() => UsuarioRol, (usuarioRol) => usuarioRol.rol)
  usuarioRoles: UsuarioRol[];
  
}