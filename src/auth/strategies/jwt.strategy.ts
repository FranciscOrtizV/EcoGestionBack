import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { JwtPayload } from "../interfaces/jwt-payload.interface";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from '@nestjs/config';
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { Usuario } from "src/common/entities";

@Injectable()
export class JwtStrategy extends PassportStrategy( Strategy ){

    constructor(

        @InjectRepository(Usuario)
        private readonly usuarioRepository: Repository<Usuario>,

        configService: ConfigService

    ){

        super({
            secretOrKey: configService.get('JWT_SECRET')!,
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        });
    }

    async validate( payload: JwtPayload ){

        const { id } = payload;

        const user = await this.usuarioRepository.findOne({
            where: { id },
            relations: ['usuarioRoles', 'usuarioRoles.rol'],
        });

        if( !user )
            throw new UnauthorizedException('Token invalido');
        
        if( !user.isActive )
            throw new UnauthorizedException('Usuario inactivo');

        return user
    }

}