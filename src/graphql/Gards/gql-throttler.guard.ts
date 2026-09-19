import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { GqlExecutionContext } from '@nestjs/graphql';

@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  getRequestResponse(context: ExecutionContext) {
    const gqlCtx = GqlExecutionContext.create(context);
    const ctx = gqlCtx.getContext();                       // → { req, res } from our GraphQLModule context
    if (ctx?.req && ctx?.res) {
      return { req: ctx.req, res: ctx.res };               // GraphQL: use the real express req/res
    }
    const http = context.switchToHttp();                   // REST: standard behavior
    return { req: http.getRequest(), res: http.getResponse() };
  }
}