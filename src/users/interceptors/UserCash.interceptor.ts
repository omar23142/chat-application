import { CacheInterceptor } from "@nestjs/cache-manager";
import { ExecutionContext, Injectable } from "@nestjs/common";
import { CURENT_USER_KEY } from "src/utils/constants";

@Injectable()
export class UserCacheInterceptor extends CacheInterceptor {
  // دالة trackBy ترجع المفتاح فقط بشكل synchronous أو asynchronous
  public trackBy(context: ExecutionContext): string | undefined {
    const req = context.switchToHttp().getRequest();
    
    // استخراج معرّف المستخدم
    const userId = req[CURENT_USER_KEY]?.id;
    console.log('in the usercacheinterceptor trackBy');
    if (!userId) {
      return undefined; // لن يتم التخزين إذا لم يتوفر userId
    }

    // استخدام req.originalUrl أو req.url بحرف صغير
    const url = req.originalUrl || req.url;
    let key = `${url}:${userId}`
    console.log(key);
    // إرجاع المفتاح فقط! (NestJS سيتولى الـ get والـ set بنفسه)
    return key;
  }
}