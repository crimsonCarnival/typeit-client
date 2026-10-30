import { HttpEvent, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ls } from '../utils/storage';
import { usageId as currentUsageId } from '../services/usage.service';

/**
 * Attaches the JWT from localStorage to every request, matching the React
 * wrapper's `Authorization: Bearer <token>` behavior, and the anonymous usage
 * id when usage statistics are on (the server counts runs where they happen).
 */
export const tokenInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn): Observable<HttpEvent<unknown>> => {
  const token = ls.get('token');
  const usageId = currentUsageId();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (usageId) headers['X-Usage-Id'] = usageId;
  if (token || usageId) req = req.clone({ setHeaders: headers });
  return next(req);
};
