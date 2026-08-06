<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class UserController extends Controller
{
    private const MIN_PASSWORD = 6;

    /** GET /api/users */
    public function index(): JsonResponse
    {
        return response()->json([
            'users' => User::orderBy('id')->get()->map(fn (User $u) => $u->toDashboardArray())->all(),
        ]);
    }

    /** POST /api/users */
    public function store(Request $request): JsonResponse
    {
        try {
            $data = $request->validate([
                'username' => ['required', 'string'],
                'email' => ['required', 'string'],
                'password' => ['required', 'string'],
                'role' => ['nullable', 'string'],
            ]);
        } catch (ValidationException) {
            return response()->json(['error' => 'missing_fields'], 400);
        }

        $username = trim($data['username']);
        $email = trim($data['email']);

        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return response()->json(['error' => 'email_invalid'], 400);
        }

        if (mb_strlen($data['password']) < self::MIN_PASSWORD) {
            return response()->json(['error' => 'password_too_short'], 400);
        }

        $exists = User::whereRaw('LOWER(username) = ?', [mb_strtolower($username)])
            ->orWhereRaw('LOWER(email) = ?', [mb_strtolower($email)])
            ->exists();

        if ($exists) {
            return response()->json(['error' => 'user_exists'], 409);
        }

        $user = User::create([
            'username' => $username,
            'email' => $email,
            'password' => $data['password'],
            // Role is whitelisted, never taken verbatim from the request.
            'role' => ($data['role'] ?? null) === 'Admin' ? 'Admin' : 'User',
            'status' => 'Active',
        ]);

        return response()->json(['user' => $user->toDashboardArray()]);
    }

    /** PATCH /api/users/{id} */
    public function update(Request $request, int $id): JsonResponse
    {
        $user = User::find($id);

        if (! $user) {
            return response()->json(['error' => 'user_not_found'], 404);
        }

        try {
            $data = $request->validate([
                'username' => ['required', 'string'],
                'email' => ['required', 'string'],
                'role' => ['nullable', 'string'],
                'password' => ['nullable', 'string'],
            ]);
        } catch (ValidationException) {
            return response()->json(['error' => 'missing_fields'], 400);
        }

        $username = trim($data['username']);
        $email = trim($data['email']);

        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return response()->json(['error' => 'email_invalid'], 400);
        }

        if (isset($data['password']) && mb_strlen($data['password']) < self::MIN_PASSWORD) {
            return response()->json(['error' => 'password_too_short'], 400);
        }

        // Check if username/email already taken by another user
        $exists = User::where('id', '!=', $id)
            ->where(function ($q) use ($username, $email) {
                $q->whereRaw('LOWER(username) = ?', [mb_strtolower($username)])
                    ->orWhereRaw('LOWER(email) = ?', [mb_strtolower($email)]);
            })
            ->exists();

        if ($exists) {
            return response()->json(['error' => 'user_exists'], 409);
        }

        $user->username = $username;
        $user->email = $email;
        $user->role = ($data['role'] ?? null) === 'Admin' ? 'Admin' : 'User';

        if (isset($data['password'])) {
            $user->password = $data['password'];
        }

        $user->save();

        return response()->json(['user' => $user->toDashboardArray()]);
    }

    /** DELETE /api/users/{id} */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = User::find($id);

        if (! $user) {
            return response()->json(['error' => 'user_not_found'], 404);
        }

        if ($user->id === $request->user()->id) {
            return response()->json(['error' => 'cannot_delete_self'], 400);
        }

        $user->delete();

        return response()->json(['ok' => true]);
    }
}
