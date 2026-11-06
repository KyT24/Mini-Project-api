import { SignOptions, decode, sign, verify } from "jsonwebtoken";

export class Jwt {
    static async generate(payload: any, secretKey: string, options: SignOptions){
        return sign(payload, secretKey, options); 
    }

    static async verify(token: string, secretKey: string){
        return verify(token, secretKey); 
    }

    static decode(token: string){
        return decode(token);
    }
}
