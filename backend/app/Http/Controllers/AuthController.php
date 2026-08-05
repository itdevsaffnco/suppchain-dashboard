<?php

namespace App\Http\Controllers;

use App\Models\PasswordReset;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    /** Minimum password length, mirrored by the frontend's validation. */
    private const MIN_PASSWORD = 6;

    /**
     * POST /api/auth/login — the identifier may be a username or an email.
     * Issues a Sanctum token the Next.js server keeps inside its session cookie.
     */
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'username' => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        $identifier = trim($data['username']);

        $user = User::whereRaw('LOWER(username) = ?', [mb_strtolower($identifier)])
            ->orWhereRaw('LOWER(email) = ?', [mb_strtolower($identifier)])
            ->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            return response()->json(['error' => 'login_error'], 401);
        }

        if (! $user->isActive()) {
            return response()->json(['error' => 'login_inactive'], 403);
        }

        // Each login gets its own token so signing in elsewhere doesn't end
        // this session; logout revokes only the token it was called with.
        $token = $user->createToken('dashboard')->plainTextToken;

        return response()->json([
            'user' => ['username' => $user->username, 'role' => $user->role],
            'token' => $token,
        ]);
    }

    /** POST /api/auth/logout — revokes the token used for this request. */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json(['ok' => true]);
    }

    /** GET /api/auth/me */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'user' => ['username' => $user->username, 'role' => $user->role],
        ]);
    }

    /** POST /api/auth/change-password */
    public function changePassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'currentPassword' => ['required', 'string'],
            'newPassword' => ['required', 'string'],
        ]);

        if (mb_strlen($data['newPassword']) < self::MIN_PASSWORD) {
            return response()->json(['error' => 'password_too_short'], 400);
        }

        $user = $request->user();

        if (! Hash::check($data['currentPassword'], $user->password)) {
            return response()->json(['error' => 'login_error'], 401);
        }

        $user->update(['password' => $data['newPassword']]);

        return response()->json(['ok' => true]);
    }

    /**
     * POST /api/auth/forgot-password — issues a reset token.
     *
     * Responds the same way whether or not the email exists so the endpoint
     * can't be used to enumerate accounts. The token is returned to the
     * Next.js server, which composes the link and sends the email; it is
     * never forwarded to the browser.
     */
    public function forgotPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'string'],
        ]);

        $user = User::whereRaw('LOWER(email) = ?', [mb_strtolower(trim($data['email']))])->first();

        if (! $user || ! $user->isActive()) {
            return response()->json(['ok' => true]);
        }

        return response()->json([
            'ok' => true,
            'token' => PasswordReset::issueFor($user),
            'email' => $user->email,
        ]);
    }

    /** GET /api/auth/reset-password?token=… — validates a link on page load. */
    public function checkResetToken(Request $request): JsonResponse
    {
        $reset = PasswordReset::findLive((string) $request->query('token', ''));

        if (! $reset) {
            return response()->json(['valid' => false], 400);
        }

        return response()->json(['valid' => true, 'username' => $reset->user->username]);
    }

    /** POST /api/auth/reset-password — consumes the token and sets the password. */
    public function resetPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
            'newPassword' => ['required', 'string'],
        ]);

        if (mb_strlen($data['newPassword']) < self::MIN_PASSWORD) {
            return response()->json(['error' => 'password_too_short'], 400);
        }

        $reset = PasswordReset::findLive($data['token']);

        if (! $reset) {
            return response()->json(['error' => 'reset_link_invalid'], 400);
        }

        $reset->user->update(['password' => $data['newPassword']]);
        $reset->update(['used_at' => now()]);

        // A password change invalidates every existing session for that user.
        $reset->user->tokens()->delete();

        return response()->json(['ok' => true]);
    }
}
