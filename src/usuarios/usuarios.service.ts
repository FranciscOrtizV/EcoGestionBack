import {
  BadRequestException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { CreateUsuarioDto, UpdateUsuarioDto } from './dto';
import { AuditoriaLog, Rol, Usuario, UsuarioRol } from 'src/common/entities';
import { buildResponse } from 'src/common/helpers';
import { AccionAuditoriaEnum, EntidadesEnum } from 'src/common/enums';


@Injectable()
export class UsuariosService {

  constructor(

    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,

    @InjectRepository(Rol)
    private readonly rolRepository: Repository<Rol>,

    @InjectRepository(UsuarioRol)
    private readonly usuarioRolRepository: Repository<UsuarioRol>,

    @InjectRepository(AuditoriaLog)
    private readonly auditoriaLogRepository: Repository<AuditoriaLog>,

    private readonly dataSource: DataSource,

  ){}

  async create(createUsuarioDto: CreateUsuarioDto, user: Usuario) {

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { rolesIds, password, ...usuarioData } = createUsuarioDto;

      // 1. Verificar si existe un usuario con el correo indicado
      const usuarioExistente = await this.usuarioRepository.findOneBy({email: usuarioData.email});

      if (usuarioExistente) 
        return buildResponse(HttpStatus.CONFLICT, `Ya existe un usuario registrado con el email: ${usuarioData.email}.`);

      // 2. Verificar si existen los roles indicados.
      if (!rolesIds || rolesIds.length === 0) {
        return buildResponse(HttpStatus.BAD_REQUEST, 'Debe indicar al menos un rol para el usuario.');
      }

      const roles = await this.rolRepository.find({ where: { id: In(rolesIds) }});

      if (roles.length !== rolesIds.length) {
        const encontradosIds = roles.map((r) => r.id);
        const faltantes = rolesIds.filter((id) => !encontradosIds.includes(id));

        return buildResponse(HttpStatus.NOT_FOUND, `No se encontraron los siguientes roles: ${faltantes.join(', ')}`);
      }

      // 3. Crear el usuario (encriptando contraseña)
      const nuevoUsuario = this.usuarioRepository.create({
        ...usuarioData,
        password: bcrypt.hashSync(password, 10),
        createdAt: new Date(),
      });

      await queryRunner.manager.save(nuevoUsuario);

      // 4. Crear la relacion del usuario con los roles
      const relaciones = roles.map((rol) =>
        this.usuarioRolRepository.create({
          usuario: nuevoUsuario,
          rol,
          createdAt: new Date(),
        }),
      );
      await queryRunner.manager.save(relaciones);

      // 5. Crear registro en tablas de auditoria.
      const registroAuditoria = this.auditoriaLogRepository.create({
        usuario: user,
        nombreEntidad: EntidadesEnum.USUARIOS,
        accion: AccionAuditoriaEnum.CREATE,
        valorNuevo: nuevoUsuario,
        createdAt: new Date(),
      });

      const registrosAuditoriaRelaciones = relaciones.map( rel => 
        this.auditoriaLogRepository.create({
          usuario: user,
          nombreEntidad: EntidadesEnum.USUARIO_ROLES,
          accion: AccionAuditoriaEnum.CREATE,
          valorNuevo: rel,
          createdAt: new Date(),
        })
      )
      
      await queryRunner.manager.save(registroAuditoria);
      await queryRunner.manager.save(registrosAuditoriaRelaciones);

      await queryRunner.commitTransaction();
      await queryRunner.release();

      const { password: _pass, ...usuarioSinPassword } = nuevoUsuario;

      return buildResponse(
        HttpStatus.CREATED,
        'Usuario creado correctamente',
        {
          ...usuarioSinPassword,
          roles: roles.map((rol) => ({
            id: rol.id,
            nombre: rol.nombre,
          })),
        },
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release()
      console.log(error);
      this.handleDbErrors(error);
    }
  }

  async findAll() {
    const usuarios = await this.usuarioRepository.find({
      relations: ['usuarioRoles', 'usuarioRoles.rol'],
      withDeleted: true,
      order: { createdAt: 'DESC' }
    });


    const data = usuarios.map((usuario) => {
      const { password, usuarioRoles, ...resto } = usuario;
      return {
        ...resto,
        roles: (usuarioRoles || []).map((ur) => ({
          id: ur.rol.id, 
          nombre: ur.rol.nombre,
        })),
      };
    });

    return buildResponse(HttpStatus.OK, 'Listado de usuarios obtenido correctamente', data);
  }

  async findAllRoles() {
    const roles = await this.rolRepository.find({
      order: { nombre: 'ASC' },
    });

    return buildResponse(
      HttpStatus.OK,
      'Listado de roles obtenido correctamente',
      roles,
    );
  }

  async findOne(id: string) {
    const usuario = await this.usuarioRepository.findOne({
      where: { id },
      relations: ['usuarioRoles', 'usuarioRoles.rol'],
      withDeleted: true
    });

    if (!usuario)
      throw new NotFoundException(`No se encontró un usuario con id: ${id}`);

    const { password, usuarioRoles, ...resto } = usuario;

    return buildResponse(
      HttpStatus.OK,
      'Usuario obtenido correctamente',
      {
        ...resto,
        roles: (usuarioRoles || []).map((ur) => ({
          id: ur.rol.id,
          nombre: ur.rol.nombre,
        })),
      },
    );
  }
  
  async update(id: string, updateUsuarioDto: UpdateUsuarioDto, user: Usuario) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const usuario = await queryRunner.manager.findOne(Usuario, {
        where: { id },
      });

      if (!usuario) 
        throw new NotFoundException(`No se encontró un usuario con id: ${id}`);

      // Snapshot ANTES (sin password)
      const { password, ...usuarioPlanoAntes } = usuario;

      const { rolesIds, password: newPassword, email, ...restoDto } = updateUsuarioDto;

      // 1. Si viene email, verificar que no esté usado por otro usuario
      if (email && email !== usuario.email) {
        const existeEmail = await this.usuarioRepository.findOne({where: { email }, withDeleted: true});

        if (existeEmail && existeEmail.id !== usuario.id)
          return buildResponse(HttpStatus.CONFLICT, `Ya existe un usuario registrado con el email: ${email}.`,);

        usuario.email = email;
      }

      // 2. Actualizar campos simples si vienen en el DTO
      Object.assign(usuario, restoDto);

      // 3. Actualizar contraseña si viene
      if (newPassword)
        usuario.password = bcrypt.hashSync(newPassword, 10);

      // 4. Actualizar roles si viene rolesIds
      if (rolesIds) {
        if (!Array.isArray(rolesIds) || rolesIds.length === 0) 
          return buildResponse(HttpStatus.BAD_REQUEST, 'Debe indicar al menos un rol para el usuario.');

        const roles = await this.rolRepository.find({
          where: { id: In(rolesIds) },
        });

        if (roles.length !== rolesIds.length) {
          const encontradosIds = roles.map((r) => r.id);
          const faltantes = rolesIds.filter(
            (idRol) => !encontradosIds.includes(idRol),
          );

          return buildResponse(HttpStatus.NOT_FOUND, `No se encontraron los siguientes roles: ${faltantes.join(', ')}`);
        }

        // Eliminar relaciones actuales y crear las nuevas
        await queryRunner.manager
          .createQueryBuilder()
          .delete()
          .from(UsuarioRol)
          .where('usuario_id = :id', { id: usuario.id })
          .execute();

        const nuevasRelaciones = roles.map((rol) =>
          this.usuarioRolRepository.create({
            usuario,
            rol,
            createdAt: new Date(),
          }),
        );

        await queryRunner.manager.save(nuevasRelaciones);
      }
      
      usuario.updatedAt = new Date();
      await queryRunner.manager.save(usuario);

      // Snapshot DESPUÉS (sin password)
      const { password: _pass2, ...usuarioPlanoDespues } = usuario;

      const registroAuditoria = this.auditoriaLogRepository.create({
        usuario: user,
        nombreEntidad: EntidadesEnum.USUARIOS,
        accion: AccionAuditoriaEnum.UPDATE,
        valorAntiguo: usuarioPlanoAntes,
        valorNuevo: usuarioPlanoDespues,
        createdAt: new Date(),
      });

      await queryRunner.manager.save(registroAuditoria);

      await queryRunner.commitTransaction();
      await queryRunner.release();

      return buildResponse( HttpStatus.OK, 'Usuario actualizado correctamente', { id }, );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      console.log(error);
      this.handleDbErrors(error);
    }
  }

  async remove(id: string, user: Usuario) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const usuario = await queryRunner.manager.findOne(Usuario, {where: { id, isActive: true }});

      if (!usuario)
        return buildResponse(HttpStatus.NO_CONTENT, `No se encontro un usuario activo con el id ${id}`, { id } );

      // Snapshot ANTES de los cambios (sin password ni relaciones)
      const { password, usuarioRoles, ...usuarioPlanoAntes } = usuario;

      // 1. Marcar como inactivo
      usuario.isActive = false;
      await queryRunner.manager.save(usuario);

      // 2. Hacer softDelete.
      await queryRunner.manager.softDelete(Usuario, id);

      // Snapshot DESPUÉS de los cambios
      const { password: _pass2, usuarioRoles: _ur2, ...usuarioPlanoDespues } = usuario;

      const registroAuditoria = this.auditoriaLogRepository.create({
        usuario: user,
        nombreEntidad: EntidadesEnum.USUARIOS,
        accion: AccionAuditoriaEnum.DELETE,
        valorAntiguo: usuarioPlanoAntes,
        valorNuevo: usuarioPlanoDespues,
        createdAt: new Date(),
      });

      await queryRunner.manager.save(registroAuditoria);

      await queryRunner.commitTransaction();
      await queryRunner.release();

      return buildResponse(HttpStatus.OK, 'Usuario eliminado correctamente', { id } );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      this.handleDbErrors(error);
    }
  }

  async rehabilitar(id: string, user: Usuario) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const usuario = await queryRunner.manager.findOne(Usuario, {
        where: { id },
        withDeleted: true,
      });

      if (!usuario)
        return buildResponse(HttpStatus.NO_CONTENT, `No se encontro un usuario inactivo con el id ${id}`, { id } );

      // Snapshot ANTES de los cambios (sin password ni relaciones)
      const { password, usuarioRoles, ...usuarioPlanoAntes } = usuario;

      // 1. Marcar como activo
      usuario.isActive = true;
      await queryRunner.manager.save(usuario);

      // 2. Restaurar el softDelete (eliminar deletedAt)
      await queryRunner.manager.restore(Usuario, id);

      // Snapshot DESPUÉS de los cambios
      const { password: _pass2, usuarioRoles: _ur2, ...usuarioPlanoDespues } = usuario;

      const registroAuditoria = this.auditoriaLogRepository.create({
        usuario: user,
        nombreEntidad: EntidadesEnum.USUARIOS,
        accion: AccionAuditoriaEnum.UPDATE,
        valorAntiguo: usuarioPlanoAntes,
        valorNuevo: usuarioPlanoDespues,
        createdAt: new Date(),
      });

      await queryRunner.manager.save(registroAuditoria);

      await queryRunner.commitTransaction();
      await queryRunner.release();

      return buildResponse(HttpStatus.OK, 'Usuario rehabilitado correctamente', { id });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      this.handleDbErrors(error);
    }
  }

  private handleDbErrors(error: any): never {
    if (error.code === '23505') 
      throw new BadRequestException(error.detail);

    console.log(error);

    throw new InternalServerErrorException('Ocurrió un error inesperado');
  }
}
