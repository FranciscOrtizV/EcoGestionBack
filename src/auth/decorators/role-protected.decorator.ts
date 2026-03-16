import { SetMetadata } from '@nestjs/common';
import { RolesValidosEnum } from 'src/common/enums';

export const META_ROLES = 'roles';

export const RoleProtected = (...args: RolesValidosEnum[]) => {
    return SetMetadata(META_ROLES, args);
}
