<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * The API is only ever called server-to-server by the Next.js app, never by a
 * browser. This shared key keeps unauthenticated endpoints (login, password
 * reset) from being reachable by anything else on the network.
 */
class EnsureAppKey
{
    public function handle(Request $request, Closure $next): Response
    {
        $expected = (string) config('scm.app_key');

        if ($expected === '') {
            abort(500, 'APP_API_KEY is not configured');
        }

        $provided = (string) $request->header('X-App-Key', '');

        if (! hash_equals($expected, $provided)) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        return $next($request);
    }
}
