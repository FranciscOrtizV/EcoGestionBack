import { BadRequestException, CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from "@nestjs/core";
import { Observable } from "rxjs";
import { META_ROLES } from '../decorators/role-protected.decorator';

@Injectable()
export class UserRoleGuard implements CanActivate {

    constructor(
        private readonly reflector: Reflector
    ){}

    canActivate(
        context: ExecutionContext
    ): boolean | Promise<boolean> | Observable<boolean>{
        
        const validRoles: string[] = this.reflector.get(META_ROLES, context.getHandler());

        if( !validRoles ) return true;
        if( validRoles.length === 0 ) return true;
        
        const req = context.switchToHttp().getRequest();
        const user = req.user;

        if( !user )
            throw new BadRequestException('User not found');

        for (const userRol of user.usuarioRoles) {
            if( validRoles.includes( userRol?.rol?.nombre  ) ){
                return true;
            };
        };
        
        throw new ForbiddenException(`El usuario ${user.nombre} ${user.apellidoPaterno}, no tiene un rol valido`);
    }

}