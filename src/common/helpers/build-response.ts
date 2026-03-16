import { HttpStatus } from "@nestjs/common";
import { ResponseInterface } from "../interface/response.interface";

export const buildResponse = ( statusCode: HttpStatus, message: string, data: any = [] ): ResponseInterface => {
    return {
        statusCode,
        message,
        data
    };
};