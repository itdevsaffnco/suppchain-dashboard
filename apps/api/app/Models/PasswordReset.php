<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

#[Fillable(['user_id', 'token_hash', 'expires_at', 'used_at'])]
class PasswordReset extends Model
{
    /** How long a reset link stays valid. */
    public const TTL_MINUTES = 30;

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'used_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public static function hashToken(string $token): string
    {
        return hash('sha256', $token);
    }

    /**
     * Issues a single-use reset token, invalidating any outstanding ones.
     * Returns the plaintext token — only ever stored hashed.
     */
    public static function issueFor(User $user): string
    {
        static::where('user_id', $user->id)->whereNull('used_at')->delete();

        $token = Str::random(64);
        static::create([
            'user_id' => $user->id,
            'token_hash' => static::hashToken($token),
            'expires_at' => Carbon::now()->addMinutes(static::TTL_MINUTES),
        ]);

        return $token;
    }

    /** Looks up a live (unused, unexpired) reset record for a plaintext token. */
    public static function findLive(string $token): ?self
    {
        return static::with('user')
            ->where('token_hash', static::hashToken($token))
            ->whereNull('used_at')
            ->where('expires_at', '>', Carbon::now())
            ->first();
    }
}
