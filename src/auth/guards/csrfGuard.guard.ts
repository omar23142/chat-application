import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import {validateRequest} from 'src/utils/csrf.utiles';

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    // console.log(req);
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;

    const cookie = req.cookies['csrfToken'] || req.headers['csrfToken'];
    const header = req.headers['x-csrf-token'];
    console.log('in the csrfguard', cookie,header);
     console.log('csrf from cookie', req.cookies['csrfToken'] );
    console.log('x-csrf-token', req.headers['x-csrf-token']);
    console.log('RefreshToken from cookie', req.cookies['RefreshToken'] )
     if (!cookie || !header || cookie !== header) {
      throw new ForbiddenException('Invalid CSRF token');
    }
    return true;
    // use the csrf-csrf library if the backend and frontend is not in the same domain
    // validateRequest تتأكد من مطابقة الهيدر x-csrf-token مع الكوكي المخزن
    // const isValid = validateRequest(req);
    
    // if (!isValid) {
    //   throw new ForbiddenException('Invalid or missing CSRF token');
    // }
    
    // return true;


  }
}