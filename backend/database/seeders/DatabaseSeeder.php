<?php

namespace Database\Seeders;

use App\Models\Batch;
use App\Models\Category;
use App\Models\CategoryWeekly;
use App\Models\Sku;
use App\Models\SkuWeekly;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /** Mirrors the app's minimum password length (AuthController::MIN_PASSWORD). */
    private const MIN_SEED_PASSWORD = 8;

    /**
     * Seeds the dashboard's starting dataset.
     *
     * The payload in data/seed.json is generated verbatim from the frontend's
     * lib/dashboard.ts seed constants, so a freshly seeded database renders
     * exactly what the demo-mode dashboard used to show.
     */
    public function run(): void
    {
        $seed = $this->loadSeed();

        $this->seedUsers($seed['users']);
        $this->seedCategories($seed['categories']);
        $this->seedSkus($seed['skus']);
    }

    /**
     * @return array{users: array<int, array<string, mixed>>, categories: array<string, array<string, mixed>>, skus: array<int, array<string, mixed>>}
     */
    private function loadSeed(): array
    {
        $path = database_path('seeders/data/seed.json');

        if (! is_file($path)) {
            throw new \RuntimeException("Seed payload missing at {$path}");
        }

        return json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
    }

    /**
     * @param  array<int, array<string, mixed>>  $users
     */
    private function seedUsers(array $users): void
    {
        // Hashed lazily: re-seeding an existing install keeps every stored
        // password, so SEED_USER_PASSWORD is only required when this seeder
        // actually has to create a brand-new account.
        $defaultPassword = null;

        foreach ($users as $user) {
            $existingUser = User::where('username', $user['username'])->first();

            if (! $existingUser && $defaultPassword === null) {
                $defaultPassword = bcrypt($this->requireSeedPassword());
            }

            User::updateOrCreate(
                ['username' => $user['username']],
                [
                    'email' => $user['email'],
                    'role' => $user['role'],
                    'status' => $user['status'],
                    'password' => $existingUser ? $existingUser->password : $defaultPassword,
                ],
            );
        }
    }

    /**
     * There is deliberately no default password: a documented one would give
     * anyone who reads this repository a working login on every fresh install.
     */
    private function requireSeedPassword(): string
    {
        $password = (string) env('SEED_USER_PASSWORD', '');

        if (mb_strlen($password) < self::MIN_SEED_PASSWORD) {
            throw new \RuntimeException(
                'SEED_USER_PASSWORD must be set to at least '
                .self::MIN_SEED_PASSWORD
                .' characters before seeding new users.'
            );
        }

        return $password;
    }

    /**
     * @param  array<string, array{forecast: array<int, int>, realisasi: array<int, int>}>  $categories
     */
    private function seedCategories(array $categories): void
    {
        foreach ($categories as $name => $weekly) {
            $category = Category::firstOrCreate(['name' => $name]);

            for ($week = 1; $week <= Sku::WEEKS; $week++) {
                CategoryWeekly::updateOrCreate(
                    ['category_id' => $category->id, 'week' => $week],
                    [
                        'forecast' => $weekly['forecast'][$week - 1] ?? 0,
                        'realisasi' => $weekly['realisasi'][$week - 1] ?? 0,
                    ],
                );
            }
        }
    }

    /**
     * @param  array<int, array<string, mixed>>  $skus
     */
    private function seedSkus(array $skus): void
    {
        foreach ($skus as $row) {
            $category = Category::firstOrCreate(['name' => $row['cat']]);

            $sku = Sku::updateOrCreate(
                ['name' => $row['name']],
                [
                    'category_id' => $category->id,
                    'po' => $row['po'],
                    'safety' => $row['safety'],
                    'daily_demand' => $row['daily_demand'],
                    'tipe_stock' => $row['tipe_stock'],
                    'target_simpan' => $row['target_simpan'],
                ],
            );

            for ($week = 1; $week <= Sku::WEEKS; $week++) {
                SkuWeekly::updateOrCreate(
                    ['sku_id' => $sku->id, 'week' => $week],
                    [
                        'forecast' => $row['f_trend'][$week - 1] ?? 0,
                        'realization' => $row['r_trend'][$week - 1] ?? 0,
                    ],
                );
            }

            foreach ($row['batches'] as $batch) {
                Batch::updateOrCreate(
                    ['sku_id' => $sku->id, 'batch_code' => $batch['id']],
                    [
                        'date' => $batch['date'],
                        'qty_in' => $batch['qty_in'],
                        'qty_used' => $batch['qty_used'],
                        'sisa' => $batch['sisa'],
                    ],
                );
            }
        }
    }
}
